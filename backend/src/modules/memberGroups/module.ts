import { defineModule } from "../../platform/modules.js";
import { moduleOpenApi } from "../../platform/module-openapi.js";
import { memberGroupsRouter } from "./http/routes.js";

export const memberGroupsModule = defineModule({
  key: "member-groups",
  routes: [{ path: "/api/member-groups", router: memberGroupsRouter }],
  openApi: moduleOpenApi("Member Groups", [
    { method: "get", path: "/member-groups", operationId: "listMemberGroups", summary: "List member groups" },
    { method: "post", path: "/member-groups", operationId: "createMemberGroup", summary: "Create a member group" },
    { method: "patch", path: "/member-groups/{id}", operationId: "updateMemberGroup", summary: "Update a member group" },
    { method: "delete", path: "/member-groups/{id}", operationId: "deactivateMemberGroup", summary: "Deactivate a member group" }
  ])
});
