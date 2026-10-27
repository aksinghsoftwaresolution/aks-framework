import { describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "../src/errors.js";
import type { RequestContext } from "../src/context.js";
import type { AuthStrategy } from "../src/auth/types.js";
import {
  createAuthenticationMiddleware,
  extractBearerToken,
} from "../src/auth/authentication-middleware.js";

function createContext(): RequestContext {
  return {
    request: {
      method: "GET",
      path: "/protected",
      headers: {},
    },
    params: {},
    query: {},
    body: undefined,
    validated: {},
    container: {} as RequestContext["container"],
    response: {} as RequestContext["response"],
  };
}


describe("extractBearerToken", () => {
  it("extracts a token from a Bearer authorization header", () => {
    const ctx = createContext();
    ctx.request.headers.authorization = "Bearer abc123";

    expect(extractBearerToken(ctx)).toBe("abc123");
  });

  it("accepts the Bearer scheme case-insensitively", () => {
    const ctx = createContext();
    ctx.request.headers.authorization = "bEaReR abc123";

    expect(extractBearerToken(ctx)).toBe("abc123");
  });

  it("returns undefined when the header is missing", () => {
    expect(extractBearerToken(createContext())).toBeUndefined();
  });

  it("rejects malformed or empty Bearer credentials", () => {
    const ctx = createContext();

    for (const header of [
      "",
      "Basic abc123",
      "Bearer",
      "Bearer ",
      "Bearer abc def",
    ]) {
      ctx.request.headers.authorization = header;
      expect(extractBearerToken(ctx)).toBeUndefined();
    }
  });

  it("rejects array-valued authorization headers", () => {
    const ctx = createContext();
    ctx.request.headers.authorization = ["Bearer abc123"];

    expect(extractBearerToken(ctx)).toBeUndefined();
  });
});

it("authenticates a user using a Bearer token from the request header", async () => {
  const ctx = createContext();
  ctx.request.headers.authorization = "Bearer valid-token";

  const user = { id: "user-123" };

  const strategy: AuthStrategy = {
    name: "bearer-token",
    authenticate: vi.fn().mockResolvedValue({ user }),
  };

  const next = vi.fn(async () => {});

  const middleware = createAuthenticationMiddleware(strategy, {
    extractCredentials: extractBearerToken,
  });

  await middleware(ctx, next);

  expect(strategy.authenticate).toHaveBeenCalledWith("valid-token");
  expect(ctx.auth).toEqual(user);
  expect(next).toHaveBeenCalledOnce();
});

describe("createAuthenticationMiddleware", () => {
  it("rejects missing credentials", async () => {
    const authenticate = vi.fn();
    const strategy: AuthStrategy = {
      name: "test",
      authenticate,
    };
    const next = vi.fn(async () => {});
    const middleware = createAuthenticationMiddleware(strategy, {
      extractCredentials: () => undefined,
    });

    await expect(
      middleware(createContext(), next),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    expect(authenticate).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects invalid credentials", async () => {
    const strategy: AuthStrategy = {
      name: "test",
      authenticate: vi.fn().mockResolvedValue(null),
    };
    const next = vi.fn(async () => {});
    const middleware = createAuthenticationMiddleware(strategy, {
      extractCredentials: () => "invalid-token",
    });

    await expect(
      middleware(createContext(), next),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    expect(strategy.authenticate).toHaveBeenCalledWith("invalid-token");
    expect(next).not.toHaveBeenCalled();
  });

  it("sets the authenticated user and calls next", async () => {
    const user = {
      id: "user-123",
      attributes: { role: "admin" },
    };

    const strategy: AuthStrategy = {
      name: "test",
      authenticate: vi.fn().mockResolvedValue({ user }),
    };
    const next = vi.fn(async () => {});
    const ctx = createContext();

    const middleware = createAuthenticationMiddleware(strategy, {
      extractCredentials: () => "valid-token",
    });

    await middleware(ctx, next);

    expect(ctx.auth).toEqual(user);
    expect(next).toHaveBeenCalledOnce();
  });

  it("propagates unexpected strategy errors", async () => {
    const error = new Error("Authentication provider unavailable");
    const strategy: AuthStrategy = {
      name: "test",
      authenticate: vi.fn().mockRejectedValue(error),
    };
    const next = vi.fn(async () => {});
    const middleware = createAuthenticationMiddleware(strategy, {
      extractCredentials: () => "valid-token",
    });

    await expect(
      middleware(createContext(), next),
    ).rejects.toBe(error);

    expect(next).not.toHaveBeenCalled();
  });

  it("propagates credential extraction errors", async () => {
    const error = new Error("Credential extraction failed");
    const strategy: AuthStrategy = {
      name: "test",
      authenticate: vi.fn(),
    };
    const next = vi.fn(async () => {});
    const middleware = createAuthenticationMiddleware(strategy, {
      extractCredentials: () => {
        throw error;
      },
    });

    await expect(
      middleware(createContext(), next),
    ).rejects.toBe(error);

    expect(strategy.authenticate).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
