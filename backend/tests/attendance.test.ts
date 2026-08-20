import { describe, expect, it, vi } from "vitest";
import { AttendanceService } from "../src/modules/attendance/application/service.js";
import type { AttendanceRepository } from "../src/modules/attendance/infrastructure/repository.js";
import type { AuthUser } from "../src/shared/types.js";

const user: AuthUser = {
  id: 9,
  clientId: 4,
  displayName: "Coach",
  email: "coach@example.com",
  userIdentifier: "C/009",
  newUserIdentifier: null,
  role: "tenant_staff",
  status: "active",
  timezone: "Asia/Colombo",
  requiresOnboarding: false
};

function repository(overrides: Partial<AttendanceRepository> = {}) {
  return {
    audienceSetting: vi.fn().mockResolvedValue("true"),
    activePersonIds: vi.fn().mockResolvedValue([11, 12]),
    createMany: vi.fn().mockResolvedValue(2),
    ...overrides
  } as unknown as AttendanceRepository;
}

const batch = {
  audience: "member" as const,
  attendanceDate: "2026-08-19",
  records: [
    { personId: 11, status: "present" as const },
    { personId: 12, status: "late" as const }
  ]
};

describe("attendance batch", () => {
  it("writes the complete validated roster once", async () => {
    const data = repository();
    const count = await new AttendanceService(data).createBatch(user, batch);

    expect(count).toBe(2);
    expect(data.createMany).toHaveBeenCalledWith({
      clientId: 4,
      recordedByUserId: 9,
      attendanceDate: "2026-08-19",
      records: batch.records
    });
  });

  it("rejects duplicate people before writing", async () => {
    const data = repository();
    await expect(new AttendanceService(data).createBatch(user, {
      ...batch,
      records: [batch.records[0], batch.records[0]]
    })).rejects.toMatchObject({ statusCode: 422 });
    expect(data.createMany).not.toHaveBeenCalled();
  });

  it("rejects people outside the active audience roster", async () => {
    const data = repository({ activePersonIds: vi.fn().mockResolvedValue([11]) });
    await expect(new AttendanceService(data).createBatch(user, batch)).rejects.toMatchObject({ statusCode: 422 });
    expect(data.createMany).not.toHaveBeenCalled();
  });
});
