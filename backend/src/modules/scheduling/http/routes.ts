import { Router, type Request } from "express";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { pool } from "../../../database/pool.js";
import { requireAuth, requireRoles } from "../../../middleware/auth.js";
import { requireTenantSystem } from "../../../middleware/systems.js";
import { AppError, asyncHandler, validate } from "../../../shared/http.js";
import { databaseDate, expandTemplateEntries, generateScheduleDates, validateRegattaDates, wouldCreateTaxonomyCycle } from "../domain.js";

const router = Router();
const statusSchema = z.enum(["active", "archived"]);
const idList = z.array(z.number().int().positive()).default([]);

const taxonomySchema = z.object({
  name: z.string().trim().min(2).max(190),
  description: z.string().trim().max(5000).nullable().optional(),
  parentId: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
  status: statusSchema.default("active")
});
const slotSchema = z.object({
  name: z.string().trim().min(2).max(120),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
  status: statusSchema.default("active")
});
const sessionSchema = z.object({
  name: z.string().trim().min(2).max(190),
  taxonomyNodeId: z.number().int().positive(),
  durationMinutes: z.number().int().positive().max(1440).nullable().optional(),
  objective: z.string().max(10000).nullable().optional(),
  instructions: z.string().max(30000).nullable().optional(),
  intensity: z.string().max(80).nullable().optional(),
  location: z.string().max(190).nullable().optional(),
  equipment: z.string().max(10000).nullable().optional(),
  staffNotes: z.string().max(10000).nullable().optional(),
  status: statusSchema.default("active")
});
const weekEntrySchema = z.object({
  weekday: z.number().int().min(1).max(7),
  slotId: z.number().int().positive(),
  sessionTemplateId: z.number().int().positive()
});
const weekSchema = z.object({
  name: z.string().trim().min(2).max(190),
  description: z.string().max(5000).nullable().optional(),
  status: statusSchema.default("active"),
  entries: z.array(weekEntrySchema).default([])
});
const planSchema = z.object({
  name: z.string().trim().min(2).max(190),
  mode: z.enum(["day", "week", "range"]),
  startDate: z.string(),
  endDate: z.string(),
  weekTemplateId: z.number().int().positive().nullable().optional(),
  entries: z.array(weekEntrySchema).default([]),
  groupIds: idList,
  memberIds: idList,
  regattaIds: idList
});
const regattaSchema = z.object({
  regattaName: z.string().trim().min(2).max(190),
  startDate: z.string(),
  endDate: z.string()
});
const regattaEndDateSchema = z.object({ endDate: z.string() });

function tenantId(request: Request) {
  if (!request.user?.clientId) throw new AppError(403, "Scheduling is only available inside a tenant");
  return request.user.clientId;
}

function jsonDatabaseValue(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

async function assertTenantResource(connection: PoolConnection | typeof pool, table: string, id: number, clientId: number, active = false) {
  const allowed = new Set(["schedule_taxonomy_nodes", "schedule_day_slots", "schedule_session_templates", "schedule_week_templates", "member_groups", "users"]);
  if (!allowed.has(table)) throw new AppError(500, "Invalid scheduling resource");
  const statusClause = active && table !== "users" ? " AND status = 'active'" : active ? " AND status = 'active'" : "";
  const [rows] = await connection.query<RowDataPacket[]>(`SELECT id FROM ${table} WHERE id = :id AND client_id = :clientId${statusClause} LIMIT 1`, { id, clientId });
  if (!rows[0]) throw new AppError(422, "Selected scheduling resource is unavailable");
}

async function assertTenantRegattas(connection: PoolConnection, regattaIds: number[], clientId: number) {
  for (const regattaId of new Set(regattaIds)) {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM regattas WHERE id = :regattaId AND client_id = :clientId LIMIT 1",
      { regattaId, clientId }
    );
    if (!rows[0]) throw new AppError(422, "Selected regatta is unavailable");
  }
}

async function taxonomyPath(connection: PoolConnection, nodeId: number, clientId: number) {
  const [rows] = await connection.query<RowDataPacket[]>(
    `WITH RECURSIVE ancestors AS (
       SELECT id, parent_id, name, 0 AS depth FROM schedule_taxonomy_nodes WHERE id = :nodeId AND client_id = :clientId
       UNION ALL
       SELECT parent.id, parent.parent_id, parent.name, child.depth + 1
       FROM schedule_taxonomy_nodes parent INNER JOIN ancestors child ON child.parent_id = parent.id
       WHERE parent.client_id = :clientId
     ) SELECT name FROM ancestors ORDER BY depth DESC`,
    { nodeId, clientId }
  );
  if (!rows.length) throw new AppError(422, "Session taxonomy path is unavailable");
  return rows.map((row) => String(row.name));
}

async function replaceWeekEntries(connection: PoolConnection, weekId: number, clientId: number, entries: z.infer<typeof weekEntrySchema>[]) {
  const cells = new Set<string>();
  for (const entry of entries) {
    const cell = `${entry.weekday}:${entry.slotId}`;
    if (cells.has(cell)) throw new AppError(422, "A week-template cell can contain only one session");
    cells.add(cell);
    await assertTenantResource(connection, "schedule_day_slots", entry.slotId, clientId, true);
    await assertTenantResource(connection, "schedule_session_templates", entry.sessionTemplateId, clientId, true);
  }
  await connection.query("DELETE FROM schedule_week_template_entries WHERE week_template_id = :weekId", { weekId });
  for (const entry of entries) {
    await connection.query(
      "INSERT INTO schedule_week_template_entries (week_template_id, weekday, slot_id, session_template_id) VALUES (:weekId, :weekday, :slotId, :sessionTemplateId)",
      { weekId, ...entry }
    );
  }
}

router.use(requireAuth, requireTenantSystem("scheduling"));

router.get("/regattas", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request);
  const [regattas] = await pool.query(
    `SELECT regatta.id AS regattaId, regatta.name AS regattaName, regatta.start_date AS startDate, regatta.end_date AS endDate,
     regatta.created_by_user_id AS createdBy, regatta.created_at AS createdDate, regatta.modified_by_user_id AS modifiedBy,
     regatta.modified_at AS modifiedDate
     FROM regattas regatta WHERE regatta.client_id = :clientId ORDER BY regatta.start_date, regatta.end_date, regatta.id`,
    { clientId }
  );
  response.json({ regattas });
}));

router.post("/regattas", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request);
  const body = validate(regattaSchema, request.body);
  const dates = validateRegattaDates(body.startDate, body.endDate);
  const connection = await pool.getConnection();
  try {
    // Serializable range locking prevents two concurrent requests from inserting overlapping regattas.
    await connection.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await connection.beginTransaction();
    const [overlaps] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM regattas WHERE client_id = :clientId AND start_date <= :endDate AND end_date >= :startDate FOR UPDATE`,
      { clientId, ...dates }
    );
    if (overlaps[0]) throw new AppError(409, "A regatta already occupies part of this date range");
    const [result] = await connection.query(
      `INSERT INTO regattas (client_id, name, start_date, end_date, created_by_user_id, modified_by_user_id)
       VALUES (:clientId, :regattaName, :startDate, :endDate, :userId, :userId)`,
      { clientId, regattaName: body.regattaName, ...dates, userId: request.user!.id }
    );
    await connection.commit();
    response.status(201).json({ regattaId: (result as { insertId: number }).insertId });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.patch("/regattas/:id/end-date", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request);
  const regattaId = Number(request.params.id);
  if (!Number.isSafeInteger(regattaId) || regattaId <= 0) throw new AppError(422, "Invalid regatta id");
  const body = validate(regattaEndDateSchema, request.body);
  const connection = await pool.getConnection();
  try {
    await connection.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await connection.beginTransaction();
    const [existing] = await connection.query<RowDataPacket[]>(
      "SELECT start_date AS startDate FROM regattas WHERE id = :regattaId AND client_id = :clientId FOR UPDATE",
      { regattaId, clientId }
    );
    if (!existing[0]) throw new AppError(404, "Regatta not found");
    const dates = validateRegattaDates(databaseDate(existing[0].startDate as string | Date), body.endDate);
    const [overlaps] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM regattas WHERE client_id = :clientId AND id <> :regattaId
       AND start_date <= :endDate AND end_date >= :startDate FOR UPDATE`,
      { clientId, regattaId, ...dates }
    );
    if (overlaps[0]) throw new AppError(409, "A regatta already occupies part of this date range");
    await connection.query(
      "UPDATE regattas SET end_date = :endDate, modified_by_user_id = :userId WHERE id = :regattaId AND client_id = :clientId",
      { endDate: dates.endDate, userId: request.user!.id, regattaId, clientId }
    );
    await connection.commit();
    response.json({ message: "Regatta end date updated" });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.get("/taxonomy", asyncHandler(async (request, response) => {
  const clientId = tenantId(request);
  const [nodes] = await pool.query(
    `SELECT id, parent_id AS parentId, name, description, sort_order AS sortOrder, status, created_at AS createdAt
     FROM schedule_taxonomy_nodes WHERE client_id = :clientId AND (status <> 'deleted' OR :includeDeleted) ORDER BY parent_id, sort_order, name`, { clientId, includeDeleted: request.user!.role === "tenant_admin" }
  );
  response.json({ nodes });
}));

router.post("/taxonomy", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const body = validate(taxonomySchema, request.body);
  if (body.parentId) await assertTenantResource(pool, "schedule_taxonomy_nodes", body.parentId, clientId, true);
  const [result] = await pool.query(
    `INSERT INTO schedule_taxonomy_nodes (client_id, parent_id, name, description, sort_order, status, created_by_user_id)
     VALUES (:clientId, :parentId, :name, :description, :sortOrder, :status, :userId)`,
    { clientId, parentId: body.parentId ?? null, name: body.name, description: body.description ?? null, sortOrder: body.sortOrder, status: body.status, userId: request.user!.id }
  );
  response.status(201).json({ id: (result as { insertId: number }).insertId });
}));

router.patch("/taxonomy/:id", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const id = Number(request.params.id); const body = validate(taxonomySchema.partial(), request.body);
  await assertTenantResource(pool, "schedule_taxonomy_nodes", id, clientId);
  if (body.parentId) await assertTenantResource(pool, "schedule_taxonomy_nodes", body.parentId, clientId, true);
  if (body.parentId !== undefined) {
    const [rows] = await pool.query<RowDataPacket[]>("SELECT id, parent_id AS parentId FROM schedule_taxonomy_nodes WHERE client_id = :clientId", { clientId });
    const parents = new Map(rows.map((row) => [Number(row.id), row.parentId === null ? null : Number(row.parentId)]));
    if (wouldCreateTaxonomyCycle(id, body.parentId ?? null, parents)) throw new AppError(422, "A taxonomy node cannot be moved into itself or its descendants");
  }
  await pool.query(
    `UPDATE schedule_taxonomy_nodes SET name = COALESCE(:name, name), description = CASE WHEN :hasDescription THEN :description ELSE description END,
     parent_id = CASE WHEN :hasParent THEN :parentId ELSE parent_id END, sort_order = COALESCE(:sortOrder, sort_order), status = COALESCE(:status, status)
     WHERE id = :id AND client_id = :clientId`,
    { id, clientId, name: body.name ?? null, hasDescription: body.description !== undefined, description: body.description ?? null, hasParent: body.parentId !== undefined, parentId: body.parentId ?? null, sortOrder: body.sortOrder ?? null, status: body.status ?? null }
  );
  response.json({ message: "Schedule structure updated" });
}));

router.delete("/taxonomy/:id", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const id = Number(request.params.id);
  await assertTenantResource(pool, "schedule_taxonomy_nodes", id, clientId);
  await pool.query("UPDATE schedule_taxonomy_nodes SET status = 'archived' WHERE id = :id AND client_id = :clientId AND status = 'active'", { id, clientId });
  response.status(204).send();
}));

router.post("/taxonomy/:id/restore", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const id = Number(request.params.id);
  const [nodes] = await pool.query<RowDataPacket[]>("SELECT parent_id AS parentId FROM schedule_taxonomy_nodes WHERE id = :id AND client_id = :clientId AND status = 'archived'", { id, clientId });
  if (!nodes[0]) throw new AppError(404, "Archived structure node not found");
  if (nodes[0].parentId) await assertTenantResource(pool, "schedule_taxonomy_nodes", Number(nodes[0].parentId), clientId, true);
  await pool.query("UPDATE schedule_taxonomy_nodes SET status = 'active' WHERE id = :id AND client_id = :clientId AND status = 'archived'", { id, clientId });
  response.json({ message: "Schedule structure restored" });
}));

router.post("/taxonomy/:id/delete", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const id = Number(request.params.id);
  const [dependencies] = await pool.query<RowDataPacket[]>(`SELECT
    (SELECT COUNT(*) FROM schedule_taxonomy_nodes WHERE parent_id = :id AND client_id = :clientId AND status <> 'deleted') AS childCount,
    (SELECT COUNT(*) FROM schedule_session_templates WHERE taxonomy_node_id = :id AND client_id = :clientId AND status <> 'deleted') AS sessionCount`, { id, clientId });
  if (Number(dependencies[0]?.childCount) > 0 || Number(dependencies[0]?.sessionCount) > 0) throw new AppError(409, "Remove or reassign child nodes and session templates before deleting this structure node");
  const [result] = await pool.query("UPDATE schedule_taxonomy_nodes SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP, deleted_by_user_id = :userId WHERE id = :id AND client_id = :clientId AND status = 'archived'", { id, clientId, userId: request.user!.id });
  if (!(result as { affectedRows: number }).affectedRows) throw new AppError(404, "Archived structure node not found"); response.json({ message: "Schedule structure deleted" });
}));

router.post("/taxonomy/:id/recover", requireRoles("tenant_admin"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const id = Number(request.params.id);
  const [nodes] = await pool.query<RowDataPacket[]>("SELECT parent_id AS parentId FROM schedule_taxonomy_nodes WHERE id = :id AND client_id = :clientId AND status = 'deleted'", { id, clientId });
  if (!nodes[0]) throw new AppError(404, "Deleted structure node not found");
  if (nodes[0].parentId) {
    const [parents] = await pool.query<RowDataPacket[]>("SELECT id FROM schedule_taxonomy_nodes WHERE id = :parentId AND client_id = :clientId AND status <> 'deleted'", { parentId: nodes[0].parentId, clientId });
    if (!parents[0]) throw new AppError(409, "Recover the parent structure node first");
  }
  await pool.query("UPDATE schedule_taxonomy_nodes SET status = 'archived', deleted_at = NULL, deleted_by_user_id = NULL WHERE id = :id AND client_id = :clientId AND status = 'deleted'", { id, clientId });
  response.json({ message: "Structure node recovered to archived records" });
}));

router.get("/slots", asyncHandler(async (request, response) => {
  const clientId = tenantId(request);
  const [slots] = await pool.query(`SELECT id, name, TIME_FORMAT(start_time, '%H:%i') AS startTime, TIME_FORMAT(end_time, '%H:%i') AS endTime, sort_order AS sortOrder, status FROM schedule_day_slots WHERE client_id = :clientId AND (status <> 'deleted' OR :includeDeleted) ORDER BY sort_order, name`, { clientId, includeDeleted: request.user!.role === "tenant_admin" });
  response.json({ slots });
}));

router.post("/slots", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const body = validate(slotSchema, request.body);
  const [result] = await pool.query(`INSERT INTO schedule_day_slots (client_id, name, start_time, end_time, sort_order, status, created_by_user_id) VALUES (:clientId, :name, :startTime, :endTime, :sortOrder, :status, :userId)`, { clientId, ...body, startTime: body.startTime ?? null, endTime: body.endTime ?? null, userId: request.user!.id });
  response.status(201).json({ id: (result as { insertId: number }).insertId });
}));

router.patch("/slots/:id", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const id = Number(request.params.id); const body = validate(slotSchema.partial(), request.body);
  await assertTenantResource(pool, "schedule_day_slots", id, clientId);
  await pool.query(`UPDATE schedule_day_slots SET name = COALESCE(:name, name), start_time = CASE WHEN :hasStart THEN :startTime ELSE start_time END, end_time = CASE WHEN :hasEnd THEN :endTime ELSE end_time END, sort_order = COALESCE(:sortOrder, sort_order), status = COALESCE(:status, status) WHERE id = :id AND client_id = :clientId`, { id, clientId, name: body.name ?? null, hasStart: body.startTime !== undefined, startTime: body.startTime ?? null, hasEnd: body.endTime !== undefined, endTime: body.endTime ?? null, sortOrder: body.sortOrder ?? null, status: body.status ?? null });
  response.json({ message: "Day slot updated" });
}));

router.delete("/slots/:id", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const id = Number(request.params.id); await assertTenantResource(pool, "schedule_day_slots", id, clientId);
  await pool.query("UPDATE schedule_day_slots SET status = 'archived' WHERE id = :id AND client_id = :clientId AND status = 'active'", { id, clientId }); response.status(204).send();
}));

router.post("/slots/:id/restore", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const id = Number(request.params.id);
  const [result] = await pool.query("UPDATE schedule_day_slots SET status = 'active' WHERE id = :id AND client_id = :clientId AND status = 'archived'", { id, clientId });
  if (!(result as { affectedRows: number }).affectedRows) throw new AppError(404, "Archived day slot not found"); response.json({ message: "Day slot restored" });
}));

router.post("/slots/:id/delete", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const id = Number(request.params.id);
  const [result] = await pool.query("UPDATE schedule_day_slots SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP, deleted_by_user_id = :userId WHERE id = :id AND client_id = :clientId AND status = 'archived'", { id, clientId, userId: request.user!.id });
  if (!(result as { affectedRows: number }).affectedRows) throw new AppError(404, "Archived day slot not found"); response.json({ message: "Day slot deleted" });
}));

router.post("/slots/:id/recover", requireRoles("tenant_admin"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const id = Number(request.params.id);
  const [result] = await pool.query("UPDATE schedule_day_slots SET status = 'archived', deleted_at = NULL, deleted_by_user_id = NULL WHERE id = :id AND client_id = :clientId AND status = 'deleted'", { id, clientId });
  if (!(result as { affectedRows: number }).affectedRows) throw new AppError(404, "Deleted day slot not found"); response.json({ message: "Day slot recovered to archived records" });
}));

router.get("/session-templates", asyncHandler(async (request, response) => {
  const clientId = tenantId(request);
  const [templates] = await pool.query(
    `SELECT st.id, st.name, st.taxonomy_node_id AS taxonomyNodeId, tn.name AS taxonomyName, st.duration_minutes AS durationMinutes,
     st.objective, st.instructions, st.intensity, st.location, st.equipment, st.staff_notes AS staffNotes, st.owner_user_id AS ownerUserId,
     owner.display_name AS ownerName, st.status FROM schedule_session_templates st
     INNER JOIN schedule_taxonomy_nodes tn ON tn.id = st.taxonomy_node_id INNER JOIN users owner ON owner.id = st.owner_user_id
     WHERE st.client_id = :clientId AND (st.status <> 'deleted' OR :includeDeleted) ORDER BY st.name`, { clientId, includeDeleted: request.user!.role === "tenant_admin" }
  );
  response.json({ templates });
}));

router.post("/session-templates", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const body = validate(sessionSchema, request.body);
  await assertTenantResource(pool, "schedule_taxonomy_nodes", body.taxonomyNodeId, clientId, true);
  const [result] = await pool.query(
    `INSERT INTO schedule_session_templates (client_id, taxonomy_node_id, name, duration_minutes, objective, instructions, intensity, location, equipment, staff_notes, owner_user_id, status)
     VALUES (:clientId, :taxonomyNodeId, :name, :durationMinutes, :objective, :instructions, :intensity, :location, :equipment, :staffNotes, :userId, :status)`,
    { clientId, ...body, durationMinutes: body.durationMinutes ?? null, objective: body.objective ?? null, instructions: body.instructions ?? null, intensity: body.intensity ?? null, location: body.location ?? null, equipment: body.equipment ?? null, staffNotes: body.staffNotes ?? null, userId: request.user!.id }
  );
  response.status(201).json({ id: (result as { insertId: number }).insertId });
}));

router.patch("/session-templates/:id", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const id = Number(request.params.id); const body = validate(sessionSchema.partial(), request.body);
  await assertTenantResource(pool, "schedule_session_templates", id, clientId);
  if (body.taxonomyNodeId) await assertTenantResource(pool, "schedule_taxonomy_nodes", body.taxonomyNodeId, clientId, true);
  const fields: Record<string, string> = { name: "name", taxonomyNodeId: "taxonomy_node_id", durationMinutes: "duration_minutes", objective: "objective", instructions: "instructions", intensity: "intensity", location: "location", equipment: "equipment", staffNotes: "staff_notes", status: "status" };
  const updates = Object.entries(fields).filter(([key]) => key in body).map(([key, column]) => `${column} = :${key}`);
  if (updates.length) await pool.query(`UPDATE schedule_session_templates SET ${updates.join(", ")} WHERE id = :id AND client_id = :clientId`, { id, clientId, ...body });
  response.json({ message: "Session template updated" });
}));

router.delete("/session-templates/:id", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const id = Number(request.params.id); await assertTenantResource(pool, "schedule_session_templates", id, clientId);
  await pool.query("UPDATE schedule_session_templates SET status = 'archived' WHERE id = :id AND client_id = :clientId AND status = 'active'", { id, clientId }); response.status(204).send();
}));

router.post("/session-templates/:id/restore", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const id = Number(request.params.id);
  const [templates] = await pool.query<RowDataPacket[]>("SELECT taxonomy_node_id AS taxonomyNodeId FROM schedule_session_templates WHERE id = :id AND client_id = :clientId AND status = 'archived'", { id, clientId });
  if (!templates[0]) throw new AppError(404, "Archived session template not found");
  await assertTenantResource(pool, "schedule_taxonomy_nodes", Number(templates[0].taxonomyNodeId), clientId, true);
  await pool.query("UPDATE schedule_session_templates SET status = 'active' WHERE id = :id AND client_id = :clientId AND status = 'archived'", { id, clientId }); response.json({ message: "Session template restored" });
}));

router.post("/session-templates/:id/delete", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const id = Number(request.params.id);
  const [result] = await pool.query("UPDATE schedule_session_templates SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP, deleted_by_user_id = :userId WHERE id = :id AND client_id = :clientId AND status = 'archived'", { id, clientId, userId: request.user!.id });
  if (!(result as { affectedRows: number }).affectedRows) throw new AppError(404, "Archived session template not found"); response.json({ message: "Session template deleted" });
}));

router.post("/session-templates/:id/recover", requireRoles("tenant_admin"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const id = Number(request.params.id);
  const [result] = await pool.query("UPDATE schedule_session_templates SET status = 'archived', deleted_at = NULL, deleted_by_user_id = NULL WHERE id = :id AND client_id = :clientId AND status = 'deleted'", { id, clientId });
  if (!(result as { affectedRows: number }).affectedRows) throw new AppError(404, "Deleted session template not found"); response.json({ message: "Session template recovered to archived records" });
}));

router.get("/week-templates", asyncHandler(async (request, response) => {
  const clientId = tenantId(request);
  const [templates] = await pool.query(
    `SELECT wt.id, wt.name, wt.description, wt.owner_user_id AS ownerUserId, owner.display_name AS ownerName, wt.status,
     COALESCE(JSON_ARRAYAGG(CASE WHEN entry.weekday IS NULL THEN NULL ELSE JSON_OBJECT('weekday', entry.weekday, 'slotId', entry.slot_id, 'sessionTemplateId', entry.session_template_id) END), JSON_ARRAY()) AS entries
     FROM schedule_week_templates wt INNER JOIN users owner ON owner.id = wt.owner_user_id
     LEFT JOIN schedule_week_template_entries entry ON entry.week_template_id = wt.id
     WHERE wt.client_id = :clientId AND (wt.status <> 'deleted' OR :includeDeleted) GROUP BY wt.id, wt.name, wt.description, wt.owner_user_id, owner.display_name, wt.status ORDER BY wt.name`, { clientId, includeDeleted: request.user!.role === "tenant_admin" }
  );
  response.json({ templates });
}));

router.post("/week-templates", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const body = validate(weekSchema, request.body); const connection = await pool.getConnection();
  try { await connection.beginTransaction();
    const [result] = await connection.query(`INSERT INTO schedule_week_templates (client_id, name, description, owner_user_id, status) VALUES (:clientId, :name, :description, :userId, :status)`, { clientId, name: body.name, description: body.description ?? null, userId: request.user!.id, status: body.status });
    const id = (result as { insertId: number }).insertId; await replaceWeekEntries(connection, id, clientId, body.entries ?? []); await connection.commit(); response.status(201).json({ id });
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}));

router.patch("/week-templates/:id", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const id = Number(request.params.id); const body = validate(weekSchema.partial(), request.body); const connection = await pool.getConnection();
  try { await connection.beginTransaction(); await assertTenantResource(connection, "schedule_week_templates", id, clientId);
    await connection.query(`UPDATE schedule_week_templates SET name = COALESCE(:name, name), description = CASE WHEN :hasDescription THEN :description ELSE description END, status = COALESCE(:status, status) WHERE id = :id AND client_id = :clientId`, { id, clientId, name: body.name ?? null, hasDescription: body.description !== undefined, description: body.description ?? null, status: body.status ?? null });
    if (body.entries) await replaceWeekEntries(connection, id, clientId, body.entries); await connection.commit(); response.json({ message: "Week template updated" });
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}));

router.delete("/week-templates/:id", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const id = Number(request.params.id); await assertTenantResource(pool, "schedule_week_templates", id, clientId);
  await pool.query("UPDATE schedule_week_templates SET status = 'archived' WHERE id = :id AND client_id = :clientId AND status = 'active'", { id, clientId }); response.status(204).send();
}));

router.post("/week-templates/:id/restore", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const id = Number(request.params.id);
  const [unavailable] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM schedule_week_template_entries entry
    INNER JOIN schedule_day_slots slot ON slot.id = entry.slot_id INNER JOIN schedule_session_templates session ON session.id = entry.session_template_id
    WHERE entry.week_template_id = :id AND (slot.status <> 'active' OR session.status <> 'active')`, { id });
  if (Number(unavailable[0]?.count) > 0) throw new AppError(409, "Restore this template's archived day slots and sessions first");
  const [result] = await pool.query("UPDATE schedule_week_templates SET status = 'active' WHERE id = :id AND client_id = :clientId AND status = 'archived'", { id, clientId });
  if (!(result as { affectedRows: number }).affectedRows) throw new AppError(404, "Archived week template not found"); response.json({ message: "Week template restored" });
}));

router.post("/week-templates/:id/delete", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const id = Number(request.params.id);
  const [result] = await pool.query("UPDATE schedule_week_templates SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP, deleted_by_user_id = :userId WHERE id = :id AND client_id = :clientId AND status = 'archived'", { id, clientId, userId: request.user!.id });
  if (!(result as { affectedRows: number }).affectedRows) throw new AppError(404, "Archived week template not found"); response.json({ message: "Week template deleted" });
}));

router.post("/week-templates/:id/recover", requireRoles("tenant_admin"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const id = Number(request.params.id);
  const [result] = await pool.query("UPDATE schedule_week_templates SET status = 'archived', deleted_at = NULL, deleted_by_user_id = NULL WHERE id = :id AND client_id = :clientId AND status = 'deleted'", { id, clientId });
  if (!(result as { affectedRows: number }).affectedRows) throw new AppError(404, "Deleted week template not found"); response.json({ message: "Week template recovered to archived records" });
}));

async function resolvePlanMembers(connection: PoolConnection, planId: number, clientId: number) {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT DISTINCT member.id FROM users member
     WHERE member.client_id = :clientId AND member.role = 'tenant_member' AND member.status = 'active' AND (
       member.id IN (SELECT user_id FROM schedule_plan_target_users WHERE plan_id = :planId)
       OR member.id IN (SELECT mgm.user_id FROM schedule_plan_target_groups target INNER JOIN member_group_members mgm ON mgm.member_group_id = target.member_group_id WHERE target.plan_id = :planId)
     )`, { clientId, planId }
  );
  return rows.map((row) => Number(row.id));
}

async function planConflicts(connection: PoolConnection, planId: number, clientId: number, lock = false) {
  const members = await resolvePlanMembers(connection, planId, clientId);
  if (!members.length) return [];
  const placeholders = members.map((_, index) => `:member${index}`).join(", ");
  const params = Object.fromEntries(members.map((id, index) => [`member${index}`, id]));
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT assignment.id AS assignmentId, assignment.member_user_id AS memberId, member.display_name AS memberName,
     assignment.schedule_date AS scheduleDate, assignment.slot_id AS slotId, slot.name AS slotName,
     JSON_UNQUOTE(JSON_EXTRACT(existing.session_snapshot, '$.name')) AS existingSessionName
     FROM schedule_assignments assignment INNER JOIN users member ON member.id = assignment.member_user_id
     INNER JOIN schedule_day_slots slot ON slot.id = assignment.slot_id INNER JOIN schedule_occurrences existing ON existing.id = assignment.occurrence_id
     INNER JOIN schedule_occurrences proposed ON proposed.plan_id = :planId AND proposed.schedule_date = assignment.schedule_date AND proposed.slot_id = assignment.slot_id
     WHERE assignment.client_id = :clientId AND assignment.status = 'active' AND assignment.member_user_id IN (${placeholders})${lock ? " FOR UPDATE" : ""}`,
    { clientId, planId, ...params }
  );
  return rows;
}

router.get("/plans", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const fromDate = String(request.query.fromDate ?? "1900-01-01"); const toDate = String(request.query.toDate ?? "2999-12-31");
  const [plans] = await pool.query(`SELECT plan.id, plan.name, plan.generation_mode AS mode, plan.start_date AS startDate, plan.end_date AS endDate, plan.status, plan.owner_user_id AS ownerUserId, owner.display_name AS ownerName, plan.published_at AS publishedAt, COUNT(occurrence.id) AS occurrenceCount,
    (SELECT COALESCE(JSON_ARRAYAGG(target.member_group_id), JSON_ARRAY()) FROM schedule_plan_target_groups target WHERE target.plan_id = plan.id) AS groupIds,
    (SELECT COALESCE(JSON_ARRAYAGG(target.user_id), JSON_ARRAY()) FROM schedule_plan_target_users target WHERE target.plan_id = plan.id) AS memberIds,
    (SELECT COALESCE(JSON_ARRAYAGG(link.regatta_id), JSON_ARRAY()) FROM schedule_plan_regattas link WHERE link.plan_id = plan.id) AS regattaIds
    FROM schedule_plans plan INNER JOIN users owner ON owner.id = plan.owner_user_id LEFT JOIN schedule_occurrences occurrence ON occurrence.plan_id = plan.id WHERE plan.client_id = :clientId AND plan.end_date >= :fromDate AND plan.start_date <= :toDate GROUP BY plan.id, plan.name, plan.generation_mode, plan.start_date, plan.end_date, plan.status, plan.owner_user_id, owner.display_name, plan.published_at ORDER BY plan.start_date DESC`, { clientId, fromDate, toDate });
  response.json({ plans });
}));

router.get("/calendar", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const fromDate = String(request.query.fromDate ?? "1900-01-01"); const toDate = String(request.query.toDate ?? "2999-12-31");
  const regattaId = request.query.regattaId === undefined ? null : Number(request.query.regattaId);
  if (regattaId !== null && (!Number.isSafeInteger(regattaId) || regattaId <= 0)) throw new AppError(422, "Invalid regatta id");
  const [occurrences] = await pool.query(`SELECT occurrence.id, occurrence.plan_id AS planId, plan.name AS planName, occurrence.schedule_date AS scheduleDate, occurrence.slot_id AS slotId, slot.name AS slotName, occurrence.session_snapshot AS sessionSnapshot, occurrence.taxonomy_path_snapshot AS taxonomyPath, occurrence.status,
    (SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT('id', regatta.id, 'name', regatta.name, 'startDate', regatta.start_date, 'endDate', regatta.end_date)), JSON_ARRAY()) FROM schedule_plan_regattas link INNER JOIN regattas regatta ON regatta.id = link.regatta_id WHERE link.plan_id = plan.id) AS regattas
    FROM schedule_occurrences occurrence INNER JOIN schedule_plans plan ON plan.id = occurrence.plan_id INNER JOIN schedule_day_slots slot ON slot.id = occurrence.slot_id
    WHERE occurrence.client_id = :clientId AND occurrence.schedule_date BETWEEN :fromDate AND :toDate
      AND (:regattaId IS NULL OR EXISTS (SELECT 1 FROM schedule_plan_regattas filter_link WHERE filter_link.plan_id = plan.id AND filter_link.regatta_id = :regattaId))
    ORDER BY occurrence.schedule_date, slot.sort_order`, { clientId, fromDate, toDate, regattaId });
  response.json({ occurrences });
}));

router.post("/plans", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const body = validate(planSchema, request.body); const dates = generateScheduleDates(body.startDate, body.endDate, body.mode); const connection = await pool.getConnection();
  try { await connection.beginTransaction();
    let entries = body.entries ?? [];
    const groupIds = body.groupIds ?? [];
    const memberIds = body.memberIds ?? [];
    const regattaIds = body.regattaIds ?? [];
    if (body.weekTemplateId) {
      await assertTenantResource(connection, "schedule_week_templates", body.weekTemplateId, clientId, true);
      const [rows] = await connection.query<RowDataPacket[]>(`SELECT entry.weekday, entry.slot_id AS slotId, entry.session_template_id AS sessionTemplateId FROM schedule_week_template_entries entry INNER JOIN schedule_week_templates week ON week.id = entry.week_template_id WHERE entry.week_template_id = :weekTemplateId AND week.client_id = :clientId`, { weekTemplateId: body.weekTemplateId, clientId });
      entries = rows.map((row) => ({ weekday: Number(row.weekday), slotId: Number(row.slotId), sessionTemplateId: Number(row.sessionTemplateId) }));
    }
    if (!entries.length) throw new AppError(422, "Add at least one session to the schedule");
    const generated = expandTemplateEntries(dates, entries); if (!generated.length) throw new AppError(422, "The selected template has no sessions in this date range");
    for (const groupId of [...new Set(groupIds)]) await assertTenantResource(connection, "member_groups", groupId, clientId, true);
    for (const memberId of [...new Set(memberIds)]) { await assertTenantResource(connection, "users", memberId, clientId, true); const [member] = await connection.query<RowDataPacket[]>("SELECT role FROM users WHERE id = :memberId AND client_id = :clientId", { memberId, clientId }); if (member[0]?.role !== "tenant_member") throw new AppError(422, "Schedules can only be assigned to tenant members"); }
    await assertTenantRegattas(connection, regattaIds, clientId);
    if (!groupIds.length && !memberIds.length) throw new AppError(422, "Select at least one class or member");
    const [result] = await connection.query(`INSERT INTO schedule_plans (client_id, name, generation_mode, start_date, end_date, source_week_template_id, owner_user_id) VALUES (:clientId, :name, :mode, :startDate, :endDate, :weekTemplateId, :userId)`, { clientId, ...body, weekTemplateId: body.weekTemplateId ?? null, userId: request.user!.id });
    const planId = (result as { insertId: number }).insertId;
    for (const groupId of [...new Set(groupIds)]) await connection.query("INSERT INTO schedule_plan_target_groups (plan_id, member_group_id) VALUES (:planId, :groupId)", { planId, groupId });
    for (const memberId of [...new Set(memberIds)]) await connection.query("INSERT INTO schedule_plan_target_users (plan_id, user_id) VALUES (:planId, :memberId)", { planId, memberId });
    for (const regattaId of [...new Set(regattaIds)]) await connection.query("INSERT INTO schedule_plan_regattas (plan_id, regatta_id) VALUES (:planId, :regattaId)", { planId, regattaId });
    const templateCache = new Map<number, { snapshot: Record<string, unknown>; path: string[] }>();
    for (const entry of generated) {
      await assertTenantResource(connection, "schedule_day_slots", entry.slotId, clientId, true); await assertTenantResource(connection, "schedule_session_templates", entry.sessionTemplateId, clientId, true);
      let template = templateCache.get(entry.sessionTemplateId);
      if (!template) {
        const [rows] = await connection.query<RowDataPacket[]>(`SELECT id, name, taxonomy_node_id AS taxonomyNodeId, duration_minutes AS durationMinutes, objective, instructions, intensity, location, equipment, staff_notes AS staffNotes FROM schedule_session_templates WHERE id = :id AND client_id = :clientId`, { id: entry.sessionTemplateId, clientId });
        const row = rows[0]; const path = await taxonomyPath(connection, Number(row.taxonomyNodeId), clientId); template = { snapshot: { id: Number(row.id), name: row.name, durationMinutes: row.durationMinutes, objective: row.objective, instructions: row.instructions, intensity: row.intensity, location: row.location, equipment: row.equipment, staffNotes: row.staffNotes }, path }; templateCache.set(entry.sessionTemplateId, template);
      }
      await connection.query(`INSERT INTO schedule_occurrences (client_id, plan_id, schedule_date, slot_id, session_template_id, session_snapshot, taxonomy_path_snapshot) VALUES (:clientId, :planId, :date, :slotId, :sessionTemplateId, :snapshot, :path)`, { clientId, planId, ...entry, snapshot: JSON.stringify(template.snapshot), path: JSON.stringify(template.path) });
    }
    await connection.commit(); response.status(201).json({ id: planId, occurrenceCount: generated.length });
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}));

router.patch("/plans/:id", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const planId = Number(request.params.id);
  const body = validate(z.object({ name: z.string().trim().min(2).max(190).optional(), startDate: z.string().optional(), endDate: z.string().optional(), groupIds: idList.optional(), memberIds: idList.optional(), regattaIds: idList.optional() }), request.body);
  const connection = await pool.getConnection();
  try { await connection.beginTransaction();
    const [plans] = await connection.query<RowDataPacket[]>("SELECT id, generation_mode AS mode, start_date AS startDate, end_date AS endDate FROM schedule_plans WHERE id = :planId AND client_id = :clientId AND status = 'draft' FOR UPDATE", { planId, clientId });
    if (!plans[0]) throw new AppError(404, "Draft schedule not found");
    if (body.name) await connection.query("UPDATE schedule_plans SET name = :name WHERE id = :planId", { name: body.name, planId });
    if (body.startDate !== undefined || body.endDate !== undefined) {
      const mode = plans[0].mode as "day" | "week" | "range";
      const startDate = body.startDate ?? databaseDate(plans[0].startDate as string | Date);
      const endDate = mode === "day" ? startDate : body.endDate ?? databaseDate(plans[0].endDate as string | Date);
      const dates = generateScheduleDates(startDate, endDate, mode);
      const [existing] = await connection.query<RowDataPacket[]>(
        `SELECT id, schedule_date AS scheduleDate, slot_id AS slotId, session_template_id AS sessionTemplateId,
         session_snapshot AS sessionSnapshot, taxonomy_path_snapshot AS taxonomyPath
         FROM schedule_occurrences WHERE plan_id = :planId ORDER BY schedule_date, slot_id`, { planId }
      );
      if (!existing.length) throw new AppError(422, "Draft schedule has no sessions to regenerate");
      const patterns = new Map<string, RowDataPacket>();
      for (const occurrence of existing) {
        const sourceDate = databaseDate(occurrence.scheduleDate as string | Date);
        const source = new Date(`${sourceDate}T12:00:00Z`);
        const weekday = source.getUTCDay() === 0 ? 7 : source.getUTCDay();
        const key = mode === "day" ? `day:${Number(occurrence.slotId)}` : `${weekday}:${Number(occurrence.slotId)}`;
        if (!patterns.has(key)) patterns.set(key, occurrence);
      }
      const generated = mode === "day"
        ? [...patterns.values()].map((entry) => ({ date: startDate, entry }))
        : dates.flatMap(({ date, weekday }) => [...patterns.entries()].filter(([key]) => key.startsWith(`${weekday}:`)).map(([, entry]) => ({ date, entry })));
      if (!generated.length) throw new AppError(422, "The edited date range contains no matching sessions");
      await connection.query("DELETE FROM schedule_occurrences WHERE plan_id = :planId", { planId });
      for (const item of generated) {
        await connection.query(
          `INSERT INTO schedule_occurrences (client_id, plan_id, schedule_date, slot_id, session_template_id, session_snapshot, taxonomy_path_snapshot)
           VALUES (:clientId, :planId, :date, :slotId, :sessionTemplateId, :sessionSnapshot, :taxonomyPath)`,
          { clientId, planId, date: item.date, slotId: item.entry.slotId, sessionTemplateId: item.entry.sessionTemplateId, sessionSnapshot: jsonDatabaseValue(item.entry.sessionSnapshot), taxonomyPath: jsonDatabaseValue(item.entry.taxonomyPath) }
        );
      }
      await connection.query("UPDATE schedule_plans SET start_date = :startDate, end_date = :endDate WHERE id = :planId", { startDate, endDate, planId });
    }
    if (body.groupIds !== undefined || body.memberIds !== undefined) {
      const groupIds = body.groupIds ?? []; const memberIds = body.memberIds ?? [];
      if (!groupIds.length && !memberIds.length) throw new AppError(422, "Select at least one class or member");
      for (const groupId of [...new Set(groupIds)]) await assertTenantResource(connection, "member_groups", groupId, clientId, true);
      for (const memberId of [...new Set(memberIds)]) {
        await assertTenantResource(connection, "users", memberId, clientId, true);
        const [member] = await connection.query<RowDataPacket[]>("SELECT role FROM users WHERE id = :memberId AND client_id = :clientId", { memberId, clientId });
        if (member[0]?.role !== "tenant_member") throw new AppError(422, "Schedules can only be assigned to tenant members");
      }
      await connection.query("DELETE FROM schedule_plan_target_groups WHERE plan_id = :planId", { planId });
      await connection.query("DELETE FROM schedule_plan_target_users WHERE plan_id = :planId", { planId });
      for (const groupId of [...new Set(groupIds)]) await connection.query("INSERT INTO schedule_plan_target_groups (plan_id, member_group_id) VALUES (:planId, :groupId)", { planId, groupId });
      for (const memberId of [...new Set(memberIds)]) await connection.query("INSERT INTO schedule_plan_target_users (plan_id, user_id) VALUES (:planId, :memberId)", { planId, memberId });
    }
    if (body.regattaIds !== undefined) {
      await assertTenantRegattas(connection, body.regattaIds, clientId);
      await connection.query("DELETE FROM schedule_plan_regattas WHERE plan_id = :planId", { planId });
      for (const regattaId of [...new Set(body.regattaIds)]) await connection.query("INSERT INTO schedule_plan_regattas (plan_id, regatta_id) VALUES (:planId, :regattaId)", { planId, regattaId });
    }
    await connection.commit(); response.json({ message: "Draft schedule updated" });
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}));

router.delete("/plans/:id", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const planId = Number(request.params.id);
  const [result] = await pool.query("DELETE FROM schedule_plans WHERE id = :planId AND client_id = :clientId AND status = 'draft'", { planId, clientId });
  if (!(result as { affectedRows: number }).affectedRows) throw new AppError(404, "Draft schedule not found");
  response.status(204).send();
}));

router.get("/plans/:id/conflicts", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const planId = Number(request.params.id); const connection = await pool.getConnection();
  try { const [plan] = await connection.query<RowDataPacket[]>("SELECT id FROM schedule_plans WHERE id = :planId AND client_id = :clientId AND status = 'draft'", { planId, clientId }); if (!plan[0]) throw new AppError(404, "Draft schedule not found"); const conflicts = await planConflicts(connection, planId, clientId); response.json({ conflicts }); } finally { connection.release(); }
}));

router.post("/plans/:id/publish", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const planId = Number(request.params.id); const body = validate(z.object({ replaceAssignmentIds: idList }), request.body); const allowedReplacements = new Set(body.replaceAssignmentIds); const connection = await pool.getConnection();
  try { await connection.beginTransaction();
    const [plans] = await connection.query<RowDataPacket[]>("SELECT id FROM schedule_plans WHERE id = :planId AND client_id = :clientId AND status = 'draft' FOR UPDATE", { planId, clientId }); if (!plans[0]) throw new AppError(404, "Draft schedule not found");
    const members = await resolvePlanMembers(connection, planId, clientId); if (!members.length) throw new AppError(422, "This schedule has no active members");
    const conflicts = await planConflicts(connection, planId, clientId, true); const unresolved = conflicts.filter((conflict) => !allowedReplacements.has(Number(conflict.assignmentId)));
    if (unresolved.length) { await connection.rollback(); return response.status(409).json({ error: { message: "Schedule conflicts require review", conflicts: unresolved } }); }
    const [occurrences] = await connection.query<RowDataPacket[]>("SELECT id, schedule_date AS scheduleDate, slot_id AS slotId FROM schedule_occurrences WHERE plan_id = :planId AND client_id = :clientId ORDER BY schedule_date, slot_id", { planId, clientId });
    const conflictByCell = new Map(conflicts.map((conflict) => [`${Number(conflict.memberId)}:${databaseDate(conflict.scheduleDate as string | Date)}:${Number(conflict.slotId)}`, Number(conflict.assignmentId)]));
    for (const occurrence of occurrences) for (const memberId of members) {
      const date = databaseDate(occurrence.scheduleDate as string | Date); const key = `${memberId}:${date}:${Number(occurrence.slotId)}`; const replacedId = conflictByCell.get(key);
      if (replacedId) await connection.query("UPDATE schedule_assignments SET status = 'replaced' WHERE id = :id AND client_id = :clientId AND status = 'active'", { id: replacedId, clientId });
      const [result] = await connection.query(`INSERT INTO schedule_assignments (client_id, occurrence_id, member_user_id, schedule_date, slot_id, published_by_user_id) VALUES (:clientId, :occurrenceId, :memberId, :scheduleDate, :slotId, :userId)`, { clientId, occurrenceId: occurrence.id, memberId, scheduleDate: date, slotId: occurrence.slotId, userId: request.user!.id });
      if (replacedId) await connection.query("UPDATE schedule_assignments SET replaced_by_assignment_id = :replacementId WHERE id = :replacedId", { replacementId: (result as { insertId: number }).insertId, replacedId });
    }
    await connection.query("UPDATE schedule_occurrences SET status = 'published' WHERE plan_id = :planId", { planId });
    await connection.query("UPDATE schedule_plans SET status = 'published', published_by_user_id = :userId, published_at = CURRENT_TIMESTAMP WHERE id = :planId", { planId, userId: request.user!.id });
    await connection.commit(); response.json({ message: "Schedule published", assignmentCount: occurrences.length * members.length });
  } catch (error) { if ((error as { code?: string }).code === "ER_DUP_ENTRY") { await connection.rollback(); throw new AppError(409, "A schedule assignment changed while publishing. Review conflicts and try again."); } await connection.rollback(); throw error; } finally { connection.release(); }
}));

router.post("/assignments/:id/cancel", requireRoles("tenant_admin", "tenant_staff"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const id = Number(request.params.id);
  const [result] = await pool.query(`UPDATE schedule_assignments SET status = 'cancelled', cancelled_by_user_id = :userId, cancelled_at = CURRENT_TIMESTAMP WHERE id = :id AND client_id = :clientId AND status = 'active'`, { id, clientId, userId: request.user!.id });
  if (!(result as { affectedRows: number }).affectedRows) throw new AppError(404, "Active assignment not found"); response.json({ message: "Schedule assignment cancelled" });
}));

router.get("/my", requireRoles("tenant_member"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const fromDate = String(request.query.fromDate ?? "1900-01-01"); const toDate = String(request.query.toDate ?? "2999-12-31");
  const regattaId = request.query.regattaId === undefined ? null : Number(request.query.regattaId);
  if (regattaId !== null && (!Number.isSafeInteger(regattaId) || regattaId <= 0)) throw new AppError(422, "Invalid regatta id");
  const [assignments] = await pool.query(`SELECT assignment.id, assignment.schedule_date AS scheduleDate, assignment.slot_id AS slotId, slot.name AS slotName, TIME_FORMAT(slot.start_time, '%H:%i') AS slotStartTime, occurrence.plan_id AS planId, plan.name AS planName, occurrence.session_snapshot AS sessionSnapshot, occurrence.taxonomy_path_snapshot AS taxonomyPath, assignment.status,
    (SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT('id', regatta.id, 'name', regatta.name, 'startDate', regatta.start_date, 'endDate', regatta.end_date)), JSON_ARRAY()) FROM schedule_plan_regattas link INNER JOIN regattas regatta ON regatta.id = link.regatta_id WHERE link.plan_id = plan.id) AS regattas
    FROM schedule_assignments assignment INNER JOIN schedule_occurrences occurrence ON occurrence.id = assignment.occurrence_id INNER JOIN schedule_plans plan ON plan.id = occurrence.plan_id INNER JOIN schedule_day_slots slot ON slot.id = assignment.slot_id
    WHERE assignment.client_id = :clientId AND assignment.member_user_id = :userId AND assignment.status = 'active' AND assignment.schedule_date BETWEEN :fromDate AND :toDate
      AND (:regattaId IS NULL OR EXISTS (SELECT 1 FROM schedule_plan_regattas filter_link WHERE filter_link.plan_id = plan.id AND filter_link.regatta_id = :regattaId))
    ORDER BY assignment.schedule_date, slot.sort_order`, { clientId, userId: request.user!.id, fromDate, toDate, regattaId });
  response.json({ assignments });
}));

router.get("/my/:assignmentId", requireRoles("tenant_member"), asyncHandler(async (request, response) => {
  const clientId = tenantId(request); const assignmentId = Number(request.params.assignmentId);
  const [assignments] = await pool.query<RowDataPacket[]>(`SELECT assignment.id, assignment.schedule_date AS scheduleDate, slot.name AS slotName, TIME_FORMAT(slot.start_time, '%H:%i') AS slotStartTime, plan.name AS planName, occurrence.session_snapshot AS sessionSnapshot, occurrence.taxonomy_path_snapshot AS taxonomyPath,
    (SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT('id', regatta.id, 'name', regatta.name, 'startDate', regatta.start_date, 'endDate', regatta.end_date)), JSON_ARRAY()) FROM schedule_plan_regattas link INNER JOIN regattas regatta ON regatta.id = link.regatta_id WHERE link.plan_id = plan.id) AS regattas
    FROM schedule_assignments assignment INNER JOIN schedule_occurrences occurrence ON occurrence.id = assignment.occurrence_id INNER JOIN schedule_plans plan ON plan.id = occurrence.plan_id INNER JOIN schedule_day_slots slot ON slot.id = assignment.slot_id WHERE assignment.id = :assignmentId AND assignment.client_id = :clientId AND assignment.member_user_id = :userId AND assignment.status = 'active' LIMIT 1`, { assignmentId, clientId, userId: request.user!.id });
  if (!assignments[0]) throw new AppError(404, "Schedule assignment not found");
  response.json({ assignment: assignments[0] });
}));

export { router as schedulingRouter };
