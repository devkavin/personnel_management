import { defineModule } from "../../platform/modules.js";
import { moduleOpenApi } from "../../platform/module-openapi.js";
import { schedulingRouter } from "./http/routes.js";
import { schedulingSystem } from "./system.js";

export const schedulingModule = defineModule({
  key: "scheduling",
  routes: [{ path: "/api/scheduling", router: schedulingRouter }],
  openApi: moduleOpenApi("Scheduling", [
    { method: "get", path: "/scheduling/regattas", operationId: "regattas", summary: "List regattas" },
    { method: "post", path: "/scheduling/regattas", operationId: "createRegatta", summary: "Create a regatta" },
    { method: "patch", path: "/scheduling/regattas/{id}/end-date", operationId: "updateRegattaEndDate", summary: "Update a regatta end date" },
    { method: "get", path: "/scheduling/taxonomy", operationId: "scheduleTaxonomy", summary: "List taxonomy nodes" },
    { method: "post", path: "/scheduling/taxonomy", operationId: "createScheduleTaxonomy", summary: "Create a taxonomy node" },
    { method: "get", path: "/scheduling/slots", operationId: "scheduleSlots", summary: "List day slots" },
    { method: "post", path: "/scheduling/slots", operationId: "createScheduleSlot", summary: "Create a day slot" },
    { method: "get", path: "/scheduling/session-templates", operationId: "scheduleSessions", summary: "List session templates" },
    { method: "post", path: "/scheduling/session-templates", operationId: "createScheduleSession", summary: "Create a session template" },
    { method: "get", path: "/scheduling/week-templates", operationId: "scheduleWeekTemplates", summary: "List week templates" },
    { method: "post", path: "/scheduling/week-templates", operationId: "createScheduleWeekTemplate", summary: "Create a week template" },
    { method: "get", path: "/scheduling/plans", operationId: "schedulePlans", summary: "List schedule plans" },
    { method: "post", path: "/scheduling/plans", operationId: "createSchedulePlan", summary: "Create a draft schedule" },
    { method: "patch", path: "/scheduling/plans/{id}", operationId: "updateSchedulePlan", summary: "Update a draft schedule" },
    { method: "delete", path: "/scheduling/plans/{id}", operationId: "deleteSchedulePlan", summary: "Delete a draft schedule" },
    { method: "get", path: "/scheduling/plans/{id}/conflicts", operationId: "scheduleConflicts", summary: "Preview publication conflicts" },
    { method: "post", path: "/scheduling/plans/{id}/publish", operationId: "publishSchedule", summary: "Publish a schedule" },
    { method: "get", path: "/scheduling/calendar", operationId: "scheduleCalendar", summary: "Read the staff calendar" },
    { method: "get", path: "/scheduling/my", operationId: "mySchedule", summary: "Read the member schedule" },
    { method: "get", path: "/scheduling/my/{assignmentId}", operationId: "myScheduleAssignment", summary: "Read member session details" }
  ]),
  system: schedulingSystem
});
