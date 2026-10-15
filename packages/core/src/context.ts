import type { IncomingHttpHeaders } from "node:http";
import type { AKSResponse } from "./response.js";
import { ValidatedData } from "./validation.js";
import type { DIContainer } from "./container.js";

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

  response: AKSResponse;
}