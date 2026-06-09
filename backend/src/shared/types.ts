export type Role = "super_admin" | "client_admin" | "user";
export type UserStatus = "active" | "inactive";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AuthUser {
  id: number;
  clientId: number | null;
  email: string;
  displayName: string;
  role: Role;
  status: UserStatus;
}
