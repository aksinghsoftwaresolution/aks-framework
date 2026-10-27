import type { IncomingHttpHeaders } from "node:http";
import type { AKSResponse } from "./response.js";
import { ValidatedData } from "./validation.js";
import type { DIContainer } from "./container.js";
import type { AuthUser } from "./auth/types.js";

export interface RequestContext {
  request: {
    method: string;
    path: string;
    headers: IncomingHttpHeaders;
  };

  params: Record<string, string>;

  query: Record<string, string>;

  body: unknown;

  validated: ValidatedData<unknown, unknown, unknown>;

  container: DIContainer;

  auth?: AuthUser;

  response: AKSResponse;
}