**AKS Framework** is a TypeScript-first backend framework for Node.js. The `@aks-framework/core` package provides an HTTP runtime, request validation, configuration and environment-file helpers, structured logging, and a dependency-injection container. The `@aks-framework/cli` package provides project diagnostics, resource generation, and update checks.

Maintained by **AKSINGH SOFTWARE SOLUTION**.

> **Development status:** AKS Framework is under active development. The current release line is `0.1.0`; no formal stability level or supported Node.js version range is declared in package metadata.

## At a Glance

- **Core package:** `@aks-framework/core` (`0.1.0`)
- **CLI package:** `@aks-framework/cli` (`0.1.0`)
- **Runtime:** Node.js built-in HTTP server
- **Language:** TypeScript
- **Tests:** Vitest suites for core runtime behavior and CLI commands
- **License:** MIT, if the repository's `LICENSE` file contains the MIT License

## Why AKS?

Backend services commonly need an HTTP server, route dispatch, request parsing, response handling, middleware, and error handling. AKS brings these runtime concerns together behind an explicit TypeScript API. It is designed to provide a clear foundation for Node.js backend services; applications may still need to select or build additional systems such as authentication and persistence.

## Current Status

The framework is under active development. The following table describes the current implemented scope and known gaps.

| Area | Status | Current scope |
| --- | --- | --- |
| HTTP server and routing | Implemented | Node.js HTTP server; `GET`, `POST`, `PUT`, `PATCH`, and `DELETE` routes. |
| Request context and parsing | Implemented | Method, path, headers, route parameters, query values, and JSON body. |
| Responses and middleware | Implemented | JSON/text helpers, status codes, headers, onion-style middleware, and short-circuiting. |
| HTTP behavior and error handling | Implemented | `HEAD` through `GET`, automatic `OPTIONS`, default `404`/`405`, and customizable error handling. |
| Request validation | Implemented | User-provided validators for body, query, and route parameters through `validateRequest()`. |
| Configuration and environment files | Implemented | Typed value access, diagnostics, and layered `.env` file loading. |
| Logging and dependency injection | Implemented | Level-filtered logger with console/file transports; transient and singleton providers. |
| CLI | Partially implemented | `doctor`, `generate`, and `update`; `diagnose`, `health`, `graph`, `contract`, and `security` are placeholders. |
| Authentication and persistence | Not implemented | No built-in authentication or database abstraction. |

## Features

- HTTP server creation using Node.js `http`.
- Static, dynamic, and wildcard route matching, with static routes preferred over dynamic routes and dynamic routes preferred over wildcard routes.
- Query parsing and URL-decoded dynamic and wildcard parameters.
- JSON request-body parsing and request context.
- JSON and text response helpers, custom status codes, and response headers.
- Middleware registration, onion-style execution, short-circuiting, and error propagation.
- Framework error classes, a default error handler, and a custom error-handler hook.
- `HEAD` handling through `GET`, automatic `OPTIONS`, and default `404`/`405` handling.
- Configurable request validation for body, query, and route parameters.
- Configuration access and environment-file parsing/loading.
- Structured logging with console and file transports.
- A dependency-injection container with transient and singleton registrations.
- CLI commands for project diagnostics, resource generation, and package update checks.

## Quick Start

The repository currently documents a local-checkout workflow. From the repository root, install dependencies, build the packages, and start the checked-in example:

```bash
npm install
npm run build
npm run dev
```

The example listens on port `3000`. In another terminal, make a request:

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

```typescript
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

`AKSApp` registers `GET`, `POST`, `PUT`, `PATCH`, and `DELETE` routes. Route patterns support static paths such as `/users/me`, dynamic parameters such as `/users/:id`, and wildcard segments such as `/files/*`.

- Static routes take precedence over dynamic routes; dynamic routes take precedence over wildcard routes.
- Empty path segments are ignored during matching. Trailing slashes and repeated slashes are therefore effectively normalized.
- Dynamic parameters are available as `ctx.params.<name>`. Wildcards capture the remaining path as `ctx.params["*"]`.
- Dynamic and wildcard parameter values are URL-decoded. Invalid percent-encoding raises `BadRequestError` and normally produces the default `400` response.
- Wildcard matching stops when the `*` segment is reached. Treat wildcard segments as terminal route patterns.
- Query values are strings in `ctx.query`. Repeated keys are not arrays; each later occurrence overwrites the previous value.

### `HEAD`, `OPTIONS`, `404`, and `405`

- A `HEAD` request can match a `GET` route. Middleware and the `GET` handler still execute; response status and headers are produced, but the body is suppressed.
- `OPTIONS` is handled automatically when the path matches registered routes. The route handler and application middleware are not invoked for the generated response. It returns status `204` and an `Allow` header containing the registered methods for matching routes; `GET` contributes `HEAD`, and `OPTIONS` is included.
- Request-body parsing occurs before automatic `OPTIONS` handling. Malformed JSON can therefore produce `400` instead of `204`.
- An unmatched route normally produces `404`. The HTTP layer matches path patterns first and parses the body before deciding the final route outcome, so malformed JSON can produce `400` instead of `404`.
- When a path matches but the method does not, the default behavior is `405`. Its `Allow` header contains the registered route methods and does not automatically add `HEAD` or `OPTIONS`. Body parsing occurs before method handling. A custom error handler can change the final response.

## Requests and Responses

The request context exposes:

- `ctx.request.method`
- `ctx.request.path`
- `ctx.request.headers`
- `ctx.params`
- `ctx.query`
- `ctx.body`
- `ctx.response`

Request bodies are buffered and parsed as JSON regardless of `Content-Type`. Empty or whitespace-only content produces `undefined`. Malformed JSON raises `BadRequestError` and normally results in HTTP `400`. Because parsing occurs before final route dispatch or method handling, malformed JSON may take precedence over `404`, `405`, or automatic `OPTIONS`. Other body formats are not parsed by the current core. The JSON parser has no request-body size limit.

`ctx.response` provides these methods:

| Method | Behavior |
| --- | --- |
| `status(code)` | Set the response status code. |
| `header(name, value)` | Set a response header. |
| `json(body)` | Produce a `ResponseResult` with JSON content type. |
| `text(body)` | Produce a `ResponseResult` with plain-text content type. |

Both `json()` and `text()` return a `ResponseResult`. For JSON responses, use an object or array payload: the HTTP sender writes string-valued response bodies directly rather than JSON-quoting them. Ordinary route-handler return values are passed through `JSON.stringify()` by the HTTP layer; an `undefined` result produces an empty response body.

## Middleware

Register middleware with `app.use()`. Each middleware receives `(ctx, next)`; `next()` returns a promise. Middleware runs in onion order: code before `await next()` runs before downstream middleware and the route handler, and code after it runs as control returns outward.

Middleware can short-circuit by not calling `next()` and returning a response result. A middleware result is used when downstream has not produced a result.

Middleware runs only after successful body parsing and route/method matching. It is not invoked for automatic `OPTIONS`, `404`, `405`, or malformed-body responses. Calling `next()` more than once throws an error and enters error handling.

## Request Validation

The core provides a validator interface and `validateRequest()` middleware, but does not include a schema-definition library. Supply validator functions for any combination of request body, query, and route parameters. A validator returns either `{ success: true, data }` or `{ success: false, issues }`; issues include a source, path, and message, with an optional code.

On success, normalized validator output is stored under `ctx.validated.body`, `ctx.validated.query`, or `ctx.validated.params`. If any validator fails, the middleware throws `ValidationError` with status `422` and the collected issues. Register it with `app.use()` like other middleware.

## Configuration and Environment Files

`AKSConfig` reads explicitly provided values and environment variables. It supports `get()`, `getOrDefault()`, `require()`, numeric and boolean getters, and configuration diagnostics. Missing required values passed to `require()` throw an error.

`parseEnv()`, `loadEnvFile()`, and `loadEnvFiles()` are also exported. By default, environment files are loaded in this order: `.env`, `.env.<NODE_ENV>`, `.env.local`, and `.env.<NODE_ENV>.local`; later files override earlier files. `AKSConfig` accepts `envFile` options to customize this behavior and `env` to provide an explicit environment map.

## Logging

`AKSLogger` supports `debug`, `info`, `warn`, and `error` levels, structured context, and configurable transports. It defaults to the console transport. `ConsoleTransport` and `FileTransport` are included; a custom transport can implement the exported `LogTransport` interface. Pass a logger to `AKSApp` to use it for framework startup and retrieve it with `app.getLogger()`.

## Dependency Injection

Each `AKSApp` owns a `DIContainer`, available through `app.getContainer()` and `ctx.container`. Register factories with `register()` for transient instances or `registerSingleton()` for cached instances, then resolve them by string or symbol token. The container detects circular dependencies, and `dispose()` calls `dispose()` on resolved singleton instances that support it.

## Error Handling

Register a custom handler with `app.onError(handler)`. The handler receives `(error, ctx)` and is expected to return a valid `ResponseResult`. If it does not, the HTTP layer falls back to a generic `500` response.

`AKSError` contains a `statusCode` and an optional `code`. Exported subclasses include:

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

The default `handleError(ctx, error)` returns an `AKSError`'s status code and a JSON body containing `error`, `status`, and `code` when present. The `code` field is omitted when unavailable. Unknown errors normally produce HTTP `500` with:

```json
{
  "error": "Internal server error"
}
```

`ValidationError` is the error raised for validation failures; the application supplies the actual validator functions.

## CLI

The `@aks-framework/cli` package exposes the `aks` executable. In a project where it is installed, run:

```bash
aks --help
aks doctor
aks generate controller users
aks update --dry-run
```

- **`doctor`** checks framework/runtime versions, project files, dependencies, and TypeScript setup. It is read-only by default. `--json` emits machine-readable output; JSON mode does not prompt or modify files. `--fix` can offer confirmed dependency updates that remain within the versions requested by `package.json`.
- **`generate`** supports `controller`, `service`, `module`, and `middleware`. Generated files go under the corresponding `src/` subdirectory. Use `--dry-run` to preview or `--force` to overwrite existing files.
- **`update`** checks installed AKS package versions and prints a package-manager command for available updates. It does not install updates; `--dry-run` previews without changing files.

The `diagnose`, `health`, `graph`, `contract`, and `security` commands are currently placeholders and are not implemented.

## Core API

The package is named `@aks-framework/core`. Its exports map provides an ESM `import` entry and TypeScript types; it does not define a CommonJS `require` export.

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
| `validateRequest` | Middleware to run user-provided request validators. |
| `handleError` | Default handler for framework and unknown errors. |
| `AKSError` and subclasses | Framework error types. |
| `RequestContext` | Context type passed to handlers and middleware. |
| `ResponseResult` | Response status, headers, and body shape. |
| `HTTPMethod` | Registered route method type: `GET`, `POST`, `PUT`, `PATCH`, or `DELETE`. |
| `Middleware`, `ErrorHandler`, `Route`, `RouteHandler` | Middleware, error-handler, and route types. |
| Configuration, validation, logger, transport, environment, and container types | Types for the corresponding APIs. |
| `AKS_VERSION` | Core version constant (`0.1.0`). |

`AKSApp` exposes `get()`, `post()`, `put()`, `patch()`, `delete()`, `use()`, `onError()`, `getRoutes()`, `getMiddlewares()`, `getErrorHandler()`, `getContainer()`, `getLogger()`, and `listen()`.

## Current Limitations

The current core does not provide:

- Built-in authentication or database abstraction.
- A schema-definition language or built-in third-party validation-library integration; validators are supplied by the application.
- Multipart or form-data parsing.
- A request-body size limit in the JSON parser.
- A declared Node.js `engines` requirement.

## Where AKS Fits

AKS currently focuses on the Node.js backend/runtime layer: accepting HTTP requests, matching routes, running middleware, and creating responses. It is not a frontend UI framework or frontend build tool.

## Development and Tests

Run commands from the repository root:

```bash
npm install
npm run build
npm test
npm run test:watch
npm run dev
```

The build script compiles core and CLI packages to their respective `dist` directories. The root TypeScript settings use `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`, and `strict: true`. No Node.js engines requirement is declared in package metadata.

## Repository Layout

```text
examples/
  hello-api.ts
packages/
  cli/
    src/       CLI commands and generators
    tests/     CLI and generator tests
  core/
    src/       HTTP runtime and supporting framework APIs
    tests/     Core runtime and API tests
```

## Roadmap

The repository does not define a scheduled release roadmap. The following are possible future areas, not claims of implemented or committed features:

- Built-in schema-definition API
- Database abstraction and integrations
- Authentication
- Testing utilities
- Plugin ecosystem
- Additional developer tooling

## Contributing

Contributions are welcome, subject to the project's ownership and contribution policies. Keep changes focused, preserve the explicit TypeScript API, and include tests for behavior changes. Run `npm test` before submitting a pull request. Document implemented behavior separately from proposed work.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.