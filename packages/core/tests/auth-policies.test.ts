
import { describe, expect, it, vi } from "vitest";

import {
  requirePermission,
  requireRole,
} from "../src/auth/policies.js";

import type { RequestContext } from "../src/context.js";
import type { AuthUser } from "../src/auth/types.js";

const user: AuthUser = {
  id: "user-123",
  attributes: {
    roles: ["admin", "editor"],
    permissions: ["users:read", "users:write"],
  },
};

const ctx = {} as RequestContext;

describe("requireRole", () => {
  it("allows a user who has the required role", async () => {
    const policy = requireRole("admin", () => ["admin", "editor"]);

    await expect(policy(user, ctx)).resolves.toBe(true);
  });

  it("denies a user who does not have the required role", async () => {
    const policy = requireRole("admin", () => ["editor"]);

    await expect(policy(user, ctx)).resolves.toBe(false);
  });

  it("supports asynchronous role resolvers", async () => {
    const resolveRoles = vi.fn().mockResolvedValue(["admin"]);
    const policy = requireRole("admin", resolveRoles);

    await expect(policy(user, ctx)).resolves.toBe(true);
    expect(resolveRoles).toHaveBeenCalledWith(user, ctx);
  });
});

describe("requirePermission", () => {
  it("allows a user who has the required permission", async () => {
    const policy = requirePermission(
      "users:write",
      () => ["users:read", "users:write"],
    );

    await expect(policy(user, ctx)).resolves.toBe(true);
  });

  it("denies a user who lacks the required permission", async () => {
    const policy = requirePermission(
      "users:delete",
      () => ["users:read", "users:write"],
    );

    await expect(policy(user, ctx)).resolves.toBe(false);
  });

  it("supports asynchronous permission resolvers", async () => {
    const resolvePermissions = vi.fn().mockResolvedValue(["users:write"]);
    const policy = requirePermission(
      "users:write",
      resolvePermissions,
    );

    await expect(policy(user, ctx)).resolves.toBe(true);
    expect(resolvePermissions).toHaveBeenCalledWith(user, ctx);
  });
});
