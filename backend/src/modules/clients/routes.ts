import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../../database/pool.js";
import { requireAuth, requireRoles } from "../../middleware/auth.js";
import { AppError, asyncHandler, validate } from "../../shared/http.js";
import { assertValidUserIdentifier } from "../../shared/identifiers.js";

const router = Router();

const clientSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  personSingular: z.string().min(2).default("person"),
  personPlural: z.string().min(2).default("people"),
  staffSingular: z.string().min(2).default("coach"),
  staffPlural: z.string().min(2).default("coaches"),
  memberSingular: z.string().min(2).default("student"),
  memberPlural: z.string().min(2).default("students"),
  userIdentifierLabel: z.string().min(2).default("User ID"),
  newUserIdentifierLabel: z.string().min(2).default("New User ID"),
  memberGroupSingular: z.string().min(2).default("Class"),
  memberGroupPlural: z.string().min(2).default("Classes"),
  admin: z
    .object({
      displayName: z.string().min(2),
      email: z.string().email(),
      userIdentifier: z.string().optional(),
      newUserIdentifier: z.string().optional(),
      password: z.string().min(8)
    })
    .optional()
});

const updateClientSchema = clientSchema.omit({ admin: true }).partial().extend({
  status: z.enum(["active", "inactive"]).optional()
});

const tenantSelect = `
  SELECT
    id,
    name,
    slug,
    person_singular AS personSingular,
    person_plural AS personPlural,
    staff_singular AS staffSingular,
    staff_plural AS staffPlural,
    member_singular AS memberSingular,
    member_plural AS memberPlural,
    user_identifier_label AS userIdentifierLabel,
    new_user_identifier_label AS newUserIdentifierLabel,
    member_group_singular AS memberGroupSingular,
    member_group_plural AS memberGroupPlural,
    status,
    created_at AS createdAt
  FROM clients
`;

router.use(requireAuth);

router.get(
  "/current",
  asyncHandler(async (request, response) => {
    if (!request.user?.clientId) throw new AppError(403, "User is not assigned to a tenant");

    const [rows] = await pool.query(`${tenantSelect} WHERE id = :clientId LIMIT 1`, { clientId: request.user.clientId });
    const tenant = Array.isArray(rows) ? rows[0] : undefined;
    if (!tenant) throw new AppError(404, "Tenant not found");

    response.json({ tenant });
  })
);

router.get(
  "/current/features",
  asyncHandler(async (request, response) => {
    if (!request.user?.clientId) throw new AppError(403, "User is not assigned to a tenant");

    const [features] = await pool.query(
      `
        SELECT
          'attendance_staff' AS code,
          'Staff Attendance' AS name,
          'Track attendance for tenant staff.' AS description,
          (ts.enabled AND staff.setting_value = 'true') AS enabled
        FROM tenant_systems ts
        LEFT JOIN tenant_system_settings staff
          ON staff.client_id = ts.client_id AND staff.system_code = ts.system_code AND staff.setting_key = 'staff_attendance_enabled'
        WHERE ts.client_id = :clientId AND ts.system_code = 'attendance'
        UNION ALL
        SELECT
          'attendance_member' AS code,
          'Member Attendance' AS name,
          'Track attendance for tenant members.' AS description,
          (ts.enabled AND member.setting_value = 'true') AS enabled
        FROM tenant_systems ts
        LEFT JOIN tenant_system_settings member
          ON member.client_id = ts.client_id AND member.system_code = ts.system_code AND member.setting_key = 'member_attendance_enabled'
        WHERE ts.client_id = :clientId AND ts.system_code = 'attendance'
        ORDER BY name
      `,
      { clientId: request.user.clientId }
    );
    response.json({ features });
  })
);

router.use(requireRoles("super_admin"));

router.get(
  "/",
  asyncHandler(async (_request, response) => {
    const [clients] = await pool.query(`${tenantSelect} ORDER BY created_at DESC`);
    response.json({ clients, tenants: clients });
  })
);

router.post(
  "/",
  asyncHandler(async (request, response) => {
    const body = validate(clientSchema, request.body);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const [result] = await connection.query(
        `
          INSERT INTO clients (
            name,
            slug,
            person_singular,
            person_plural,
            staff_singular,
            staff_plural,
            member_singular,
            member_plural,
            user_identifier_label,
            new_user_identifier_label,
            member_group_singular,
            member_group_plural
          )
          VALUES (
            :name,
            :slug,
            :personSingular,
            :personPlural,
            :staffSingular,
            :staffPlural,
            :memberSingular,
            :memberPlural,
            :userIdentifierLabel,
            :newUserIdentifierLabel,
            :memberGroupSingular,
            :memberGroupPlural
          )
        `,
        body
      );
      const clientId = (result as any).insertId;

      await connection.query(
        `
          INSERT INTO client_features (client_id, feature_id, enabled)
          SELECT :clientId, id, code IN ('attendance', 'attendance_staff', 'attendance_member')
          FROM features
        `,
        { clientId }
      );

      await connection.query(
        `
          INSERT INTO tenant_systems (client_id, system_code, enabled)
          VALUES (:clientId, 'attendance', TRUE)
        `,
        { clientId }
      );

      await connection.query(
        `
          INSERT INTO tenant_system_settings (client_id, system_code, setting_key, setting_value)
          VALUES
            (:clientId, 'attendance', 'staff_attendance_enabled', 'true'),
            (:clientId, 'attendance', 'member_attendance_enabled', 'true')
        `,
        { clientId }
      );

      let admin = null;
      if (body.admin) {
        const userIdentifier = assertValidUserIdentifier(body.admin.userIdentifier);
        const newUserIdentifier = assertValidUserIdentifier(body.admin.newUserIdentifier);
        if (userIdentifier && newUserIdentifier && userIdentifier === newUserIdentifier) throw new AppError(409, "User IDs must be unique");
        if (userIdentifier || newUserIdentifier) {
          const identifiers = [userIdentifier, newUserIdentifier].filter((value): value is string => Boolean(value));
          const placeholders = identifiers.map((_, index) => `:identifier${index}`).join(", ");
          const params = Object.fromEntries(identifiers.map((value, index) => [`identifier${index}`, value]));
          const [existingIdentifiers] = await connection.query(
            `
              SELECT id
              FROM users
              WHERE user_identifier IN (${placeholders})
                 OR new_user_identifier IN (${placeholders})
              LIMIT 1
            `,
            params
          );
          if (Array.isArray(existingIdentifiers) && existingIdentifiers.length > 0) throw new AppError(409, "User ID already exists");
        }
        const passwordHash = await bcrypt.hash(body.admin.password, 12);
        const [adminResult] = await connection.query(
          `
            INSERT INTO users (client_id, display_name, email, user_identifier, new_user_identifier, password_hash, role)
            VALUES (:clientId, :displayName, :email, :userIdentifier, :newUserIdentifier, :passwordHash, 'tenant_admin')
          `,
          {
            clientId,
            displayName: body.admin.displayName,
            email: body.admin.email,
            userIdentifier,
            newUserIdentifier,
            passwordHash
          }
        );
        admin = {
          id: (adminResult as any).insertId,
          clientId,
          displayName: body.admin.displayName,
          email: body.admin.email,
          userIdentifier,
          newUserIdentifier,
          role: "tenant_admin"
        };
      }

      await connection.commit();
      response.status(201).json({
        id: clientId,
        name: body.name,
        slug: body.slug,
        personSingular: body.personSingular,
        personPlural: body.personPlural,
        staffSingular: body.staffSingular,
        staffPlural: body.staffPlural,
        memberSingular: body.memberSingular,
        memberPlural: body.memberPlural,
        userIdentifierLabel: body.userIdentifierLabel,
        newUserIdentifierLabel: body.newUserIdentifierLabel,
        memberGroupSingular: body.memberGroupSingular,
        memberGroupPlural: body.memberGroupPlural,
        status: "active",
        admin
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
    if (!id) throw new AppError(422, "Invalid client id");
    const body = validate(updateClientSchema, request.body);
    await pool.query(
      `
        UPDATE clients
        SET
          name = COALESCE(:name, name),
          slug = COALESCE(:slug, slug),
          person_singular = COALESCE(:personSingular, person_singular),
          person_plural = COALESCE(:personPlural, person_plural),
          staff_singular = COALESCE(:staffSingular, staff_singular),
          staff_plural = COALESCE(:staffPlural, staff_plural),
          member_singular = COALESCE(:memberSingular, member_singular),
          member_plural = COALESCE(:memberPlural, member_plural),
          user_identifier_label = COALESCE(:userIdentifierLabel, user_identifier_label),
          new_user_identifier_label = COALESCE(:newUserIdentifierLabel, new_user_identifier_label),
          member_group_singular = COALESCE(:memberGroupSingular, member_group_singular),
          member_group_plural = COALESCE(:memberGroupPlural, member_group_plural),
          status = COALESCE(:status, status)
        WHERE id = :id
      `,
      {
        id,
        name: body.name ?? null,
        slug: body.slug ?? null,
        personSingular: body.personSingular ?? null,
        personPlural: body.personPlural ?? null,
        staffSingular: body.staffSingular ?? null,
        staffPlural: body.staffPlural ?? null,
        memberSingular: body.memberSingular ?? null,
        memberPlural: body.memberPlural ?? null,
        userIdentifierLabel: body.userIdentifierLabel ?? null,
        newUserIdentifierLabel: body.newUserIdentifierLabel ?? null,
        memberGroupSingular: body.memberGroupSingular ?? null,
        memberGroupPlural: body.memberGroupPlural ?? null,
        status: body.status ?? null
      }
    );
    response.json({ message: "Client updated" });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (request, response) => {
    const id = Number(request.params.id);
    if (!id) throw new AppError(422, "Invalid client id");

    await pool.query("UPDATE clients SET status = 'inactive' WHERE id = :id", { id });
    response.status(204).send();
  })
);

router.get(
  "/:id/features",
  asyncHandler(async (request, response) => {
    const clientId = Number(request.params.id);
    const [features] = await pool.query(
      `
        SELECT f.code, f.name, f.description, COALESCE(cf.enabled, FALSE) AS enabled
        FROM features f
        LEFT JOIN client_features cf ON cf.feature_id = f.id AND cf.client_id = :clientId
        WHERE f.code NOT IN ('attendance', 'attendance_staff', 'attendance_member')
        ORDER BY f.name
      `,
      { clientId }
    );
    response.json({ features });
  })
);

router.put(
  "/:id/features",
  asyncHandler(async (request, response) => {
    const clientId = Number(request.params.id);
    const body = validate(z.object({ features: z.record(z.boolean()) }), request.body);

    for (const [code, enabled] of Object.entries(body.features)) {
      await pool.query(
        `
          INSERT INTO client_features (client_id, feature_id, enabled)
          SELECT :clientId, id, :enabled FROM features WHERE code = :code
          ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)
        `,
        { clientId, code, enabled }
      );
    }
    response.json({ message: "Feature flags updated" });
  })
);

export { router as clientsRouter };
