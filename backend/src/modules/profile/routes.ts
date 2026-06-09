import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../../database/pool.js";
import { requireAuth, signUserToken } from "../../middleware/auth.js";
import { AppError, asyncHandler, validate } from "../../shared/http.js";
import type { AuthUser } from "../../shared/types.js";

const router = Router();

const profileSchema = z.object({
  displayName: z.string().min(2).optional(),
  email: z.string().email().optional()
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
});

function mapUser(row: any): AuthUser {
  return {
    id: Number(row.id),
    clientId: row.client_id === null ? null : Number(row.client_id),
    displayName: row.display_name,
    email: row.email,
    role: row.role,
    status: row.status
  };
}

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (request, response) => {
    response.json({ user: request.user });
  })
);

router.patch(
  "/",
  asyncHandler(async (request, response) => {
    const body = validate(profileSchema, request.body);
    await pool.query(
      `
        UPDATE users
        SET display_name = COALESCE(:displayName, display_name),
            email = COALESCE(:email, email)
        WHERE id = :id
      `,
      {
        id: request.user!.id,
        displayName: body.displayName ?? null,
        email: body.email ?? null
      }
    );

    const [rows] = await pool.query("SELECT * FROM users WHERE id = :id LIMIT 1", { id: request.user!.id });
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!row) throw new AppError(404, "User not found");

    const user = mapUser(row);
    response.json({ user, token: signUserToken(user) });
  })
);

router.patch(
  "/password",
  asyncHandler(async (request, response) => {
    const body = validate(passwordSchema, request.body);
    const [rows] = await pool.query("SELECT password_hash FROM users WHERE id = :id LIMIT 1", { id: request.user!.id });
    const row = Array.isArray(rows) ? (rows[0] as { password_hash: string } | undefined) : undefined;
    if (!row) throw new AppError(404, "User not found");

    const isValid = await bcrypt.compare(body.currentPassword, row.password_hash);
    if (!isValid) throw new AppError(401, "Current password is incorrect");

    const passwordHash = await bcrypt.hash(body.newPassword, 12);
    await pool.query("UPDATE users SET password_hash = :passwordHash WHERE id = :id", {
      id: request.user!.id,
      passwordHash
    });
    response.json({ message: "Password updated" });
  })
);

export { router as profileRouter };
