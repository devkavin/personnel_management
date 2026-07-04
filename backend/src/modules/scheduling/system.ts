import type { SystemCapability } from "../../platform/systems.js";

export const schedulingSystem: SystemCapability = {
  code: "scheduling",
  async dashboardStats(database) {
    const [rows] = await database.query(
      `SELECT
        (SELECT COUNT(*) FROM schedule_session_templates WHERE status = 'active') AS sessionTemplates,
        (SELECT COUNT(*) FROM schedule_week_templates WHERE status = 'active') AS weekTemplates,
        (SELECT COUNT(*) FROM schedule_plans WHERE status = 'published') AS publishedSchedules`
    );
    return (Array.isArray(rows) ? rows[0] : {}) as Record<string, unknown>;
  },
  async onTenantEnabled(database, tenantId, userId) {
    await database.query(
      `INSERT IGNORE INTO schedule_day_slots (client_id, name, sort_order, created_by_user_id)
       VALUES (:tenantId, 'Morning', 10, :userId), (:tenantId, 'Evening', 20, :userId)`,
      { tenantId, userId }
    );
  }
};
