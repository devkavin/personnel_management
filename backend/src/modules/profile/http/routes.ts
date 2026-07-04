import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../../../database/pool.js";
import { requireAuth, signUserToken } from "../../../middleware/auth.js";
import { AppError, asyncHandler, validate } from "../../../shared/http.js";
import { assertValidUserIdentifier } from "../../../shared/identifiers.js";
import type { AuthUser } from "../../../shared/types.js";
import { env } from "../../../config/env.js";

const router = Router();

const profileSchema = z.object({
  displayName: z.string().min(2).optional(),
  email: z.string().email().nullable().optional(),
  userIdentifier: z.string().nullable().optional(),
  newUserIdentifier: z.string().nullable().optional()
  ,timezone: z.string().min(1).max(80).optional().refine((value) => {
    if (!value) return true;
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
  }, "Enter a valid IANA timezone")
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
});

const onboardingSchema = z.object({
  displayName: z.string().min(2),
  email: z.string().email().nullable().optional(),
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
    timezone: row.timezone ?? env.APP_TIMEZONE,
    requiresOnboarding: Boolean(row.requires_onboarding)
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
    const [currentRows] = await pool.query("SELECT user_identifier, new_user_identifier FROM users WHERE id = :id LIMIT 1", { id: request.user!.id });
    const current = Array.isArray(currentRows)
      ? (currentRows[0] as { user_identifier: string | null; new_user_identifier: string | null } | undefined)
      : undefined;
    if (!current) throw new AppError(404, "User not found");

    const userIdentifier = body.userIdentifier === undefined ? current.user_identifier : assertValidUserIdentifier(body.userIdentifier);
    const newUserIdentifier = body.newUserIdentifier === undefined ? current.new_user_identifier : assertValidUserIdentifier(body.newUserIdentifier);
    const identifiers = [userIdentifier, newUserIdentifier].filter((value): value is string => Boolean(value));
    if (new Set(identifiers).size !== identifiers.length) throw new AppError(409, "User IDs must be unique");
    if (identifiers.length > 0) {
      const placeholders = identifiers.map((_, index) => `:identifier${index}`).join(", ");
      const params = Object.fromEntries(identifiers.map((value, index) => [`identifier${index}`, value]));
      const [existingRows] = await pool.query(
        `
          SELECT id
          FROM users
          WHERE id <> :id
            AND (
              user_identifier IN (${placeholders})
              OR new_user_identifier IN (${placeholders})
            )
          LIMIT 1
        `,
        { id: request.user!.id, ...params }
      );
      if (Array.isArray(existingRows) && existingRows.length > 0) throw new AppError(409, "User ID already exists");
    }

    await pool.query(
      `
        UPDATE users
        SET display_name = COALESCE(:displayName, display_name),
            email = COALESCE(:email, email),
            user_identifier = :userIdentifier,
            new_user_identifier = :newUserIdentifier
            ,timezone = COALESCE(:timezone, timezone)
        WHERE id = :id
      `,
      {
        id: request.user!.id,
        displayName: body.displayName ?? null,
        email: body.email ?? null,
        userIdentifier,
        newUserIdentifier
        ,timezone: body.timezone ?? null
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
  "/onboarding",
  asyncHandler(async (request, response) => {
    const body = validate(onboardingSchema, request.body);
    const passwordHash = await bcrypt.hash(body.password, 12);

    await pool.query(
      `
        UPDATE users
        SET display_name = :displayName,
            email = :email,
            password_hash = :passwordHash,
            requires_onboarding = FALSE
        WHERE id = :id
      `,
      {
        id: request.user!.id,
        displayName: body.displayName,
        email: body.email ?? null,
        passwordHash
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
