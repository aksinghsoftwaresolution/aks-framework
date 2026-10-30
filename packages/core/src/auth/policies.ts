
import type { RequestContext } from "../context.js";
import type { AuthUser } from "./types.js";
import type { AuthorizationPolicy } from "./authorization-middleware.js";
import { AuthorizationError } from "../errors.js";
export type RoleResolver = (
  user: AuthUser,
  ctx: RequestContext,
) => readonly string[] | Promise<readonly string[]>;

export type PermissionResolver = (
  user: AuthUser,
  ctx: RequestContext,
) => readonly string[] | Promise<readonly string[]>;

function validatePolicyName(
  value: string,
  type: "role" | "permission",
): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(
      `Authorization ${type} must be a non-empty string`,
    );
  }
}

function validateResolvedNames(
  value: unknown,
  type: "role" | "permission",
): readonly string[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (item): item is string =>
        typeof item === "string" && item.trim().length > 0,
    )
  ) {
    throw new AuthorizationError(
      `Authorization ${type} resolver returned an invalid result`,
    );
  }

  return value;
}

/**
 * Creates an authorization policy that allows users
 * who have the specified role.
 */
export function requireRole(
  role: string,
  resolveRoles: RoleResolver,
): AuthorizationPolicy {
  validatePolicyName(role, "role");

  return async (user, ctx) => {
  const roles = validateResolvedNames(
    await resolveRoles(user, ctx),
    "role",
  );

  return roles.includes(role);
};
}

/**
 * Creates an authorization policy that allows users
 * who have the specified permission.
 */
export function requirePermission(
  permission: string,
  resolvePermissions: PermissionResolver,
): AuthorizationPolicy {
  validatePolicyName(permission, "permission");

  return async (user, ctx) => {
  const permissions = validateResolvedNames(
    await resolvePermissions(user, ctx),
    "permission",
  );

  return permissions.includes(permission);
};
}
