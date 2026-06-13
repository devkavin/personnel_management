import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../../database/pool.js";
import { requireAuth, requireRoles } from "../../middleware/auth.js";
import { AppError, asyncHandler, validate } from "../../shared/http.js";
import { assertValidUserIdentifier } from "../../shared/identifiers.js";
import { requireTenantScope } from "../../shared/policies.js";
import type { Role } from "../../shared/types.js";

const router = Router();

const createPersonSchema = z.object({
  clientId: z.coerce.number().optional(),
  displayName: z.string().min(2),
  email: z.string().email(),
  userIdentifier: z.string().optional(),
  newUserIdentifier: z.string().optional(),
  password: z.string().min(8),
  role: z.enum(["tenant_admin", "tenant_staff", "tenant_member"]).default("tenant_member")
});

const updatePersonSchema = z.object({
  displayName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  userIdentifier: z.string().nullable().optional(),
  newUserIdentifier: z.string().nullable().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(["tenant_admin", "tenant_staff", "tenant_member"]).optional(),
  status: z.enum(["active", "inactive"]).optional()
});

function assertCanManageRole(actorRole: Role, targetRole: Role) {
  if (actorRole === "super_admin" || actorRole === "tenant_admin") return;
  if (actorRole === "tenant_staff" && targetRole === "tenant_member") return;
  throw new AppError(403, "Cannot manage this role");
}

async function assertUniqueUserIdentifiers(_clientId: number, identifiers: Array<string | null>, ignoredUserId?: number) {
  const values = identifiers.filter((value): value is string => Boolean(value));
  if (values.length === 0) return;
  if (new Set(values).size !== values.length) throw new AppError(409, "User IDs must be unique");
  const placeholders = values.map((_, index) => `:identifier${index}`).join(", ");
  const params = Object.fromEntries(values.map((value, index) => [`identifier${index}`, value]));

  const [rows] = await pool.query(
    `
      SELECT id
      FROM users
      WHERE (:ignoredUserId IS NULL OR id <> :ignoredUserId)
        AND (
          user_identifier IN (${placeholders})
          OR new_user_identifier IN (${placeholders})
        )
      LIMIT 1
    `,
    { ignoredUserId: ignoredUserId ?? null, ...params }
  );
  if (Array.isArray(rows) && rows.length > 0) throw new AppError(409, "User ID already exists");
}

router.use(requireAuth, requireRoles("super_admin", "tenant_admin", "tenant_staff"));

router.get(
  "/",
  asyncHandler(async (request, response) => {
    const clientId = requireTenantScope(request.user!, Number(request.query.clientId) || undefined);
    const [people] = await pool.query(
      `
        SELECT
          id,
          client_id AS clientId,
          display_name AS displayName,
          email,
          user_identifier AS userIdentifier,
          new_user_identifier AS newUserIdentifier,
          role,
          status,
          created_at AS createdAt
        FROM users
        WHERE client_id = :clientId
        ORDER BY display_name
      `,
      { clientId }
    );
    response.json({ people });
  })
);

router.post(
  "/",
  asyncHandler(async (request, response) => {
    const body = validate(createPersonSchema, request.body);
    const clientId = requireTenantScope(request.user!, body.clientId);
    const role = body.role ?? "tenant_member";
    assertCanManageRole(request.user!.role, role);
    const userIdentifier = assertValidUserIdentifier(body.userIdentifier);
    const newUserIdentifier = assertValidUserIdentifier(body.newUserIdentifier);
    await assertUniqueUserIdentifiers(clientId, [userIdentifier, newUserIdentifier]);
    const passwordHash = await bcrypt.hash(body.password, 12);
    const [result] = await pool.query(
      `
        INSERT INTO users (client_id, display_name, email, user_identifier, new_user_identifier, password_hash, role)
        VALUES (:clientId, :displayName, :email, :userIdentifier, :newUserIdentifier, :passwordHash, :role)
      `,
      { clientId, displayName: body.displayName, email: body.email, userIdentifier, newUserIdentifier, passwordHash, role }
    );
    response.status(201).json({
      id: (result as any).insertId,
      clientId,
      displayName: body.displayName,
      email: body.email,
      userIdentifier,
      newUserIdentifier,
      role
    });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (request, response) => {
    const id = Number(request.params.id);
    const body = validate(updatePersonSchema, request.body);
    const [rows] = await pool.query(
      "SELECT client_id, role, user_identifier, new_user_identifier FROM users WHERE id = :id AND role <> 'super_admin' LIMIT 1",
      { id }
    );
    const person = Array.isArray(rows)
      ? (rows[0] as { client_id: number; role: Role; user_identifier: string | null; new_user_identifier: string | null } | undefined)
      : undefined;
    if (!person) throw new AppError(404, "Person not found");

    requireTenantScope(request.user!, person.client_id);
    assertCanManageRole(request.user!.role, person.role);
    if (body.role) assertCanManageRole(request.user!.role, body.role);
    const userIdentifier = body.userIdentifier === undefined ? undefined : assertValidUserIdentifier(body.userIdentifier);
    const newUserIdentifier = body.newUserIdentifier === undefined ? undefined : assertValidUserIdentifier(body.newUserIdentifier);
    const finalUserIdentifier = userIdentifier === undefined ? person.user_identifier : userIdentifier;
    const finalNewUserIdentifier = newUserIdentifier === undefined ? person.new_user_identifier : newUserIdentifier;
    if (userIdentifier !== undefined || newUserIdentifier !== undefined) {
      await assertUniqueUserIdentifiers(person.client_id, [finalUserIdentifier, finalNewUserIdentifier], id);
    }
    const passwordHash = body.password ? await bcrypt.hash(body.password, 12) : undefined;
    await pool.query(
      `
        UPDATE users
        SET
          display_name = COALESCE(:displayName, display_name),
          email = COALESCE(:email, email),
          user_identifier = :userIdentifier,
          new_user_identifier = :newUserIdentifier,
          password_hash = COALESCE(:passwordHash, password_hash),
          role = COALESCE(:role, role),
          status = COALESCE(:status, status)
        WHERE id = :id AND client_id = :clientId
      `,
      {
        id,
        clientId: person.client_id,
        displayName: body.displayName ?? null,
        email: body.email ?? null,
        userIdentifier: finalUserIdentifier,
        newUserIdentifier: finalNewUserIdentifier,
        passwordHash: passwordHash ?? null,
        role: body.role ?? null,
        status: body.status ?? null
      }
    );
    response.json({ message: "Person updated" });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (request, response) => {
    const id = Number(request.params.id);
    const [rows] = await pool.query("SELECT client_id, role FROM users WHERE id = :id AND role <> 'super_admin' LIMIT 1", { id });
    const person = Array.isArray(rows) ? (rows[0] as { client_id: number; role: Role } | undefined) : undefined;
    if (!person) throw new AppError(404, "Person not found");

    requireTenantScope(request.user!, person.client_id);
    assertCanManageRole(request.user!.role, person.role);
    await pool.query("UPDATE users SET status = 'inactive' WHERE id = :id AND client_id = :clientId", {
      id,
      clientId: person.client_id
    });
    response.status(204).send();
  })
);

export { router as peopleRouter };
