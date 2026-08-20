import { defineModule } from "../../platform/modules.js";
import { moduleOpenApi } from "../../platform/module-openapi.js";
import { attendanceRouter } from "./http/routes.js";
import { attendanceSystem } from "./system.js";

export const attendanceModule = defineModule({
  key: "attendance",
  routes: [{ path: "/api/attendance", router: attendanceRouter }],
  openApi: moduleOpenApi("Attendance", [
    { method: "get", path: "/attendance", operationId: "listAttendance", summary: "List tenant attendance" },
    { method: "post", path: "/attendance", operationId: "recordAttendance", summary: "Record tenant attendance" },
    { method: "post", path: "/attendance/batch", operationId: "recordAttendanceBatch", summary: "Record an attendance roster transactionally" }
  ]),
  system: attendanceSystem
});
