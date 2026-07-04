import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { appModules } from "./modules/catalog.js";
import { buildOpenApiDocument } from "./platform/openapi.js";
import { AppError } from "./shared/http.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.APP_ORIGINS, credentials: true }));
  app.use(express.json());
  app.use(pinoHttp({ enabled: env.NODE_ENV !== "test" }));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.get("/api/openapi.json", (_request, response) => response.json(buildOpenApiDocument(appModules)));
  for (const module of appModules) {
    for (const route of module.routes) app.use(route.path, route.router);
  }

  app.use((_request, _response, next) => {
    next(new AppError(404, "Route not found"));
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    const duplicate = (error as { code?: string }).code === "ER_DUP_ENTRY";
    const statusCode = error instanceof AppError ? error.statusCode : duplicate ? 409 : 500;
    const message = duplicate ? "An active or archived record already uses this name" : error instanceof Error ? error.message : "Unexpected error";
    response.status(statusCode).json({ error: { message } });
  };
  app.use(errorHandler);

  return app;
}
