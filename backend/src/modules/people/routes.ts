import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../../database/pool.js";
import { requireAuth, requireRoles } from "../../middleware/auth.js";
import { AppError, asyncHandler, validate } from "../../shared/http.js";
import { requireTenantScope } from "../../shared/policies.js";

const router = Router();

const createPersonSchema = z.object({
  clientId: z.coerce.number().optional(),
  displayName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["client_admin", "user"]).default("user")
});

const updatePersonSchema = z.object({
  displayName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(["client_admin", "user"]).optional(),
  status: z.enum(["active", "inactive"]).optional()
});

router.use(requireAuth, requireRoles("super_admin", "client_admin"));

router.get(
  "/",
  asyncHandler(async (request, response) => {
    const clientId = requireTenantScope(request.user!, Number(request.query.clientId) || undefined);
    const [people] = await pool.query(
      `
        SELECT id, client_id AS clientId, display_name AS displayName, email, role, status, created_at AS createdAt
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
    const passwordHash = await bcrypt.hash(body.password, 12);
    const [result] = await pool.query(
      `
        INSERT INTO users (client_id, display_name, email, password_hash, role)
        VALUES (:clientId, :displayName, :email, :passwordHash, :role)
      `,
      { clientId, displayName: body.displayName, email: body.email, passwordHash, role: body.role }
    );
    response.status(201).json({ id: (result as any).insertId, clientId, displayName: body.displayName, email: body.email, role: body.role });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (request, response) => {
    const id = Number(request.params.id);
    const body = validate(updatePersonSchema, request.body);
    const [rows] = await pool.query("SELECT client_id FROM users WHERE id = :id AND role <> 'super_admin' LIMIT 1", { id });
    const person = Array.isArray(rows) ? (rows[0] as { client_id: number } | undefined) : undefined;
    if (!person) throw new AppError(404, "Person not found");

    requireTenantScope(request.user!, person.client_id);
    const passwordHash = body.password ? await bcrypt.hash(body.password, 12) : undefined;
    await pool.query(
      `
        UPDATE users
        SET
          display_name = COALESCE(:displayName, display_name),
          email = COALESCE(:email, email),
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
    const [rows] = await pool.query("SELECT client_id FROM users WHERE id = :id AND role <> 'super_admin' LIMIT 1", { id });
    const person = Array.isArray(rows) ? (rows[0] as { client_id: number } | undefined) : undefined;
    if (!person) throw new AppError(404, "Person not found");

    requireTenantScope(request.user!, person.client_id);
    await pool.query("UPDATE users SET status = 'inactive' WHERE id = :id AND client_id = :clientId", {
      id,
      clientId: person.client_id
    });
    response.status(204).send();
  })
);

export { router as peopleRouter };
