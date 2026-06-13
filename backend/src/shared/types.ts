export type Role = "super_admin" | "tenant_admin" | "tenant_staff" | "tenant_member";
export type UserStatus = "active" | "inactive";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AuthUser {
  id: number;
  clientId: number | null;
  email: string;
  displayName: string;
  userIdentifier: string | null;
  newUserIdentifier: string | null;
  role: Role;
  status: UserStatus;
}
