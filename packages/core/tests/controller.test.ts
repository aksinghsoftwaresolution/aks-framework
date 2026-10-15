import { describe, expect, it } from "vitest";

import type { Controller } from "../src/controller.js";
import type { RequestContext } from "../src/context.js";

describe("Controller", () => {
  it("supports an independent controller function", async () => {
    const controller: Controller = async (ctx) => {
      return ctx.response.json({
        message: "Hello from controller",
        method: ctx.request.method,
      });
    };

    const ctx = {
      request: {
        method: "GET",
        path: "/hello",
        headers: {},
      },
      params: {},
      query: {},
      body: undefined,
      validated: {},
      response: new (class {
        json(body: unknown) {
          return {
            statusCode: 200,
            headers: {
              "Content-Type": "application/json",
            },
            body,
          };
        }
      })(),
    } as RequestContext;

    const result = await controller(ctx);

    expect(result).toEqual({
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        message: "Hello from controller",
        method: "GET",
      },
    });
  });

  it("propagates controller errors", async () => {
    const controller: Controller = () => {
      throw new Error("Controller failed");
    };

    const ctx = {
      request: {
        method: "GET",
        path: "/error",
        headers: {},
      },
      params: {},
      query: {},
      body: undefined,
      validated: {},
      response: new (class {
        status(code: number) {
          return this;
        }

        json(body: unknown) {
          return {
            statusCode: 500,
            headers: {
              "Content-Type": "application/json",
            },
            body,
          };
        }
      })(),
    } as RequestContext;

   await expect(
  Promise.resolve().then(() => controller(ctx)),
).rejects.toThrow("Controller failed");
  });
});