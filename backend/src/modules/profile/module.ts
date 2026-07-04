import { defineModule } from "../../platform/modules.js";
import { moduleOpenApi } from "../../platform/module-openapi.js";
import { profileRouter } from "./http/routes.js";

export const profileModule = defineModule({
  key: "profile",
  routes: [{ path: "/api/profile", router: profileRouter }],
  openApi: moduleOpenApi("Profile", [
    { method: "get", path: "/profile", operationId: "profile", summary: "Read the current profile" },
    { method: "patch", path: "/profile", operationId: "updateProfile", summary: "Update the current profile" },
    { method: "patch", path: "/profile/password", operationId: "updatePassword", summary: "Change password" },
    { method: "patch", path: "/profile/onboarding", operationId: "completeOnboarding", summary: "Complete first login" }
  ])
});
