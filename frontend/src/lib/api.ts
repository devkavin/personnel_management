export type Role = "super_admin" | "client_admin" | "user";

export interface AuthUser {
  id: number;
  clientId: number | null;
  email: string;
  displayName: string;
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
    clientAdmins?: number;
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
  status: "active" | "inactive";
  createdAt?: string;
}

export interface Person {
  id: number;
  clientId: number;
  displayName: string;
  email: string;
  role: "client_admin" | "user";
  status: "active" | "inactive";
  createdAt?: string;
}

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

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
      admin: {
        displayName: string;
        email: string;
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
      password: string;
      role: "client_admin" | "user";
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

  attendance(token: string, filters: { fromDate?: string; toDate?: string; personId?: number } = {}) {
    const params = new URLSearchParams();
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

  updateProfile(token: string, payload: { displayName: string; email: string }) {
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
