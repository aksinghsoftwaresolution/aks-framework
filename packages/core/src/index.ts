export const AKS_VERSION = "0.1.0";

export {
  AKSApp,
} from "./app.js";

export {
  createHTTPServer,
} from "./http.js";

export {
  parseJSONBody,
} from "./body.js";

export {
  AKSResponse,
} from "./response.js";

export {
  AKSConfig,
} from "./config.js";

export {
  AKSLogger,
} from "./logger.js";

export {
  createAuthenticationMiddleware,
} from "./auth/authentication-middleware.js";

export {
  createAuthorizationMiddleware,
} from "./auth/authorization-middleware.js";

export {
  BearerTokenStrategy,
} from "./auth/bearer-token-strategy.js";

export {
  requireRole,
  requirePermission,
} from "./auth/policies.js";

export type {
  AKSAppOptions,
  HTTPMethod,
  Middleware,
  ErrorHandler,
  Route,
  RouteHandler,
} from "./app.js";

export type {
  RequestContext,
} from "./context.js";

export type {
  ResponseResult,
} from "./response.js";

export {
  AKSDatabase,
  AKSDatabaseClient,
} from "./database.js";

export {
  DatabaseConnectionError,
  DatabaseDriverRegistry,
  DatabaseAdapterCapabilityError,
} from "./database-connection.js";

export {
  AKSError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  MethodNotAllowedError,
  ConflictError,
  ValidationError,
  TooManyRequestsError,
  InternalServerError,
  BadGatewayError,
  ServiceUnavailableError,
  GatewayTimeoutError,
} from "./errors.js";

export {
  handleError,
} from "./error-handler.js";

export type {
  ValidationSource,
  ValidationIssue,
  ValidationResult,
  Validator,
  ValidatedData,
} from "./validation.js";

export {
  validateRequest,
} from "./validation-middleware.js";

export type {
  ValidationOptions,
} from "./validation-middleware.js";

export type {
  Controller,
} from "./controller.js";

export {
  DIContainer,
} from "./container.js";

export type {
  Factory,
  Disposable,
} from "./container.js";

export type {
  AKSConfigOptions,
  ConfigDiagnosticStatus,
  ConfigDiagnostic,
  ConfigValueType,
  ConfigRule,
  ConfigRuleDiagnostic,
} from "./config.js";

export {
  parseEnv,
  loadEnvFile,
  loadEnvFiles,
} from "./env.js";

export type {
  EnvFileOptions,
  ParsedEnv,
} from "./env.js";

export type {
  LogLevel,
  LogContext,
  LogEntry,
  LoggerOptions,
} from "./logger.js";

export type {
  LogTransport,
} from "./logger-transport.js";

export {
  ConsoleTransport,
} from "./console-transport.js";

export {
  FileTransport,
} from "./file-transport.js";

export type {
  FileTransportOptions,
} from "./file-transport.js";

export type {
  AKSDatabaseOptions,
  AKSDatabaseClientOptions,
  DatabaseAdapter,
  DatabaseAdapterBase,
  DatabaseCapabilities,
  DatabaseQueryResult,
  DatabaseTransaction,
  SQLDatabaseAdapter,
  DocumentDatabaseAdapter,
  KeyValueDatabaseAdapter,
} from "./database.js";

export type {
  DatabaseDriver,
  DatabaseConnectionOptions,
} from "./database-connection.js";

export type {
  AuthenticationOptions,
} from "./auth/authentication-middleware.js";

export type {
  AuthUser,
  AuthResult,
  AuthStrategy,
} from "./auth/types.js";

export type {
  AuthorizationOptions,
  AuthorizationPolicy,
} from "./auth/authorization-middleware.js";

export type {
  RoleResolver,
  PermissionResolver,
} from "./auth/policies.js";

export type {
  BearerTokenVerifier,
} from "./auth/bearer-token-strategy.js";

export {
  extractBearerToken,
} from "./auth/authentication-middleware.js";