export type Role = "super_admin" | "tenant_admin" | "tenant_staff" | "tenant_member";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type AttendanceAudience = "staff" | "member";

export interface AuthUser {
  id: number;
  clientId: number | null;
  email: string | null;
  displayName: string;
  userIdentifier: string | null;
  newUserIdentifier: string | null;
  role: Role;
  status: "active" | "inactive";
  timezone: string;
  requiresOnboarding: boolean;
}

export interface LoginResponse { token: string; user: AuthUser }

export interface DashboardResponse {
  scope: "system" | "client";
  clients?: { totalClients?: number; activeClients?: number };
  users?: { totalUsers?: number; tenantAdmins?: number; tenantStaff?: number; tenantMembers?: number };
  people?: { totalPeople?: number; activePeople?: number };
  todayAttendance?: Array<{ status: AttendanceStatus; count: number }>;
  attendanceHistory?: Array<{ date: string; present: number; absent: number; late: number; excused: number; total: number }>;
}

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  personSingular: string;
  personPlural: string;
  staffSingular: string;
  staffPlural: string;
  memberSingular: string;
  memberPlural: string;
  userIdentifierLabel: string;
  newUserIdentifierLabel: string;
  memberGroupSingular: string;
  memberGroupPlural: string;
  timezone: string;
  status: "active" | "inactive";
  createdAt?: string;
}

export interface TenantFeature { code: string; name: string; description: string | null; enabled: boolean | number }
export interface AvailableSystem { code: string; name: string; description: string | null; status: "active" | "inactive"; tenantCount?: number; enabledTenantCount?: number }
export interface SystemDashboardResponse { system: AvailableSystem; stats: { totalTenants?: number; enabledTenants?: number; staffAttendanceTenants?: number; memberAttendanceTenants?: number; sessionTemplates?: number; weekTemplates?: number; publishedSchedules?: number } }
export interface SystemSetting { key: string; name: string; scope: string; type: "select" | "boolean"; value: string; options?: string[] }
export interface TenantSystemSetting { tenantId: number; tenantName: string; tenantSlug: string; enabled: boolean | number; staffAttendanceEnabled: string | boolean | number; memberAttendanceEnabled: string | boolean | number }

export interface Person {
  id: number;
  clientId: number;
  displayName: string;
  email: string | null;
  userIdentifier: string | null;
  newUserIdentifier: string | null;
  role: Exclude<Role, "super_admin">;
  status: "active" | "inactive";
  requiresOnboarding: boolean;
  createdAt?: string;
}

export interface MemberGroupMember { id: number; displayName: string }
export interface MemberGroup { id: number; clientId: number; name: string; description: string | null; status: "active" | "inactive"; createdByUserId?: number; createdByName?: string; memberCount: number; members: MemberGroupMember[] | string | null; createdAt?: string }
export interface AttendanceRecord { id: number; clientId: number; personId: number; personName: string; recordedByUserId: number; recordedByName: string; attendanceDate: string; status: AttendanceStatus; notes: string | null; createdAt?: string }
export type ScheduleResourceStatus = "active" | "archived";
export interface ScheduleTaxonomyNode { id: number; parentId: number | null; name: string; description: string | null; sortOrder: number; status: ScheduleResourceStatus }
export interface ScheduleSlot { id: number; name: string; startTime: string | null; endTime: string | null; sortOrder: number; status: ScheduleResourceStatus }
export interface ScheduleSessionTemplate { id: number; name: string; taxonomyNodeId: number; taxonomyName: string; durationMinutes: number | null; objective: string | null; instructions: string | null; intensity: string | null; location: string | null; equipment: string | null; staffNotes: string | null; ownerName: string; status: ScheduleResourceStatus }
export interface ScheduleWeekEntry { weekday: number; slotId: number; sessionTemplateId: number }
export interface ScheduleWeekTemplate { id: number; name: string; description: string | null; ownerName: string; status: ScheduleResourceStatus; entries: ScheduleWeekEntry[] | string | null }
export interface ScheduleSnapshot { id: number; name: string; durationMinutes: number | null; objective: string | null; instructions: string | null; intensity: string | null; location: string | null; equipment: string | null; staffNotes?: string | null }
export interface ScheduleOccurrence { id: number; planId: number; planName: string; scheduleDate: string; slotId: number; slotName: string; sessionSnapshot: ScheduleSnapshot | string; taxonomyPath: string[] | string; status: "draft" | "published" | "cancelled" }
export interface SchedulePlan { id: number; name: string; mode: "day" | "week" | "range"; startDate: string; endDate: string; status: "draft" | "published" | "cancelled"; ownerName: string; occurrenceCount: number; publishedAt: string | null; groupIds: number[] | string; memberIds: number[] | string }
export interface ScheduleConflict { assignmentId: number; memberId: number; memberName: string; scheduleDate: string; slotId: number; slotName: string; existingSessionName: string }
export interface MyScheduleAssignment extends Omit<ScheduleOccurrence, "id" | "status"> { id: number; slotStartTime?: string | null; status: "active" | "replaced" | "cancelled" }

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) }
  });
  const data = (await response.json().catch(() => null)) as T | { error?: { message?: string } } | null;
  if (!response.ok) {
    const message = typeof data === "object" && data !== null && "error" in data ? data.error?.message : "Request failed";
    throw new Error(message ?? "Request failed");
  }
  return data as T;
}

const json = (method: string, token: string, body?: unknown): RequestInit => ({ method, headers: auth(token), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const get = <T>(path: string, token: string) => request<T>(path, { headers: auth(token) });

export const api = {
  login(login: string, password: string) { return request<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify({ login, password }) }); },
  register(payload: { clientSlug: string; displayName: string; email: string; password: string }) { return request<{ message: string }>("/auth/register", { method: "POST", body: JSON.stringify(payload) }); },
  me(token: string) { return get<{ user: AuthUser }>("/auth/me", token); },
  dashboard(token: string) { return get<DashboardResponse>("/dashboard", token); },
  currentTenant(token: string) { return get<{ tenant: Tenant }>("/tenants/current", token); },
  currentTenantFeatures(token: string) { return get<{ features: TenantFeature[] }>("/tenants/current/features", token); },

  tenants(token: string) { return get<{ tenants: Tenant[] }>("/tenants", token); },
  createTenant(token: string, payload: Omit<Tenant, "id" | "status" | "createdAt"> & { admin?: { displayName: string; email: string; userIdentifier?: string; newUserIdentifier?: string; password: string } }) { return request<Tenant>("/tenants", json("POST", token, payload)); },
  updateTenant(token: string, id: number, payload: Partial<Omit<Tenant, "id" | "createdAt">>) { return request<{ message: string }>(`/tenants/${id}`, json("PATCH", token, payload)); },
  deactivateTenant(token: string, id: number) { return request<void>(`/tenants/${id}`, json("DELETE", token)); },
  tenantFeatures(token: string, id: number) { return get<{ features: TenantFeature[] }>(`/tenants/${id}/features`, token); },
  updateTenantFeatures(token: string, id: number, features: Record<string, boolean>) { return request<{ message: string }>(`/tenants/${id}/features`, json("PUT", token, { features })); },

  systems(token: string) { return get<{ systems: AvailableSystem[] }>("/systems", token); },
  systemDashboard(token: string, code: string) { return get<SystemDashboardResponse>(`/systems/${code}`, token); },
  systemSettings(token: string, code: string) { return get<{ system: AvailableSystem; settings: SystemSetting[] }>(`/systems/${code}/settings`, token); },
  updateSystemSettings(token: string, code: string, payload: { name: string; description: string | null; status: "active" | "inactive"; settings: { defaultAttendanceStatus?: AttendanceStatus; notesEnabled?: boolean } }) { return request<{ message: string }>(`/systems/${code}/settings`, json("PUT", token, payload)); },
  systemTenantSettings(token: string, code: string) { return get<{ tenantSettings: TenantSystemSetting[] }>(`/systems/${code}/tenant-settings`, token); },
  updateSystemTenantSettings(token: string, code: string, tenantId: number, payload: { enabled: boolean; settings: { staffAttendanceEnabled?: boolean; memberAttendanceEnabled?: boolean } }) { return request<{ message: string }>(`/systems/${code}/tenant-settings/${tenantId}`, json("PUT", token, payload)); },

  people(token: string) { return get<{ people: Person[] }>("/people", token); },
  createPerson(token: string, payload: { displayName: string; email: string; userIdentifier?: string; newUserIdentifier?: string; password: string; role: Exclude<Role, "super_admin"> }) { return request<Person>("/people", json("POST", token, payload)); },
  onboardPerson(token: string, payload: { userIdentifier: string; role: Exclude<Role, "super_admin">; memberGroupId?: number }) { return request<Person>("/people/onboard", json("POST", token, payload)); },
  bulkOnboardPeople(token: string, payload: { userIdentifiers: string; role: Exclude<Role, "super_admin">; memberGroupId?: number }) { return request<{ created: number; skipped: number; errors: Array<{ row: number; userIdentifier: string; message: string }> }>("/people/onboard/bulk", json("POST", token, payload)); },
  updatePerson(token: string, id: number, payload: Partial<{ displayName: string; email: string; userIdentifier: string | null; newUserIdentifier: string | null; password: string; role: Exclude<Role, "super_admin">; status: "active" | "inactive" }>) { return request<{ message: string }>(`/people/${id}`, json("PATCH", token, payload)); },
  deactivatePerson(token: string, id: number) { return request<void>(`/people/${id}`, json("DELETE", token)); },

  memberGroups(token: string) { return get<{ groups: MemberGroup[] }>("/member-groups", token); },
  createMemberGroup(token: string, payload: { name: string; description?: string | null; status?: "active" | "inactive"; memberIds: number[] }) { return request<MemberGroup>("/member-groups", json("POST", token, payload)); },
  updateMemberGroup(token: string, id: number, payload: Partial<{ name: string; description: string | null; status: "active" | "inactive"; memberIds: number[] }>) { return request<{ message: string }>(`/member-groups/${id}`, json("PATCH", token, payload)); },
  deactivateMemberGroup(token: string, id: number) { return request<void>(`/member-groups/${id}`, json("DELETE", token)); },

  attendance(token: string, filters: { audience?: AttendanceAudience; fromDate?: string; toDate?: string; personId?: number } = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== "") params.set(key, String(value)); });
    return get<{ records: AttendanceRecord[] }>(`/attendance${params.size ? `?${params}` : ""}`, token);
  },
  createAttendance(token: string, payload: { personId: number; audience: AttendanceAudience; attendanceDate: string; status: AttendanceStatus; notes?: string }) { return request<{ id: number; message: string }>("/attendance", json("POST", token, payload)); },

  scheduleTaxonomy(token: string) { return get<{ nodes: ScheduleTaxonomyNode[] }>("/scheduling/taxonomy", token); },
  createScheduleTaxonomy(token: string, payload: Omit<ScheduleTaxonomyNode, "id">) { return request<{ id: number }>("/scheduling/taxonomy", json("POST", token, payload)); },
  updateScheduleTaxonomy(token: string, id: number, payload: Partial<Omit<ScheduleTaxonomyNode, "id">>) { return request<{ message: string }>(`/scheduling/taxonomy/${id}`, json("PATCH", token, payload)); },
  archiveScheduleTaxonomy(token: string, id: number) { return request<void>(`/scheduling/taxonomy/${id}`, json("DELETE", token)); },
  scheduleSlots(token: string) { return get<{ slots: ScheduleSlot[] }>("/scheduling/slots", token); },
  createScheduleSlot(token: string, payload: Omit<ScheduleSlot, "id">) { return request<{ id: number }>("/scheduling/slots", json("POST", token, payload)); },
  updateScheduleSlot(token: string, id: number, payload: Partial<Omit<ScheduleSlot, "id">>) { return request<{ message: string }>(`/scheduling/slots/${id}`, json("PATCH", token, payload)); },
  archiveScheduleSlot(token: string, id: number) { return request<void>(`/scheduling/slots/${id}`, json("DELETE", token)); },
  scheduleSessions(token: string) { return get<{ templates: ScheduleSessionTemplate[] }>("/scheduling/session-templates", token); },
  createScheduleSession(token: string, payload: Omit<ScheduleSessionTemplate, "id" | "taxonomyName" | "ownerName">) { return request<{ id: number }>("/scheduling/session-templates", json("POST", token, payload)); },
  updateScheduleSession(token: string, id: number, payload: Partial<Omit<ScheduleSessionTemplate, "id" | "taxonomyName" | "ownerName">>) { return request<{ message: string }>(`/scheduling/session-templates/${id}`, json("PATCH", token, payload)); },
  archiveScheduleSession(token: string, id: number) { return request<void>(`/scheduling/session-templates/${id}`, json("DELETE", token)); },
  scheduleWeekTemplates(token: string) { return get<{ templates: ScheduleWeekTemplate[] }>("/scheduling/week-templates", token); },
  createScheduleWeekTemplate(token: string, payload: { name: string; description: string | null; status: ScheduleResourceStatus; entries: ScheduleWeekEntry[] }) { return request<{ id: number }>("/scheduling/week-templates", json("POST", token, payload)); },
  updateScheduleWeekTemplate(token: string, id: number, payload: Partial<{ name: string; description: string | null; status: ScheduleResourceStatus; entries: ScheduleWeekEntry[] }>) { return request<{ message: string }>(`/scheduling/week-templates/${id}`, json("PATCH", token, payload)); },
  archiveScheduleWeekTemplate(token: string, id: number) { return request<void>(`/scheduling/week-templates/${id}`, json("DELETE", token)); },
  schedulePlans(token: string, fromDate: string, toDate: string) { return get<{ plans: SchedulePlan[] }>(`/scheduling/plans?fromDate=${fromDate}&toDate=${toDate}`, token); },
  scheduleCalendar(token: string, fromDate: string, toDate: string) { return get<{ occurrences: ScheduleOccurrence[] }>(`/scheduling/calendar?fromDate=${fromDate}&toDate=${toDate}`, token); },
  createSchedulePlan(token: string, payload: { name: string; mode: "day" | "week" | "range"; startDate: string; endDate: string; weekTemplateId?: number | null; entries: ScheduleWeekEntry[]; groupIds: number[]; memberIds: number[] }) { return request<{ id: number; occurrenceCount: number }>("/scheduling/plans", json("POST", token, payload)); },
  updateSchedulePlan(token: string, id: number, payload: Partial<{ name: string; startDate: string; endDate: string; groupIds: number[]; memberIds: number[] }>) { return request<{ message: string }>(`/scheduling/plans/${id}`, json("PATCH", token, payload)); },
  deleteSchedulePlan(token: string, id: number) { return request<void>(`/scheduling/plans/${id}`, json("DELETE", token)); },
  scheduleConflicts(token: string, id: number) { return get<{ conflicts: ScheduleConflict[] }>(`/scheduling/plans/${id}/conflicts`, token); },
  publishSchedule(token: string, id: number, replaceAssignmentIds: number[]) { return request<{ message: string; assignmentCount: number }>(`/scheduling/plans/${id}/publish`, json("POST", token, { replaceAssignmentIds })); },
  cancelScheduleAssignment(token: string, id: number) { return request<{ message: string }>(`/scheduling/assignments/${id}/cancel`, json("POST", token)); },
  mySchedule(token: string, fromDate: string, toDate: string) { return get<{ assignments: MyScheduleAssignment[] }>(`/scheduling/my?fromDate=${fromDate}&toDate=${toDate}`, token); },
  myScheduleDetail(token: string, id: number) { return get<{ assignment: MyScheduleAssignment }>(`/scheduling/my/${id}`, token); },

  profile(token: string) { return get<{ user: AuthUser }>("/profile", token); },
  updateProfile(token: string, payload: { displayName: string; email: string | null; userIdentifier?: string | null; newUserIdentifier?: string | null; timezone?: string }) { return request<LoginResponse>("/profile", json("PATCH", token, payload)); },
  completeOnboarding(token: string, payload: { displayName: string; email?: string | null; password: string }) { return request<LoginResponse>("/profile/onboarding", json("PATCH", token, payload)); },
  updatePassword(token: string, payload: { currentPassword: string; newPassword: string }) { return request<{ message: string }>("/profile/password", json("PATCH", token, payload)); }
};
