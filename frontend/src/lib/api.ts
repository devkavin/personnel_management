export type Role = "super_admin" | "tenant_admin" | "tenant_staff" | "tenant_member";

export interface AuthUser {
  id: number;
  clientId: number | null;
  email: string;
  displayName: string;
  userIdentifier: string | null;
  newUserIdentifier: string | null;
  role: Role;
  status: "active" | "inactive";
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface DashboardResponse {
  scope: "system" | "client";
  clientId?: number;
  clients?: {
    totalClients?: number;
    activeClients?: number;
  };
  users?: {
    totalUsers?: number;
    tenantAdmins?: number;
    tenantStaff?: number;
    tenantMembers?: number;
  };
  people?: {
    totalPeople?: number;
    activePeople?: number;
  };
  todayAttendance?: Array<{
    status: "present" | "absent" | "late" | "excused";
    count: number;
  }>;
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
  status: "active" | "inactive";
  createdAt?: string;
}

export interface TenantFeature {
  code: string;
  name: string;
  description: string | null;
  enabled: boolean | number;
}

export interface AvailableSystem {
  code: string;
  name: string;
  description: string | null;
  status: "active" | "inactive";
  tenantCount?: number;
  enabledTenantCount?: number;
}

export interface SystemDashboardResponse {
  system: AvailableSystem;
  stats: {
    totalTenants?: number;
    enabledTenants?: number;
    staffAttendanceTenants?: number;
    memberAttendanceTenants?: number;
  };
}

export interface TenantSystemSetting {
  tenantId: number;
  tenantName: string;
  tenantSlug: string;
  enabled: boolean | number;
  staffAttendanceEnabled: string | boolean | number;
  memberAttendanceEnabled: string | boolean | number;
}

export interface SystemSetting {
  key: string;
  name: string;
  scope: string;
  type: "select" | "boolean";
  value: string;
  options?: string[];
}

export interface Person {
  id: number;
  clientId: number;
  displayName: string;
  email: string;
  userIdentifier: string | null;
  newUserIdentifier: string | null;
  role: "tenant_admin" | "tenant_staff" | "tenant_member";
  status: "active" | "inactive";
  createdAt?: string;
}

export interface MemberGroupMember {
  id: number;
  displayName: string;
}

export interface MemberGroup {
  id: number;
  clientId: number;
  name: string;
  description: string | null;
  status: "active" | "inactive";
  createdByUserId?: number;
  createdByName?: string;
  memberCount: number;
  members: MemberGroupMember[] | string | null;
  createdAt?: string;
}

export type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type AttendanceAudience = "staff" | "member";

export interface AttendanceRecord {
  id: number;
  clientId: number;
  personId: number;
  personName: string;
  recordedByUserId: number;
  recordedByName: string;
  attendanceDate: string;
  status: AttendanceStatus;
  notes: string | null;
  createdAt?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

function isApiError(data: unknown): data is { error?: { message?: string } } {
  return typeof data === "object" && data !== null && "error" in data;
}

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });

  const data = (await response.json().catch(() => null)) as T | { error?: { message?: string } } | null;

  if (!response.ok) {
    const message = isApiError(data) ? data.error?.message : "Request failed";
    throw new Error(message ?? "Request failed");
  }

  return data as T;
}

export const api = {
  login(email: string, password: string) {
    return request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },

  dashboard(token: string) {
    return request<DashboardResponse>("/dashboard", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },

  tenants(token: string) {
    return request<{ tenants: Tenant[] }>("/tenants", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },

  createTenant(
    token: string,
    payload: {
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
      admin: {
        displayName: string;
        email: string;
        userIdentifier?: string;
        newUserIdentifier?: string;
        password: string;
      };
    }
  ) {
    return request<Tenant>("/tenants", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
  },

  currentTenant(token: string) {
    return request<{ tenant: Tenant }>("/tenants/current", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },

  currentTenantFeatures(token: string) {
    return request<{ features: TenantFeature[] }>("/tenants/current/features", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },

  updateTenant(token: string, id: number, payload: Partial<Omit<Tenant, "id" | "createdAt">>) {
    return request<{ message: string }>(`/tenants/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
  },

  deactivateTenant(token: string, id: number) {
    return request<void>(`/tenants/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },

  tenantFeatures(token: string, id: number) {
    return request<{ features: TenantFeature[] }>(`/tenants/${id}/features`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },

  updateTenantFeatures(token: string, id: number, features: Record<string, boolean>) {
    return request<{ message: string }>(`/tenants/${id}/features`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ features })
    });
  },

  systems(token: string) {
    return request<{ systems: AvailableSystem[] }>("/systems", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },

  systemDashboard(token: string, code: string) {
    return request<SystemDashboardResponse>(`/systems/${code}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },

  systemSettings(token: string, code: string) {
    return request<{ system: AvailableSystem; settings: SystemSetting[] }>(`/systems/${code}/settings`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },

  updateSystemSettings(
    token: string,
    code: string,
    payload: {
      name: string;
      description: string | null;
      status: "active" | "inactive";
      settings: {
        defaultAttendanceStatus?: AttendanceStatus;
        notesEnabled?: boolean;
      };
    }
  ) {
    return request<{ message: string }>(`/systems/${code}/settings`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
  },

  systemTenantSettings(token: string, code: string) {
    return request<{ tenantSettings: TenantSystemSetting[] }>(`/systems/${code}/tenant-settings`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },

  updateSystemTenantSettings(
    token: string,
    code: string,
    tenantId: number,
    payload: { enabled: boolean; settings: { staffAttendanceEnabled?: boolean; memberAttendanceEnabled?: boolean } }
  ) {
    return request<{ message: string }>(`/systems/${code}/tenant-settings/${tenantId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
  },

  people(token: string) {
    return request<{ people: Person[] }>("/people", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },

  createPerson(
    token: string,
    payload: {
      displayName: string;
      email: string;
      userIdentifier?: string;
      newUserIdentifier?: string;
      password: string;
      role: "tenant_admin" | "tenant_staff" | "tenant_member";
    }
  ) {
    return request<Person>("/people", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
  },

  updatePerson(
    token: string,
    id: number,
    payload: Partial<{
      displayName: string;
      email: string;
      userIdentifier: string | null;
      newUserIdentifier: string | null;
      password: string;
      role: "tenant_admin" | "tenant_staff" | "tenant_member";
      status: "active" | "inactive";
    }>
  ) {
    return request<{ message: string }>(`/people/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
  },

  deactivatePerson(token: string, id: number) {
    return request<void>(`/people/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },

  memberGroups(token: string) {
    return request<{ groups: MemberGroup[] }>("/member-groups", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },

  createMemberGroup(
    token: string,
    payload: {
      name: string;
      description?: string | null;
      status?: "active" | "inactive";
      memberIds: number[];
    }
  ) {
    return request<MemberGroup>("/member-groups", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
  },

  updateMemberGroup(
    token: string,
    id: number,
    payload: Partial<{
      name: string;
      description: string | null;
      status: "active" | "inactive";
      memberIds: number[];
    }>
  ) {
    return request<{ message: string }>(`/member-groups/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
  },

  deactivateMemberGroup(token: string, id: number) {
    return request<void>(`/member-groups/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },

  attendance(token: string, filters: { audience?: AttendanceAudience; fromDate?: string; toDate?: string; personId?: number } = {}) {
    const params = new URLSearchParams();
    if (filters.audience) params.set("audience", filters.audience);
    if (filters.fromDate) params.set("fromDate", filters.fromDate);
    if (filters.toDate) params.set("toDate", filters.toDate);
    if (filters.personId) params.set("personId", String(filters.personId));

    const query = params.toString();
    return request<{ records: AttendanceRecord[] }>(`/attendance${query ? `?${query}` : ""}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },

  createAttendance(
    token: string,
    payload: {
      personId: number;
      audience: AttendanceAudience;
      attendanceDate: string;
      status: AttendanceStatus;
      notes?: string;
    }
  ) {
    return request<{ id: number; message: string }>("/attendance", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
  },

  updateProfile(token: string, payload: { displayName: string; email: string; userIdentifier?: string | null; newUserIdentifier?: string | null }) {
    return request<LoginResponse>("/profile", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
  },

  updatePassword(token: string, payload: { currentPassword: string; newPassword: string }) {
    return request<{ message: string }>("/profile/password", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
  }
};
