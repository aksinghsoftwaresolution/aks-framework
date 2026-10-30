export class AKSError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;

  constructor(
    message: string,
    statusCode = 500,
    code?: string,
  ) {
    super(message);

    this.name = "AKSError";
    this.statusCode = statusCode;
    this.code = code;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends AKSError {
  constructor(
    message = "Bad request",
    code = "BAD_REQUEST",
  ) {
    super(message, 400, code);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends AKSError {
  constructor(
    message = "Unauthorized",
    code = "UNAUTHORIZED",
  ) {
    super(message, 401, code);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AKSError {
  constructor(
    message = "Forbidden",
    code = "FORBIDDEN",
  ) {
    super(message, 403, code);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AKSError {
  constructor(
    message = "Resource not found",
    code = "NOT_FOUND",
  ) {
    super(message, 404, code);
    this.name = "NotFoundError";
  }
}

export class MethodNotAllowedError extends AKSError {
  constructor(
    message = "Method not allowed",
    code = "METHOD_NOT_ALLOWED",
  ) {
    super(message, 405, code);
    this.name = "MethodNotAllowedError";
  }
}

export class ConflictError extends AKSError {
  constructor(
    message = "Conflict",
    code = "CONFLICT",
  ) {
    super(message, 409, code);
    this.name = "ConflictError";
  }
}

export interface ValidationErrorIssue {
  source: "body" | "query" | "params";
  path: string;
  message: string;
  code?: string;
}

export class ValidationError extends AKSError {
  public readonly issues: ValidationErrorIssue[];

  constructor(
    message = "Validation failed",
    issues: ValidationErrorIssue[] = [],
    code = "VALIDATION_ERROR",
  ) {
    super(message, 422, code);
    this.name = "ValidationError";
    this.issues = issues;
  }
}

export class TooManyRequestsError extends AKSError {
  constructor(
    message = "Too many requests",
    code = "TOO_MANY_REQUESTS",
  ) {
    super(message, 429, code);
    this.name = "TooManyRequestsError";
  }
}

export class InternalServerError extends AKSError {
  constructor(
    message = "Internal server error",
    code = "INTERNAL_SERVER_ERROR",
  ) {
    super(message, 500, code);
    this.name = "InternalServerError";
  }
}

export class AuthenticationError extends InternalServerError {
  constructor(
    message = "Authentication provider returned an invalid result",
    code = "AUTHENTICATION_PROVIDER_ERROR",
  ) {
    super(message, code);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends InternalServerError {
  constructor(
    message = "Authorization policy returned an invalid result",
    code = "AUTHORIZATION_POLICY_ERROR",
  ) {
    super(message, code);
    this.name = "AuthorizationError";
  }
}

export class BadGatewayError extends AKSError {
  constructor(
    message = "Bad gateway",
    code = "BAD_GATEWAY",
  ) {
    super(message, 502, code);
    this.name = "BadGatewayError";
  }
}

export class ServiceUnavailableError extends AKSError {
  constructor(
    message = "Service unavailable",
    code = "SERVICE_UNAVAILABLE",
  ) {
    super(message, 503, code);
    this.name = "ServiceUnavailableError";
  }
}

export class GatewayTimeoutError extends AKSError {
  constructor(
    message = "Gateway timeout",
    code = "GATEWAY_TIMEOUT",
  ) {
    super(message, 504, code);
    this.name = "GatewayTimeoutError";
  }
}