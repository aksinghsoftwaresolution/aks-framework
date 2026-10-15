import type { LogTransport } from "./logger-transport.js";
import { ConsoleTransport } from "./console-transport.js";

export type LogLevel =
  | "debug"
  | "info"
  | "warn"
  | "error";

export interface LogContext {
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
}

export interface LoggerOptions {
  level?: LogLevel;
  transports?: LogTransport[];
  onTransportError?: (
    error: unknown,
    entry: LogEntry,
  ) => void;
}

const LOG_LEVEL_PRIORITY: Record<
  LogLevel,
  number
> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class AKSLogger {
  private readonly minimumLevel: LogLevel;
  private readonly transports: LogTransport[];
  private readonly onTransportError?: (
  error: unknown,
  entry: LogEntry,
) => void;

  constructor(
    options: LoggerOptions = {},
  ) {
    this.minimumLevel =
      options.level ?? "info";
    
    this.transports =
      options.transports ??
      [new ConsoleTransport()];

    this.onTransportError =
      options.onTransportError;
  }

  debug(
    message: string,
    context?: LogContext,
  ): void {
    this.log(
      "debug",
      message,
      context,
    );
  }

  info(
    message: string,
    context?: LogContext,
  ): void {
    this.log(
      "info",
      message,
      context,
    );
  }

  warn(
    message: string,
    context?: LogContext,
  ): void {
    this.log(
      "warn",
      message,
      context,
    );
  }

  error(
    message: string,
    context?: LogContext,
  ): void {
    this.log(
      "error",
      message,
      context,
    );
  }

  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): void {
    if (
      LOG_LEVEL_PRIORITY[level] <
      LOG_LEVEL_PRIORITY[this.minimumLevel]
    ) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp:
        new Date().toISOString(),
      ...(context !== undefined
        ? { context }
        : {}),
    };

    this.write(entry);
  }

  protected write(
    entry: LogEntry,
  ): void {
    for (const transport of this.transports) {
      try {
        const result =
          transport.write(entry);

        if (
          result instanceof Promise
        ) {
          void result.catch((error) => {
            this.handleTransportError(
              error,
              entry,
            );
          });
        }
      } catch (error) {
        this.handleTransportError(
          error,
          entry,
        );
      }
    }
  }

  private handleTransportError(
    error: unknown,
    entry: LogEntry,
  ): void {
    if (this.onTransportError) {
      try {
        this.onTransportError(
          error,
          entry,
        );
      } catch {
        // Logging must never throw because
        // its error handler itself failed.
      }

      return;
    }

    console.error(
      "AKSLogger transport error:",
      error,
    );
  }

}