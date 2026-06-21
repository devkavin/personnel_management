import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { attendanceRouter } from "./modules/attendance/routes.js";
import { authRouter } from "./modules/auth/routes.js";
import { clientsRouter } from "./modules/clients/routes.js";
import { dashboardRouter } from "./modules/dashboard/routes.js";
import { memberGroupsRouter } from "./modules/memberGroups/routes.js";
import { peopleRouter } from "./modules/people/routes.js";
import { profileRouter } from "./modules/profile/routes.js";
import { systemsRouter } from "./modules/systems/routes.js";
import { AppError } from "./shared/http.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.APP_ORIGINS.length > 0 ? env.APP_ORIGINS : env.APP_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(pinoHttp({ enabled: env.NODE_ENV !== "test" }));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/clients", clientsRouter);
  app.use("/api/tenants", clientsRouter);
  app.use("/api/people", peopleRouter);
  app.use("/api/member-groups", memberGroupsRouter);
  app.use("/api/profile", profileRouter);
  app.use("/api/attendance", attendanceRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/systems", systemsRouter);

  app.use((_request, _response, next) => {
    next(new AppError(404, "Route not found"));
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : "Unexpected error";
    response.status(statusCode).json({ error: { message } });
  };
  app.use(errorHandler);

  return app;
}
