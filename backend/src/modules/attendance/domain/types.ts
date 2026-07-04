import type { Role } from "../../../shared/types.js";

export type AttendanceAudience = "staff" | "member";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export function audienceSetting(audience: AttendanceAudience) {
  return audience === "staff" ? "staff_attendance_enabled" : "member_attendance_enabled";
}

export function audienceRole(audience: AttendanceAudience): Role {
  return audience === "staff" ? "tenant_staff" : "tenant_member";
}
