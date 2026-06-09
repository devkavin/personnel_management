import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { signUserToken } from "../src/middleware/auth.js";
import { env } from "../src/config/env.js";
import type { AuthUser } from "../src/shared/types.js";

describe("auth token", () => {
  it("includes role and tenant scope in signed tokens", () => {
    const user: AuthUser = {
      id: 7,
      clientId: 3,
      displayName: "A User",
      email: "user@example.com",
      role: "client_admin",
      status: "active"
    };

    const token = signUserToken(user);
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;

    expect(decoded.sub).toBe("7");
    expect(decoded.clientId).toBe(3);
    expect(decoded.role).toBe("client_admin");
  });
});
