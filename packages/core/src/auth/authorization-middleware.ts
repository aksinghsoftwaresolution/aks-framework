
import type { Middleware } from "../app.js";
import { ForbiddenError, UnauthorizedError } from "../errors.js";
import type { RequestContext } from "../context.js";
import type { AuthUser } from "./types.js";

export type AuthorizationPolicy = (
  user: AuthUser,
  ctx: RequestContext,
) => boolean | Promise<boolean>;

export interface AuthorizationOptions {
  policy: AuthorizationPolicy;
}

export function createAuthorizationMiddleware(
  options: AuthorizationOptions,
): Middleware {
  return async (ctx, next) => {
    const user = ctx.auth;

    if (!user) {
      throw new UnauthorizedError(
        "Authentication is required to access this resource",
      );
    }

    const allowed = await options.policy(user, ctx);

    if (!allowed) {
      throw new ForbiddenError(
        "You do not have permission to access this resource",
      );
    }

    await next();
  };
}
