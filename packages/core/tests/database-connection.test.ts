import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  DatabaseConnectionError,
  DatabaseDriverRegistry,
} from "../src/database-connection.js";

import type {
  DatabaseAdapterBase,
} from "../src/database.js";

function createAdapter(): DatabaseAdapterBase {
  return {
    capabilities: {
      sql: true,
    },
  };
}

describe("DatabaseDriverRegistry", () => {
  it("registers and resolves a driver", () => {
    const adapter = createAdapter();
    const driver = {
      name: "test",
      connect: vi.fn().mockResolvedValue(adapter),
    };

    const registry = new DatabaseDriverRegistry();

    expect(registry.register(driver)).toBe(registry);
    expect(registry.has("test")).toBe(true);
    expect(registry.get("test")).toBe(driver);
    expect(registry.list()).toEqual(["test"]);
  });

  it("normalizes whitespace around driver names", () => {
    const driver = {
      name: "  test  ",
      connect: vi.fn().mockResolvedValue(createAdapter()),
    };

    const registry = new DatabaseDriverRegistry();
    registry.register(driver);

    expect(registry.has("test")).toBe(true);
    expect(registry.get("test")).toBe(driver);
    expect(registry.list()).toEqual(["test"]);
  });

  it("rejects an empty driver name", () => {
    const registry = new DatabaseDriverRegistry();

    expect(() =>
      registry.register({
        name: "   ",
        connect: vi.fn(),
      }),
    ).toThrow("Database driver name must not be empty");
  });

  it("rejects duplicate driver names", () => {
    const registry = new DatabaseDriverRegistry();

    const driver = {
      name: "test",
      connect: vi.fn(),
    };

    registry.register(driver);

    expect(() => registry.register(driver)).toThrow(
      'Database driver "test" is already registered',
    );
  });

  it("throws when resolving an unknown driver", () => {
    const registry = new DatabaseDriverRegistry();

    expect(() => registry.get("missing")).toThrow(
      'Database driver "missing" is not registered',
    );
  });

  it("connects through the registered driver", async () => {
    const adapter = createAdapter();
    const options = {
      connectionString: "test://database",
      settings: {
        poolSize: 5,
      },
    };

    const driver = {
      name: "test",
      connect: vi.fn().mockResolvedValue(adapter),
    };

    const registry = new DatabaseDriverRegistry();
    registry.register(driver);

    await expect(registry.connect("test", options)).resolves.toBe(adapter);
    expect(driver.connect).toHaveBeenCalledWith(options);
  });

  it("uses default connection options when omitted", async () => {
    const adapter = createAdapter();
    const driver = {
      name: "test",
      connect: vi.fn().mockResolvedValue(adapter),
    };

    const registry = new DatabaseDriverRegistry();
    registry.register(driver);

    await expect(registry.connect("test")).resolves.toBe(adapter);
    expect(driver.connect).toHaveBeenCalledWith({});
  });

  it("wraps connection failures and preserves the original cause", async () => {
    const originalError = new Error("Connection refused");
    const driver = {
      name: "test",
      connect: vi.fn().mockRejectedValue(originalError),
    };

    const registry = new DatabaseDriverRegistry();
    registry.register(driver);

    try {
      await registry.connect("test");
      throw new Error("Expected connection to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        'Failed to connect using database driver "test"',
      );
      expect((error as Error).cause).toBe(originalError);
    }
  });

  it("does not wrap errors from driver lookup", async () => {
    const registry = new DatabaseDriverRegistry();

    await expect(registry.connect("missing")).rejects.toThrow(
      'Database driver "missing" is not registered',
    );
  });

  
  it("resolves driver names without case sensitivity", () => {
    const driver = {
      name: "Postgres",
      connect: vi.fn().mockResolvedValue(createAdapter()),
    };

    const registry = new DatabaseDriverRegistry();
    registry.register(driver);

    expect(registry.has("postgres")).toBe(true);
    expect(registry.has("POSTGRES")).toBe(true);
    expect(registry.get("  POSTGRES  ")).toBe(driver);
    expect(registry.list()).toEqual(["postgres"]);
  });

  it("rejects duplicate names regardless of case", () => {
    const registry = new DatabaseDriverRegistry();

    registry.register({
      name: "Postgres",
      connect: vi.fn(),
    });

    expect(() =>
      registry.register({
        name: "postgres",
        connect: vi.fn(),
      }),
    ).toThrow('Database driver "postgres" is already registered');
  });

  it("throws DatabaseConnectionError with the driver name and original cause", async () => {
    const originalError = new Error("Connection refused");
    const registry = new DatabaseDriverRegistry();

    registry.register({
      name: "Postgres",
      connect: vi.fn().mockRejectedValue(originalError),
    });

    try {
      await registry.connect("postgres");
      throw new Error("Expected connection to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(DatabaseConnectionError);
      expect(error).toMatchObject({
        name: "DatabaseConnectionError",
        driverName: "Postgres",
        message: 'Failed to connect using database driver "Postgres"',
        cause: originalError,
      });
    }
  });

  
  it("creates independent connections for concurrent requests", async () => {
    const firstAdapter = createAdapter();
    const secondAdapter = createAdapter();

    const connect = vi.fn()
      .mockResolvedValueOnce(firstAdapter)
      .mockResolvedValueOnce(secondAdapter);

    const registry = new DatabaseDriverRegistry();

    registry.register({
      name: "test",
      connect,
    });

    const [first, second] = await Promise.all([
      registry.connect("test"),
      registry.connect("test"),
    ]);

    expect(connect).toHaveBeenCalledTimes(2);
    expect(first).toBe(firstAdapter);
    expect(second).toBe(secondAdapter);
    expect(first).not.toBe(second);
  });

  it("isolates a failed connection from concurrent successful connections", async () => {
    const originalError = new Error("Connection refused");
    const successfulAdapter = createAdapter();

    const connect = vi.fn()
      .mockRejectedValueOnce(originalError)
      .mockResolvedValueOnce(successfulAdapter);

    const registry = new DatabaseDriverRegistry();

    registry.register({
      name: "test",
      connect,
    });

    const results = await Promise.allSettled([
      registry.connect("test"),
      registry.connect("test"),
    ]);

    expect(results[0]).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({
        name: "DatabaseConnectionError",
        cause: originalError,
      }),
    });

    expect(results[1]).toEqual({
      status: "fulfilled",
      value: successfulAdapter,
    });

    expect(registry.has("test")).toBe(true);
  });

});
