
import { afterEach, describe, expect, it } from "vitest";
import { AKSApp } from "../src/app.js";
import { createHTTPServer } from "../src/http.js";
import {
  createAuthenticationMiddleware,
  extractBearerToken,
} from "../src/auth/authentication-middleware.js";
import { BearerTokenStrategy } from "../src/auth/bearer-token-strategy.js";
import {
  createAuthorizationMiddleware,
} from "../src/auth/authorization-middleware.js";
import {
  requirePermission,
} from "../src/auth/policies.js";
import type { Server } from "node:http";

const servers: Server[] = [];

async function startServer(app: AKSApp): Promise<string> {
  const server = createHTTPServer(app);
  servers.push(server);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  const activeServers = servers.splice(0);

  await Promise.all(
    activeServers.map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          if (!server.listening) {
            resolve();
            return;
          }

          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        }),
    ),
  );
});


function createTestApp() {
  const app = new AKSApp();

  const strategy = new BearerTokenStrategy((token) => {
    if (token !== "valid-token") {
      return null;
    }

    return {
      user: {
        id: "user-123",
        attributes: {
          permissions: ["reports:read"],
        },
      },
    };
  });

  app.use(
    createAuthenticationMiddleware(strategy, {
      extractCredentials: extractBearerToken,
    }),
  );

  app.use(
    createAuthorizationMiddleware({
      policy: requirePermission(
        "reports:read",
        (user) => {
          const permissions = user.attributes?.permissions;

          return Array.isArray(permissions)
            ? permissions.filter(
                (permission): permission is string =>
                  typeof permission === "string",
              )
            : [];
        },
      ),
    }),
  );

  app.get("/protected", async (ctx) => ({
    message: "Authenticated",
    userId: ctx.auth?.id,
  }));

  app.get("/reports", async () => ({
    reports: ["monthly"],
  }));

  return app;
}

describe("HTTP authentication integration", () => {
  it("returns 401 when the Authorization header is missing", async () => {
    const baseUrl = await startServer(createTestApp());

    const response = await fetch(`${baseUrl}/protected`);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
  });

  it("returns 401 when the Bearer header is malformed", async () => {
    const baseUrl = await startServer(createTestApp());

    const response = await fetch(`${baseUrl}/protected`, {
      headers: {
        Authorization: "Basic valid-token",
      },
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
  });

  it("returns 401 when the token is invalid", async () => {
    const baseUrl = await startServer(createTestApp());

    const response = await fetch(`${baseUrl}/protected`, {
      headers: {
        Authorization: "Bearer invalid-token",
      },
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
  });

  it("allows a valid token to access the protected route", async () => {
    const baseUrl = await startServer(createTestApp());

    const response = await fetch(`${baseUrl}/protected`, {
      headers: {
        Authorization: "Bearer valid-token",
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "Authenticated",
      userId: "user-123",
    });
  });

  it("returns 403 when an authenticated user lacks permission", async () => {
    const app = new AKSApp();

    const strategy = new BearerTokenStrategy((token) => {
      if (token !== "valid-token") {
        return null;
      }

      return {
        user: {
          id: "user-123",
          attributes: {
            permissions: [],
          },
        },
      };
    });

    app.use(
  createAuthenticationMiddleware(strategy, {
    extractCredentials: extractBearerToken,
  }),
);

app.use(
  createAuthorizationMiddleware({
    policy: requirePermission(
      "reports:read",
      (user) => {
        const permissions = user.attributes?.permissions;

        return Array.isArray(permissions)
          ? permissions.filter(
              (permission): permission is string =>
                typeof permission === "string",
            )
          : [];
      },
    ),
  }),
);

app.get("/reports", async () => ({
  reports: ["monthly"],
}));

    const baseUrl = await startServer(app);

    const response = await fetch(`${baseUrl}/reports`, {
      headers: {
        Authorization: "Bearer valid-token",
      },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
  });

  it("allows an authenticated user with permission", async () => {
    const baseUrl = await startServer(createTestApp());

    const response = await fetch(`${baseUrl}/reports`, {
      headers: {
        Authorization: "Bearer valid-token",
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      reports: ["monthly"],
    });
  });
});
