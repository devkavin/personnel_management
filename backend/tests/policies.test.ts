import { describe, expect, it } from "vitest";
import { AppError } from "../src/shared/http.js";
import { canAccessClient, requireTenantScope } from "../src/shared/policies.js";
import type { AuthUser } from "../src/shared/types.js";

const superAdmin: AuthUser = {
  id: 1,
  clientId: null,
  displayName: "System Admin",
  email: "admin@example.com",
  userIdentifier: null,
  newUserIdentifier: null,
  role: "super_admin",
  status: "active",
  requiresOnboarding: false
};

const clientAdmin: AuthUser = {
  id: 2,
  clientId: 10,
  displayName: "Client Admin",
  email: "client@example.com",
  userIdentifier: "ADM/001",
  newUserIdentifier: null,
  role: "tenant_admin",
  status: "active",
  requiresOnboarding: false
};

describe("tenant policies", () => {
  it("allows super admins to access any explicit client", () => {
    expect(canAccessClient(superAdmin, 999)).toBe(true);
    expect(requireTenantScope(superAdmin, 999)).toBe(999);
  });

  it("requires super admins to provide a client for tenant-scoped operations", () => {
    expect(() => requireTenantScope(superAdmin)).toThrow(AppError);
  });

  it("locks client admins to their assigned client", () => {
    expect(requireTenantScope(clientAdmin)).toBe(10);
    expect(requireTenantScope(clientAdmin, 10)).toBe(10);
    expect(canAccessClient(clientAdmin, 11)).toBe(false);
    expect(() => requireTenantScope(clientAdmin, 11)).toThrow(AppError);
  });
});
