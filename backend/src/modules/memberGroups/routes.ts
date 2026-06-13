import { Router } from "express";
import { z } from "zod";
import { pool } from "../../database/pool.js";
import { requireAuth, requireRoles } from "../../middleware/auth.js";
import { AppError, asyncHandler, validate } from "../../shared/http.js";
import { requireTenantScope } from "../../shared/policies.js";

const router = Router();

const memberGroupSchema = z.object({
  clientId: z.coerce.number().optional(),
  name: z.string().min(2),
  description: z.string().nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  memberIds: z.array(z.coerce.number()).default([])
});

const updateMemberGroupSchema = memberGroupSchema.partial().extend({
  memberIds: z.array(z.coerce.number()).optional()
});

router.use(requireAuth, requireRoles("super_admin", "tenant_admin", "tenant_staff"));

async function assertMembersBelongToTenant(clientId: number, memberIds: number[]) {
  const uniqueMemberIds = [...new Set(memberIds)];
  if (uniqueMemberIds.length === 0) return uniqueMemberIds;

  const placeholders = uniqueMemberIds.map((_, index) => `:memberId${index}`).join(", ");
  const params = Object.fromEntries(uniqueMemberIds.map((memberId, index) => [`memberId${index}`, memberId]));
  const [rows] = await pool.query(
    `
      SELECT id
      FROM users
      WHERE client_id = :clientId
        AND role = 'tenant_member'
        AND id IN (${placeholders})
    `,
    { clientId, ...params }
  );

  if (!Array.isArray(rows) || rows.length !== uniqueMemberIds.length) {
    throw new AppError(422, "One or more selected members do not belong to this tenant");
  }

  return uniqueMemberIds;
}

async function replaceGroupMembers(connection: Awaited<ReturnType<typeof pool.getConnection>>, groupId: number, clientId: number, memberIds: number[]) {
  const uniqueMemberIds = await assertMembersBelongToTenant(clientId, memberIds);
  await connection.query("DELETE FROM member_group_members WHERE member_group_id = :groupId", { groupId });

  if (uniqueMemberIds.length === 0) return;

  await connection.query(
    `
      INSERT INTO member_group_members (member_group_id, user_id)
      VALUES ${uniqueMemberIds.map((_, index) => `(:groupId, :memberId${index})`).join(", ")}
    `,
    {
      groupId,
      ...Object.fromEntries(uniqueMemberIds.map((memberId, index) => [`memberId${index}`, memberId]))
    }
  );
}

router.get(
  "/",
  asyncHandler(async (request, response) => {
    const clientId = requireTenantScope(request.user!, Number(request.query.clientId) || undefined);
    const [groups] = await pool.query(
      `
        SELECT
          mg.id,
          mg.client_id AS clientId,
          mg.name,
          mg.description,
          mg.status,
          mg.created_by_user_id AS createdByUserId,
          creator.display_name AS createdByName,
          COUNT(mgm.user_id) AS memberCount,
          COALESCE(JSON_ARRAYAGG(
            CASE
              WHEN member.id IS NULL THEN NULL
              ELSE JSON_OBJECT('id', member.id, 'displayName', member.display_name)
            END
          ), JSON_ARRAY()) AS members,
          mg.created_at AS createdAt
        FROM member_groups mg
        INNER JOIN users creator ON creator.id = mg.created_by_user_id
        LEFT JOIN member_group_members mgm ON mgm.member_group_id = mg.id
        LEFT JOIN users member ON member.id = mgm.user_id
        WHERE mg.client_id = :clientId
        GROUP BY mg.id, creator.display_name
        ORDER BY mg.name
      `,
      { clientId }
    );

    response.json({ groups });
  })
);

router.post(
  "/",
  asyncHandler(async (request, response) => {
    const body = validate(memberGroupSchema, request.body);
    const memberIds = body.memberIds ?? [];
    const clientId = requireTenantScope(request.user!, body.clientId);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const [result] = await connection.query(
        `
          INSERT INTO member_groups (client_id, name, description, status, created_by_user_id)
          VALUES (:clientId, :name, :description, :status, :createdByUserId)
        `,
        {
          clientId,
          name: body.name,
          description: body.description ?? null,
          status: body.status ?? "active",
          createdByUserId: request.user!.id
        }
      );
      const groupId = (result as any).insertId;
      await replaceGroupMembers(connection, groupId, clientId, memberIds);
      await connection.commit();

      response.status(201).json({
        id: groupId,
        clientId,
        name: body.name,
        description: body.description ?? null,
        status: body.status ?? "active",
        memberCount: memberIds.length
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

router.patch(
  "/:id",
  asyncHandler(async (request, response) => {
    const id = Number(request.params.id);
    if (!id) throw new AppError(422, "Invalid group id");
    const body = validate(updateMemberGroupSchema, request.body);

    const [existingRows] = await pool.query("SELECT client_id FROM member_groups WHERE id = :id LIMIT 1", { id });
    const existing = Array.isArray(existingRows) ? (existingRows[0] as { client_id: number } | undefined) : undefined;
    if (!existing) throw new AppError(404, "Group not found");

    const clientId = requireTenantScope(request.user!, existing.client_id);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      await connection.query(
        `
          UPDATE member_groups
          SET
            name = COALESCE(:name, name),
            description = IF(:descriptionProvided, :description, description),
            status = COALESCE(:status, status)
          WHERE id = :id AND client_id = :clientId
        `,
        {
          id,
          clientId,
          name: body.name ?? null,
          description: body.description ?? null,
          descriptionProvided: body.description !== undefined,
          status: body.status ?? null
        }
      );

      if (body.memberIds) await replaceGroupMembers(connection, id, clientId, body.memberIds);
      await connection.commit();
      response.json({ message: "Group updated" });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

router.delete(
  "/:id",
  asyncHandler(async (request, response) => {
    const id = Number(request.params.id);
    if (!id) throw new AppError(422, "Invalid group id");
    const [existingRows] = await pool.query("SELECT client_id FROM member_groups WHERE id = :id LIMIT 1", { id });
    const existing = Array.isArray(existingRows) ? (existingRows[0] as { client_id: number } | undefined) : undefined;
    if (!existing) throw new AppError(404, "Group not found");

    const clientId = requireTenantScope(request.user!, existing.client_id);
    await pool.query("UPDATE member_groups SET status = 'inactive' WHERE id = :id AND client_id = :clientId", { id, clientId });
    response.status(204).send();
  })
);

export { router as memberGroupsRouter };
