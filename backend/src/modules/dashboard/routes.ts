import { Router } from "express";
import { pool } from "../../database/pool.js";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../shared/http.js";
import { requireTenantScope } from "../../shared/policies.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (request, response) => {
    if (request.user!.role === "super_admin") {
      const [[clientStats], [userStats]] = await Promise.all([
        pool.query("SELECT COUNT(*) AS totalClients, SUM(status = 'active') AS activeClients FROM clients"),
        pool.query(`
          SELECT
            COUNT(*) AS totalUsers,
            SUM(role = 'tenant_admin') AS tenantAdmins,
            SUM(role = 'tenant_staff') AS tenantStaff,
            SUM(role = 'tenant_member') AS tenantMembers
          FROM users
          WHERE role <> 'super_admin'
        `)
      ]);
      response.json({
        scope: "system",
        clients: Array.isArray(clientStats) ? clientStats[0] : {},
        users: Array.isArray(userStats) ? userStats[0] : {}
      });
      return;
    }

    const clientId = requireTenantScope(request.user!);
    const [[peopleStats], [attendanceStats]] = await Promise.all([
      pool.query("SELECT COUNT(*) AS totalPeople, SUM(status = 'active') AS activePeople FROM users WHERE client_id = :clientId", {
        clientId
      }),
      pool.query(
        `
          SELECT status, COUNT(*) AS count
          FROM attendance_records
          WHERE client_id = :clientId AND attendance_date = CURRENT_DATE()
          GROUP BY status
        `,
        { clientId }
      )
    ]);

    response.json({
      scope: "client",
      clientId,
      people: Array.isArray(peopleStats) ? peopleStats[0] : {},
      todayAttendance: attendanceStats
    });
  })
);

export { router as dashboardRouter };
