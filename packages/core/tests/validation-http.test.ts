import { describe, expect, it } from "vitest";

import { AKSApp } from "../src/app.js";
import { createHTTPServer } from "../src/http.js";
import { validateRequest } from "../src/validation-middleware.js";

describe("HTTP validation", () => {
  it("returns structured 422 validation errors", async () => {
    const app = new AKSApp();

    let handlerCalled = false;

    app.use((ctx, next) =>
      validateRequest(
        ctx,
        {
          body: () => ({
            success: false,
            issues: [
              {
                source: "body",
                path: "name",
                message: "Name is required",
                code: "REQUIRED",
              },
            ],
          }),
        },
        next,
      ),
    );

    app.post("/users", () => {
      handlerCalled = true;

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
        },
        body: {
          success: true,
        },
      };
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
        `http://127.0.0.1:${address.port}/users`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );

      const body = await response.json();

      expect(response.status).toBe(422);

      expect(body).toEqual({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        status: 422,
        issues: [
          {
            source: "body",
            path: "name",
            message: "Name is required",
            code: "REQUIRED",
          },
        ],
      });

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
});