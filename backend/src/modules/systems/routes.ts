import { Router } from "express";
import { z } from "zod";
import { pool } from "../../database/pool.js";
import { requireAuth, requireRoles } from "../../middleware/auth.js";
import { AppError, asyncHandler, validate } from "../../shared/http.js";

const router = Router();

const updateTenantSystemSchema = z.object({
  enabled: z.boolean(),
  settings: z
    .object({
      staffAttendanceEnabled: z.boolean().optional(),
      memberAttendanceEnabled: z.boolean().optional()
    })
    .default({})
});

const updateSystemSettingsSchema = z.object({
  name: z.string().min(2),
  description: z.string().nullable().optional(),
  status: z.enum(["active", "inactive"]),
  settings: z.object({
    defaultAttendanceStatus: z.enum(["present", "absent", "late", "excused"]).optional(),
    notesEnabled: z.boolean().optional()
  })
});

router.use(requireAuth, requireRoles("super_admin"));

router.get(
  "/",
  asyncHandler(async (_request, response) => {
    const [systems] = await pool.query(
      `
        SELECT
          s.code,
          s.name,
          s.description,
          s.status,
          COUNT(ts.client_id) AS tenantCount,
          SUM(CASE WHEN ts.enabled THEN 1 ELSE 0 END) AS enabledTenantCount
        FROM systems s
        LEFT JOIN tenant_systems ts ON ts.system_code = s.code
        WHERE s.status = 'active'
        GROUP BY s.code, s.name, s.description, s.status
        ORDER BY s.name ASC
      `
    );
    response.json({ systems });
  })
);

router.get(
  "/:code",
  asyncHandler(async (request, response) => {
    const code = request.params.code;
    const [systems] = await pool.query("SELECT code, name, description, status FROM systems WHERE code = :code LIMIT 1", { code });
    const system = Array.isArray(systems) ? systems[0] : undefined;
    if (!system) throw new AppError(404, "System not found");

    const [statsRows] = await pool.query(
      `
        SELECT
          COUNT(c.id) AS totalTenants,
          SUM(CASE WHEN ts.enabled THEN 1 ELSE 0 END) AS enabledTenants,
          SUM(CASE WHEN ts.enabled AND staff.setting_value = 'true' THEN 1 ELSE 0 END) AS staffAttendanceTenants,
          SUM(CASE WHEN ts.enabled AND member.setting_value = 'true' THEN 1 ELSE 0 END) AS memberAttendanceTenants
        FROM clients c
        LEFT JOIN tenant_systems ts ON ts.client_id = c.id AND ts.system_code = :code
        LEFT JOIN tenant_system_settings staff
          ON staff.client_id = c.id AND staff.system_code = :code AND staff.setting_key = 'staff_attendance_enabled'
        LEFT JOIN tenant_system_settings member
          ON member.client_id = c.id AND member.system_code = :code AND member.setting_key = 'member_attendance_enabled'
      `,
      { code }
    );
    const stats = (Array.isArray(statsRows) ? statsRows[0] : {}) as Record<string, unknown>;
    if (code === "scheduling") {
      const [schedulingRows] = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM schedule_session_templates WHERE status = 'active') AS sessionTemplates,
           (SELECT COUNT(*) FROM schedule_week_templates WHERE status = 'active') AS weekTemplates,
           (SELECT COUNT(*) FROM schedule_plans WHERE status = 'published') AS publishedSchedules`
      );
      Object.assign(stats, Array.isArray(schedulingRows) ? schedulingRows[0] : {});
    }
    response.json({ system, stats });
  })
);

router.get(
  "/:code/settings",
  asyncHandler(async (request, response) => {
    const code = request.params.code;
    const [systems] = await pool.query("SELECT code, name, description, status FROM systems WHERE code = :code LIMIT 1", { code });
    const system = Array.isArray(systems) ? systems[0] : undefined;
    if (!system) throw new AppError(404, "System not found");

    const [settingRows] = await pool.query(
      `
        SELECT setting_key AS settingKey, setting_value AS settingValue
        FROM system_settings
        WHERE system_code = :code
      `,
      { code }
    );
    const values = new Map(
      Array.isArray(settingRows)
        ? (settingRows as Array<{ settingKey: string; settingValue: string }>).map((setting) => [setting.settingKey, setting.settingValue])
        : []
    );

    response.json({
      system,
      settings:
        code === "attendance"
          ? [
              {
                key: "default_attendance_status",
                name: "Default attendance status",
                scope: "system",
                type: "select",
                value: values.get("default_attendance_status") ?? "present",
                options: ["present", "absent", "late", "excused"]
              },
              {
                key: "notes_enabled",
                name: "Notes enabled",
                scope: "system",
                type: "boolean",
                value: values.get("notes_enabled") ?? "true"
              }
            ]
          : []
    });
  })
);

router.put(
  "/:code/settings",
  asyncHandler(async (request, response) => {
    const code = request.params.code;
    const body = validate(updateSystemSettingsSchema, request.body);

    await pool.query(
      `
        UPDATE systems
        SET name = :name,
            description = :description,
            status = :status
        WHERE code = :code
      `,
      { code, name: body.name, description: body.description ?? null, status: body.status }
    );

    const settings = [
      ["default_attendance_status", body.settings.defaultAttendanceStatus],
      ["notes_enabled", body.settings.notesEnabled === undefined ? undefined : body.settings.notesEnabled ? "true" : "false"]
    ] as const;

    for (const [settingKey, settingValue] of settings) {
      if (settingValue === undefined) continue;
      await pool.query(
        `
          INSERT INTO system_settings (system_code, setting_key, setting_value)
          VALUES (:code, :settingKey, :settingValue)
          ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
        `,
        { code, settingKey, settingValue }
      );
    }

    response.json({ message: "System settings updated" });
  })
);

router.get(
  "/:code/tenant-settings",
  asyncHandler(async (request, response) => {
    const code = request.params.code;
    const [rows] = await pool.query(
      `
        SELECT
          c.id AS tenantId,
          c.name AS tenantName,
          c.slug AS tenantSlug,
          COALESCE(ts.enabled, FALSE) AS enabled,
          COALESCE(staff.setting_value, 'false') AS staffAttendanceEnabled,
          COALESCE(member.setting_value, 'false') AS memberAttendanceEnabled
        FROM clients c
        LEFT JOIN tenant_systems ts ON ts.client_id = c.id AND ts.system_code = :code
        LEFT JOIN tenant_system_settings staff
          ON staff.client_id = c.id AND staff.system_code = :code AND staff.setting_key = 'staff_attendance_enabled'
        LEFT JOIN tenant_system_settings member
          ON member.client_id = c.id AND member.system_code = :code AND member.setting_key = 'member_attendance_enabled'
        ORDER BY c.name ASC
      `,
      { code }
    );
    response.json({ tenantSettings: rows });
  })
);

router.put(
  "/:code/tenant-settings/:tenantId",
  asyncHandler(async (request, response) => {
    const code = request.params.code;
    const tenantId = Number(request.params.tenantId);
    if (!tenantId) throw new AppError(422, "Invalid tenant id");
    const body = validate(updateTenantSystemSchema, request.body);
    const settings = body.settings ?? {};

    await pool.query(
      `
        INSERT INTO tenant_systems (client_id, system_code, enabled)
        VALUES (:tenantId, :code, :enabled)
        ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)
      `,
      { tenantId, code, enabled: body.enabled }
    );

    if (code === "scheduling" && body.enabled) {
      await pool.query(
        `INSERT IGNORE INTO schedule_day_slots (client_id, name, sort_order, created_by_user_id)
         VALUES (:tenantId, 'Morning', 10, :userId), (:tenantId, 'Evening', 20, :userId)`,
        { tenantId, userId: request.user!.id }
      );
    }

    const settingUpdates = [
      ["staff_attendance_enabled", settings.staffAttendanceEnabled],
      ["member_attendance_enabled", settings.memberAttendanceEnabled]
    ] as const;

    for (const [settingKey, value] of settingUpdates) {
      if (value === undefined) continue;
      await pool.query(
        `
          INSERT INTO tenant_system_settings (client_id, system_code, setting_key, setting_value)
          VALUES (:tenantId, :code, :settingKey, :settingValue)
          ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
        `,
        { tenantId, code, settingKey, settingValue: value ? "true" : "false" }
      );
    }

    response.json({ message: "Tenant system settings updated" });
  })
);

export { router as systemsRouter };
