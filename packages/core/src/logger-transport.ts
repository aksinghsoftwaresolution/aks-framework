import type { LogEntry } from "./logger.js";

export interface LogTransport {
  write(entry: LogEntry): void | Promise<void>;
}