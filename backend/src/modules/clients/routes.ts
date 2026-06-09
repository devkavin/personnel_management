import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../../database/pool.js";
import { requireAuth, requireRoles } from "../../middleware/auth.js";
import { AppError, asyncHandler, validate } from "../../shared/http.js";

const router = Router();

const clientSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  personSingular: z.string().min(2).default("person"),
  personPlural: z.string().min(2).default("people"),
  admin: z
    .object({
      displayName: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(8)
    })
    .optional()
});

const updateClientSchema = clientSchema.omit({ admin: true }).partial().extend({
  status: z.enum(["active", "inactive"]).optional()
});

router.use(requireAuth, requireRoles("super_admin"));

router.get(
  "/",
  asyncHandler(async (_request, response) => {
    const [clients] = await pool.query(`
      SELECT id, name, slug, person_singular AS personSingular, person_plural AS personPlural, status, created_at AS createdAt
      FROM clients
      ORDER BY created_at DESC
    `);
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
          INSERT INTO clients (name, slug, person_singular, person_plural)
          VALUES (:name, :slug, :personSingular, :personPlural)
        `,
        body
      );
      const clientId = (result as any).insertId;

      await connection.query(
        `
          INSERT INTO client_features (client_id, feature_id, enabled)
          SELECT :clientId, id, code = 'attendance'
          FROM features
        `,
        { clientId }
      );

      let admin = null;
      if (body.admin) {
        const passwordHash = await bcrypt.hash(body.admin.password, 12);
        const [adminResult] = await connection.query(
          `
            INSERT INTO users (client_id, display_name, email, password_hash, role)
            VALUES (:clientId, :displayName, :email, :passwordHash, 'client_admin')
          `,
          {
            clientId,
            displayName: body.admin.displayName,
            email: body.admin.email,
            passwordHash
          }
        );
        admin = {
          id: (adminResult as any).insertId,
          clientId,
          displayName: body.admin.displayName,
          email: body.admin.email,
          role: "client_admin"
        };
      }

      await connection.commit();
      response.status(201).json({
        id: clientId,
        name: body.name,
        slug: body.slug,
        personSingular: body.personSingular,
        personPlural: body.personPlural,
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
          status = COALESCE(:status, status)
        WHERE id = :id
      `,
      {
        id,
        name: body.name ?? null,
        slug: body.slug ?? null,
        personSingular: body.personSingular ?? null,
        personPlural: body.personPlural ?? null,
        status: body.status ?? null
      }
    );
    response.json({ message: "Client updated" });
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
