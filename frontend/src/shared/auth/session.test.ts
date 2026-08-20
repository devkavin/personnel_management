import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isTokenExpired, readSession, SESSION_KEY, tokenExpiresAt } from "./session";

function token(payload: object) {
  const encoded = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `header.${encoded}.signature`;
}

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear()
  });
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("session expiry", () => {
  it("reads the JWT expiry timestamp", () => {
    expect(tokenExpiresAt(token({ exp: 1_900_000_000 }))).toBe(1_900_000_000_000);
  });

  it("treats expired and malformed tokens as expired", () => {
    expect(isTokenExpired(token({ exp: 100 }), 101_000)).toBe(true);
    expect(isTokenExpired("not-a-jwt", 0)).toBe(true);
  });

  it("clears an expired persisted session", () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token: token({ exp: 100 }), user: { id: 1 } }));
    vi.spyOn(Date, "now").mockReturnValue(101_000);

    expect(readSession()).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
});
