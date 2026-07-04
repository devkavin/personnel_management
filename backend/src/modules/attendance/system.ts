import type { SystemCapability } from "../../platform/systems.js";

export const attendanceSystem: SystemCapability = {
  code: "attendance",
  async dashboardStats(database) {
    const [rows] = await database.query(
      `SELECT
        SUM(CASE WHEN ts.enabled AND staff.setting_value = 'true' THEN 1 ELSE 0 END) AS staffAttendanceTenants,
        SUM(CASE WHEN ts.enabled AND member.setting_value = 'true' THEN 1 ELSE 0 END) AS memberAttendanceTenants
       FROM clients client
       LEFT JOIN tenant_systems ts ON ts.client_id = client.id AND ts.system_code = 'attendance'
       LEFT JOIN tenant_system_settings staff
         ON staff.client_id = client.id AND staff.system_code = 'attendance' AND staff.setting_key = 'staff_attendance_enabled'
       LEFT JOIN tenant_system_settings member
         ON member.client_id = client.id AND member.system_code = 'attendance' AND member.setting_key = 'member_attendance_enabled'`
    );
    return (Array.isArray(rows) ? rows[0] : {}) as Record<string, unknown>;
  },
  globalSettings: [
    {
      key: "default_attendance_status",
      apiKey: "defaultAttendanceStatus",
      name: "Default attendance status",
      scope: "system",
      type: "select",
      defaultValue: "present",
      options: ["present", "absent", "late", "excused"]
    },
    {
      key: "notes_enabled",
      apiKey: "notesEnabled",
      name: "Notes enabled",
      scope: "system",
      type: "boolean",
      defaultValue: "true"
    }
  ],
  tenantSettings: [
    {
      key: "staff_attendance_enabled",
      apiKey: "staffAttendanceEnabled",
      name: "Staff attendance",
      scope: "tenant",
      type: "boolean",
      defaultValue: "false"
    },
    {
      key: "member_attendance_enabled",
      apiKey: "memberAttendanceEnabled",
      name: "Member attendance",
      scope: "tenant",
      type: "boolean",
      defaultValue: "false"
    }
  ]
};
