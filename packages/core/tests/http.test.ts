import { describe, expect, it } from "vitest";
import { AKSApp } from "../src/app.js";
import { createHTTPServer } from "../src/http.js";
import { NotFoundError } from "../src/errors.js";
import type { Controller } from "../src/controller.js";

describe("HTTP routing", () => {
  it("matches a static route", async () => {
    const app = new AKSApp();

    app.get("/hello", async () => {
      return {
        route: "static",
      };
    });

    const server = createHTTPServer(app);

    await new Promise<void>((resolve) => {
      server.listen(0, resolve);
    });

    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Failed to determine server address");
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/hello`,
      );

      expect(response.status).toBe(200);

      await expect(response.json()).resolves.toEqual({
        route: "static",
      });
    } finally {
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
  });

  it("executes route-specific middleware before the route handler", async () => {
  const app = new AKSApp();
  const executionOrder: string[] = [];

  const routeMiddleware = async (
    _ctx: Parameters<Controller>[0],
    next: () => Promise<void>,
  ) => {
    executionOrder.push("route-middleware-before");
    await next();
    executionOrder.push("route-middleware-after");
  };

  app.get("/route-middleware", routeMiddleware, async () => {
    executionOrder.push("handler");
    return { message: "ok" };
  });

  const server = createHTTPServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/route-middleware`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ message: "ok" });
    expect(executionOrder).toEqual([
      "route-middleware-before",
      "handler",
      "route-middleware-after",
    ]);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

it("runs global middleware before route-specific middleware", async () => {
  const app = new AKSApp();
  const executionOrder: string[] = [];

  app.use(async (_ctx, next) => {
    executionOrder.push("global-before");
    await next();
    executionOrder.push("global-after");
  });

  const routeMiddleware = async (
    _ctx: Parameters<Controller>[0],
    next: () => Promise<void>,
  ) => {
    executionOrder.push("route-before");
    await next();
    executionOrder.push("route-after");
  };

  app.get("/middleware-order", routeMiddleware, async () => {
    executionOrder.push("handler");
    return { message: "ok" };
  });

  const server = createHTTPServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/middleware-order`,
    );

    expect(response.status).toBe(200);
    expect(executionOrder).toEqual([
      "global-before",
      "route-before",
      "handler",
      "route-after",
      "global-after",
    ]);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

it("executes multiple route-specific middleware in registration order", async () => {
  const app = new AKSApp();
  const executionOrder: string[] = [];

  const first = async (
    _ctx: Parameters<Controller>[0],
    next: () => Promise<void>,
  ) => {
    executionOrder.push("first-before");
    await next();
    executionOrder.push("first-after");
  };

  const second = async (
    _ctx: Parameters<Controller>[0],
    next: () => Promise<void>,
  ) => {
    executionOrder.push("second-before");
    await next();
    executionOrder.push("second-after");
  };

  app.get("/multiple-middleware", first, second, async () => {
    executionOrder.push("handler");
    return { message: "ok" };
  });

  const server = createHTTPServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/multiple-middleware`,
    );

    expect(response.status).toBe(200);
    expect(executionOrder).toEqual([
      "first-before",
      "second-before",
      "handler",
      "second-after",
      "first-after",
    ]);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

it("allows route-specific middleware to short-circuit the handler", async () => {
  const app = new AKSApp();
  let handlerExecuted = false;

  const authMiddleware = async (
    ctx: Parameters<Controller>[0],
    _next: () => Promise<void>,
  ) => {
    return ctx.response.status(401).json({
      error: "Unauthorized",
    });
  };

  app.get("/route-protected", authMiddleware, async () => {
    handlerExecuted = true;
    return { message: "should not execute" };
  });

  const server = createHTTPServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/route-protected`,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized",
    });
    expect(handlerExecuted).toBe(false);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

it("propagates route-specific middleware errors to the error handler", async () => {
  const app = new AKSApp();

  const failingMiddleware = async () => {
    throw new Error("route middleware failure");
  };

  app.get("/route-middleware-error", failingMiddleware, async () => ({
    message: "should not execute",
  }));

  app.onError((error, ctx) => {
    expect((error as Error).message).toBe("route middleware failure");
    return ctx.response.status(500).json({
      error: "route middleware error handled",
    });
  });

  const server = createHTTPServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/route-middleware-error`,
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "route middleware error handled",
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

it("continues to support routes without route-specific middleware", async () => {
  const app = new AKSApp();

  app.get("/no-route-middleware", async () => ({
    message: "works",
  }));

  const server = createHTTPServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/no-route-middleware`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "works",
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

  it("matches a dynamic route parameter", async () => {
    const app = new AKSApp();

    app.get("/users/:id", async (ctx) => {
      return {
        userId: ctx.params.id,
      };
    });

    const server = createHTTPServer(app);

    await new Promise<void>((resolve) => {
      server.listen(0, resolve);
    });

    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Failed to determine server address");
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/users/123`,
      );

      expect(response.status).toBe(200);

      await expect(response.json()).resolves.toEqual({
        userId: "123",
      });
    } finally {
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
  });

  it("prioritizes a static route over a dynamic route", async () => {
  const app = new AKSApp();

  app.get("/users/:id", async (ctx) => {
    return {
      route: "dynamic",
      id: ctx.params.id,
    };
  });

  app.get("/users/me", async () => {
    return {
      route: "static",
    };
  });

  const server = createHTTPServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/users/me`,
    );

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual({
      route: "static",
    });
  } finally {
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
});

it("matches a wildcard route", async () => {
  const app = new AKSApp();

  app.get("/files/*", async (ctx) => {
    return {
      route: "wildcard",
      path: ctx.params["*"],
    };
  });

  const server = createHTTPServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/files/images/logo.png`,
    );

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual({
      route: "wildcard",
      path: "images/logo.png",
    });
  } finally {
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
});

it("prioritizes static over dynamic over wildcard routes", async () => {
  const app = new AKSApp();

  app.get("/files/*", async (ctx) => {
    return {
      route: "wildcard",
      path: ctx.params["*"],
    };
  });

  app.get("/files/:id", async (ctx) => {
    return {
      route: "dynamic",
      id: ctx.params.id,
    };
  });

  app.get("/files/special", async () => {
    return {
      route: "static",
    };
  });

  const server = createHTTPServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const staticResponse = await fetch(
      `http://127.0.0.1:${address.port}/files/special`,
    );

    expect(staticResponse.status).toBe(200);

    await expect(staticResponse.json()).resolves.toEqual({
      route: "static",
    });

    const dynamicResponse = await fetch(
      `http://127.0.0.1:${address.port}/files/report.pdf`,
    );

    expect(dynamicResponse.status).toBe(200);

    await expect(dynamicResponse.json()).resolves.toEqual({
      route: "dynamic",
      id: "report.pdf",
    });

    const wildcardResponse = await fetch(
      `http://127.0.0.1:${address.port}/files/images/logo.png`,
    );

    expect(wildcardResponse.status).toBe(200);

    await expect(wildcardResponse.json()).resolves.toEqual({
      route: "wildcard",
      path: "images/logo.png",
    });
  } finally {
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
});

it("returns 404 for an unknown route", async () => {
  const app = new AKSApp();

  app.get("/hello", async () => {
    return {
      message: "hello",
    };
  });

  const server = createHTTPServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/does-not-exist`,
    );

    expect(response.status).toBe(404);

    await expect(response.json()).resolves.toEqual({
      error: "Route not found",
      code: "NOT_FOUND",
      status: 404,
    });
  } finally {
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
});

it("returns 405 when the route exists but the method is not allowed", async () => {
  const app = new AKSApp();

  app.get("/users/:id", async (ctx) => {
    return {
      userId: ctx.params.id,
    };
  });

  app.put("/users/:id", async (ctx) => {
    return {
      message: "User updated",
      userId: ctx.params.id,
    };
  });

  const server = createHTTPServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/users/123`,
      {
        method: "POST",
      },
    );

    expect(response.status).toBe(405);

    expect(response.headers.get("allow")).toBe(
      "GET, PUT",
    );

    await expect(response.json()).resolves.toEqual({
      error: "Method not allowed",
      code: "METHOD_NOT_ALLOWED",
      status: 405,
    });
  } finally {
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
});

it("matches GET routes for HEAD requests and suppresses the response body", async () => {
  const app = new AKSApp();

  app.get("/hello", async () => {
    return {
      message: "hello",
    };
  });

  const server = createHTTPServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/hello`,
      {
        method: "HEAD",
      },
    );

    expect(response.status).toBe(200);

    expect(response.headers.get("content-type")).toBe(
      "application/json",
    );

    expect(await response.text()).toBe("");
  } finally {
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
});

it("handles OPTIONS requests automatically without invoking the route handler", async () => {
  const app = new AKSApp();

  let handlerCalled = false;

  app.get("/users/:id", async () => {
    handlerCalled = true;

    return {
      userId: "123",
    };
  });

  app.put("/users/:id", async () => {
    return {
      message: "updated",
    };
  });

  const server = createHTTPServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/users/123`,
      {
        method: "OPTIONS",
      },
    );

    expect(response.status).toBe(204);

    expect(response.headers.get("allow")).toBe(
      "GET, HEAD, PUT, OPTIONS",
    );

    expect(await response.text()).toBe("");

    expect(handlerCalled).toBe(false);
  } finally {
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
});

it("matches routes with or without a trailing slash", async () => {
  const app = new AKSApp();

  app.get("/users/:id", async (ctx) => {
    return {
      userId: ctx.params.id,
    };
  });

  const server = createHTTPServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/users/123/`,
    );

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual({
      userId: "123",
    });
  } finally {
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
});

it("decodes dynamic URL parameters", async () => {
  const app = new AKSApp();

  app.get("/users/:name", async (ctx) => {
    return {
      name: ctx.params.name,
    };
  });

  const server = createHTTPServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/users/John%20Doe`,
    );

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual({
      name: "John Doe",
    });
  } finally {
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
});

it("returns 400 for an invalid encoded URL parameter", async () => {
  const app = new AKSApp();

  app.get("/users/:id", async (ctx) => {
    return {
      userId: ctx.params.id,
    };
  });

  const server = createHTTPServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/users/%E0%A4%A`,
    );

    expect(response.status).toBe(400);

    await expect(response.json()).resolves.toEqual({
      error: "Invalid URL parameter: id",
      code: "BAD_REQUEST",
      status: 400,
    });
  } finally {
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
});

it("parses a JSON request body", async () => {
  const app = new AKSApp();

  app.post("/users", async (ctx) => {
    return {
      received: ctx.body,
    };
  });

  const server = createHTTPServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/users`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Adison",
          age: 25,
        }),
      },
    );

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual({
      received: {
        name: "Adison",
        age: 25,
      },
    });
  } finally {
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
});

it("returns 400 for invalid JSON request body", async () => {
  const app = new AKSApp();

  app.post("/users", async (ctx) => {
    return {
      received: ctx.body,
    };
  });

  const server = createHTTPServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/users`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: '{"name": "Adison"',
      },
    );

    expect(response.status).toBe(400);

    await expect(response.json()).resolves.toEqual({
      error: "Invalid JSON body",
      code: "BAD_REQUEST",
      status: 400,
    });
  } finally {
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
});

it("sets the request body to undefined when no body is provided", async () => {
  const app = new AKSApp();

  app.post("/users", async (ctx) => {
    return {
      bodyIsUndefined: ctx.body === undefined,
    };
  });

  const server = createHTTPServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/users`,
      {
        method: "POST",
      },
    );

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual({
      bodyIsUndefined: true,
    });
  } finally {
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
});

it("sets a custom response status and JSON body", async () => {
  const app = new AKSApp();

  app.get("/created", async (ctx) => {
    return ctx.response
      .status(201)
      .json({
        message: "Created",
      });
  });

  const server = createHTTPServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/created`,
    );

    expect(response.status).toBe(201);

    expect(response.headers.get("content-type")).toBe(
      "application/json",
    );

    await expect(response.json()).resolves.toEqual({
      message: "Created",
    });
  } finally {
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
});

it("sets custom response headers", async () => {
  const app = new AKSApp();

  app.get("/headers", async (ctx) => {
    return ctx.response
      .header("X-AKS-Test", "works")
      .json({
        message: "headers",
      });
  });

  const server = createHTTPServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/headers`,
    );

    expect(response.status).toBe(200);

    expect(response.headers.get("x-aks-test")).toBe(
      "works",
    );

    await expect(response.json()).resolves.toEqual({
      message: "headers",
    });
  } finally {
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
});

it("returns a plain-text response", async () => {
  const app = new AKSApp();

  app.get("/text", async (ctx) => {
    return ctx.response.text("Hello from AKS Framework");
  });

  const server = createHTTPServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/text`,
    );

    expect(response.status).toBe(200);

    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );

    await expect(response.text()).resolves.toBe(
      "Hello from AKS Framework",
    );
  } finally {
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
});

it("executes middleware before the route handler", async () => {
  const app = new AKSApp();

  app.use(async (ctx, next) => {
    ctx.request.headers["x-aks-middleware"] = "executed";

    await next();
  });

  app.get("/middleware", async (ctx) => {
    return {
      middleware: ctx.request.headers["x-aks-middleware"],
    };
  });

  const server = createHTTPServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/middleware`,
    );

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual({
      middleware: "executed",
    });
  } finally {
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
});

it("executes middleware in onion order", async () => {
  const app = new AKSApp();

  const executionOrder: string[] = [];

  app.use(async (_ctx, next) => {
    executionOrder.push("middleware-1-before");

    await next();

    executionOrder.push("middleware-1-after");
  });

  app.use(async (_ctx, next) => {
    executionOrder.push("middleware-2-before");

    await next();

    executionOrder.push("middleware-2-after");
  });

  app.get("/middleware-order", async () => {
    executionOrder.push("handler");

    return {
      message: "ok",
    };
  });

  const server = createHTTPServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/middleware-order`,
    );

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual({
      message: "ok",
    });

    expect(executionOrder).toEqual([
      "middleware-1-before",
      "middleware-2-before",
      "handler",
      "middleware-2-after",
      "middleware-1-after",
    ]);
  } finally {
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
});

it("allows middleware to short-circuit the request", async () => {
  const app = new AKSApp();

  let handlerExecuted = false;

  app.use(async (ctx, _next) => {
    return ctx.response
      .status(401)
      .json({
        error: "Unauthorized",
      });
  });

  app.get("/middleware-short-circuit", async () => {
    handlerExecuted = true;

    return {
      message: "should not execute",
    };
  });

  const server = createHTTPServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/middleware-short-circuit`,
    );

    expect(response.status).toBe(401);

    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized",
    });

    expect(handlerExecuted).toBe(false);
  } finally {
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
});

it("propagates middleware errors to the error handler", async () => {
  const app = new AKSApp();

  app.use(async () => {
    throw new Error("middleware failure");
  });

  app.get("/middleware-error", async () => {
    return {
      message: "should not execute",
    };
  });

  app.onError((error, ctx) => {
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("middleware failure");

    return ctx.response
      .status(500)
      .json({
        error: "middleware error handled",
      });
  });

  const server = createHTTPServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/middleware-error`,
    );

    expect(response.status).toBe(500);

    await expect(response.json()).resolves.toEqual({
      error: "middleware error handled",
    });
  } finally {
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
});

it("uses the default error handler when no custom handler is registered", async () => {
  const app = new AKSApp();

  app.get("/default-error", async () => {
    throw new Error("unexpected failure");
  });

  const server = createHTTPServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/default-error`,
    );

    expect(response.status).toBe(500);

    await expect(response.json()).resolves.toEqual({
      error: "Internal server error",
    });
  } finally {
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
});

it("returns structured responses for AKSError instances", async () => {
  const app = new AKSApp();

  app.get("/structured-error", async () => {
    throw new NotFoundError(
      "User not found",
      "USER_NOT_FOUND",
    );
  });

  const server = createHTTPServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/structured-error`,
    );

    expect(response.status).toBe(404);

    await expect(response.json()).resolves.toEqual({
      error: "User not found",
      code: "USER_NOT_FOUND",
      status: 404,
    });
  } finally {
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
});

it("supports a controller as a route handler", async () => {
  const app = new AKSApp();

  const controller: Controller = (ctx) =>
    ctx.response.json({
      message: "Hello from controller",
    });

  app.get("/controller", controller);

  const server = createHTTPServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  try {
    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Failed to get server address");
    }

    const response = await fetch(
      `http://127.0.0.1:${address.port}/controller`,
    );

    expect(response.status).toBe(200);

    expect(await response.json()).toEqual({
      message: "Hello from controller",
    });
  } finally {
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
});

it("exposes its dependency injection container", () => {
  const app = new AKSApp();

  const container = app.getContainer();

  container.register("config", () => ({
    port: 3000,
  }));

  expect(
    container.resolve<{ port: number }>("config"),
  ).toEqual({
    port: 3000,
  });
});


  it("safely handles special query parameter names", async () => {
    const app = new AKSApp();

    app.get("/query", async (ctx) => {
      return {
        proto: ctx.query["__proto__"],
        constructor: ctx.query["constructor"],
        toString: ctx.query["toString"],
        normal: ctx.query["normal"],
        hasNullPrototype: Object.getPrototypeOf(ctx.query) === null,
      };
    });

    const server = createHTTPServer(app);

    await new Promise<void>((resolve) => {
      server.listen(0, resolve);
    });

    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Failed to determine server address");
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/query?__proto__=injected&constructor=test&toString=value&normal=works`,
      );

      expect(response.status).toBe(200);

      await expect(response.json()).resolves.toEqual({
        proto: "injected",
        constructor: "test",
        toString: "value",
        normal: "works",
        hasNullPrototype: true,
      });
    } finally {
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
  });

});