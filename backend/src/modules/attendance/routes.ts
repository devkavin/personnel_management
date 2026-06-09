import { Router } from "express";
import { z } from "zod";
import { pool } from "../../database/pool.js";
import { requireAuth, requireRoles } from "../../middleware/auth.js";
import { requireClientFeature } from "../../middleware/features.js";
import { AppError, asyncHandler, validate } from "../../shared/http.js";
import { requireTenantScope } from "../../shared/policies.js";

const router = Router();

const createAttendanceSchema = z.object({
  clientId: z.coerce.number().optional(),
  personId: z.coerce.number(),
  attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["present", "absent", "late", "excused"]),
  notes: z.string().max(2000).optional()
});

router.use(requireAuth, requireRoles("super_admin", "client_admin"), requireClientFeature("attendance"));

router.get(
  "/",
  asyncHandler(async (request, response) => {
    const clientId = requireTenantScope(request.user!, Number(request.query.clientId) || undefined);
    const personId = Number(request.query.personId) || undefined;
    const fromDate = typeof request.query.fromDate === "string" ? request.query.fromDate : undefined;
    const toDate = typeof request.query.toDate === "string" ? request.query.toDate : undefined;

    const [records] = await pool.query(
      `
        SELECT
          ar.id,
          ar.client_id AS clientId,
          ar.person_id AS personId,
          person.display_name AS personName,
          ar.recorded_by_user_id AS recordedByUserId,
          recorder.display_name AS recordedByName,
          ar.attendance_date AS attendanceDate,
          ar.status,
          ar.notes,
          ar.created_at AS createdAt
        FROM attendance_records ar
        INNER JOIN users person ON person.id = ar.person_id AND person.client_id = ar.client_id
        INNER JOIN users recorder ON recorder.id = ar.recorded_by_user_id
        WHERE ar.client_id = :clientId
          AND (:personId IS NULL OR ar.person_id = :personId)
          AND (:fromDate IS NULL OR ar.attendance_date >= :fromDate)
          AND (:toDate IS NULL OR ar.attendance_date <= :toDate)
        ORDER BY ar.attendance_date DESC, person.display_name ASC
      `,
      { clientId, personId: personId ?? null, fromDate: fromDate ?? null, toDate: toDate ?? null }
    );
    response.json({ records });
  })
);

router.post(
  "/",
  asyncHandler(async (request, response) => {
    const body = validate(createAttendanceSchema, request.body);
    const clientId = requireTenantScope(request.user!, body.clientId);

    const [people] = await pool.query(
      "SELECT id FROM users WHERE id = :personId AND client_id = :clientId AND role <> 'super_admin' AND status = 'active' LIMIT 1",
      { personId: body.personId, clientId }
    );
    if (!Array.isArray(people) || people.length === 0) throw new AppError(404, "Person not found in this client");

    const [result] = await pool.query(
      `
        INSERT INTO attendance_records (client_id, person_id, recorded_by_user_id, attendance_date, status, notes)
        VALUES (:clientId, :personId, :recordedByUserId, :attendanceDate, :status, :notes)
        ON DUPLICATE KEY UPDATE
          recorded_by_user_id = VALUES(recorded_by_user_id),
          status = VALUES(status),
          notes = VALUES(notes)
      `,
      {
        clientId,
        personId: body.personId,
        recordedByUserId: request.user!.id,
        attendanceDate: body.attendanceDate,
        status: body.status,
        notes: body.notes ?? null
      }
    );
    response.status(201).json({ id: (result as any).insertId, message: "Attendance recorded" });
  })
);

export { router as attendanceRouter };
