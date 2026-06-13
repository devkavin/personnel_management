import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../../database/pool.js";
import { requireAuth, signUserToken } from "../../middleware/auth.js";
import { AppError, asyncHandler, validate } from "../../shared/http.js";
import { normalizeUserIdentifier } from "../../shared/identifiers.js";
import type { AuthUser } from "../../shared/types.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().min(1).optional(),
  login: z.string().min(1).optional(),
  password: z.string().min(1)
});

const registerSchema = z.object({
  clientSlug: z.string().min(2),
  displayName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8)
});

function mapUser(row: any): AuthUser {
  return {
    id: Number(row.id),
    clientId: row.client_id === null ? null : Number(row.client_id),
    displayName: row.display_name,
    email: row.email,
    userIdentifier: row.user_identifier,
    newUserIdentifier: row.new_user_identifier,
    role: row.role,
    status: row.status,
    requiresOnboarding: Boolean(row.requires_onboarding)
  };
}

router.post(
  "/login",
  asyncHandler(async (request, response) => {
    const body = validate(loginSchema, request.body);
    const login = body.login ?? body.email;
    if (!login) throw new AppError(422, "Email or User ID is required");
    const normalizedIdentifier = normalizeUserIdentifier(login);
    const [rows] = await pool.query(
      `
        SELECT *
        FROM users
        WHERE email = :login
          OR user_identifier = :normalizedIdentifier
          OR new_user_identifier = :normalizedIdentifier
        LIMIT 1
      `,
      { login, normalizedIdentifier }
    );
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!row) throw new AppError(401, "Invalid credentials");

    const isValid = await bcrypt.compare(body.password, (row as any).password_hash);
    if (!isValid) throw new AppError(401, "Invalid credentials");

    const user = mapUser(row);
    if (user.status !== "active") throw new AppError(403, "User is inactive");

    response.json({ token: signUserToken(user), user });
  })
);

router.post(
  "/register",
  asyncHandler(async (request, response) => {
    const body = validate(registerSchema, request.body);
    const [clients] = await pool.query("SELECT id FROM clients WHERE slug = :slug AND status = 'active' LIMIT 1", {
      slug: body.clientSlug
    });
    const client = Array.isArray(clients) ? (clients[0] as { id: number } | undefined) : undefined;
    if (!client) throw new AppError(404, "Client not found");

    const passwordHash = await bcrypt.hash(body.password, 12);
    await pool.query(
      `
        INSERT INTO users (client_id, display_name, email, password_hash, role)
        VALUES (:clientId, :displayName, :email, :passwordHash, 'tenant_member')
      `,
      {
        clientId: client.id,
        displayName: body.displayName,
        email: body.email,
        passwordHash
      }
    );

    response.status(201).json({ message: "Registration complete" });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (request, response) => {
    response.json({ user: request.user });
  })
);

export { router as authRouter };
