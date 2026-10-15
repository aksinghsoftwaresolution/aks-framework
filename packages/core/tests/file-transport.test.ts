import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  FileTransport,
} from "../src/index.js";

import {
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";

describe("FileTransport", () => {
  const directories: string[] = [];

  async function createTempFilePath(): Promise<string> {
    const directory = await mkdtemp(
      join(tmpdir(), "aks-logger-"),
    );

    directories.push(directory);

    return join(
      directory,
      "application.log",
    );
  }

  afterEach(async () => {
    for (const directory of directories) {
      await rm(directory, {
        recursive: true,
        force: true,
      });
    }

    directories.length = 0;
  });

  it("creates the log file when it does not exist", async () => {
    const file = await createTempFilePath();

    const transport = new FileTransport({
      file,
    });

    await transport.write({
      level: "info",
      message: "hello",
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    const content = await readFile(
      file,
      "utf-8",
    );

    expect(content).toBe(
      '{"level":"info","message":"hello","timestamp":"2026-01-01T00:00:00.000Z"}\n',
    );
  });

  it("appends entries instead of overwriting", async () => {
    const file = await createTempFilePath();

    const transport = new FileTransport({
      file,
    });

    await transport.write({
      level: "info",
      message: "first",
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    await transport.write({
      level: "error",
      message: "second",
      timestamp: "2026-01-01T00:00:01.000Z",
    });

    const content = await readFile(
      file,
      "utf-8",
    );

    expect(content).toBe(
      '{"level":"info","message":"first","timestamp":"2026-01-01T00:00:00.000Z"}\n' +
      '{"level":"error","message":"second","timestamp":"2026-01-01T00:00:01.000Z"}\n',
    );
  });

  it("preserves log context", async () => {
    const file = await createTempFilePath();

    const transport = new FileTransport({
      file,
    });

    await transport.write({
      level: "warn",
      message: "request failed",
      timestamp: "2026-01-01T00:00:00.000Z",
      context: {
        requestId: "abc123",
        statusCode: 500,
      },
    });

    const content = await readFile(
      file,
      "utf-8",
    );

    const entry = JSON.parse(
      content,
    );

    expect(entry).toEqual({
      level: "warn",
      message: "request failed",
      timestamp: "2026-01-01T00:00:00.000Z",
      context: {
        requestId: "abc123",
        statusCode: 500,
      },
    });
  });

  it("serializes writes through the queue", async () => {
    const file = await createTempFilePath();

    const transport = new FileTransport({
      file,
    });

    const first = transport.write({
      level: "info",
      message: "first",
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    const second = transport.write({
      level: "info",
      message: "second",
      timestamp: "2026-01-01T00:00:01.000Z",
    });

    const third = transport.write({
      level: "info",
      message: "third",
      timestamp: "2026-01-01T00:00:02.000Z",
    });

    await Promise.all([
      first,
      second,
      third,
    ]);

    const content = await readFile(
      file,
      "utf-8",
    );

    const entries = content
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    expect(
      entries.map(
        (entry) => entry.message,
      ),
    ).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("supports all log levels", async () => {
    const file = await createTempFilePath();

    const transport = new FileTransport({
      file,
    });

    await transport.write({
      level: "debug",
      message: "debug message",
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    await transport.write({
      level: "info",
      message: "info message",
      timestamp: "2026-01-01T00:00:01.000Z",
    });

    await transport.write({
      level: "warn",
      message: "warn message",
      timestamp: "2026-01-01T00:00:02.000Z",
    });

    await transport.write({
      level: "error",
      message: "error message",
      timestamp: "2026-01-01T00:00:03.000Z",
    });

    const content = await readFile(
      file,
      "utf-8",
    );

    const entries = content
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    expect(
      entries.map(
        (entry) => entry.level,
      ),
    ).toEqual([
      "debug",
      "info",
      "warn",
      "error",
    ]);
  });

  it("preserves special characters in messages", async () => {
    const file = await createTempFilePath();

    const transport = new FileTransport({
      file,
    });

    const message =
      'User said: "Hello"\nPath: C:\\Users\\test';

    await transport.write({
      level: "info",
      message,
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    const content = await readFile(
      file,
      "utf-8",
    );

    const entry = JSON.parse(
      content,
    );

    expect(entry.message).toBe(
      message,
    );
  });

  it("preserves nested context values", async () => {
    const file = await createTempFilePath();

    const transport = new FileTransport({
      file,
    });

    await transport.write({
      level: "info",
      message: "request completed",
      timestamp: "2026-01-01T00:00:00.000Z",
      context: {
        request: {
          id: "req-123",
          method: "GET",
          metadata: {
            source: "api",
          },
        },
        response: {
          statusCode: 200,
        },
      },
    });

    const content = await readFile(
      file,
      "utf-8",
    );

    const entry = JSON.parse(
      content,
    );

    expect(entry.context).toEqual({
      request: {
        id: "req-123",
        method: "GET",
        metadata: {
          source: "api",
        },
      },
      response: {
        statusCode: 200,
      },
    });
  });

  it("supports empty messages", async () => {
    const file = await createTempFilePath();

    const transport = new FileTransport({
      file,
    });

    await transport.write({
      level: "info",
      message: "",
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    const content = await readFile(
      file,
      "utf-8",
    );

    const entry = JSON.parse(
      content,
    );

    expect(entry.message).toBe("");
  });

  it("handles multiple queued batches", async () => {
    const file = await createTempFilePath();

    const transport = new FileTransport({
      file,
    });

    const firstBatch = [
      transport.write({
        level: "info",
        message: "first",
        timestamp: "2026-01-01T00:00:00.000Z",
      }),
      transport.write({
        level: "info",
        message: "second",
        timestamp: "2026-01-01T00:00:01.000Z",
      }),
    ];

    await Promise.all(firstBatch);

    const secondBatch = [
      transport.write({
        level: "info",
        message: "third",
        timestamp: "2026-01-01T00:00:02.000Z",
      }),
      transport.write({
        level: "info",
        message: "fourth",
        timestamp: "2026-01-01T00:00:03.000Z",
      }),
    ];

    await Promise.all(secondBatch);

    const content = await readFile(
      file,
      "utf-8",
    );

    const entries = content
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    expect(
      entries.map(
        (entry) => entry.message,
      ),
    ).toEqual([
      "first",
      "second",
      "third",
      "fourth",
    ]);
  });

  it("writes entries as valid JSON lines", async () => {
    const file = await createTempFilePath();

    const transport = new FileTransport({
      file,
    });

    await transport.write({
      level: "info",
      message: "first",
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    await transport.write({
      level: "warn",
      message: "second",
      timestamp: "2026-01-01T00:00:01.000Z",
    });

    const content = await readFile(
      file,
      "utf-8",
    );

    const lines = content
      .trim()
      .split("\n");

    expect(lines).toHaveLength(2);

    for (const line of lines) {
      expect(() => JSON.parse(line))
        .not.toThrow();
    }
  });

  it("propagates file write failures", async () => {
    const file = join(
      tmpdir(),
      "aks-nonexistent-directory",
      "application.log",
    );

    const transport = new FileTransport({
      file,
    });

    await expect(
      transport.write({
        level: "error",
        message: "write failed",
        timestamp: "2026-01-01T00:00:00.000Z",
      }),
    ).rejects.toBeDefined();
  });

  it("continues processing queued writes after a write failure", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "aks-logger-"),
    );

    directories.push(directory);

    const file = join(
      directory,
      "application.log",
    );

    const transport = new FileTransport({
      file,
    });

    await transport.write({
      level: "info",
      message: "first",
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    const originalAppendFile = await import(
      "node:fs/promises"
    );

    expect(
      originalAppendFile.appendFile,
    ).toBeDefined();

    const second = transport.write({
      level: "info",
      message: "second",
      timestamp: "2026-01-01T00:00:01.000Z",
    });

    const third = transport.write({
      level: "info",
      message: "third",
      timestamp: "2026-01-01T00:00:02.000Z",
    });

    await Promise.all([
      second,
      third,
    ]);

    const content = await readFile(
      file,
      "utf-8",
    );

    const entries = content
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    expect(
      entries.map(
        (entry) => entry.message,
      ),
    ).toEqual([
      "first",
      "second",
      "third",
    ]);
  });
});