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

    it.each([
  undefined,
  {},
  { user: null },
  { user: {} },
  { user: { id: "" } },
  { user: { id: "   " } },
  { user: { id: 123 } },
  { user: { id: "user-123", attributes: null } },
  { user: { id: "user-123", attributes: [] } },
  { user: new Date() },
  {
    user: new (class {
      id = "user-123";
    })(),
  },
  {
    user: {
      id: "user-123",
      attributes: new Date(),
    },
  },
] as unknown[])(
  "rejects malformed authentication result: %j",
  async (result) => {
    const strategy: AuthStrategy = {
      name: "test",
      authenticate: vi.fn().mockResolvedValue(result),
    };

    const next = vi.fn(async () => {});
    const middleware = createAuthenticationMiddleware(strategy, {
      extractCredentials: () => "valid-token",
    });

    await expect(
      middleware(createContext(), next),
    ).rejects.toMatchObject({
      statusCode: 500,
      code: "AUTHENTICATION_PROVIDER_ERROR",
    });

    expect(next).not.toHaveBeenCalled();
  },
);

  it("returns 401 when the strategy rejects validly formatted credentials", async () => {
    const strategy: AuthStrategy = {
      name: "test",
      authenticate: vi.fn().mockResolvedValue(null),
    };

    const middleware = createAuthenticationMiddleware(strategy, {
      extractCredentials: () => "invalid-token",
    });

    await expect(
      middleware(createContext(), vi.fn(async () => {})),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
  });

  it("creates an immutable copy of the authenticated user", async () => {
  const user = {
    id: "user-123",
    attributes: {
      role: "admin",
      permissions: ["reports:read"],
    },
  };

  const strategy: AuthStrategy = {
    name: "test",
    authenticate: vi.fn().mockResolvedValue({ user }),
  };

  const ctx = createContext();
  const middleware = createAuthenticationMiddleware(strategy, {
    extractCredentials: () => "valid-token",
  });

  await middleware(ctx, vi.fn(async () => {}));

  expect(ctx.auth).not.toBe(user);
  expect(ctx.auth?.attributes).not.toBe(user.attributes);
  expect(Object.isFrozen(ctx.auth)).toBe(true);
  expect(Object.isFrozen(ctx.auth?.attributes)).toBe(true);

  expect(user.id).toBe("user-123");
  expect(user.attributes.role).toBe("admin");
  expect(Object.isFrozen(user)).toBe(false);
  expect(Object.isFrozen(user.attributes)).toBe(false);
});

it("does not allow mutation of authenticated identity fields", async () => {
  const strategy: AuthStrategy = {
    name: "test",
    authenticate: vi.fn().mockResolvedValue({
      user: {
        id: "user-123",
        attributes: { role: "admin" },
      },
    }),
  };

  const ctx = createContext();
  const middleware = createAuthenticationMiddleware(strategy, {
    extractCredentials: () => "valid-token",
  });

  await middleware(ctx, vi.fn(async () => {}));

  expect(() => {
    Object.assign(ctx.auth!, { id: "attacker" });
  }).toThrow(TypeError);

  expect(() => {
    Object.assign(ctx.auth!.attributes!, { role: "user" });
  }).toThrow(TypeError);

  expect(ctx.auth?.id).toBe("user-123");
  expect(ctx.auth?.attributes?.role).toBe("admin");
});

it("prevents mutation of nested permission arrays in authenticated attributes", async () => {
  const strategy: AuthStrategy = {
    name: "test",
    authenticate: vi.fn().mockResolvedValue({
      user: {
        id: "user-123",
        attributes: {
          permissions: ["reports:read"],
        },
      },
    }),
  };

  const ctx = createContext();
  const middleware = createAuthenticationMiddleware(strategy, {
    extractCredentials: () => "valid-token",
  });

  await middleware(ctx, vi.fn(async () => {}));

  expect(() => {
    (ctx.auth?.attributes?.permissions as string[]).push("admin:all");
  }).toThrow(TypeError);

  expect(ctx.auth?.attributes?.permissions).toEqual(["reports:read"]);
});

it("preserves circular references when copying authenticated attributes", async () => {
  const attributes: Record<string, unknown> = {};
  attributes.self = attributes;

  const strategy: AuthStrategy = {
    name: "test",
    authenticate: vi.fn().mockResolvedValue({
      user: {
        id: "user-123",
        attributes,
      },
    }),
  };

  const ctx = createContext();
  const middleware = createAuthenticationMiddleware(strategy, {
    extractCredentials: () => "valid-token",
  });

  await middleware(ctx, vi.fn(async () => {}));

  expect(ctx.auth?.attributes).not.toBe(attributes);
  expect(ctx.auth?.attributes?.self).toBe(ctx.auth?.attributes);
  expect(Object.isFrozen(ctx.auth?.attributes)).toBe(true);
  expect(attributes.self).toBe(attributes);
  expect(Object.isFrozen(attributes)).toBe(false);
});

it("accepts a null-prototype authentication user", async () => {
  const user = Object.assign(
    Object.create(null),
    { id: "user-123" },
  );

  const strategy: AuthStrategy = {
    name: "test",
    authenticate: vi.fn().mockResolvedValue({ user }),
  };

  const ctx = createContext();
  const next = vi.fn(async () => {});

  const middleware = createAuthenticationMiddleware(strategy, {
    extractCredentials: () => "valid-token",
  });

  await middleware(ctx, next);

  expect(ctx.auth).toMatchObject({
    id: "user-123",
  });
  expect(next).toHaveBeenCalledOnce();
});

});
