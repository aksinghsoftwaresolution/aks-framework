# AKS Framework

**Intelligent. Enterprise. Autonomous.**

AKS Framework is a TypeScript-first backend framework for Node.js. It provides an explicit HTTP runtime, dependency injection, configuration management, structured logging, request validation, authentication, authorization, database abstractions, resource lifecycle management, and developer tooling.

AKS is designed to help developers build, understand, secure, and operate backend applications through clear APIs and modular architecture.

The monorepo includes:

- `@aks-framework/core`
- `@aks-framework/cli`
- `@aks-framework/driver-postgres`

Maintained by **AKSINGH SOFTWARE SOLUTION**.

---

## At a Glance

| Item | Details |
| --- | --- |
| Core package | `@aks-framework/core` (`0.1.0`) |
| CLI package | `@aks-framework/cli` |
| PostgreSQL driver | `@aks-framework/driver-postgres` |
| Runtime | Node.js built-in HTTP server |
| Language | TypeScript |
| Module system | ESM |
| Testing | Vitest |
| Database | Adapter-based database abstraction |
| Authentication | Bearer-token authentication through configurable verification |
| Authorization | Policies, roles, and permissions |
| Current status | Under active development |

The repository does not currently declare a supported Node.js version range or a formal stability level in package metadata.

---

## Our Vision

AKS is built around three pillars.

### 1. Intelligent

The framework aims to understand the applications developers build.

Current foundations include:

- Dependency injection and dependency resolution.
- Application route and middleware registration.
- Configuration access and diagnostics.
- CLI dependency graph tooling.
- Application and runtime diagnostic commands.

Future intelligence capabilities may build on these foundations to provide deeper architecture analysis, configuration intelligence, request journey analysis, and change impact detection.

### 2. Enterprise

Backend applications need predictable security, reliability, and resource management.

Current foundations include:

- Structured logging.
- Authentication and authorization middleware.
- Request validation.
- Database adapter abstractions.
- Transaction handling.
- Resource disposal and lifecycle management.
- Framework error handling.

### 3. Autonomous

AKS aims to help developers detect and resolve problems rather than merely report them.

The CLI already provides diagnostic and repair-oriented tooling. More advanced application-aware recommendations, automated testing, and approved self-healing workflows are future development areas.

**Important:** The three pillars describe the product direction. They do not imply that every planned intelligence or autonomous capability is already implemented.

---

## Current Implementation Status

The current release line is `0.1.0`.

| Area | Status | Current scope |
| --- | --- | --- |
| HTTP server and routing | Implemented | Node.js HTTP server, static/dynamic/wildcard routes, supported HTTP methods |
| Request context and parsing | Implemented | Method, path, headers, parameters, query values, and JSON body |
| Responses and middleware | Implemented | JSON/text responses, status codes, custom headers, onion-style middleware |
| HTTP behavior and error handling | Implemented | `HEAD`, automatic `OPTIONS`, `404`, `405`, framework errors, custom error handling |
| Request validation | Implemented | Application-provided validators for body, query, and route parameters |
| Configuration and environment files | Implemented | Configuration access, defaults, diagnostics, and layered `.env` loading |
| Logging | Implemented | Structured logging with console and file transports |
| Dependency injection | Implemented | Transient and singleton registrations, circular-dependency detection, disposable singleton support |
| Database abstraction | Implemented | Adapter contract, queries, transactions, and resource lifecycle management |
| PostgreSQL driver | Implemented | Pool integration, connection verification, queries, transactions, and disposal handling |
| Authentication | Implemented | Authentication middleware and configurable bearer-token verification |
| Authorization | Implemented | Authorization policies, role checks, and permission checks |
| CLI | Partially implemented | Doctor, generators, update checks, health, diagnostics, dependency graph, and contract tooling |
| CLI security command | Placeholder | Command exists, but security checks are not implemented |
| Advanced application intelligence | Planned | Deeper application metadata and runtime intelligence |
| Autonomous application repair | Planned | Application-aware recommendations and safe automated actions |

The latest recorded full test run passed **605 tests across 42 test files**, with 3 additional tests skipped. The skipped tests require a live PostgreSQL database and `AKS_TEST_DATABASE_URL`.

This is a development snapshot, not a guarantee of production readiness. Run the test suite to verify the current state.

---

## Features

### HTTP Runtime

- Node.js built-in HTTP server.
- Static, dynamic, and wildcard route matching.
- Route priority: static routes before dynamic routes, and dynamic routes before wildcard routes.
- Query parsing and URL-decoded route parameters.
- JSON request-body parsing and request context.
- JSON and text response helpers.
- Custom response status codes and headers.
- Onion-style middleware execution.
- Middleware short-circuiting and error propagation.
- `HEAD` handling through `GET`.
- Automatic `OPTIONS` responses.
- Default `404` and `405` handling.

### Request Validation

- Application-provided validator functions.
- Validation of request body, query, and route parameters.
- Normalized validated data available through `ctx.validated`.
- Validation failures represented by `ValidationError` with HTTP status `422`.

### Configuration

- Explicit configuration values.
- Environment variable support.
- Defaults and required values.
- Nested configuration access.
- Numeric and boolean getters.
- Environment-file parsing and loading.
- Configuration diagnostics.

### Logging

- Structured logging.
- `debug`, `info`, `warn`, and `error` levels.
- Console and file transports.
- Custom transport support.
- Application-level logger access.

### Dependency Injection

- Transient registrations.
- Singleton registrations.
- String and symbol tokens.
- Dependency resolution.
- Circular-dependency detection.
- Disposable singleton support.
- Application-owned DI container.

### Database

- Database adapter abstraction.
- Query execution.
- Transaction creation, commit, and rollback.
- Transaction completion and cleanup.
- Adapter disposal and resource lifecycle management.
- PostgreSQL connection pooling through the separate driver package.

### Authentication and Authorization

- Bearer-token extraction.
- Configurable token verification.
- Authentication middleware.
- Immutable authentication context.
- Authorization policies.
- Role-based checks.
- Permission-based checks.
- HTTP `401` and `403` handling.

### Developer Tooling

- Project diagnostics.
- Resource generators.
- Framework update checks.
- Health and diagnostic command groups.
- Dependency graph tooling.
- OpenAPI contract validation.

---

## Installation and Quick Start

This repository currently documents a local-checkout workflow.

From the repository root:

```bash
npm install
npm run build
npm run dev
```

The checked-in example listens on port `3000`.

Test it:

```bash
curl http://localhost:3000/hello
```

Example response:

```json
{
  "message": "Hello from AKS Framework",
  "method": "GET",
  "path": "/hello"
}
```

---

## First Application

After building the core package, create `examples/first-app.ts`:

```ts
import { AKSApp } from "../packages/core/dist/index.js";

const app = new AKSApp();

app.get("/hello", (ctx) => {
  return ctx.response.json({
    message: "Hello from AKS Framework",
  });
});

app.listen(3000);
```

Run it:

```bash
npx tsx examples/first-app.ts
```

`app.listen(port)` starts the HTTP server. It does not return a server handle.

---

## HTTP and Routing

`AKSApp` supports:

- `GET`
- `POST`
- `PUT`
- `PATCH`
- `DELETE`

Example:

```ts
import { AKSApp } from "@aks-framework/core";

const app = new AKSApp();

app.get("/users", (ctx) => {
  return ctx.response.json({
    users: [],
  });
});

app.get("/users/:id", (ctx) => {
  return ctx.response.json({
    userId: ctx.params.id,
  });
});

app.post("/users", (ctx) => {
  return ctx.response.status(201).json({
    message: "User created",
    body: ctx.body,
  });
});

app.listen(3000);
```

### Route patterns

Static route:

```ts
app.get("/users/me", (ctx) => {
  return ctx.response.json({ user: "current" });
});
```

Dynamic route:

```ts
app.get("/users/:id", (ctx) => {
  return ctx.response.json({
    id: ctx.params.id,
  });
});
```

Wildcard route:

```ts
app.get("/files/*", (ctx) => {
  return ctx.response.json({
    path: ctx.params["*"],
  });
});
```

### Routing behavior

- Static routes take precedence over dynamic routes.
- Dynamic routes take precedence over wildcard routes.
- Empty path segments are ignored during matching.
- Trailing and repeated slashes are effectively normalized.
- Dynamic parameters are available through `ctx.params`.
- Wildcards capture the remaining path through `ctx.params["*"]`.
- Dynamic and wildcard parameter values are URL-decoded.
- Invalid percent-encoding raises `BadRequestError`.
- Wildcard matching stops when the `*` segment is reached. Treat wildcard segments as terminal route patterns.
- Query values are strings in `ctx.query`.
- Repeated query keys are not represented as arrays; later occurrences overwrite earlier values.

### `HEAD`, `OPTIONS`, `404`, and `405`

- A `HEAD` request can match a `GET` route. The handler executes, but the response body is suppressed.
- `OPTIONS` is handled automatically when the path matches registered routes.
- The automatic `OPTIONS` response uses status `204` and an `Allow` header.
- The generated `Allow` header includes registered methods, adds `HEAD` when `GET` is registered, and includes `OPTIONS`.
- An unmatched route normally produces `404`.
- A matching path with an unsupported method normally produces `405`.
- The `Allow` header for `405` contains registered route methods; it does not automatically add `HEAD` or `OPTIONS`.
- Request-body parsing happens before final route dispatch and method handling. Malformed JSON can therefore take precedence over `404`, `405`, or automatic `OPTIONS`.
- A custom error handler can change the final response.

---

## Requests and Responses

The request context exposes:

```ts
ctx.request.method
ctx.request.path
ctx.request.headers

ctx.params
ctx.query
ctx.body

ctx.response
```

### Request body parsing

The current HTTP runtime buffers and parses request bodies as JSON regardless of `Content-Type`.

- Empty or whitespace-only bodies produce `undefined`.
- Malformed JSON raises `BadRequestError` and normally produces HTTP `400`.
- Other body formats are not parsed by the current core.
- The JSON parser does not currently enforce a request-body size limit.

### Response helpers

| Method | Behavior |
| --- | --- |
| `status(code)` | Set the response status code |
| `header(name, value)` | Set a response header |
| `json(body)` | Produce a JSON `ResponseResult` |
| `text(body)` | Produce a plain-text `ResponseResult` |

Example:

```ts
app.get("/status", (ctx) => {
  return ctx.response
    .status(200)
    .header("X-AKS-Version", "0.1.0")
    .json({
      status: "ok",
    });
});
```

Both `json()` and `text()` return a `ResponseResult`.

For JSON responses, use object or array payloads when you want JSON serialization. The HTTP sender writes string-valued response bodies directly rather than JSON-quoting them. Ordinary route-handler return values are passed through `JSON.stringify()` by the HTTP layer; an `undefined` result produces an empty response body.

---

## Middleware

Register middleware with `app.use()`.

Each middleware receives `(ctx, next)`. The `next()` function returns a promise.

Example:

```ts
import { AKSApp } from "@aks-framework/core";

const app = new AKSApp();

app.use(async (ctx, next) => {
  const startedAt = Date.now();

  await next();

  console.log({
    method: ctx.request.method,
    path: ctx.request.path,
    durationMs: Date.now() - startedAt,
  });
});

app.get("/hello", (ctx) => {
  return ctx.response.json({
    message: "Hello",
  });
});

app.listen(3000);
```

Middleware follows onion-style execution:

1. Middleware runs before downstream middleware and the route handler.
2. `await next()` transfers control downstream.
3. Code after `await next()` runs while control returns outward.

Middleware can short-circuit by not calling `next()` and returning a response result.

Middleware runs only after successful body parsing and route/method matching. It is not invoked for automatic `OPTIONS`, `404`, `405`, or malformed-body responses.

Calling `next()` more than once throws an error and enters error handling.

---

## Request Validation

The core provides a validator interface and `validateRequest()` middleware, but does not include a schema-definition language.

Applications provide validator functions for any combination of:

- Request body.
- Query parameters.
- Route parameters.

A validator returns either:

```ts
{
  success: true,
  data: normalizedData,
}
```

or:

```ts
{
  success: false,
  issues: [
    {
      source: "body",
      path: "email",
      message: "Email is required",
    },
  ],
}
```

Validation issues include a source, path, and message, with an optional code.

After successful validation, normalized data is stored under:

```ts
ctx.validated.body
ctx.validated.query
ctx.validated.params
```

If validation fails, the middleware throws `ValidationError` with status `422` and the collected issues.

Applications supply the actual validator functions and may integrate their preferred validation library.

---

## Configuration and Environment Files

`AKSConfig` reads explicitly provided values and environment variables.

Its API supports:

- `get()`
- `getOrDefault()`
- `require()`
- Numeric and boolean getters.
- Configuration diagnostics.
- Defaults and explicit environment maps.
- Environment-file configuration.

Example:

```ts
import { AKSConfig } from "@aks-framework/core";

const config = new AKSConfig({
  values: {
    app: {
      name: "users-api",
      port: 3000,
    },
  },
});

const appName = config.get("app.name");
const port = config.getOrDefault("app.port", 3000);

console.log({ appName, port });
```

Missing required values passed to `require()` throw an error.

### Environment files

The following helpers are exported:

- `parseEnv()`
- `loadEnvFile()`
- `loadEnvFiles()`

By default, environment files are loaded in this order:

1. `.env`
2. `.env.<NODE_ENV>`
3. `.env.local`
4. `.env.<NODE_ENV>.local`

Later files override earlier files.

`AKSConfig` accepts `envFile` options to customize environment-file loading and `env` to provide an explicit environment map.

Example:

```ts
import { AKSConfig } from "@aks-framework/core";

const config = new AKSConfig({
  envFile: true,
});

const databaseUrl = config.require("DATABASE_URL");
const port = config.getNumber("PORT", 3000);

console.log({
  databaseConfigured: Boolean(databaseUrl),
  port,
});
```

Do not commit real secrets or production credentials to environment files in source control.

---

## Logging

`AKSLogger` supports:

- `debug`
- `info`
- `warn`
- `error`

It supports structured context and configurable transports.

Included transports:

- `ConsoleTransport`
- `FileTransport`

Custom transports can implement the exported `LogTransport` interface.

Example:

```ts
import {
  AKSApp,
  AKSLogger,
  ConsoleTransport,
} from "@aks-framework/core";

const logger = new AKSLogger({
  level: "debug",
  transports: [
    new ConsoleTransport(),
  ],
});

const app = new AKSApp({ logger });

app.get("/hello", (ctx) => {
  app.getLogger().info("Hello route requested", {
    path: ctx.request.path,
  });

  return ctx.response.json({
    message: "Hello",
  });
});

app.listen(3000);
```

Pass a logger to `AKSApp` to use it for framework logging. Retrieve it later with:

```ts
const logger = app.getLogger();
```

---

## Dependency Injection

Each `AKSApp` owns a `DIContainer`, available through:

```ts
app.getContainer()
ctx.container
```

The container supports:

- `register()` for transient instances.
- `registerSingleton()` for cached singleton instances.
- String and symbol tokens.
- Dependency resolution.
- Circular-dependency detection.
- Disposal of resolved singleton instances that support the disposable lifecycle.

Example:

```ts
import {
  AKSApp,
  DIContainer,
} from "@aks-framework/core";

const app = new AKSApp();
const container = app.getContainer();

class UserService {
  findAll() {
    return [
      { id: 1, name: "Adison" },
    ];
  }
}

container.registerSingleton(
  "UserService",
  () => new UserService(),
);

app.get("/users", (ctx) => {
  const users = ctx.container
    .resolve<UserService>("UserService")
    .findAll();

  return ctx.response.json({ users });
});

app.listen(3000);
```

Use dependency injection to separate service construction from application behavior and to manage shared dependencies.

The example demonstrates a string token. Applications can also use symbol tokens.

---

## Database Support

AKS provides a database abstraction in the core package and a PostgreSQL driver in the monorepo.

The abstraction separates framework-level database operations from database-specific implementation.

Current database capabilities include:

- Query execution through the database adapter.
- Transaction creation.
- Transaction commit and rollback.
- Transaction completion and client cleanup.
- Adapter disposal and resource lifecycle management.
- PostgreSQL connection pooling.
- PostgreSQL connection verification.
- Handling of connection, query, transaction, and pool-disposal failures.

### PostgreSQL installation

Install the relevant packages in an application using the PostgreSQL driver:

```bash
npm install @aks-framework/core @aks-framework/driver-postgres pg
```

### PostgreSQL usage

The following ESM example demonstrates driver registration, connection, a parameterized query, and resource disposal.

It assumes:

- `DATABASE_URL` is configured.
- The target database is reachable.
- A `users` table exists.

```ts
import {
  AKSDatabase,
  DatabaseDriverRegistry,
  type DatabaseAdapter,
} from "@aks-framework/core";

import {
  PostgresDatabaseDriver,
} from "@aks-framework/driver-postgres";

async function main(): Promise<void> {
  const registry = new DatabaseDriverRegistry();

  registry.register(new PostgresDatabaseDriver());

  const adapter = await registry.connect("postgres", {
    connectionString: process.env.DATABASE_URL,
  });

  const database = new AKSDatabase({
    adapter: adapter as DatabaseAdapter,
  });

  try {
    const result = await database.query<{
      id: number;
      name: string;
    }>(
      "SELECT id, name FROM users WHERE id = $1",
      [7],
    );

    console.log(result.rows);
  } finally {
    await database.dispose();
  }
}

main().catch((error: unknown) => {
  console.error("Database operation failed:", error);
  process.exitCode = 1;
});
```

The PostgreSQL driver verifies connectivity during connection setup.

The query uses a parameterized value rather than interpolating input into SQL.

`DatabaseDriverRegistry.connect()` returns the general `DatabaseAdapterBase` type. The example uses a type assertion because `AKSDatabase` requires a `DatabaseAdapter`. The assertion does not perform runtime conversion or additional validation.

### Database testing

Mock-based tests cover database abstraction, transactions, and resource lifecycle behavior without requiring a locally installed PostgreSQL server.

The repository also includes PostgreSQL driver integration tests using a mocked `pg.Pool`. These tests verify interactions between the driver registry, PostgreSQL driver, and database abstraction. They do not establish connectivity to a live PostgreSQL server.

Live database tests require a running PostgreSQL instance and `AKS_TEST_DATABASE_URL`.

---

## Authentication

AKS provides authentication middleware and a configurable bearer-token verification strategy.

The framework separates credential extraction from credential verification. Applications supply the verification logic appropriate to their authentication provider.

### Authentication flow

1. The middleware extracts a bearer token from the `Authorization` header.
2. The configured authentication strategy verifies the token.
3. The strategy returns an authenticated user or `null`.
4. The middleware places an immutable authentication result in `ctx.auth`.
5. Authorization middleware can use the authenticated user to evaluate access policies.

Missing or invalid credentials result in HTTP `401`.

### Bearer-token authentication

Example:

```ts
import {
  AKSApp,
  BearerTokenStrategy,
  createAuthenticationMiddleware,
} from "@aks-framework/core";

const app = new AKSApp();

const strategy = new BearerTokenStrategy({
  verifyToken: async (token) => {
    // Replace this with your real token verification.
    // Verify signature, expiration, issuer, and audience
    // according to your authentication provider.

    if (token !== process.env.API_ACCESS_TOKEN) {
      return null;
    }

    return {
      user: {
        id: "user-123",
        name: "Example User",
      },
      attributes: {
        roles: ["user"],
        permissions: ["users:read"],
      },
    };
  },
});

app.use(
  createAuthenticationMiddleware(strategy),
);

app.get("/profile", (ctx) => {
  return ctx.response.json({
    user: ctx.auth?.user,
  });
});

app.listen(3000);
```

The example uses a simple environment token comparison only to demonstrate the middleware integration. It is not a production token-verification implementation.

### Important token-verification responsibility

`BearerTokenStrategy` delegates verification to the configured verifier.

The application or authentication provider must perform the appropriate cryptographic and claim validation, including:

- Token signature verification.
- Expiration checks.
- Issuer validation.
- Audience validation.
- Permitted algorithm validation.
- Any application-specific identity and claim checks.

AKS does not currently provide built-in JWT cryptographic verification or a built-in OIDC integration.

Do not treat successful bearer-token extraction as proof that a token is valid.

### Authentication context

After successful authentication, the authenticated user is available through:

```ts
ctx.auth?.user
```

Additional authentication attributes are available through:

```ts
ctx.auth?.attributes
```

The authentication middleware creates an immutable copy of the authentication result so downstream middleware and handlers cannot modify its plain-object user and attribute data.

---

## Authorization

Authentication determines who is making a request. Authorization determines whether that authenticated user may perform the requested operation.

AKS provides:

- Authorization policies.
- Role checks.
- Permission checks.
- HTTP `401` handling when authentication is missing.
- HTTP `403` handling when access is denied.
- Fail-closed handling for invalid policy results.

### Authorization policy

An authorization policy receives the authenticated user and request context and returns a boolean.

Example:

```ts
import {
  AKSApp,
  createAuthenticationMiddleware,
  createAuthorizationMiddleware,
} from "@aks-framework/core";

const app = new AKSApp();

// Register your authentication middleware before
// authorization middleware.

app.use(createAuthenticationMiddleware(strategy));

app.get(
  "/admin",
  createAuthorizationMiddleware(
    async (user) => {
      return Array.isArray(user.roles)
        && user.roles.includes("admin");
    },
  ),
  (ctx) => {
    return ctx.response.json({
      message: "Welcome, administrator",
    });
  },
);

app.listen(3000);
```

The `strategy` variable represents the configured authentication strategy from the previous example.

Expected behavior:

| Condition | HTTP status |
| --- | ---: |
| No authenticated user | `401` |
| Policy denies access | `403` |
| Policy allows access | Route handler executes |

### Role-based access

AKS provides `requireRole()` for role-based checks.

Example:

```ts
app.get(
  "/admin",
  requireRole("admin"),
  (ctx) => {
    return ctx.response.json({
      message: "Admin access granted",
    });
  },
);
```

### Permission-based access

AKS provides `requirePermission()` for permission-based checks.

Example:

```ts
app.get(
  "/users",
  requirePermission("users:read"),
  (ctx) => {
    return ctx.response.json({
      users: [],
    });
  },
);
```

Role and permission resolvers must return valid arrays. Invalid resolver results fail closed.

**Security note:** Route-level authorization does not automatically implement resource ownership checks. Applications must explicitly enforce rules such as whether a user can access a particular user's record.

---

## Error Handling

Register a custom handler with:

```ts
app.onError(handler);
```

The handler receives `(error, ctx)` and is expected to return a valid `ResponseResult`. If it does not, the HTTP layer falls back to a generic `500` response.

`AKSError` contains a `statusCode` and an optional `code`.

Exported subclasses include:

- `BadRequestError`
- `UnauthorizedError`
- `ForbiddenError`
- `NotFoundError`
- `MethodNotAllowedError`
- `ConflictError`
- `ValidationError`
- `TooManyRequestsError`
- `InternalServerError`
- `BadGatewayError`
- `ServiceUnavailableError`
- `GatewayTimeoutError`
- `AuthenticationError`
- `AuthorizationError`

Example:

```ts
import {
  AKSApp,
  NotFoundError,
} from "@aks-framework/core";

const app = new AKSApp();

app.get("/users/:id", (ctx) => {
  const user = undefined;

  if (!user) {
    throw new NotFoundError("User not found");
  }

  return ctx.response.json({ user });
});

app.listen(3000);
```

The default `handleError(ctx, error)` returns an `AKSError`'s status code and a JSON body containing `error`, `status`, and `code` when present.

Unknown errors normally produce HTTP `500`:

```json
{
  "error": "Internal server error"
}
```

The `code` field is omitted when unavailable.

---

## CLI

The `@aks-framework/cli` package exposes the `aks` executable.

Check available commands:

```bash
aks --help
```

Current command groups include:

| Command | Purpose |
| --- | --- |
| `doctor` | Inspect framework and project setup |
| `generate` | Generate supported application resources |
| `update` | Check for available AKS package updates |
| `health` | Health tooling |
| `diagnose` | Application and runtime diagnostics |
| `graph` | Dependency graph tooling |
| `contract` | OpenAPI contract validation |
| `security` | Reserved command; checks are not implemented yet |

### Doctor

```bash
aks doctor
```

Doctor checks project and framework setup. It is read-only by default.

Supported options include:

```bash
aks doctor --json
aks doctor --fix
```

JSON mode provides machine-readable output and does not prompt or modify files.

Supported repair operations should be reviewed before use. Dependency updates offered by repair operations remain within the versions requested by `package.json`.

### Generate

Supported generators:

- `controller`
- `service`
- `module`
- `middleware`

Examples:

```bash
aks generate controller users
aks generate service users
aks generate module users
aks generate middleware authentication
```

Generated files go under the corresponding `src/` subdirectories.

Preview file operations:

```bash
aks generate module users --dry-run
```

Use `--force` to overwrite existing files.

### Update

Check for available updates:

```bash
aks update
```

Preview behavior:

```bash
aks update --dry-run
```

The update command checks installed AKS package versions and reports available updates. It prints a package-manager command rather than installing updates itself.

### Contract validation

The CLI uses [`@apidevtools/swagger-parser`](https://www.npmjs.com/package/@apidevtools/swagger-parser) to parse and validate existing OpenAPI documents in JSON or YAML format.

Validate YAML:

```bash
aks contract --file openapi.yaml
```

Validate JSON with machine-readable output:

```bash
aks contract --file openapi.json --json
```

| Option | Description |
| --- | --- |
| `--file <path>` | Path to the OpenAPI JSON or YAML document. Required. |
| `--json` | Output the validation result as JSON. |
| `-h`, `--help` | Show contract command help. |

The command reports whether the document is valid and, when available, includes its OpenAPI version, API title, and API version.

Failed validation sets the process exit code to `1`.

**Current scope:** This command validates existing OpenAPI documents. It does not automatically generate specifications from AKS routes or provide a Swagger UI.

### CLI security command

The `security` command is currently a placeholder. It does not perform security checks.

The existence of the command should not be interpreted as an implemented security scanner.

---

## Core API

The core package is named `@aks-framework/core`.

Its package exports provide an ESM import entry and TypeScript types. A CommonJS `require` export is not declared.

Important exports include:

| Export | Description |
| --- | --- |
| `AKSApp` | Application class and route/middleware/error-handler registration |
| `createHTTPServer` | Create a Node.js HTTP server for an `AKSApp` |
| `AKSResponse` | Construct JSON and text `ResponseResult` values |
| `parseJSONBody` | Buffer and parse an incoming request as JSON |
| `AKSConfig` | Read configuration values and inspect validity |
| `parseEnv`, `loadEnvFile`, `loadEnvFiles` | Parse and load `.env` files |
| `AKSLogger`, `ConsoleTransport`, `FileTransport` | Structured logging and built-in transports |
| `DIContainer` | Register and resolve dependencies |
| `validateRequest` | Run application-provided request validators |
| `createAuthenticationMiddleware` | Authenticate requests using a configured strategy |
| `BearerTokenStrategy` | Extract and verify bearer-token credentials through a verifier |
| `createAuthorizationMiddleware` | Apply an authorization policy |
| `requireRole` | Role-based authorization middleware |
| `requirePermission` | Permission-based authorization middleware |
| `handleError` | Default handler for framework and unknown errors |
| `AKSError` and subclasses | Framework error types |
| `RequestContext` | Context type passed to handlers and middleware |
| `ResponseResult` | Response status, headers, and body shape |
| `HTTPMethod` | Registered route method type |
| `Middleware`, `ErrorHandler`, `Route`, `RouteHandler` | Middleware, error-handler, and route types |
| `AKSDatabase` and database adapter types | Database operations and adapter contracts |
| `AKS_VERSION` | Core version constant (`0.1.0`) |

`AKSApp` exposes:

- `get()`
- `post()`
- `put()`
- `patch()`
- `delete()`
- `use()`
- `onError()`
- `getRoutes()`
- `getMiddlewares()`
- `getErrorHandler()`
- `getContainer()`
- `getLogger()`
- `listen()`

Refer to the package source and exported TypeScript declarations for exact signatures of database and driver APIs.

---

## Current Limitations

The current framework does not provide:

- Built-in JWT cryptographic verification.
- Built-in OpenID Connect integration.
- A built-in schema-definition language.
- Multipart or form-data parsing.
- A request-body size limit in the JSON parser.
- Automatic resource ownership authorization.
- A declared Node.js `engines` requirement.
- A declared formal stability level.
- Live PostgreSQL test coverage in the default test run.

Database access is available through the database abstraction and PostgreSQL driver. This does not mean every database engine or persistence feature is supported.

The CLI `security` command is a placeholder and does not currently perform security checks.

Advanced application intelligence and autonomous repair capabilities remain future development areas.

---

## Where AKS Fits

AKS focuses on the Node.js backend/runtime layer:

- Accepting HTTP requests.
- Matching routes.
- Executing middleware.
- Validating requests.
- Authenticating and authorizing requests.
- Creating responses.
- Managing dependencies.
- Managing database access through adapters.
- Managing application resources.
- Providing developer tooling.

AKS is not a frontend UI framework or frontend build tool.

---

## Development and Tests

Run commands from the repository root:

```bash
npm install
npm run build
npm test
npm run test:watch
npm run dev
```

The build compiles the core, CLI, and PostgreSQL driver packages into their respective `dist` directories.

The root TypeScript configuration uses:

- `target: ES2022`
- `module: NodeNext`
- `moduleResolution: NodeNext`
- `strict: true`

### PostgreSQL integration tests

The default test suite skips live PostgreSQL tests when a database is not configured.

To run live PostgreSQL tests, configure:

```bash
AKS_TEST_DATABASE_URL=postgres://user:password@localhost:5432/aks_test
```

Then run the PostgreSQL test command:

```bash
npm run test:postgres
```

Use a dedicated test database. Do not point integration tests at production data.

### Latest recorded test snapshot

The latest recorded full test run:

- **42 test files passed**
- **605 tests passed**
- **3 tests skipped**

The skipped tests require a live PostgreSQL database and `AKS_TEST_DATABASE_URL`.

Always run the suite again after making changes.

Before submitting changes:

```bash
npm run build
npm test
git diff --check
```

---

## Repository Layout

```text
examples/
  hello-api.ts

packages/
  core/
    src/          HTTP runtime and framework APIs
    tests/        Core runtime and API tests

  cli/
    src/          CLI commands and generators
    tests/        CLI and generator tests

  driver-postgres/
    src/          PostgreSQL driver implementation
    tests/        PostgreSQL driver tests
```

---

## Roadmap

AKS is under active development. The product direction is organized around its three pillars.

### Intelligent

- Shared application metadata model.
- Deeper dependency and architecture analysis.
- Configuration intelligence.
- Request journey intelligence.
- Change impact analysis.
- Contract drift detection.

### Enterprise

- Expanded security diagnostics.
- Additional database drivers.
- More comprehensive health and resource monitoring.
- Architecture governance.
- Operational and lifecycle controls.
- Broader infrastructure integrations.

### Autonomous

- Advanced diagnostic recommendations.
- Safe automated repair workflows.
- Automated test generation.
- Application-aware AI assistance.
- Approval-based actions with verification and reporting.

These are potential future development areas, not promises of scheduled releases. Consult the current repository implementation to determine which capabilities are available.

---

## Contributing

Keep changes focused, preserve the explicit TypeScript API, and include tests for behavior changes.

Before submitting a change:

1. Run `npm run build`.
2. Run `npm test`.
3. Run `git diff --check`.
4. Update documentation when behavior or public APIs change.

Document implemented behavior separately from proposed work.

---

## ❤️ Support the Project

If AKS Framework has saved you time or helped you build your application, please consider supporting its ongoing development.

Your sponsorship helps cover maintenance costs, new features, and faster bug fixes.

- **[Sponsor us on GitHub](https://github.com/sponsors/aksinghsoftwaresolution)**
- **[Support us on thanks.dev](https://thanks.dev/gh/aksinghsoftwaresolution)**

Thank you for supporting open-source software!

---

## License

AKS Framework is licensed under the MIT License. See [LICENSE](./LICENSE) for details.