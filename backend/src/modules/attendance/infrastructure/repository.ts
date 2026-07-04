import type { Pool } from "mysql2/promise";
import type { Role } from "../../../shared/types.js";
import type { AttendanceStatus } from "../domain/types.js";

export interface AttendanceFilters {
  clientId: number;
  personRole: Role;
  personId?: number;
  fromDate?: string;
  toDate?: string;
}

export class AttendanceRepository {
  constructor(private readonly database: Pool) {}

  async audienceSetting(clientId: number, settingKey: string) {
    const [rows] = await this.database.query(
      `SELECT setting_value AS settingValue FROM tenant_system_settings
       WHERE client_id = :clientId AND system_code = 'attendance' AND setting_key = :settingKey LIMIT 1`,
      { clientId, settingKey }
    );
    return Array.isArray(rows) ? (rows[0] as { settingValue?: string } | undefined)?.settingValue : undefined;
  }

  async list(filters: AttendanceFilters) {
    const [records] = await this.database.query(
      `SELECT ar.id, ar.client_id AS clientId, ar.person_id AS personId, person.display_name AS personName,
        ar.recorded_by_user_id AS recordedByUserId, recorder.display_name AS recordedByName,
        ar.attendance_date AS attendanceDate, ar.status, ar.notes, ar.created_at AS createdAt
       FROM attendance_records ar
       INNER JOIN users person ON person.id = ar.person_id AND person.client_id = ar.client_id
       INNER JOIN users recorder ON recorder.id = ar.recorded_by_user_id
       WHERE ar.client_id = :clientId AND person.role = :personRole
         AND (:personId IS NULL OR ar.person_id = :personId)
         AND (:fromDate IS NULL OR ar.attendance_date >= :fromDate)
         AND (:toDate IS NULL OR ar.attendance_date <= :toDate)
       ORDER BY ar.attendance_date DESC, person.display_name ASC`,
      { ...filters, personId: filters.personId ?? null, fromDate: filters.fromDate ?? null, toDate: filters.toDate ?? null }
    );
    return records;
  }

  async activePersonExists(clientId: number, personId: number, role: Role) {
    const [rows] = await this.database.query(
      "SELECT id FROM users WHERE id = :personId AND client_id = :clientId AND role = :role AND status = 'active' LIMIT 1",
      { clientId, personId, role }
    );
    return Array.isArray(rows) && rows.length > 0;
  }

  async create(input: {
    clientId: number;
    personId: number;
    recordedByUserId: number;
    attendanceDate: string;
    status: AttendanceStatus;
    notes?: string;
  }) {
    const [result] = await this.database.query(
      `INSERT INTO attendance_records (client_id, person_id, recorded_by_user_id, attendance_date, status, notes)
       VALUES (:clientId, :personId, :recordedByUserId, :attendanceDate, :status, :notes)`,
      { ...input, notes: input.notes ?? null }
    );
    return (result as { insertId: number }).insertId;
  }
}
