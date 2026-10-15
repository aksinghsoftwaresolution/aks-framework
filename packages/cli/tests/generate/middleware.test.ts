import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { middlewareGenerator } from "../../src/generate/generators/middleware.js";
import type { GeneratorContext } from "../../src/generate/types.js";

function createContext(
  name: string,
  cwd = "test-project",
): GeneratorContext {
  return {
    cwd,
    name,
    originalName: name,
    write: false,
    force: false,
  };
}

describe("middleware generator", () => {
  it("has the correct generator metadata", () => {
    expect(middlewareGenerator.name).toBe("middleware");
    expect(middlewareGenerator.description).toBe(
      "Generate application middleware.",
    );
  });

  it("generates a middleware file", async () => {
    const files = await middlewareGenerator.createFiles(
      createContext("auth"),
    );

    expect(files).toHaveLength(1);
    expect(files[0].path).toBe(
      join(
        "test-project",
        "src",
        "middleware",
        "auth.middleware.ts",
      ),
    );

    expect(files[0].content).toBe(
      [
        'import type { Middleware } from "@aks-framework/core";',
        "",
        "export const authMiddleware: Middleware = async (ctx, next) => {",
        "  // TODO: Add middleware logic.",
        "  await next();",
        "};",
        "",
      ].join("\n"),
    );
  });

  it("normalizes PascalCase names", async () => {
    const files = await middlewareGenerator.createFiles(
      createContext("AuthMiddleware"),
    );

    expect(files[0].path).toBe(
      join(
        "test-project",
        "src",
        "middleware",
        "auth-middleware.middleware.ts",
      ),
    );

    expect(files[0].content).toContain(
      "export const authMiddlewareMiddleware: Middleware = async (ctx, next) => {",
    );
  });

  it("normalizes snake_case names", async () => {
    const files = await middlewareGenerator.createFiles(
      createContext("request_logger"),
    );

    expect(files[0].path).toBe(
      join(
        "test-project",
        "src",
        "middleware",
        "request-logger.middleware.ts",
      ),
    );

    expect(files[0].content).toContain(
      "export const requestLoggerMiddleware: Middleware = async (ctx, next) => {",
    );
  });

  it("normalizes kebab-case names", async () => {
    const files = await middlewareGenerator.createFiles(
      createContext("request-logger"),
    );

    expect(files[0].content).toContain(
      "export const requestLoggerMiddleware: Middleware = async (ctx, next) => {",
    );
  });

  it("uses the supplied project directory", async () => {
    const files = await middlewareGenerator.createFiles(
      createContext("auth", "custom-project"),
    );

    expect(files[0].path).toBe(
      join(
        "custom-project",
        "src",
        "middleware",
        "auth.middleware.ts",
      ),
    );
  });
});