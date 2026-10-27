
import type { Middleware } from "../app.js";
import { UnauthorizedError } from "../errors.js";
import type { RequestContext } from "../context.js";
import type { AuthStrategy } from "./types.js";

export interface AuthenticationOptions {
  extractCredentials: (
    ctx: RequestContext,
  ) => unknown | Promise<unknown>;
}


export function extractBearerToken(
  ctx: RequestContext,
): string | undefined {
  const authorization = ctx.request.headers.authorization;

  if (typeof authorization !== "string") {
    return undefined;
  }

  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());

  return match?.[1];
}

export function createAuthenticationMiddleware(
  strategy: AuthStrategy,
  options: AuthenticationOptions,
): Middleware {
  return async (ctx, next) => {
    const credentials = await options.extractCredentials(ctx);

    if (credentials === undefined || credentials === null) {
      throw new UnauthorizedError("Authentication credentials are required");
    }

    const result = await strategy.authenticate(credentials);

    if (!result) {
      throw new UnauthorizedError("Invalid authentication credentials");
    }

    ctx.auth = result.user;

    await next();
  };
}
