import { describe, expect, it } from "vitest";
import { AKSApp } from "../src/app.js";
import type { Controller } from "../src/controller.js";
import { createHTTPServer } from "../src/http.js";

describe("HTTP controller", () => {
  it("handles controller errors through the default error handler", async () => {
    const app = new AKSApp();

    const controller: Controller = () => {
      throw new Error("Controller failed");
    };

    app.get("/controller-error", controller);

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
        `http://127.0.0.1:${address.port}/controller-error`,
      );

      expect(response.status).toBe(500);

      expect(await response.json()).toEqual({
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

  it("allows a controller to resolve a dependency from the request container", async () => {
    const app = new AKSApp();

    app.getContainer().register("userService", () => ({
      getName: () => "AKS User",
    }));

    app.get("/user", (ctx) => {
      const userService = ctx.container.resolve<{
        getName: () => string;
      }>("userService");

      return ctx.response.json({
        name: userService.getName(),
      });
    });

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
        `http://127.0.0.1:${address.port}/user`,
      );

      expect(response.status).toBe(200);

      expect(await response.json()).toEqual({
        name: "AKS User",
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

  it("resolves transient and singleton dependencies with the expected lifetimes", async () => {
  const app = new AKSApp();

  app.getContainer().register("transientService", () => ({
    id: Symbol(),
  }));

  app.getContainer().registerSingleton("singletonService", () => ({
    id: Symbol(),
  }));

  app.get("/di-lifetimes", (ctx) => {
    const transientA = ctx.container.resolve<{ id: symbol }>(
      "transientService",
    );

    const transientB = ctx.container.resolve<{ id: symbol }>(
      "transientService",
    );

    const singletonA = ctx.container.resolve<{ id: symbol }>(
      "singletonService",
    );

    const singletonB = ctx.container.resolve<{ id: symbol }>(
      "singletonService",
    );

    return ctx.response.json({
      transientSame: transientA === transientB,
      singletonSame: singletonA === singletonB,
    });
  });

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
      `http://127.0.0.1:${address.port}/di-lifetimes`,
    );

    expect(response.status).toBe(200);

    expect(await response.json()).toEqual({
      transientSame: false,
      singletonSame: true,
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