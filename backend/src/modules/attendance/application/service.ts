import type { AuthUser } from "../../../shared/types.js";
import { AppError } from "../../../shared/http.js";
import { requireTenantScope } from "../../../shared/policies.js";
import { audienceRole, audienceSetting } from "../domain/types.js";
import type { AttendanceQuery, CreateAttendanceBatchInput, CreateAttendanceInput } from "../http/schemas.js";
import { AttendanceRepository } from "../infrastructure/repository.js";

export class AttendanceService {
  constructor(private readonly repository: AttendanceRepository) {}

  private async assertAudienceEnabled(clientId: number, audience: AttendanceQuery["audience"]) {
    const enabled = await this.repository.audienceSetting(clientId, audienceSetting(audience));
    if (enabled !== "true") throw new AppError(403, `${audience} attendance is disabled for this client`);
  }

  async list(user: AuthUser, query: AttendanceQuery) {
    const clientId = requireTenantScope(user, query.clientId);
    await this.assertAudienceEnabled(clientId, query.audience);
    return this.repository.list({
      clientId,
      personRole: audienceRole(query.audience),
      personId: query.personId,
      fromDate: query.fromDate,
      toDate: query.toDate
    });
  }

  async create(user: AuthUser, input: CreateAttendanceInput) {
    const clientId = requireTenantScope(user, input.clientId);
    await this.assertAudienceEnabled(clientId, input.audience);
    const role = audienceRole(input.audience);
    if (!(await this.repository.activePersonExists(clientId, input.personId, role))) {
      throw new AppError(404, "Person not found in this client");
    }
    try {
      return await this.repository.create({
        clientId,
        personId: input.personId,
        recordedByUserId: user.id,
        attendanceDate: input.attendanceDate,
        status: input.status,
        notes: input.notes
      });
    } catch (error) {
      if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
        throw new AppError(409, "Attendance has already been recorded for this person and date");
      }
      throw error;
    }
  }

  async createBatch(user: AuthUser, input: CreateAttendanceBatchInput) {
    const clientId = requireTenantScope(user, input.clientId);
    await this.assertAudienceEnabled(clientId, input.audience);
    const personIds = input.records.map((record) => record.personId);
    if (new Set(personIds).size !== personIds.length) throw new AppError(422, "Each person may only appear once in an attendance batch");

    const activePersonIds = new Set(await this.repository.activePersonIds(clientId, personIds, audienceRole(input.audience)));
    const unavailable = personIds.filter((personId) => !activePersonIds.has(personId));
    if (unavailable.length) throw new AppError(422, "One or more selected people are unavailable for this attendance audience");

    try {
      return await this.repository.createMany({
        clientId,
        recordedByUserId: user.id,
        attendanceDate: input.attendanceDate,
        records: input.records
      });
    } catch (error) {
      if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
        throw new AppError(409, "Attendance has already been recorded for one or more selected people on this date");
      }
      throw error;
    }
  }
}
