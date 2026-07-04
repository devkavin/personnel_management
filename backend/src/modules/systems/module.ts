import { defineModule } from "../../platform/modules.js";
import { moduleOpenApi } from "../../platform/module-openapi.js";
import { systemsRouter } from "./http/routes.js";

export const systemsModule = defineModule({
  key: "systems",
  routes: [{ path: "/api/systems", router: systemsRouter }],
  openApi: moduleOpenApi("Available Systems", [
    { method: "get", path: "/systems", operationId: "listSystems", summary: "List systems" },
    { method: "get", path: "/systems/{code}", operationId: "systemDashboard", summary: "Read a system dashboard" },
    { method: "get", path: "/systems/{code}/settings", operationId: "systemSettings", summary: "Read global system settings" },
    { method: "put", path: "/systems/{code}/settings", operationId: "updateSystemSettings", summary: "Update global system settings" },
    { method: "get", path: "/systems/{code}/tenant-settings", operationId: "systemTenantSettings", summary: "Read tenant system settings" },
    { method: "put", path: "/systems/{code}/tenant-settings/{tenantId}", operationId: "updateSystemTenantSettings", summary: "Update tenant system settings" }
  ])
});
