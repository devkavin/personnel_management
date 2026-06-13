import { AppError } from "./http.js";

const USER_IDENTIFIER_PATTERN = /^[A-Z0-9/]+$/;

export function normalizeUserIdentifier(value?: string | null) {
  const normalized = value?.trim().toUpperCase();
  return normalized || null;
}

export function assertValidUserIdentifier(value?: string | null) {
  const normalized = normalizeUserIdentifier(value);
  if (!normalized) return null;
  if (!USER_IDENTIFIER_PATTERN.test(normalized)) {
    throw new AppError(422, "User ID can only contain letters, numbers, and /");
  }
  return normalized;
}
