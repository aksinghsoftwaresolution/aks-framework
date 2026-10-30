import type { Middleware } from "../app.js";
import { AuthenticationError, UnauthorizedError } from "../errors.js";
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

function cloneAndFreeze(
  value: unknown,
  seen = new WeakMap<object, unknown>(),
): unknown {
  if (typeof value !== "object" || value === null) {
    return value;
  }

  const existing = seen.get(value);

  if (existing !== undefined) {
    return existing;
  }

  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(value, copy);

    for (const item of value) {
      copy.push(cloneAndFreeze(item, seen));
    }

    return Object.freeze(copy);
  }

  const prototype = Object.getPrototypeOf(value);

  if (prototype === Object.prototype || prototype === null) {
    const copy: Record<string, unknown> = {};
    seen.set(value, copy);

    for (const [key, item] of Object.entries(value)) {
      copy[key] = cloneAndFreeze(item, seen);
    }

    return Object.freeze(copy);
  }

  return value;
}

function createImmutableAuthUser(
  user: {
    id: string;
    attributes?: Readonly<Record<string, unknown>>;
  },
): {
  readonly id: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
} {
  const attributes = user.attributes === undefined
    ? undefined
    : cloneAndFreeze(user.attributes) as Readonly<Record<string, unknown>>;

  return Object.freeze({
    id: user.id,
    ...(attributes === undefined ? {} : { attributes }),
  });
}

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function isValidAuthResult(
  result: unknown,
): result is {
  user: {
    id: string;
    attributes?: Readonly<Record<string, unknown>>;
  };
} {
  if (!isPlainObject(result) || !isPlainObject(result.user)) {
    return false;
  }

  const user = result.user;

  if (
    typeof user.id !== "string" ||
    user.id.trim().length === 0
  ) {
    return false;
  }

  if (
    "attributes" in user &&
    user.attributes !== undefined &&
    !isPlainObject(user.attributes)
  ) {
    return false;
  }

  return true;
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

    if (result === null) {
  throw new UnauthorizedError("Invalid authentication credentials");
}

if (!isValidAuthResult(result)) {
  throw new AuthenticationError();
}

ctx.auth = createImmutableAuthUser(result.user);

    await next();
  };
}
