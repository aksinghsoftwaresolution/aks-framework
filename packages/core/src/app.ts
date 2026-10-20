import { createHTTPServer } from "./http.js";
import type { RequestContext } from "./context.js";
import type { Controller } from "./controller.js";
import { DIContainer } from "./container.js";
import { AKSLogger } from "./logger.js";
import type { Server } from "node:http";

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
  private server?: Server;
  private shutdownPromise?: Promise<void>;

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

async dispose(): Promise<void> {
  await this.container.dispose();
}

shutdown(): Promise<void> {
  if (this.shutdownPromise) {
    return this.shutdownPromise;
  }

  const shutdown = this.performShutdown();

  this.shutdownPromise = shutdown;

  return shutdown;
}

private async performShutdown(): Promise<void> {
  try {
    const server = this.server;

    if (server?.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  } finally {
    await this.dispose();
  }
}

  listen(port: number): Server {
  if (this.server) {
    throw new Error("AKS application is already listening",)
  }
  const server = createHTTPServer(this);
  this.server = server;

  server.once("close", () => {
    if (this.server === server) {
      this.server = undefined;
    }
  });


  server.listen(port, () => {
    const address = server.address();

    const actualPort = address && typeof address !== "string" ? address.port : port;

    this.logger.info(
      "AKS Framework started",
      {
        port: actualPort,
        url: `http://localhost:${actualPort}`,
      });
  });
  return server;
}
}