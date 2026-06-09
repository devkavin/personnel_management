import { AppError } from "./http.js";
import type { AuthUser, Role } from "./types.js";

export function canAccessClient(user: AuthUser, clientId: number) {
  return user.role === "super_admin" || user.clientId === clientId;
}

export function requireTenantScope(user: AuthUser, requestedClientId?: number) {
  if (user.role === "super_admin") {
    if (!requestedClientId) throw new AppError(422, "clientId is required for super admin tenant-scoped operations");
    return requestedClientId;
  }

  if (!user.clientId) throw new AppError(403, "User is not assigned to a client");
  if (requestedClientId && requestedClientId !== user.clientId) {
    throw new AppError(403, "Cannot access another client");
  }
  return user.clientId;
}

export function assertRole(user: AuthUser, roles: Role[]) {
  if (!roles.includes(user.role)) {
    throw new AppError(403, "Insufficient role");
  }
}
