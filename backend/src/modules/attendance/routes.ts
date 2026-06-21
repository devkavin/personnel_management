import { Router } from "express";
import { z } from "zod";
import { pool } from "../../database/pool.js";
import { requireAuth, requireRoles } from "../../middleware/auth.js";
import { AppError, asyncHandler, validate } from "../../shared/http.js";
import { requireTenantScope } from "../../shared/policies.js";

const router = Router();
const attendanceAudienceSchema = z.enum(["staff", "member"]);
type AttendanceAudience = z.infer<typeof attendanceAudienceSchema>;

const createAttendanceSchema = z.object({
  clientId: z.coerce.number().optional(),
  audience: attendanceAudienceSchema,
  personId: z.coerce.number(),
  attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["present", "absent", "late", "excused"]),
  notes: z.string().max(2000).optional()
});

router.use(requireAuth, requireRoles("super_admin", "tenant_admin", "tenant_staff"));

function audienceFeatureCode(audience: AttendanceAudience) {
  return audience === "staff" ? "staff_attendance_enabled" : "member_attendance_enabled";
}

function audienceRole(audience: AttendanceAudience) {
  return audience === "staff" ? "tenant_staff" : "tenant_member";
}

async function assertAttendanceFeature(clientId: number, audience: AttendanceAudience) {
  const [rows] = await pool.query(
    `
      SELECT ts.enabled AS systemEnabled, setting.setting_value AS settingValue
      FROM tenant_systems ts
      LEFT JOIN tenant_system_settings setting
        ON setting.client_id = ts.client_id
        AND setting.system_code = ts.system_code
        AND setting.setting_key = :featureCode
      WHERE ts.client_id = :clientId AND ts.system_code = 'attendance'
      LIMIT 1
    `,
    { clientId, featureCode: audienceFeatureCode(audience) }
  );
  const system = Array.isArray(rows) ? (rows[0] as { systemEnabled?: number; settingValue?: string } | undefined) : undefined;
  if (!system?.systemEnabled) throw new AppError(403, "Attendance system is disabled for this client");
  if (system.settingValue !== "true") throw new AppError(403, `${audience} attendance is disabled for this client`);
}

router.get(
  "/",
  asyncHandler(async (request, response) => {
    const clientId = requireTenantScope(request.user!, Number(request.query.clientId) || undefined);
    const audience = validate(attendanceAudienceSchema.default("member"), request.query.audience) ?? "member";
    const personId = Number(request.query.personId) || undefined;
    const fromDate = typeof request.query.fromDate === "string" ? request.query.fromDate : undefined;
    const toDate = typeof request.query.toDate === "string" ? request.query.toDate : undefined;
    await assertAttendanceFeature(clientId, audience);

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
          AND person.role = :personRole
          AND (:personId IS NULL OR ar.person_id = :personId)
          AND (:fromDate IS NULL OR ar.attendance_date >= :fromDate)
          AND (:toDate IS NULL OR ar.attendance_date <= :toDate)
        ORDER BY ar.attendance_date DESC, person.display_name ASC
      `,
      { clientId, personRole: audienceRole(audience), personId: personId ?? null, fromDate: fromDate ?? null, toDate: toDate ?? null }
    );
    response.json({ records });
  })
);

router.post(
  "/",
  asyncHandler(async (request, response) => {
    const body = validate(createAttendanceSchema, request.body);
    const clientId = requireTenantScope(request.user!, body.clientId);
    await assertAttendanceFeature(clientId, body.audience);

    const [people] = await pool.query(
      "SELECT id FROM users WHERE id = :personId AND client_id = :clientId AND role = :personRole AND status = 'active' LIMIT 1",
      { personId: body.personId, clientId, personRole: audienceRole(body.audience) }
    );
    if (!Array.isArray(people) || people.length === 0) throw new AppError(404, "Person not found in this client");

    let result: any;
    try {
      [result] = await pool.query(
        `
          INSERT INTO attendance_records (client_id, person_id, recorded_by_user_id, attendance_date, status, notes)
          VALUES (:clientId, :personId, :recordedByUserId, :attendanceDate, :status, :notes)
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
    } catch (error) {
      if ((error as { code?: string }).code === "ER_DUP_ENTRY") throw new AppError(409, "Attendance has already been recorded for this person and date");
      throw error;
    }
    response.status(201).json({ id: (result as any).insertId, message: "Attendance recorded" });
  })
);

export { router as attendanceRouter };
