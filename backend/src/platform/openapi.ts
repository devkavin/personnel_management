import type { OpenAPIV3 } from "openapi-types";
import type { AppModule } from "./modules.js";

export function buildOpenApiDocument(modules: AppModule[]): OpenAPIV3.Document {
  const paths: OpenAPIV3.PathsObject = {};
  const schemas: Record<string, OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject> = {};

  for (const module of modules) {
    if (!module.openApi) continue;
    Object.assign(paths, module.openApi.paths);
    Object.assign(schemas, module.openApi.components?.schemas ?? {});
  }

  return {
    openapi: "3.0.3",
    info: { title: "Personnel Management API", version: "1.0.0" },
    servers: [{ url: "/api" }],
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
      schemas
    }
  };
}
