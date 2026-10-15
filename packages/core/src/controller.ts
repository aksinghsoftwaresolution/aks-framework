import type { RequestContext } from "./context.js";

export type Controller = (
  ctx: RequestContext,
) => unknown | Promise<unknown>;