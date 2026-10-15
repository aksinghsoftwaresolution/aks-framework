import type { RequestContext } from "./context.js";
import { AKSError, ValidationError } from "./errors.js";

export function handleError(
  ctx: RequestContext,
  error: unknown,
) {
  if (error instanceof AKSError) {
    return ctx.response
  .status(error.statusCode)
  .json({
    error: error.message,
    ...(error.code
      ? {
          code: error.code,
        }
      : {}),
    status: error.statusCode,
    ...(error instanceof ValidationError
      ? {
          issues: error.issues,
        }
      : {}),
  });
  }

  return ctx.response
    .status(500)
    .json({
      error: "Internal server error",
    });
}