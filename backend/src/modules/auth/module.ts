import { defineModule } from "../../platform/modules.js";
import { moduleOpenApi } from "../../platform/module-openapi.js";
import { authRouter } from "./http/routes.js";

export const authModule = defineModule({
  key: "auth",
  routes: [{ path: "/api/auth", router: authRouter }],
  openApi: moduleOpenApi("Authentication", [
    { method: "post", path: "/auth/login", operationId: "login", summary: "Sign in", public: true },
    { method: "post", path: "/auth/register", operationId: "register", summary: "Register a tenant member", public: true },
    { method: "get", path: "/auth/me", operationId: "currentUser", summary: "Read the current session" }
  ])
});
