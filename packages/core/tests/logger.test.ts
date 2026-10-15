import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  AKSLogger,
  ConsoleTransport,
} from "../src/index.js";

describe("AKSLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs info messages by default", () => {
    const spy = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    const logger = new AKSLogger();

    logger.info("Server started");

    expect(spy).toHaveBeenCalledTimes(1);

    const output = JSON.parse(
      spy.mock.calls[0][0] as string,
    );

    expect(output.level).toBe("info");
    expect(output.message).toBe(
      "Server started",
    );
    expect(output.timestamp).toEqual(
      expect.any(String),
    );
  });

  it("does not log debug messages at info level", () => {
    const spy = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    const logger = new AKSLogger({
      level: "info",
    });

    logger.debug("Debug message");

    expect(spy).not.toHaveBeenCalled();
  });

  it("logs debug messages at debug level", () => {
    const spy = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    const logger = new AKSLogger({
      level: "debug",
    });

    logger.debug("Debug message");

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("logs warnings using console.warn", () => {
    const spy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    const logger = new AKSLogger();

    logger.warn("Slow request");

    expect(spy).toHaveBeenCalledTimes(1);

    const output = JSON.parse(
      spy.mock.calls[0][0] as string,
    );

    expect(output.level).toBe("warn");
    expect(output.message).toBe(
      "Slow request",
    );
  });

  it("logs errors using console.error", () => {
    const spy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const logger = new AKSLogger();

    logger.error("Request failed");

    expect(spy).toHaveBeenCalledTimes(1);

    const output = JSON.parse(
      spy.mock.calls[0][0] as string,
    );

    expect(output.level).toBe("error");
    expect(output.message).toBe(
      "Request failed",
    );
  });

  it("includes context when provided", () => {
    const spy = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    const logger = new AKSLogger();

    logger.info("User created", {
      userId: "123",
      source: "api",
    });

    const output = JSON.parse(
      spy.mock.calls[0][0] as string,
    );

    expect(output.context).toEqual({
      userId: "123",
      source: "api",
    });
  });

  it("omits context when it is not provided", () => {
    const spy = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    const logger = new AKSLogger();

    logger.info("Application started");

    const output = JSON.parse(
      spy.mock.calls[0][0] as string,
    );

    expect(output).not.toHaveProperty(
      "context",
    );
  });

  it("filters messages below the configured level", () => {
    const logSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    const logger = new AKSLogger({
      level: "warn",
    });

    logger.debug("debug");
    logger.info("info");
    logger.warn("warn");

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("writes to a custom transport", () => {
  const entries: unknown[] = [];

  const transport = {
    write(entry: unknown) {
      entries.push(entry);
    },
  };

  const logger = new AKSLogger({
    transports: [transport],
  });

  logger.info("Custom transport");

  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({
    level: "info",
    message: "Custom transport",
  });
});

it("isolates synchronous transport failures", () => {
  const entries: string[] = [];

  const failingTransport = {
    write() {
      throw new Error(
        "Transport failed",
      );
    },
  };

  const workingTransport = {
    write(entry: {
      message: string;
    }) {
      entries.push(entry.message);
    },
  };

  const logger = new AKSLogger({
    transports: [
      failingTransport,
      workingTransport,
    ],
    onTransportError: () => {},
  });

  expect(() => {
    logger.info("Application started");
  }).not.toThrow();

  expect(entries).toEqual([
    "Application started",
  ]);
});

it("reports synchronous transport failures", () => {
  const errors: unknown[] = [];

  const error = new Error(
    "Transport failed",
  );

  const logger = new AKSLogger({
    transports: [
      {
        write() {
          throw error;
        },
      },
    ],
    onTransportError: (
      receivedError,
      entry,
    ) => {
      errors.push(receivedError);

      expect(entry.level).toBe("info");
      expect(entry.message).toBe(
        "Test message",
      );
    },
  });

  logger.info("Test message");

  expect(errors).toEqual([error]);
});

it("isolates asynchronous transport failures", async () => {
  const entries: string[] = [];

  const failingTransport = {
    async write() {
      throw new Error(
        "Async transport failed",
      );
    },
  };

  const workingTransport = {
    write(entry: {
      message: string;
    }) {
      entries.push(entry.message);
    },
  };

  const logger = new AKSLogger({
    transports: [
      failingTransport,
      workingTransport,
    ],
    onTransportError: () => {},
  });

  logger.info("Application started");

  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

  expect(entries).toEqual([
    "Application started",
  ]);
});

it("reports asynchronous transport failures", async () => {
  const errors: unknown[] = [];

  const error = new Error(
    "Async transport failed",
  );

  const logger = new AKSLogger({
    transports: [
      {
        async write() {
          throw error;
        },
      },
    ],
    onTransportError: (
      receivedError,
      entry,
    ) => {
      errors.push(receivedError);

      expect(entry.level).toBe("info");
      expect(entry.message).toBe(
        "Test message",
      );
    },
  });

  logger.info("Test message");

  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

  expect(errors).toEqual([error]);
});

it("writes using ConsoleTransport", () => {
  const transport = new ConsoleTransport();

  const consoleLog = vi
    .spyOn(console, "log")
    .mockImplementation(() => {});

  const logger = new AKSLogger({
    transports: [transport],
  });

  logger.info("hello");

  expect(consoleLog).toHaveBeenCalledOnce();

  const output = consoleLog.mock.calls[0][0] as string;
  const entry = JSON.parse(output);

  expect(entry.level).toBe("info");
  expect(entry.message).toBe("hello");

  consoleLog.mockRestore();
});

it("writes to multiple transports", async () => {
  const firstTransport = {
    write: vi.fn(),
  };

  const secondTransport = {
    write: vi.fn(),
  };

  const logger = new AKSLogger({
    transports: [
      firstTransport,
      secondTransport,
    ],
  });

  logger.info("hello", {
    requestId: "abc123",
  });

  expect(
    firstTransport.write,
  ).toHaveBeenCalledOnce();

  expect(
    secondTransport.write,
  ).toHaveBeenCalledOnce();

  expect(
    firstTransport.write.mock.calls[0][0],
  ).toEqual(
    secondTransport.write.mock.calls[0][0],
  );
});


});