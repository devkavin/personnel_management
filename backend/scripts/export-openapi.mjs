import fs from "node:fs/promises";
import path from "node:path";
import { appModules } from "../dist/modules/catalog.js";
import { buildOpenApiDocument } from "../dist/platform/openapi.js";

const destination = path.resolve(process.argv[2] ?? "../frontend/openapi.json");
await fs.mkdir(path.dirname(destination), { recursive: true });
await fs.writeFile(destination, `${JSON.stringify(buildOpenApiDocument(appModules), null, 2)}\n`);
console.log(`OpenAPI contract written to ${destination}`);
