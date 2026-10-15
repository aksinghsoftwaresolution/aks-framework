import type { LogEntry } from "./logger.js";
import type { LogTransport } from "./logger-transport.js";

export class ConsoleTransport
  implements LogTransport
{
  write(entry: LogEntry): void {
    const output = JSON.stringify(entry);

    if (entry.level === "error") {
      console.error(output);
      return;
    }

    if (entry.level === "warn") {
      console.warn(output);
      return;
    }

    console.log(output);
  }
}