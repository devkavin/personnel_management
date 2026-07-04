import type { OpenAPIV3 } from "openapi-types";

export interface ModuleOperation {
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string;
  operationId: string;
  summary: string;
  public?: boolean;
}

export function moduleOpenApi(title: string, operations: ModuleOperation[]): OpenAPIV3.Document {
  const paths: OpenAPIV3.PathsObject = {};
  for (const operation of operations) {
    const pathItem = paths[operation.path] ?? {};
    pathItem[operation.method] = {
      operationId: operation.operationId,
      summary: operation.summary,
      tags: [title],
      security: operation.public ? [] : [{ bearerAuth: [] }],
      responses: {
        "200": { description: "Successful response" },
        "201": { description: "Created" },
        "204": { description: "No content" },
        "401": { description: "Authentication required" },
        "403": { description: "Access denied" },
        "422": { description: "Validation failed" }
      }
    };
    paths[operation.path] = pathItem;
  }
  return { openapi: "3.0.3", info: { title: `${title} API`, version: "1.0.0" }, paths };
}
