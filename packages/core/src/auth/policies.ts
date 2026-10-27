
import type { RequestContext } from "../context.js";
import type { AuthUser } from "./types.js";
import type { AuthorizationPolicy } from "./authorization-middleware.js";

export type RoleResolver = (
  user: AuthUser,
  ctx: RequestContext,
) => readonly string[] | Promise<readonly string[]>;

export type PermissionResolver = (
  user: AuthUser,
  ctx: RequestContext,
) => readonly string[] | Promise<readonly string[]>;

/**
 * Creates an authorization policy that allows users
 * who have the specified role.
 */
export function requireRole(
  role: string,
  resolveRoles: RoleResolver,
): AuthorizationPolicy {
  return async (user, ctx) => {
    const roles = await resolveRoles(user, ctx);
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
  return async (user, ctx) => {
    const permissions = await resolvePermissions(user, ctx);
    return permissions.includes(permission);
  };
}
