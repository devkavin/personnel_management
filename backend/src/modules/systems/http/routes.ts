import { Router } from "express";
import { z } from "zod";
import { pool } from "../../../database/pool.js";
import { requireAuth, requireRoles } from "../../../middleware/auth.js";
import type { SystemSettingDefinition } from "../../../platform/systems.js";
import { AppError, asyncHandler, validate } from "../../../shared/http.js";
import { systemRegistry } from "../../system-catalog.js";

const router = Router();
const settingValueSchema = z.union([z.string(), z.boolean(), z.number()]);
const updateTenantSystemSchema = z.object({
  enabled: z.boolean(),
  settings: z.record(z.string(), settingValueSchema).default({})
});
const updateSystemSettingsSchema = z.object({
  name: z.string().min(2),
  description: z.string().nullable().optional(),
  status: z.enum(["active", "inactive"]),
  settings: z.record(z.string(), settingValueSchema).default({})
});

router.use(requireAuth, requireRoles("super_admin"));

function capabilityFor(code: string) {
  return systemRegistry.get(code);
}

function routeParam(value: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function serializeSetting(definition: SystemSettingDefinition, value: unknown) {
  if (definition.type === "boolean") {
    if (typeof value !== "boolean") throw new AppError(422, `${definition.name} must be true or false`);
    return value ? "true" : "false";
  }
  const text = String(value);
  if (definition.options && !definition.options.includes(text)) throw new AppError(422, `${definition.name} is invalid`);
  return text;
}

async function systemRecord(code: string) {
  const [rows] = await pool.query("SELECT code, name, description, status FROM systems WHERE code = :code LIMIT 1", { code });
  const system = Array.isArray(rows) ? rows[0] : undefined;
  if (!system) throw new AppError(404, "System not found");
  return system;
}

router.get("/", asyncHandler(async (_request, response) => {
  const [systems] = await pool.query(
    `SELECT s.code, s.name, s.description, s.status, COUNT(ts.client_id) AS tenantCount,
      SUM(CASE WHEN ts.enabled THEN 1 ELSE 0 END) AS enabledTenantCount
     FROM systems s LEFT JOIN tenant_systems ts ON ts.system_code = s.code
     WHERE s.status = 'active'
     GROUP BY s.code, s.name, s.description, s.status ORDER BY s.name ASC`
  );
  response.json({ systems });
}));

router.get("/:code", asyncHandler(async (request, response) => {
  const code = routeParam(request.params.code);
  const system = await systemRecord(code);
  const [rows] = await pool.query(
    `SELECT COUNT(client.id) AS totalTenants, SUM(CASE WHEN tenant.enabled THEN 1 ELSE 0 END) AS enabledTenants
     FROM clients client LEFT JOIN tenant_systems tenant ON tenant.client_id = client.id AND tenant.system_code = :code`,
    { code }
  );
  const stats = (Array.isArray(rows) ? rows[0] : {}) as Record<string, unknown>;
  const moduleStats = await capabilityFor(code)?.dashboardStats?.(pool);
  response.json({ system, stats: { ...stats, ...moduleStats } });
}));

router.get("/:code/settings", asyncHandler(async (request, response) => {
  const code = routeParam(request.params.code);
  const system = await systemRecord(code);
  const definitions = capabilityFor(code)?.globalSettings ?? [];
  const [rows] = await pool.query(
    "SELECT setting_key AS settingKey, setting_value AS settingValue FROM system_settings WHERE system_code = :code",
    { code }
  );
  const values = new Map(
    (Array.isArray(rows) ? rows : []).map((row) => {
      const setting = row as { settingKey: string; settingValue: string };
      return [setting.settingKey, setting.settingValue];
    })
  );
  const settings = definitions.map(({ apiKey: _apiKey, defaultValue, ...definition }) => ({
    ...definition,
    value: values.get(definition.key) ?? defaultValue
  }));
  response.json({ system, settings });
}));

router.put("/:code/settings", asyncHandler(async (request, response) => {
  const code = routeParam(request.params.code);
  await systemRecord(code);
  const body = validate(updateSystemSettingsSchema, request.body);
  await pool.query(
    "UPDATE systems SET name = :name, description = :description, status = :status WHERE code = :code",
    { code, name: body.name, description: body.description ?? null, status: body.status }
  );

  for (const definition of capabilityFor(code)?.globalSettings ?? []) {
    const value = (body.settings ?? {})[definition.apiKey];
    if (value === undefined) continue;
    await pool.query(
      `INSERT INTO system_settings (system_code, setting_key, setting_value)
       VALUES (:code, :settingKey, :settingValue)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      { code, settingKey: definition.key, settingValue: serializeSetting(definition, value) }
    );
  }
  response.json({ message: "System settings updated" });
}));

router.get("/:code/tenant-settings", asyncHandler(async (request, response) => {
  const code = routeParam(request.params.code);
  await systemRecord(code);
  const definitions = capabilityFor(code)?.tenantSettings ?? [];
  const [tenantRows] = await pool.query(
    `SELECT client.id AS tenantId, client.name AS tenantName, client.slug AS tenantSlug,
      COALESCE(tenant.enabled, FALSE) AS enabled
     FROM clients client
     LEFT JOIN tenant_systems tenant ON tenant.client_id = client.id AND tenant.system_code = :code
     ORDER BY client.name ASC`,
    { code }
  );
  const [settingRows] = await pool.query(
    "SELECT client_id AS tenantId, setting_key AS settingKey, setting_value AS settingValue FROM tenant_system_settings WHERE system_code = :code",
    { code }
  );
  const values = new Map(
    (Array.isArray(settingRows) ? settingRows : []).map((row) => {
      const setting = row as { tenantId: number; settingKey: string; settingValue: string };
      return [`${setting.tenantId}:${setting.settingKey}`, setting.settingValue];
    })
  );
  const tenantSettings = (Array.isArray(tenantRows) ? tenantRows : []).map((row) => {
    const tenant = row as Record<string, unknown> & { tenantId: number };
    const dynamic = Object.fromEntries(
      definitions.map((definition) => [definition.apiKey, values.get(`${tenant.tenantId}:${definition.key}`) ?? definition.defaultValue])
    );
    return { ...tenant, ...dynamic };
  });
  response.json({ tenantSettings });
}));

router.put("/:code/tenant-settings/:tenantId", asyncHandler(async (request, response) => {
  const code = routeParam(request.params.code);
  const tenantId = Number(routeParam(request.params.tenantId));
  if (!tenantId) throw new AppError(422, "Invalid tenant id");
  await systemRecord(code);
  const body = validate(updateTenantSystemSchema, request.body);
  await pool.query(
    `INSERT INTO tenant_systems (client_id, system_code, enabled)
     VALUES (:tenantId, :code, :enabled)
     ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
    { tenantId, code, enabled: body.enabled }
  );

  const capability = capabilityFor(code);
  if (body.enabled) await capability?.onTenantEnabled?.(pool, tenantId, request.user!.id);
  for (const definition of capability?.tenantSettings ?? []) {
    const value = (body.settings ?? {})[definition.apiKey];
    if (value === undefined) continue;
    await pool.query(
      `INSERT INTO tenant_system_settings (client_id, system_code, setting_key, setting_value)
       VALUES (:tenantId, :code, :settingKey, :settingValue)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      { tenantId, code, settingKey: definition.key, settingValue: serializeSetting(definition, value) }
    );
  }
  response.json({ message: "Tenant system settings updated" });
}));

export { router as systemsRouter };
