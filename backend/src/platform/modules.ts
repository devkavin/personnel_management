import type { Router } from "express";
import type { OpenAPIV3 } from "openapi-types";
import type { SystemCapability } from "./systems.js";

export interface RouteMount {
  path: string;
  router: Router;
}

export interface AppModule {
  key: string;
  routes: RouteMount[];
  openApi?: OpenAPIV3.Document;
  system?: SystemCapability;
}

export function defineModule(module: AppModule) {
  return module;
}
