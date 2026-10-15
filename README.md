# AKS Framework

AKS Framework is a TypeScript-first backend framework for Node.js. Today, `@aks-framework/core` provides an HTTP runtime with route registration, request context, JSON request-body parsing, response helpers, middleware, and error handling.

Maintained by **AKSINGH SOFTWARE SOLUTION**.

## At a Glance

- **Core package:** `@aks-framework/core` `0.1.0`
- **Runtime:** Node.js built-in HTTP server
- **Current focus:** HTTP routing and request/response behavior
- **Tests:** 24 tests currently exercise selected HTTP behaviors
- **Status:** Under active development; no formal stability level is declared in package metadata

## Why AKS?

Backend services commonly need to connect an HTTP server to route dispatch, request parsing, response handling, middleware, and error handling. AKS brings these runtime concerns together behind a small, explicit TypeScript API. It does not remove the need to select or build the other systems an application requires.

## Current Status

AKS Framework is currently under active development. The current release line is `0.1.0`. No formal stability level is declared in package metadata. The repository does not declare a supported Node.js version range.

| Area | Status | Current scope |
| --- | --- | --- |
| HTTP server and routing | Implemented | Node.js HTTP server; `GET`, `POST`, `PUT`, `PATCH`, and `DELETE` routes. |
| Request context and parsing | Implemented | Method, path, headers, route params, query values, and JSON body. |
| Responses | Implemented | JSON and text response helpers, status codes, and headers. |
| Middleware | Implemented | Onion execution, short-circuiting, and error propagation for matched requests. |
| HTTP behavior | Implemented | `HEAD` through `GET`, automatic `OPTIONS`, default `404`/`405`, and `Allow` headers. |
| Error handling | Implemented | `app.onError()` and the default `handleError()` behavior. |
| HTTP tests | Implemented | 24 tests exercise selected HTTP behaviors. |
| Validation, authentication, persistence, dependency injection | Not implemented | No built-in systems for these concerns. |
| Configuration, logging, CLI, and request validation | Not implemented | No built-in framework APIs for these concerns. |

## Features

- HTTP server creation through Node.js `http`.
- Static, dynamic, and wildcard route matching with static routes preferred over dynamic routes, and dynamic routes preferred over wildcard routes.
- Query parsing and URL-decoded dynamic and wildcard parameters.
- JSON request-body parsing and request context.
- JSON and text response helpers, custom status codes, and response headers.
- Middleware registration, onion-style execution, short-circuiting, and error propagation.
- Framework error classes, a default error handler, and a custom error-handler hook.
- `HEAD` handling through `GET`, automatic `OPTIONS`, and default `404`/`405` handling.

## Quick Start

This repository currently documents a local-checkout workflow rather than a registry installation. From the repository root, install the development dependencies, build the core package, and start the checked-in example:

```bash
npm install
npx tsc -p packages/core/tsconfig.json
npm run dev
```

The core build emits to `packages/core/dist`, which the example imports. The example listens on port `3000`:

```bash
curl http://localhost:3000/hello
```

It returns JSON similar to:

```json
{"message":"Hello from AKS Framework","method":"GET","path":"/hello"}
```

## First Application

After building the core package, save this as `examples/first-app.ts`:

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

Run the file with the repository's TypeScript runner:

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

- A `HEAD` request can match a `GET` route. Middleware and the `GET` handler still execute; the response status and headers are produced, but the body is suppressed.
- `OPTIONS` is handled automatically when the path matches registered routes. The route handler and application middleware are not invoked for the generated response. It has status `204` and an `Allow` header containing the registered methods for matching routes; `GET` contributes `HEAD`, and `OPTIONS` is included.
- Request-body parsing occurs before `OPTIONS` handling. Malformed JSON can therefore produce `400` instead of the automatic `204` response.
- An unmatched route normally produces the default `404` response. A custom error handler can change the response. The HTTP layer matches path patterns first, then parses the body before deciding the final route outcome, so malformed JSON can produce `400` instead of `404`.
- When a path matches but the method does not, the default behavior is `405`. Its `Allow` header contains the registered route methods; it does not automatically add `HEAD` or `OPTIONS`. The automatic `OPTIONS` response uses the different behavior described above. Body parsing occurs before method handling, and a custom error handler can change the final response.

## Requests and Responses

The request context exposes:

- `ctx.request.method`
- `ctx.request.path`
- `ctx.request.headers`
- `ctx.params`
- `ctx.query`
- `ctx.body`
- `ctx.response`

Request bodies are buffered and parsed as JSON regardless of `Content-Type`. No bytes or whitespace-only content produces `undefined`. Malformed JSON raises `BadRequestError` and normally results in HTTP `400`. The HTTP layer first matches path patterns, then parses the body before route dispatch or final method handling. Malformed JSON may therefore take precedence over `404`, `405`, or automatic `OPTIONS`. Other body formats are not parsed by the current core. The JSON parser has no request-body size limit.

`ctx.response` provides these methods:

| Method | Behavior |
| --- | --- |
| `status(code)` | Set the response status code. |
| `header(name, value)` | Set a response header. |
| `json(body)` | Produce a `ResponseResult` with JSON content type. |
| `text(body)` | Produce a `ResponseResult` with plain-text content type. |

Both `json()` and `text()` return a `ResponseResult`. For JSON responses, use an object or array payload: the HTTP sender writes string-valued response bodies directly rather than JSON-quoting them. Ordinary route-handler return values are passed through `JSON.stringify()` by the HTTP layer; an `undefined` result produces an empty response body.

## Middleware

Register middleware with `app.use()`. Each middleware receives `(ctx, next)`; `next()` returns a promise. Middleware runs in onion order, so code before `await next()` runs before downstream middleware and the route handler, and code after it runs while control returns outward.

Middleware can short-circuit by not calling `next()` and returning a response result. A middleware result is used when downstream has not produced a result.

Middleware runs only after successful body parsing and route/method matching. It is not invoked for automatic `OPTIONS`, `404`, `405`, or malformed-body responses. Calling `next()` more than once throws an error and enters error handling.

## Error Handling

Register a custom handler with `app.onError(handler)`. The handler receives `(error, ctx)` and is expected to return a valid `ResponseResult`. If it does not, the HTTP layer falls back to a generic `500` response.

`AKSError` contains a `statusCode` and an optional `code`. The exported subclasses are:

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
{"error":"Internal server error"}
```

`ValidationError` is an error class; it does not validate request data.

## Core API

The package is named `@aks-framework/core`. Its exports map provides an ESM `import` entry and TypeScript types; it does not define a CommonJS `require` export.

| Export | Description |
| --- | --- |
| `AKSApp` | Application class and route/middleware/error-handler registration. |
| `createHTTPServer` | Create a Node.js HTTP server for an `AKSApp`. |
| `AKSResponse` | Construct JSON and text `ResponseResult` values. |
| `parseJSONBody` | Buffer and parse an incoming request as JSON. |
| `handleError` | Default handler for framework and unknown errors. |
| `AKSError` and subclasses | Framework error types. |
| `RequestContext` | Context type passed to handlers and middleware. |
| `ResponseResult` | Response status, headers, and body shape. |
| `HTTPMethod` | Registered route method type: `GET`, `POST`, `PUT`, `PATCH`, or `DELETE`. |
| `Middleware`, `ErrorHandler`, `Route`, `RouteHandler` | Middleware, error-handler, and route types. |
| `AKS_VERSION` | Core version constant (`0.1.0`). |

`AKSApp` exposes `get()`, `post()`, `put()`, `patch()`, `delete()`, `use()`, `onError()`, `getRoutes()`, `getMiddlewares()`, `getErrorHandler()`, and `listen()`.

## Current Limitations

The current core does not provide:

- Built-in authentication or database abstraction.
- Built-in dependency injection, configuration system, or logging framework.
- Built-in request validation system.
- Multipart or form-data parsing.
- A request-body size limit in the JSON parser.
- A framework CLI.
- A declared Node.js `engines` requirement.

## Where AKS Fits

AKS currently focuses on the Node.js backend/runtime layer: accepting HTTP requests, matching routes, running middleware, and creating responses. Its scope is not a frontend UI framework or frontend build tool.

## Development and Tests

Run commands from the repository root:

```bash
npm install
npx tsc -p packages/core/tsconfig.json
npm run build
npm test
npm run test:watch
npm run dev
```

The core TypeScript build emits to `packages/core/dist`. The root `build` script runs `tsc` with the root configuration, which does not define a dedicated `outDir`. The root TypeScript settings are `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`, and `strict: true`. No Node.js engines requirement is declared in package metadata.

The current HTTP test file contains 24 tests that exercise selected routing, HTTP method, body parsing, response, middleware, and error-handling behaviors. They are not an exhaustive coverage claim.

## Repository Layout

```text
examples/
  hello-api.ts
packages/
  core/
    src/       HTTP runtime and public exports
    tests/     HTTP behavior tests
```

## Roadmap

The repository does not define a scheduled release roadmap. Possible future areas are proposals only, not implemented or committed features: validation, dependency injection, configuration, logging, CLI, database abstraction, authentication, testing utilities, plugins, and developer tooling.

## Contributing

Keep changes focused, preserve the explicit TypeScript API, and include tests for behavior changes. Run `npm test` before submitting. Document implemented behavior separately from proposed work.

## License

Package metadata currently declares MIT, but a `LICENSE` file should be added to the repository before distribution.