import { Router } from "express";
import { pool } from "../../../database/pool.js";
import { requireAuth, requireRoles } from "../../../middleware/auth.js";
import { requireTenantSystem } from "../../../middleware/systems.js";
import { asyncHandler, validate } from "../../../shared/http.js";
import { AttendanceService } from "../application/service.js";
import { AttendanceRepository } from "../infrastructure/repository.js";
import { attendanceQuerySchema, createAttendanceBatchSchema, createAttendanceSchema } from "./schemas.js";

const router = Router();
const service = new AttendanceService(new AttendanceRepository(pool));

router.use(requireAuth, requireRoles("super_admin", "tenant_admin", "tenant_staff"), requireTenantSystem("attendance"));

router.get("/", asyncHandler(async (request, response) => {
  const query = validate(attendanceQuerySchema, request.query);
  const records = await service.list(request.user!, { ...query, audience: query.audience ?? "member" });
  response.json({ records });
}));

router.post("/", asyncHandler(async (request, response) => {
  const id = await service.create(request.user!, validate(createAttendanceSchema, request.body));
  response.status(201).json({ id, message: "Attendance recorded" });
}));

router.post("/batch", asyncHandler(async (request, response) => {
  const count = await service.createBatch(request.user!, validate(createAttendanceBatchSchema, request.body));
  response.status(201).json({ count, message: "Attendance roster recorded" });
}));

export { router as attendanceRouter };
