import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  DatabaseConnectionError,
  DatabaseDriverRegistry,
  DatabaseAdapterCapabilityError,
} from "../src/database-connection.js";

import type {
  DatabaseAdapter,
  DatabaseAdapterBase,
  DatabaseTransaction,
} from "../src/database.js";

function createAdapter(): DatabaseAdapterBase {
  return {
    capabilities: {
      sql: true,
    },
  };
}

function createSQLAdapter(): DatabaseAdapter {
  return {
    capabilities: {
      sql: true,
      transactions: true,
    },
    query: vi.fn().mockResolvedValue({
      rows: [{ value: 1 }],
      rowCount: 1,
    }),
    beginTransaction: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
      }),
      commit: vi.fn(),
      rollback: vi.fn(),
    } satisfies DatabaseTransaction),
    dispose: vi.fn().mockResolvedValue(undefined),
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

      it("connects and returns a usable AKSDatabase", async () => {
    const adapter = createSQLAdapter();
    const registry = new DatabaseDriverRegistry();

    registry.register({
      name: "postgres",
      connect: vi.fn().mockResolvedValue(adapter),
    });

    const database = await registry.connectDatabase("postgres");

    await expect(database.query("SELECT 1")).resolves.toEqual({
      rows: [{ value: 1 }],
      rowCount: 1,
    });

    expect(adapter.query).toHaveBeenCalledWith("SELECT 1", []);
    await database.dispose();
    expect(adapter.dispose).toHaveBeenCalledOnce();
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

    it("creates DatabaseAdapterCapabilityError with driver details", () => {
    const error = new DatabaseAdapterCapabilityError("postgres");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("DatabaseAdapterCapabilityError");
    expect(error.driverName).toBe("postgres");
    expect(error.message).toBe(
      'Database driver "postgres" did not provide a compatible SQL adapter',
    );
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
    it("rejects an incompatible SQL adapter and disposes it", async () => {
    const dispose = vi.fn().mockResolvedValue(undefined);
    const adapter: DatabaseAdapterBase = {
      capabilities: {
        sql: true,
      },
      dispose,
    };

    const registry = new DatabaseDriverRegistry();

    registry.register({
      name: "test",
      connect: vi.fn().mockResolvedValue(adapter),
    });

    await expect(
      registry.connectDatabase("test"),
    ).rejects.toMatchObject({
      name: "DatabaseAdapterCapabilityError",
      driverName: "test",
    });

    expect(dispose).toHaveBeenCalledOnce();
  });

    it("wraps connection failures from connectDatabase", async () => {
    const originalError = new Error("Connection refused");
    const registry = new DatabaseDriverRegistry();

    registry.register({
      name: "postgres",
      connect: vi.fn().mockRejectedValue(originalError),
    });

    await expect(
      registry.connectDatabase("postgres"),
    ).rejects.toMatchObject({
      name: "DatabaseConnectionError",
      driverName: "postgres",
      cause: originalError,
    });
  });

  it("preserves the capability error when adapter cleanup fails", async () => {
    const disposeError = new Error("Cleanup failed");
    const adapter: DatabaseAdapterBase = {
      capabilities: {
        sql: false,
      },
      dispose: vi.fn().mockRejectedValue(disposeError),
    };

    const registry = new DatabaseDriverRegistry();

    registry.register({
      name: "test",
      connect: vi.fn().mockResolvedValue(adapter),
    });

    await expect(
      registry.connectDatabase("test"),
    ).rejects.toMatchObject({
      name: "AggregateError",
      message: "Database adapter validation failed and cleanup also failed",
    });
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

  
  it("forwards connection options through connectDatabase", async () => {
    const adapter = createSQLAdapter();
    const connect = vi.fn().mockResolvedValue(adapter);
    const registry = new DatabaseDriverRegistry();

    registry.register({
      name: "postgres",
      connect,
    });

    const options = {
      connectionString: "postgres://localhost/test",
      settings: { poolSize: 5 },
    };

    const database = await registry.connectDatabase(
      "postgres",
      options,
    );

    expect(connect).toHaveBeenCalledOnce();
    expect(connect).toHaveBeenCalledWith(options);
    expect(database).toBeInstanceOf(
      (await import("../src/database.js")).AKSDatabase,
    );

    await database.dispose();
  });

  it("preserves both errors when adapter validation and cleanup fail", async () => {
    const disposeError = new Error("Cleanup failed");
    const adapter: DatabaseAdapterBase = {
      capabilities: { sql: true },
      dispose: vi.fn().mockRejectedValue(disposeError),
    };

    const registry = new DatabaseDriverRegistry();

    registry.register({
      name: "postgres",
      connect: vi.fn().mockResolvedValue(adapter),
    });

    let caughtError: unknown;

    try {
      await registry.connectDatabase("postgres");
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(AggregateError);

    const aggregateError = caughtError as AggregateError;

    expect(aggregateError.message).toBe(
      "Database adapter validation failed and cleanup also failed",
    );
    expect(aggregateError.errors).toHaveLength(2);
    expect(aggregateError.errors[0]).toBeInstanceOf(
      DatabaseAdapterCapabilityError,
    );
    expect(aggregateError.errors[1]).toBe(disposeError);
  });

});
