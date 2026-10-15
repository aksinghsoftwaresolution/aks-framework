import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { AKSApp } from "../src/app.js";
import {
  AKSLogger,
  type LogEntry,
} from "../src/logger.js";
import type { LogTransport } from "../src/logger-transport.js";

describe("AKSApp logger integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a default logger", () => {
    const app = new AKSApp();

    expect(app.getLogger()).toBeInstanceOf(
      AKSLogger,
    );
  });

  it("uses the injected logger", () => {
    const logger = new AKSLogger({
      transports: [],
    });

    const app = new AKSApp({
      logger,
    });

    expect(app.getLogger()).toBe(logger);
  });

  it("keeps logger stable across calls", () => {
    const app = new AKSApp();

    expect(app.getLogger()).toBe(
      app.getLogger(),
    );
  });

  it("creates separate default loggers for separate app instances", () => {
    const app1 = new AKSApp();
    const app2 = new AKSApp();

    expect(app1.getLogger()).toBeInstanceOf(
      AKSLogger,
    );

    expect(app2.getLogger()).toBeInstanceOf(
      AKSLogger,
    );

    expect(app1.getLogger()).not.toBe(
      app2.getLogger(),
    );
  });

  it("accepts a logger configured with a custom level", () => {
    const logger = new AKSLogger({
      level: "debug",
      transports: [],
    });

    const app = new AKSApp({
      logger,
    });

    expect(app.getLogger()).toBe(logger);
  });

  it("accepts a logger with a custom transport", () => {
    const entries: LogEntry[] = [];

    const transport: LogTransport = {
      write(entry) {
        entries.push(entry);
      },
    };

    const logger = new AKSLogger({
      transports: [transport],
    });

    const app = new AKSApp({
      logger,
    });

    app.getLogger().info(
      "Application test message",
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      level: "info",
      message: "Application test message",
    });
  });

  it("uses the injected logger for application logging", () => {
    const info = vi.fn();

    const logger = new AKSLogger({
      transports: [],
    });

    vi.spyOn(logger, "info").mockImplementation(
      info,
    );

    const app = new AKSApp({
      logger,
    });

    app.getLogger().info(
      "Application started",
    );

    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(
      "Application started",
    );
  });

  it("preserves logger context", () => {
    const entries: LogEntry[] = [];

    const transport: LogTransport = {
      write(entry) {
        entries.push(entry);
      },
    };

    const logger = new AKSLogger({
      transports: [transport],
    });

    const app = new AKSApp({
      logger,
    });

    app.getLogger().info(
      "Request completed",
      {
        method: "GET",
        path: "/users",
        statusCode: 200,
      },
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      level: "info",
      message: "Request completed",
      context: {
        method: "GET",
        path: "/users",
        statusCode: 200,
      },
    });
  });

  it("preserves the configured logger level", () => {
    const entries: LogEntry[] = [];

    const transport: LogTransport = {
      write(entry) {
        entries.push(entry);
      },
    };

    const logger = new AKSLogger({
      level: "warn",
      transports: [transport],
    });

    const app = new AKSApp({
      logger,
    });

    app.getLogger().debug("Debug message");
    app.getLogger().info("Info message");
    app.getLogger().warn("Warning message");
    app.getLogger().error("Error message");

    expect(entries).toHaveLength(2);

    expect(entries.map((entry) => entry.level))
      .toEqual([
        "warn",
        "error",
      ]);
  });

  it("allows multiple applications to use different loggers", () => {
    const entries1: LogEntry[] = [];
    const entries2: LogEntry[] = [];

    const transport1: LogTransport = {
      write(entry) {
        entries1.push(entry);
      },
    };

    const transport2: LogTransport = {
      write(entry) {
        entries2.push(entry);
      },
    };

    const logger1 = new AKSLogger({
      transports: [transport1],
    });

    const logger2 = new AKSLogger({
      transports: [transport2],
    });

    const app1 = new AKSApp({
      logger: logger1,
    });

    const app2 = new AKSApp({
      logger: logger2,
    });

    app1.getLogger().info("App 1");
    app2.getLogger().info("App 2");

    expect(entries1).toHaveLength(1);
    expect(entries2).toHaveLength(1);

    expect(entries1[0].message).toBe(
      "App 1",
    );

    expect(entries2[0].message).toBe(
      "App 2",
    );
  });

  it("does not replace the injected logger", () => {
    const logger = new AKSLogger({
      transports: [],
    });

    const app = new AKSApp({
      logger,
    });

    const originalLogger =
      app.getLogger();

    app.getLogger().info(
      "Test message",
    );

    expect(app.getLogger()).toBe(
      originalLogger,
    );

    expect(app.getLogger()).toBe(
      logger,
    );
  });

  it("does not share a default logger between applications", () => {
    const app1 = new AKSApp();
    const app2 = new AKSApp();

    expect(app1.getLogger()).not.toBe(
      app2.getLogger(),
    );
  });
});