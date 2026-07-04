import { defineModule } from "../../platform/modules.js";
import { moduleOpenApi } from "../../platform/module-openapi.js";
import { dashboardRouter } from "./http/routes.js";

export const dashboardModule = defineModule({
  key: "dashboard",
  routes: [{ path: "/api/dashboard", router: dashboardRouter }],
  openApi: moduleOpenApi("Dashboard", [{ method: "get", path: "/dashboard", operationId: "dashboard", summary: "Read role dashboard metrics" }])
});
