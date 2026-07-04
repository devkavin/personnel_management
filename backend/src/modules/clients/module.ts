import { defineModule } from "../../platform/modules.js";
import { moduleOpenApi } from "../../platform/module-openapi.js";
import { clientsRouter } from "./http/routes.js";

export const clientsModule = defineModule({
  key: "clients",
  routes: [
    { path: "/api/clients", router: clientsRouter },
    { path: "/api/tenants", router: clientsRouter }
  ],
  openApi: moduleOpenApi("Tenants", [
    { method: "get", path: "/tenants", operationId: "listTenants", summary: "List tenants" },
    { method: "post", path: "/tenants", operationId: "createTenant", summary: "Create a tenant" },
    { method: "patch", path: "/tenants/{id}", operationId: "updateTenant", summary: "Update a tenant" },
    { method: "delete", path: "/tenants/{id}", operationId: "deactivateTenant", summary: "Deactivate a tenant" },
    { method: "get", path: "/tenants/current", operationId: "currentTenant", summary: "Read the current tenant" },
    { method: "get", path: "/tenants/current/features", operationId: "currentTenantFeatures", summary: "List current tenant features" },
    { method: "get", path: "/tenants/{id}/features", operationId: "tenantFeatures", summary: "List tenant features" },
    { method: "put", path: "/tenants/{id}/features", operationId: "updateTenantFeatures", summary: "Update tenant features" }
  ])
});
