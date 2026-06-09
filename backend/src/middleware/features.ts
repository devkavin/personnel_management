import type { NextFunction, Request, Response } from "express";
import { pool } from "../database/pool.js";
import { AppError } from "../shared/http.js";
import { requireTenantScope } from "../shared/policies.js";

export function requireClientFeature(featureCode: string) {
  return async (request: Request, _response: Response, next: NextFunction) => {
    try {
      if (!request.user) throw new AppError(401, "Authentication required");
      if (request.user.role === "super_admin" && !request.query.clientId && !request.body.clientId) {
        return next();
      }

      const requestedClientId = Number(request.query.clientId ?? request.body.clientId) || undefined;
      const clientId = requireTenantScope(request.user, requestedClientId);
      const [rows] = await pool.query(
        `
          SELECT cf.enabled
          FROM client_features cf
          INNER JOIN features f ON f.id = cf.feature_id
          WHERE cf.client_id = :clientId AND f.code = :featureCode
          LIMIT 1
        `,
        { clientId, featureCode }
      );
      const feature = Array.isArray(rows) ? (rows[0] as { enabled?: number } | undefined) : undefined;
      if (!feature?.enabled) throw new AppError(403, `${featureCode} feature is disabled for this client`);
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
