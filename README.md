# AKS Framework

AKS Framework is a TypeScript-first backend framework for Node.js, designed to provide an explicit HTTP runtime, dependency injection, configuration management, structured logging, request validation, database abstractions, and developer tooling.

The monorepo includes `@aks-framework/core`, `@aks-framework/cli`, and `@aks-framework/driver-postgres`.

Maintained by **AKSINGH SOFTWARE SOLUTION**.

## At a Glance

- **Core package:** `@aks-framework/core` (`0.1.0`)
- **CLI package:** `@aks-framework/cli`
- **Database driver:** `@aks-framework/driver-postgres`
- **Runtime:** Node.js built-in HTTP server
- **Language:** TypeScript
- **Testing:** Vitest
- **Current focus:** Database integration, PostgreSQL driver reliability, resource lifecycle management, and developer tooling
- **Status:** Under active development; no formal stability level is declared in package metadata

## Why AKS?

Backend applications need more than an HTTP server. They need predictable request handling, configuration, dependency management, logging, error handling, resource cleanup, and database access.

AKS brings these concerns together through explicit TypeScript APIs and a modular package structure. Its goal is to provide a practical foundation for backend applications while keeping framework behavior understandable and testable.

AKS is under active development. APIs and behavior may change before a stable release.

## Current Status

The current release line is `0.1.0`. The repository does not declare a supported Node.js version range in package metadata.

| Area | Status | Current scope |
| --- | --- | --- |
| HTTP server and routing | Implemented | Node.js HTTP server, static/dynamic/wildcard routes, and supported HTTP methods |
| Request context and parsing | Implemented | Request method, path, headers, parameters, query values, and JSON body |
| Responses and middleware | Implemented | JSON/text responses, custom status codes and headers, onion-style middleware, and short-circuiting |
| HTTP behavior and error handling | Implemented | `HEAD`, automatic `OPTIONS`, `404`/`405`, framework errors, and custom error handling |
| Request validation | Implemented | Application-provided validators for body, query, and route parameters |
| Configuration and environment files | Implemented | Configuration access, defaults, diagnostics, and layered `.env` loading |
| Logging | Implemented | Structured logging with console and file transports |
| Dependency injection | Implemented | Transient and singleton registrations, circular-dependency detection, and disposable singleton support |
| Database abstraction | Implemented | Database adapter contract, queries, transactions, and resource lifecycle management |
| PostgreSQL driver | Implemented | PostgreSQL pool integration, connection verification, queries, transactions, and disposal handling |
| CLI | Partially implemented | Diagnostics, resource generation, update checks, health checks, dependency graph, and API contract tooling; security command is a placeholder |
| Authentication | Not implemented | No built-in authentication system is currently provided |

The repository's test suite last recorded **498 passing tests across 37 test files**. This is a snapshot of the development state at that time, not a guarantee of production readiness. Run the suite again to verify the current result.

## Features

- HTTP server creation using Node.js `http`.
- Static, dynamic, and wildcard route matching.
- Route priority: static routes before dynamic routes, and dynamic routes before wildcard routes.
- Query parsing and URL-decoded route parameters.
- JSON request-body parsing and request context.
- JSON and text response helpers, custom status codes, and response headers.
- Onion-style middleware execution, short-circuiting, and error propagation.
- Framework error classes, a default error handler, and a custom error-handler hook.
- `HEAD` handling through `GET`, automatic `OPTIONS`, and default `404`/`405` handling.
- Configurable request validation for body, query, and route parameters.
- Configuration access, environment-file parsing, layered environment loading, and diagnostics.
- Structured logging with console and file transports.
- Dependency injection with transient and singleton lifetimes.
- Database adapter abstractions, query execution, transaction handling, and resource cleanup.
- PostgreSQL connection pooling and transaction support through the PostgreSQL driver.
- CLI tooling for diagnostics, resource generation, update checks, health checks, dependency graphs, and API contract tooling. The security command is currently a placeholder.

## Quick Start

This repository currently documents a local-checkout workflow.

From the repository root:

```bash
npm install
npm run build
npm run dev
```

The checked-in example uses the built core package and listens on port `3000`.

Test the example:

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

Run it with the repository's TypeScript runner:

```bash
npx tsx examples/first-app.ts
```

`app.listen(port)` starts the HTTP server. It does not return a server handle.

## HTTP and Routing

`AKSApp` registers `GET`, `POST`, `PUT`, `PATCH`, and `DELETE` routes.

Supported route patterns include:

- Static paths such as `/users/me`.
- Dynamic parameters such as `/users/:id`.
- Wildcard paths such as `/files/*`.

Routing behavior:

- Static routes take precedence over dynamic routes; dynamic routes take precedence over wildcard routes.
- Empty path segments are ignored during matching. Trailing slashes and repeated slashes are effectively normalized.
- Dynamic parameters are available as `ctx.params.id` or through the corresponding parameter name.
- Wildcards capture the remaining path as `ctx.params["*"]`.
- Dynamic and wildcard parameter values are URL-decoded. Invalid percent-encoding raises `BadRequestError` and normally produces HTTP `400`.
- Wildcard matching stops when the `*` segment is reached. Treat wildcard segments as terminal route patterns.
- Query values are strings in `ctx.query`. Repeated keys are not represented as arrays; later occurrences overwrite earlier values.

### `HEAD`, `OPTIONS`, `404`, and `405`

- A `HEAD` request can match a `GET` route. Middleware and the `GET` handler execute, but the response body is suppressed.
- `OPTIONS` is handled automatically when the path matches registered routes. The generated response has status `204` and an `Allow` header.
- The automatic `OPTIONS` response includes registered methods, adds `HEAD` when `GET` is registered, and includes `OPTIONS`.
- Request-body parsing occurs before automatic `OPTIONS` handling. Malformed JSON can therefore produce `400` instead of `204`.
- An unmatched route normally produces `404`.
- When a path matches but the HTTP method is not registered, the default behavior is `405`.
- The `Allow` header for `405` contains the registered route methods; it does not automatically add `HEAD` or `OPTIONS`.
- Body parsing occurs before final route dispatch and method handling. Malformed JSON can take precedence over `404`, `405`, or automatic `OPTIONS`.
- A custom error handler can change the final response.

## Requests and Responses

The request context exposes:

- `ctx.request.method`
- `ctx.request.path`
- `ctx.request.headers`
- `ctx.params`
- `ctx.query`
- `ctx.body`
- `ctx.response`

Request bodies are buffered and parsed as JSON regardless of `Content-Type`.

- An empty or whitespace-only body produces `undefined`.
- Malformed JSON raises `BadRequestError` and normally results in HTTP `400`.
- Other body formats are not parsed by the current core.
- The JSON parser does not currently enforce a request-body size limit.

The response helper exposes these methods:

| Method | Behavior |
| --- | --- |
| `status(code)` | Set the response status code. |
| `header(name, value)` | Set a response header. |
| `json(body)` | Produce a `ResponseResult` with JSON content type. |
| `text(body)` | Produce a `ResponseResult` with plain-text content type. |

Both `json()` and `text()` return a `ResponseResult`.

For JSON responses, use object or array payloads when you want JSON serialization. The HTTP sender writes string-valued response bodies directly rather than JSON-quoting them. Ordinary route-handler return values are passed through `JSON.stringify()` by the HTTP layer; an `undefined` result produces an empty response body.

## Middleware

Register middleware with `app.use()`.

Each middleware receives `(ctx, next)`. The `next()` function returns a promise.

Middleware follows onion-style execution:

1. Middleware runs before downstream middleware and the route handler.
2. `await next()` transfers control downstream.
3. Code after `await next()` runs while control returns outward.

Middleware can short-circuit by not calling `next()` and returning a response result. A middleware result is used when downstream has not already produced a result.

Middleware runs only after successful body parsing and route/method matching. It is not invoked for automatic `OPTIONS`, `404`, `405`, or malformed-body responses.

Calling `next()` more than once throws an error and enters error handling.

## Request Validation

The core provides a validator interface and `validateRequest()` middleware, but does not include a schema-definition language.

Applications supply validator functions for any combination of request body, query, and route parameters.

A validator returns either:

```ts
{ success: true, data }
```

or:

```ts
{ success: false, issues }
```

Validation issues include a source, path, and message, with an optional code.

On success, normalized output is stored under:

- `ctx.validated.body`
- `ctx.validated.query`
- `ctx.validated.params`

If validation fails, the middleware throws `ValidationError` with status `422` and the collected issues.

Register validation with `app.use()` like other middleware.

## Configuration and Environment Files

`AKSConfig` reads explicitly provided values and environment variables.

Its API supports:

- `get()`
- `getOrDefault()`
- `require()`
- Numeric and boolean getters
- Configuration diagnostics
- Defaults and explicit environment maps
- Environment-file configuration

Missing required values passed to `require()` throw an error.

The following helpers are exported:

- `parseEnv()`
- `loadEnvFile()`
- `loadEnvFiles()`

By default, environment files are loaded in this order:

1. `.env`
2. `.env.<NODE_ENV>`
3. `.env.local`
4. `.env.<NODE_ENV>.local`

Later files override earlier files. `AKSConfig` accepts `envFile` options to customize environment-file loading and `env` to provide an explicit environment map.

## Logging

`AKSLogger` supports the following levels:

- `debug`
- `info`
- `warn`
- `error`

It supports structured context and configurable transports.

Included transports:

- `ConsoleTransport`
- `FileTransport`

Custom transports can implement the exported `LogTransport` interface.

Pass a logger to `AKSApp` to use it for framework logging, and retrieve it with `app.getLogger()`.

## Dependency Injection

Each `AKSApp` owns a `DIContainer`, available through `app.getContainer()` and `ctx.container`.

The container supports:

- `register()` for transient instances.
- `registerSingleton()` for cached singleton instances.
- String and symbol tokens.
- Dependency resolution.
- Circular-dependency detection.
- Disposal of resolved singleton instances that support the disposable lifecycle.

Use dependency injection to separate application services from their construction and manage shared dependencies.

## Database Support

AKS provides a database abstraction in the core package and a PostgreSQL driver in the monorepo.

The abstraction separates framework-level database operations from the underlying database implementation. This allows the core to define a common adapter contract while a driver implements the database-specific behavior.

Current database capabilities include:

- Query execution through the database adapter.
- Transaction creation.
- Transaction commit and rollback.
- Transaction completion and client cleanup.
- Adapter disposal and resource lifecycle management.
- PostgreSQL connection pooling.
- PostgreSQL connection verification.
- Handling of connection, query, transaction, and pool-disposal failures.

The `@aks-framework/driver-postgres` package uses a PostgreSQL connection pool and verifies connectivity during connection setup. Transaction completion and disposal behavior have dedicated regression tests, including concurrent operations and failure paths.

### PostgreSQL Usage

The following ESM example shows how to register the PostgreSQL driver, connect to the database, execute a parameterized query, and dispose of database resources.

It assumes the required packages are installed, `DATABASE_URL` is configured, and a `users` table exists in the target database.

```ts
import {
  AKSDatabase,
  DatabaseDriverRegistry,
} from "@aks-framework/core";
import { PostgresDatabaseDriver } from "@aks-framework/driver-postgres";

async function main(): Promise<void> {
  const registry = new DatabaseDriverRegistry();
  registry.register(new PostgresDatabaseDriver());

  const adapter = await registry.connect("postgres", {
    connectionString: process.env.DATABASE_URL,
  });

  const database = new AKSDatabase({
    adapter: adapter as import("@aks-framework/core").DatabaseAdapter,
  });

  try {
    const result = await database.query<{ id: number; name: string }>(
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

The PostgreSQL driver verifies connectivity during connection setup. The query uses a parameterized value rather than interpolating input into SQL.

`DatabaseDriverRegistry.connect()` returns the general `DatabaseAdapterBase` type. The example uses a type assertion because `AKSDatabase` requires a `DatabaseAdapter`. The PostgreSQL adapter implements the SQL query and transaction operations used by this example. The assertion does not perform a runtime conversion or additional validation.

### Database Testing

The automated suite includes database abstraction tests and PostgreSQL driver tests. Mock-based tests cover transaction and resource lifecycle behavior without requiring a locally installed PostgreSQL server.

The repository also contains a PostgreSQL driver integration-test file. The integration test uses a mocked `pg.Pool`; it verifies the interaction between the driver registry, PostgreSQL driver, and database abstraction, but does not establish connectivity to a live PostgreSQL server.

For application-specific database setup, use the adapter and driver APIs exported by the relevant packages.

## Error Handling

Register a custom handler with `app.onError(handler)`.

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

The default `handleError(ctx, error)` returns an `AKSError`'s status code and a JSON body containing `error`, `status`, and `code` when present. The `code` field is omitted when unavailable.

Unknown errors normally produce HTTP `500` with:

```json
{
  "error": "Internal server error"
}
```

`ValidationError` is used for validation failures; the application supplies the actual validator functions.

## CLI

The `@aks-framework/cli` package exposes the `aks` executable.

Check available commands:

```bash
aks --help
```

Available command groups include:

- `doctor` — inspect framework/runtime versions, project files, dependencies, and TypeScript setup.
- `generate` — generate supported application resources.
- `update` — check for available AKS package updates.
- `health` — application health tooling.
- `diagnose` — application and runtime diagnostics.
- `graph` — inspect the application dependency graph.
- `contract` — validate OpenAPI API contracts using Swagger Parser.
- `security` — reserved CLI command; security checks are not implemented yet.

### Contract Validation (OpenAPI)

The AKS CLI uses [`@apidevtools/swagger-parser`](https://www.npmjs.com/package/@apidevtools/swagger-parser) to parse and validate existing OpenAPI documents in JSON or YAML format.

**Validate an OpenAPI YAML document:**

```bash
aks contract --file openapi.yaml
```

**Validate an OpenAPI JSON document with machine-readable output:**

```bash
aks contract --file openapi.json --json
```

**Options:**

| Option | Description |
| --- | --- |
| `--file <path>` | Path to the OpenAPI JSON or YAML document. Required. |
| `--json` | Output the validation result as JSON. |
| `-h`, `--help` | Show contract command help. |

The command reports whether the document is valid and, when available, includes its OpenAPI version, API title, and API version. JSON results include a `success` field and a `message`. Failed validation sets the process exit code to `1`.

Validation failures include invalid documents, missing files, and a missing document path.

**Current scope:** This command validates existing OpenAPI documents. It does not generate specifications automatically from AKS routes or provide a Swagger UI.

### Doctor

```bash
aks doctor
```

Doctor checks project and framework setup. It is read-only by default.

Options include:

- `--json` for machine-readable output.
- `--fix` for supported repair operations.

JSON mode does not prompt or modify files. Dependency updates offered by supported repair operations remain within the versions requested by `package.json`.

### Generate

Supported generators include:

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

Use `--dry-run` to preview file operations and `--force` to overwrite existing files.

### Update

```bash
aks update --dry-run
```

The update command checks installed AKS package versions and reports available updates. It prints a package-manager command rather than installing updates itself. `--dry-run` previews behavior without changing files.

The CLI is under active development. The `security` command is currently a placeholder and does not perform security checks. Other commands should be evaluated according to their documented behavior; command availability alone does not imply production readiness.

## Core API

The core package is named `@aks-framework/core`. Its package exports provide an ESM import entry and TypeScript types; a CommonJS `require` export is not declared.

Important exports include:

| Export | Description |
| --- | --- |
| `AKSApp` | Application class and route/middleware/error-handler registration. |
| `createHTTPServer` | Create a Node.js HTTP server for an `AKSApp`. |
| `AKSResponse` | Construct JSON and text `ResponseResult` values. |
| `parseJSONBody` | Buffer and parse an incoming request as JSON. |
| `AKSConfig` | Read configuration values and inspect their validity. |
| `parseEnv`, `loadEnvFile`, `loadEnvFiles` | Parse and load `.env` files. |
| `AKSLogger`, `ConsoleTransport`, `FileTransport` | Structured logging and built-in transports. |
| `DIContainer` | Register and resolve transient or singleton dependencies. |
| `validateRequest` | Middleware to run application-provided request validators. |
| `handleError` | Default handler for framework and unknown errors. |
| `AKSError` and subclasses | Framework error types. |
| `RequestContext` | Context type passed to handlers and middleware. |
| `ResponseResult` | Response status, headers, and body shape. |
| `HTTPMethod` | Registered route method type. |
| `Middleware`, `ErrorHandler`, `Route`, `RouteHandler` | Middleware, error-handler, and route types. |
| `AKSDatabase` and database adapter types | Database operations and adapter contracts. |
| `AKS_VERSION` | Core version constant (`0.1.0`). |

`AKSApp` exposes `get()`, `post()`, `put()`, `patch()`, `delete()`, `use()`, `onError()`, `getRoutes()`, `getMiddlewares()`, `getErrorHandler()`, `getContainer()`, `getLogger()`, and `listen()`.

Refer to the package source and exported TypeScript declarations for the exact signatures of database and driver APIs.

## Current Limitations

The current framework does not provide:

- Built-in authentication.
- A schema-definition language or built-in integration with a specific validation library.
- Multipart or form-data parsing.
- A request-body size limit in the JSON parser.
- A declared Node.js `engines` requirement.
- A declared formal stability level.

Database access is available through the database abstraction and PostgreSQL driver. This does not mean that every database engine or persistence feature is supported.

The CLI's `security` command is a placeholder and does not currently perform security checks.

## Where AKS Fits

AKS focuses on the Node.js backend/runtime layer: accepting HTTP requests, matching routes, executing middleware, validating requests, creating responses, managing dependencies, and providing database access through adapters.

It is not a frontend UI framework or frontend build tool.

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

The latest recorded full test run passed **498 tests across 37 test files**. Run the suite again after changes to verify the current count.

Before submitting changes, run:

```bash
npm run build
npm test
git diff --check
```

## Repository Layout

```text
examples/
  hello-api.ts

packages/
  core/
    src/          HTTP runtime and supporting framework APIs
    tests/        Core runtime and API tests

  cli/
    src/          CLI commands and generators
    tests/        CLI and generator tests

  driver-postgres/
    src/          PostgreSQL driver implementation
    tests/        PostgreSQL driver tests
```

## Roadmap

AKS is under active development. Future priorities may include:

- Authentication and authorization.
- Additional database drivers and database tooling.
- More comprehensive health and diagnostic capabilities.
- Expanded API contract validation.
- Additional infrastructure integrations.
- Further developer tooling and lifecycle management.

These are potential future areas, not promises of scheduled releases. Consult the current repository implementation to determine which capabilities are available.

## Contributing

Keep changes focused, preserve the explicit TypeScript API, and include tests for behavior changes.

Before submitting a change:

1. Run `npm run build`.
2. Run `npm test`.
3. Run `git diff --check`.
4. Update documentation when behavior or public APIs change.

Document implemented behavior separately from proposed work.

## ❤️ Support the Project

If the AKS Framework has saved you time or helped you build your application, please consider supporting its ongoing development! Your sponsorship helps cover maintenance costs, new features, and faster bug fixes.

You can fund this project through the following platforms:

*   **[Sponsor us on GitHub](https://github.com/sponsors/aksinghsoftwaresolution)**
*   **[Support us on thanks.dev](https://thanks.dev/gh/aksinghsoftwaresolution)**

Thank you for supporting open-source software!

## License

AKS Framework is licensed under the MIT License. See [LICENSE](./LICENSE) for details.