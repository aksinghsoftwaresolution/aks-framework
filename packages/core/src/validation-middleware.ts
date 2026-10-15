import type { RequestContext } from "./context.js";
import { ValidationError } from "./errors.js";
import type {
  ValidationIssue,
  ValidationResult,
  Validator,
} from "./validation.js";

export interface ValidationOptions {
  body?: Validator<unknown, unknown>;
  query?: Validator<Record<string, string>, unknown>;
  params?: Validator<Record<string, string>, unknown>;
}

export async function validateRequest(
  ctx: RequestContext,
  options: ValidationOptions,
  next: () => Promise<void>,
): Promise<void> {
  const issues: ValidationIssue[] = [];

  if (options.body) {
    const result = options.body(ctx.body);

    if (!result.success) {
      issues.push(...result.issues);
    } else {
      ctx.validated.body = result.data;
    }
  }

  if (options.query) {
    const result = options.query(ctx.query);

    if (!result.success) {
      issues.push(...result.issues);
    } else {
      ctx.validated.query = result.data;
    }
  }

  if (options.params) {
    const result = options.params(ctx.params);

    if (!result.success) {
      issues.push(...result.issues);
    } else {
      ctx.validated.params = result.data;
    }
  }

  if (issues.length > 0) {
    throw new ValidationError(
      "Validation failed",
      issues,
    );
  }

  await next();
}