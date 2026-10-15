import { createHTTPServer } from "./http.js";
import type { RequestContext } from "./context.js";
import type { Controller } from "./controller.js";
import { DIContainer } from "./container.js";
import { AKSLogger } from "./logger.js";

export type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type RouteHandler = Controller;

export type Middleware = (
  ctx: RequestContext,
  next: () => Promise<void>,
) => unknown | Promise<unknown>;

export type ErrorHandler = (
  error: unknown,
  ctx: RequestContext,
) => unknown | Promise<unknown>;

export interface Route {
  method: HTTPMethod;
  path: string;
  handler: RouteHandler;
}

export interface AKSAppOptions {
  logger?: AKSLogger;
}

export class AKSApp {
  private routes: Route[] = [];
  private middlewares: Middleware[] = [];
  private errorHandler?: ErrorHandler;
  private readonly container = new DIContainer();
  private readonly logger: AKSLogger;

  constructor(options: AKSAppOptions = {}) {
    this.logger = 
    options.logger ??
    new AKSLogger();
  }

  use(middleware: Middleware): this {
    this.middlewares.push(middleware);

    return this;
  }

  onError(handler: ErrorHandler): this {
  this.errorHandler = handler;
  return this;
}

  get(path: string, handler: RouteHandler): this {
    this.routes.push({
      method: "GET",
      path,
      handler,
    });

    return this;
  }

  post(path: string, handler: RouteHandler): this {
    this.routes.push({
      method: "POST",
      path,
      handler,
    });

    return this;
  }

  put(path: string, handler: RouteHandler): this {
    this.routes.push({
      method: "PUT",
      path,
      handler,
    });

    return this;
  }

  patch(path: string, handler: RouteHandler): this {
    this.routes.push({
      method: "PATCH",
      path,
      handler,
    });

    return this;
  }

  delete(path: string, handler: RouteHandler): this {
    this.routes.push({
      method: "DELETE",
      path,
      handler,
    });

    return this;
  }

  getRoutes(): readonly Route[] {
    return this.routes;
  }

  getMiddlewares(): readonly Middleware[] {
    return this.middlewares;
  }

  getErrorHandler(): ErrorHandler | undefined {
  return this.errorHandler;
}

getContainer(): DIContainer {
  return this.container;
}

getLogger(): AKSLogger {
  return this.logger;
}

  listen(port: number): void {
  const server = createHTTPServer(this);

  server.listen(port, () => {
    this.logger.info(
      "AKS Framework started",
      {
        port,
        url: `http://localhost:${port}`,
      },
    );
  });
}
}