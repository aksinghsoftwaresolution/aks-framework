import {
  AKSApp,
  AKSLogger,
  NotFoundError,
  AKSError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ValidationError,
  TooManyRequestsError,
  MethodNotAllowedError,
  InternalServerError,
  BadGatewayError,
  ServiceUnavailableError,
  GatewayTimeoutError,
} from "../packages/core/dist/index.js";

const logger = new AKSLogger({
  level: "debug",
});

const app = new AKSApp({
  logger,
});

app.onError((error, ctx) => {
  if (error instanceof AKSError) {
    return ctx.response
      .status(error.statusCode)
      .json({
        error: error.message,
        ...(error.code
          ? {
              code: error.code,
            }
          : {}),
        status: error.statusCode,
        source: "application",
      });
  }

  return ctx.response
    .status(500)
    .json({
      error: "Something went wrong",
      source: "application",
    });
});

app.use(async (ctx, next) => {
  app.getLogger().debug(
    "Middleware 1 before",
    {
      method: ctx.request.method,
      path: ctx.request.path,
    },
  );

  if (ctx.request.path === "/protected") {
    return ctx.response
      .status(401)
      .json({
        error: "Unauthorized",
      });
  }

  await next();

  app.getLogger().debug(
    "Middleware 1 after",
    {
      method: ctx.request.method,
      path: ctx.request.path,
    },
  );
});

app.use(async (ctx, next) => {
  app.getLogger().debug(
    "Middleware 2 before",
    {
      method: ctx.request.method,
      path: ctx.request.path,
    },
  );

  await next();

  app.getLogger().debug(
    "Middleware 2 after",
    {
      method: ctx.request.method,
      path: ctx.request.path,
    },
  );
});

app.use(async (ctx, next) => {
  if (ctx.request.path === "/middleware-error") {
    throw new NotFoundError("User not found");
  }

  await next();
});

app.get("/middleware-error", async () => {
  return {
    message: "This should not be reached",
  };
});

app.get("/unexpected-error", async () => {
  throw new Error("This is an internal error");
});

app.get("/hello", async (ctx) => {
  return {
    message: "Hello from AKS Framework",
    method: ctx.request.method,
    path: ctx.request.path,
  };
});

app.get("/about", async (ctx) => {
  return {
    framework: "AKS Framework",
    version: "0.1.0",
    method: ctx.request.method,
    path: ctx.request.path,
  };
});

app.get("/protected", async (ctx) => {
  return {
    message: "You reached the protected route",
  };
});

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

app.delete("/users/:id", async (ctx) => {
  return {
    message: "User deleted",
    userId: ctx.params.id,
  };
});

app.get("/users/me", async () => {
  return {
    userId: "current-user",
    source: "static-route",
  };
});

app.get("/profile/:id/settings", async (ctx) => {
  return {
    route: "dynamic-profile",
    id: ctx.params.id,
  };
});

app.get("/profile/admin/settings", async () => {
  return {
    route: "static-profile",
  };
});

app.get("/files/*", async (ctx) => {
  return {
    route: "wildcard",
    path: ctx.params["*"],
  };
});

app.get("/files/:id", async (ctx) => {
  return {
    route: "dynamic-file",
    id: ctx.params.id,
  };
});

app.get("/files/special", async () => {
  return {
    route: "static-file",
  };
});

app.get("/error-409", async () => {
  throw new ConflictError("User already exists");
});

app.get("/search", async (ctx) => {
  return {
    query: ctx.query,
  };
});

app.post("/users", async (ctx) => {
  return ctx.response
    .status(201)
    .header("X-AKS-Version", "0.1.0")
    .json({
      message: "User created",
      body: ctx.body,
    });
});

app.get("/text", async (ctx) => {
  return ctx.response
    .status(200)
    .text("Hello from AKS Framework");
});
app.get("/error-400", async () => {
  throw new BadRequestError("Invalid request data");
});

app.get("/error-401", async () => {
  throw new UnauthorizedError("Authentication required");
});

app.get("/error-403", async () => {
  throw new ForbiddenError("Access denied");
});

app.get("/error-422", async () => {
  throw new ValidationError("Email address is invalid");
});

app.get("/error-429", async () => {
  throw new TooManyRequestsError("Rate limit exceeded");
});

app.get("/error-404", async () => {
  throw new NotFoundError("User not found");
});

app.get("/error-405", async () => {
  throw new MethodNotAllowedError("This HTTP method is not allowed");
});

app.get("/error-500", async () => {
  throw new InternalServerError("Database operation failed");
});

app.get("/error-502", async () => {
  throw new BadGatewayError("Upstream service returned an invalid response");
});

app.get("/error-503", async () => {
  throw new ServiceUnavailableError("Service is temporarily unavailable");
});

app.get("/error-504", async () => {
  throw new GatewayTimeoutError("Upstream service timed out");
});

app.listen(3000);