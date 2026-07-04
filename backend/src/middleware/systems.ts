import type { NextFunction, Request, Response } from "express";
import { pool } from "../database/pool.js";
import { AppError } from "../shared/http.js";
import { requireTenantScope } from "../shared/policies.js";

export function requireTenantSystem(systemCode: string) {
  return async (request: Request, _response: Response, next: NextFunction) => {
    try {
      if (!request.user) throw new AppError(401, "Authentication required");
      const requestedClientId = Number(request.query.clientId ?? request.body?.clientId) || undefined;
      const clientId = requireTenantScope(request.user, requestedClientId);
      const [rows] = await pool.query(
        "SELECT enabled FROM tenant_systems WHERE client_id = :clientId AND system_code = :systemCode LIMIT 1",
        { clientId, systemCode }
      );
      const system = Array.isArray(rows) ? (rows[0] as { enabled?: number } | undefined) : undefined;
      if (!system?.enabled) throw new AppError(403, `${systemCode} system is disabled for this tenant`);
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
