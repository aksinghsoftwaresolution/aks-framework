import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

import { parseJSONBody } from "./body.js";
import type { AKSApp, Middleware } from "./app.js";
import type { RequestContext } from "./context.js";
import { handleError } from "./error-handler.js";
import {
  BadRequestError,
  MethodNotAllowedError,
  NotFoundError,
} from "./errors.js";
import { AKSResponse } from "./response.js";

interface MatchedRoute {
  handler: (ctx: RequestContext) => unknown | Promise<unknown>;
  params: Record<string, string>;
}

function matchRoute(
  routePath: string,
  requestPath: string,
): MatchedRoute | null {
  const routeParts = routePath.split("/").filter(Boolean);
  const requestParts = requestPath.split("/").filter(Boolean);

  const hasWildcard = routeParts.includes("*");

  if (
    !hasWildcard &&
    routeParts.length !== requestParts.length
  ) {
    return null;
  }

  if (
    hasWildcard &&
    requestParts.length < routeParts.length - 1
  ) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let index = 0; index < routeParts.length; index++) {
    const routePart = routeParts[index];
    const requestPart = requestParts[index];

    if (routePart === "*") {
      const remainingParts = requestParts.slice(index);

      try {
        params["*"] = remainingParts
          .map((part) => decodeURIComponent(part))
          .join("/");
      } catch {
        throw new BadRequestError(
          "Invalid wildcard URL parameter",
        );
      }

      return {
        handler: undefined as never,
        params,
      };
    }

    if (routePart.startsWith(":")) {
      const paramName = routePart.slice(1);

      try {
        params[paramName] = decodeURIComponent(requestPart);
      } catch {
        throw new BadRequestError(
          `Invalid URL parameter: ${paramName}`,
        );
      }

      continue;
    }

    if (routePart !== requestPart) {
      return null;
    }
  }

  return {
    handler: undefined as never,
    params,
  };
}

function sendResponse(
  res: ServerResponse,
  responseResult: {
    statusCode: number;
    headers: Record<string, string>;
    body: unknown;
  },
): void {
  res.statusCode = responseResult.statusCode;

  for (const [name, value] of Object.entries(
    responseResult.headers,
  )) {
    res.setHeader(name, value);
  }

  if (typeof responseResult.body === "string") {
    res.end(responseResult.body);
  } else {
    res.end(JSON.stringify(responseResult.body));
  }
}

function compareRouteSpecificity(
  routePathA: string,
  routePathB: string,
): number {
  const partsA = routePathA.split("/").filter(Boolean);
  const partsB = routePathB.split("/").filter(Boolean);

  const length = Math.max(partsA.length, partsB.length);

  for (let index = 0; index < length; index++) {
    const partA = partsA[index];
    const partB = partsB[index];

    if (partA === undefined) {
      return -1;
    }

    if (partB === undefined) {
      return 1;
    }

    const aIsWildcard = partA === "*";
    const bIsWildcard = partB === "*";

    if (aIsWildcard && !bIsWildcard) {
      return -1;
    }

    if (!aIsWildcard && bIsWildcard) {
      return 1;
    }

    const aIsDynamic = partA.startsWith(":");
    const bIsDynamic = partB.startsWith(":");

    if (aIsDynamic && !bIsDynamic) {
      return -1;
    }

    if (!aIsDynamic && bIsDynamic) {
      return 1;
    }
  }

  return 0;
}

export function createHTTPServer(app: AKSApp) {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const startedAt = Date.now();
    const method = req.method ?? "GET";
    const rawUrl = req.url ?? "/";

    const url = new URL(rawUrl, "http://localhost");

    const path = url.pathname;

    const query = Object.setPrototypeOf(
  Object.fromEntries(url.searchParams.entries()),
  null,
) as Record<string, string>;

    const pathMatchedRoutes: Array<{
      route: ReturnType<AKSApp["getRoutes"]>[number];
      match: MatchedRoute;
    }> = [];

    let allowedMethods = "";
    let optionsMatched = false;

    let matchedRoute:
      | {
          handler: (ctx: RequestContext) => unknown | Promise<unknown>;
          params: Record<string, string>;
          middlewares: Middleware[];
        }
      | null = null;

    let body: unknown;

    const context: RequestContext = {
      request: {
        method,
        path,
        headers: req.headers,
      },
      params: {},
      query,
      body: undefined,
       validated: {},
       container: app.getContainer(),
      response: new AKSResponse(),
    };

    try {
      const routes = [...app.getRoutes()].sort(
  (a, b) => compareRouteSpecificity(b.path, a.path),
);

for (const route of routes) {
        const match = matchRoute(route.path, path);

        if (!match) {
          continue;
        }

        pathMatchedRoutes.push({
          route,
          match,
        });

        if (method === "OPTIONS") {
          optionsMatched = true;
          continue;
        }

        const methodMatches =
          route.method === method ||
          (method === "HEAD" && route.method === "GET");

        if (!methodMatches) {
          continue;
        }

        if (!matchedRoute) {
          matchedRoute = {
            handler: route.handler,
            params: match.params,
            middlewares: route.middlewares,
          };
        }
      }

      context.params = matchedRoute?.params ?? {};

      try {
        body = await parseJSONBody(req);
        context.body = body;
      } catch {
        throw new BadRequestError("Invalid JSON body");
      }

      if (optionsMatched) {
  allowedMethods = [
    ...new Set(
      pathMatchedRoutes.flatMap(
        ({ route }) =>
          route.method === "GET"
            ? ["GET", "HEAD"]
            : [route.method],
      ),
    ),
    "OPTIONS",
  ].join(", ");

  res.statusCode = 204;
  res.setHeader("Allow", allowedMethods);
  res.end();
  return;
}

if (!matchedRoute) {
  if (pathMatchedRoutes.length > 0) {
    allowedMethods = [
      ...new Set(
        pathMatchedRoutes.map(
          ({ route }) => route.method,
        ),
      ),
    ].join(", ");

    throw new MethodNotAllowedError(
      "Method not allowed",
    );
  }

  throw new NotFoundError("Route not found");
}

      let result: unknown;

      const middlewares = [...app.getMiddlewares(), ...matchedRoute.middlewares,]

      let middlewareIndex = -1;

      const dispatch = async (index: number): Promise<void> => {
        if (index <= middlewareIndex) {
          throw new Error("next() called multiple times");
        }

        middlewareIndex = index;

        if (index === middlewares.length) {
          result = await matchedRoute!.handler(context);
          return;
        }

        const middleware = middlewares[index];

        const middlewareResult = await middleware(
          context,
          async () => {
            await dispatch(index + 1);
          },
        );

        if (
          middlewareResult !== undefined &&
          result === undefined
        ) {
          result = middlewareResult;
        }
      };

      await dispatch(0);

      if (
        typeof result === "object" &&
        result !== null &&
        "statusCode" in result &&
        "headers" in result &&
        "body" in result
      ) {
        const responseResult = result as {
          statusCode: number;
          headers: Record<string, string>;
          body: unknown;
        };

        if (method === "HEAD") {
          res.statusCode = responseResult.statusCode;

          for (const [name, value] of Object.entries(
            responseResult.headers,
          )) {
            res.setHeader(name, value);
          }

          res.end();
          return;
        }

        sendResponse(res, responseResult);
        return;
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");

      if (method === "HEAD") {
        res.end();
        return;
      }

      res.end(JSON.stringify(result));
    } catch (error) {
      const customErrorHandler = app.getErrorHandler();

      const errorResult = customErrorHandler
        ? await customErrorHandler(error, context)
        : handleError(context, error);

      if (
        typeof errorResult === "object" &&
        errorResult !== null &&
        "statusCode" in errorResult &&
        "headers" in errorResult &&
        "body" in errorResult
      ) {
        const responseResult = errorResult as {
          statusCode: number;
          headers: Record<string, string>;
          body: unknown;
        };

        if (
          error instanceof MethodNotAllowedError &&
          allowedMethods
        ) {
          responseResult.headers["Allow"] = allowedMethods;
        }

        sendResponse(res, responseResult);
        return;
      }

      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");

            res.end(
        JSON.stringify({
          error: "Internal server error",
        }),
      );
    } finally {
      app.getLogger().info(
        "HTTP request completed",
        {
          method,
          path,
          statusCode: res.statusCode,
          durationMs: Date.now() - startedAt,
        },
      );
    }
  });
}