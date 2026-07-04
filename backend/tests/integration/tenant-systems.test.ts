import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { runMigrations } from "../../src/database/migrate.js";
import { pool } from "../../src/database/pool.js";
import { signUserToken } from "../../src/middleware/auth.js";
import type { AuthUser } from "../../src/shared/types.js";

const runDatabaseTests = process.env.RUN_DB_TESTS === "true";
const suite = runDatabaseTests ? describe : describe.skip;
const slug = `architecture-test-${Date.now()}`;
let tenantA = 0;
let tenantB = 0;
let adminA: AuthUser;
let memberA = 0;

suite("tenant system integration", () => {
  beforeAll(async () => {
    await runMigrations();
    const [first] = await pool.query("INSERT INTO clients (name, slug) VALUES ('Architecture A', :slug)", { slug: `${slug}-a` });
    const [second] = await pool.query("INSERT INTO clients (name, slug) VALUES ('Architecture B', :slug)", { slug: `${slug}-b` });
    tenantA = (first as { insertId: number }).insertId;
    tenantB = (second as { insertId: number }).insertId;
    const [admin] = await pool.query(
      "INSERT INTO users (client_id, display_name, email, password_hash, role) VALUES (:tenantA, 'Admin A', :email, 'unused', 'tenant_admin')",
      { tenantA, email: `${slug}-admin@example.com` }
    );
    const adminId = (admin as { insertId: number }).insertId;
    const [member] = await pool.query(
      "INSERT INTO users (client_id, display_name, email, password_hash, role) VALUES (:tenantA, 'Member A', :email, 'unused', 'tenant_member')",
      { tenantA, email: `${slug}-member@example.com` }
    );
    memberA = (member as { insertId: number }).insertId;
    adminA = {
      id: adminId, clientId: tenantA, displayName: "Admin A", email: `${slug}-admin@example.com`,
      userIdentifier: null, newUserIdentifier: null, role: "tenant_admin", status: "active",
      timezone: "Asia/Colombo", requiresOnboarding: false
    };
    await pool.query("INSERT INTO tenant_systems (client_id, system_code, enabled) VALUES (:tenantA, 'attendance', TRUE)", { tenantA });
    await pool.query(
      "INSERT INTO tenant_system_settings (client_id, system_code, setting_key, setting_value) VALUES (:tenantA, 'attendance', 'member_attendance_enabled', 'true')",
      { tenantA }
    );
  }, 90_000);

  afterAll(async () => {
    if (tenantA || tenantB) {
      await pool.query("DELETE FROM attendance_records WHERE client_id IN (:tenantA, :tenantB)", { tenantA, tenantB });
      await pool.query("DELETE FROM users WHERE client_id IN (:tenantA, :tenantB)", { tenantA, tenantB });
      await pool.query("DELETE FROM clients WHERE id IN (:tenantA, :tenantB)", { tenantA, tenantB });
    }
    await pool.end();
  });

  it("rejects cross-tenant access before querying attendance", async () => {
    const response = await request(createApp())
      .get(`/api/attendance?clientId=${tenantB}&audience=member`)
      .set("Authorization", `Bearer ${signUserToken(adminA)}`);
    expect(response.status).toBe(403);
  });

  it("preserves duplicate daily attendance prevention", async () => {
    const token = signUserToken(adminA);
    const payload = { audience: "member", personId: memberA, attendanceDate: "2026-07-03", status: "present" };
    const first = await request(createApp()).post("/api/attendance").set("Authorization", `Bearer ${token}`).send(payload);
    const duplicate = await request(createApp()).post("/api/attendance").set("Authorization", `Bearer ${token}`).send(payload);
    expect(first.status).toBe(201);
    expect(duplicate.status).toBe(409);
  });
});
