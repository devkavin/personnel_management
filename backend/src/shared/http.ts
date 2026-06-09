import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export function asyncHandler(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>
) {
  return (request: Request, response: Response, next: NextFunction) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export function validate<T>(schema: ZodSchema<T>, input: unknown) {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError(422, result.error.issues.map((issue) => issue.message).join(", "));
  }
  return result.data;
}
