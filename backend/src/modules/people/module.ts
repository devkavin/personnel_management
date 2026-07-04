import { defineModule } from "../../platform/modules.js";
import { moduleOpenApi } from "../../platform/module-openapi.js";
import { peopleRouter } from "./http/routes.js";

export const peopleModule = defineModule({
  key: "people",
  routes: [{ path: "/api/people", router: peopleRouter }],
  openApi: moduleOpenApi("People", [
    { method: "get", path: "/people", operationId: "listPeople", summary: "List tenant users" },
    { method: "post", path: "/people", operationId: "createPerson", summary: "Create a complete account" },
    { method: "post", path: "/people/onboard", operationId: "onboardPerson", summary: "Onboard one user" },
    { method: "post", path: "/people/onboard/bulk", operationId: "bulkOnboardPeople", summary: "Bulk onboard users" },
    { method: "patch", path: "/people/{id}", operationId: "updatePerson", summary: "Update a tenant user" },
    { method: "delete", path: "/people/{id}", operationId: "deactivatePerson", summary: "Deactivate a tenant user" }
  ])
});
