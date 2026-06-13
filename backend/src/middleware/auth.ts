import type { NextFunction, Request, Response } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../shared/http.js";
import type { AuthUser, Role } from "../shared/types.js";
import { assertRole } from "../shared/policies.js";

interface TokenPayload {
  sub: number;
  clientId: number | null;
  email: string;
  displayName: string;
  userIdentifier: string | null;
  newUserIdentifier: string | null;
  role: Role;
  status: "active" | "inactive";
}

export function signUserToken(user: AuthUser) {
  const options: SignOptions = {
    subject: String(user.id),
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"]
  };

  return jwt.sign(
    {
      clientId: user.clientId,
      email: user.email,
      displayName: user.displayName,
      userIdentifier: user.userIdentifier,
      newUserIdentifier: user.newUserIdentifier,
      role: user.role,
      status: user.status
    },
    env.JWT_SECRET,
    options
  );
}

export function requireAuth(request: Request, _response: Response, next: NextFunction) {
  const header = request.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) return next(new AppError(401, "Authentication required"));

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as unknown as TokenPayload;
    if (payload.status !== "active") throw new AppError(403, "User is inactive");
    request.user = {
      id: Number(payload.sub),
      clientId: payload.clientId,
      email: payload.email,
      displayName: payload.displayName,
      userIdentifier: payload.userIdentifier,
      newUserIdentifier: payload.newUserIdentifier,
      role: payload.role,
      status: payload.status
    };
    return next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    return next(new AppError(401, "Invalid or expired token"));
  }
}

export function requireRoles(...roles: Role[]) {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (!request.user) return next(new AppError(401, "Authentication required"));
    try {
      assertRole(request.user, roles);
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
