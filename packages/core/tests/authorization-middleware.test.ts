
import { describe, expect, it, vi } from "vitest";

import { createAuthorizationMiddleware } from "../src/auth/authorization-middleware.js";
import { ForbiddenError, UnauthorizedError } from "../src/errors.js";
import type { RequestContext } from "../src/context.js";
import type { AuthUser } from "../src/auth/types.js";

function createContext(user?: AuthUser): RequestContext {
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
    ...(user ? { auth: user } : {}),
    response: {} as RequestContext["response"],
  };
}

describe("createAuthorizationMiddleware", () => {
  it("rejects requests without an authenticated user", async () => {
    const policy = vi.fn(() => true);
    const next = vi.fn(async () => {});
    const middleware = createAuthorizationMiddleware({ policy });

    await expect(
      middleware(createContext(), next),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    expect(policy).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects authenticated users when the policy denies access", async () => {
    const user: AuthUser = { id: "user-123" };
    const policy = vi.fn(() => false);
    const next = vi.fn(async () => {});
    const middleware = createAuthorizationMiddleware({ policy });

    await expect(
      middleware(createContext(user), next),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(policy).toHaveBeenCalledWith(
      user,
      expect.objectContaining({ auth: user }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("allows access when the policy approves the user", async () => {
    const user: AuthUser = { id: "admin-123" };
    const policy = vi.fn(() => true);
    const next = vi.fn(async () => {});
    const ctx = createContext(user);
    const middleware = createAuthorizationMiddleware({ policy });

    await middleware(ctx, next);

    expect(policy).toHaveBeenCalledWith(user, ctx);
    expect(next).toHaveBeenCalledOnce();
  });

  it("supports asynchronous authorization policies", async () => {
    const user: AuthUser = { id: "user-456" };
    const policy = vi.fn().mockResolvedValue(true);
    const next = vi.fn(async () => {});
    const middleware = createAuthorizationMiddleware({ policy });

    await middleware(createContext(user), next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("propagates unexpected policy errors", async () => {
    const user: AuthUser = { id: "user-789" };
    const error = new Error("Permission service unavailable");
    const policy = vi.fn().mockRejectedValue(error);
    const next = vi.fn(async () => {});
    const middleware = createAuthorizationMiddleware({ policy });

    await expect(
      middleware(createContext(user), next),
    ).rejects.toBe(error);

    expect(next).not.toHaveBeenCalled();
  });
});
