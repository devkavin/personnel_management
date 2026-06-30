import { Router } from "express";
import { pool } from "../../database/pool.js";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../shared/http.js";
import { requireTenantScope } from "../../shared/policies.js";

const router = Router();

type AttendanceStatus = "present" | "absent" | "late" | "excused";

const attendanceStatuses: AttendanceStatus[] = ["present", "absent", "late", "excused"];

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function lastSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return formatDate(date);
  });
}

function normalizeAttendanceHistory(rows: unknown[]) {
  const days = lastSevenDays();
  const history = new Map(
    days.map((date) => [
      date,
      {
        date,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        total: 0
      }
    ])
  );

  for (const row of rows as Array<{ attendanceDate: string; status: AttendanceStatus; count: number }>) {
    const day = history.get(row.attendanceDate);
    if (!day || !attendanceStatuses.includes(row.status)) continue;
    const count = Number(row.count ?? 0);
    day[row.status] = count;
    day.total += count;
  }

  return Array.from(history.values());
}

router.get(
  "/",
  requireAuth,
  asyncHandler(async (request, response) => {
    if (request.user!.role === "super_admin") {
      const [[clientStats], [userStats], [attendanceHistoryRows]] = await Promise.all([
        pool.query("SELECT COUNT(*) AS totalClients, SUM(status = 'active') AS activeClients FROM clients"),
        pool.query(`
          SELECT
            COUNT(*) AS totalUsers,
            SUM(role = 'tenant_admin') AS tenantAdmins,
            SUM(role = 'tenant_staff') AS tenantStaff,
            SUM(role = 'tenant_member') AS tenantMembers
          FROM users
          WHERE role <> 'super_admin'
        `),
        pool.query(`
          SELECT DATE_FORMAT(attendance_date, '%Y-%m-%d') AS attendanceDate, status, COUNT(*) AS count
          FROM attendance_records
          WHERE attendance_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY)
          GROUP BY attendance_date, status
          ORDER BY attendance_date ASC
        `)
      ]);
      response.json({
        scope: "system",
        clients: Array.isArray(clientStats) ? clientStats[0] : {},
        users: Array.isArray(userStats) ? userStats[0] : {},
        attendanceHistory: normalizeAttendanceHistory(Array.isArray(attendanceHistoryRows) ? attendanceHistoryRows : [])
      });
      return;
    }

    const clientId = requireTenantScope(request.user!);
    const [[peopleStats], [attendanceStats], [attendanceHistoryRows]] = await Promise.all([
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
      ),
      pool.query(
        `
          SELECT DATE_FORMAT(attendance_date, '%Y-%m-%d') AS attendanceDate, status, COUNT(*) AS count
          FROM attendance_records
          WHERE client_id = :clientId
            AND attendance_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY)
          GROUP BY attendance_date, status
          ORDER BY attendance_date ASC
        `,
        { clientId }
      )
    ]);

    response.json({
      scope: "client",
      clientId,
      people: Array.isArray(peopleStats) ? peopleStats[0] : {},
      todayAttendance: attendanceStats,
      attendanceHistory: normalizeAttendanceHistory(Array.isArray(attendanceHistoryRows) ? attendanceHistoryRows : [])
    });
  })
);

export { router as dashboardRouter };
