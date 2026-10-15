import { appendFile } from "node:fs/promises";
import type { LogEntry } from "./logger.js";
import type { LogTransport } from "./logger-transport.js";

export interface FileTransportOptions {
  file: string;
}

export class FileTransport
  implements LogTransport
{
  private readonly file: string;

  private writeQueue: Array<{
    line: string;
    resolve: () => void;
    reject: (error: unknown) => void;
  }> = [];

  private writing = false;

  constructor(
    options: FileTransportOptions,
  ) {
    this.file = options.file;
  }

  write(
    entry: LogEntry,
  ): Promise<void> {
    const line =
      `${JSON.stringify(entry)}\n`;

    return new Promise<void>(
      (resolve, reject) => {
        this.writeQueue.push({
          line,
          resolve,
          reject,
        });

        void this.processQueue();
      },
    );
  }

  private async processQueue(): Promise<void> {
    if (this.writing) {
      return;
    }

    this.writing = true;

    try {
      while (this.writeQueue.length > 0) {
        const item =
          this.writeQueue.shift()!;

        try {
          await appendFile(
            this.file,
            item.line,
            "utf-8",
          );

          item.resolve();
        } catch (error) {
          item.reject(error);
        }
      }
    } finally {
      this.writing = false;
    }
  }
}