import type { AuthUser } from "../api/client";

export const SESSION_KEY = "personnel_management_frontend_session";
export const AUTH_EXPIRED_EVENT = "personnel-management:auth-expired";

export interface Session {
  token: string;
  user: AuthUser;
}

interface TokenPayload {
  exp?: number;
}

function decodeTokenPayload(token: string): TokenPayload | null {
  const payload = token.split(".")[1];
  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    return JSON.parse(atob(base64)) as TokenPayload;
  } catch {
    return null;
  }
}

export function tokenExpiresAt(token: string) {
  const expiration = decodeTokenPayload(token)?.exp;
  return typeof expiration === "number" && Number.isFinite(expiration) ? expiration * 1000 : null;
}

export function isTokenExpired(token: string, now = Date.now()) {
  const expiresAt = tokenExpiresAt(token);
  return expiresAt === null || expiresAt <= now;
}

export function readSession(): Session | null {
  const value = localStorage.getItem(SESSION_KEY);
  if (!value) return null;

  try {
    const session = JSON.parse(value) as Partial<Session>;
    if (!session.token || !session.user || isTokenExpired(session.token)) {
      clearSession();
      return null;
    }
    return session as Session;
  } catch {
    clearSession();
    return null;
  }
}

export function writeSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function notifyAuthenticationExpired() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}
