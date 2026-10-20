
import { describe, expect, it, vi } from "vitest";

import {
  AKSDatabase,
  type DatabaseAdapter,
  type DatabaseQueryResult,
  type DatabaseTransaction,
} from "../src/database.js";

function createMockAdapter() {
  const query = vi.fn(
    async <Row = Record<string, unknown>>(
      _sql: string,
      _parameters?: readonly unknown[],
    ): Promise<DatabaseQueryResult<Row>> => ({
      rows: [] as Row[],
      rowCount: 0,
    }),
  );

  const commit = vi.fn(async () => {});
  const rollback = vi.fn(async () => {});
  const beginTransaction = vi.fn(
    async (): Promise<DatabaseTransaction> => ({
      query: async <Row = Record<string, unknown>>() => ({
        rows: [] as Row[],
        rowCount: 0,
      }),
      commit,
      rollback,
    }),
  );
  const dispose = vi.fn(async () => {});

  const adapter: DatabaseAdapter = {
    query,
    beginTransaction,
    dispose,
  };

  return {
    adapter,
    query,
    commit,
    rollback,
    beginTransaction,
    dispose,
  };
}

describe("AKSDatabase", () => {
  it("forwards SQL and parameters to the adapter", async () => {
    const mocks = createMockAdapter();
    const rows = [{ id: 1, name: "Alice" }];

    mocks.query.mockResolvedValueOnce({
      rows,
      rowCount: 1,
    });

    const database = new AKSDatabase({
      adapter: mocks.adapter,
    });

    const result = await database.query<{ id: number; name: string }>(
      "SELECT * FROM users WHERE id = ?",
      [1],
    );

    expect(mocks.query).toHaveBeenCalledWith(
      "SELECT * FROM users WHERE id = ?",
      [1],
    );
    expect(result).toEqual({
      rows,
      rowCount: 1,
    });
  });

  it("uses an empty parameter array by default", async () => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({
      adapter: mocks.adapter,
    });

    await database.query("SELECT 1");

    expect(mocks.query).toHaveBeenCalledWith("SELECT 1", []);
  });

  it("propagates adapter query errors", async () => {
    const mocks = createMockAdapter();
    const error = new Error("Database query failed");

    mocks.query.mockRejectedValueOnce(error);

    const database = new AKSDatabase({
      adapter: mocks.adapter,
    });

    await expect(database.query("SELECT 1")).rejects.toBe(error);
  });

  it("commits a successful transaction and returns its result", async () => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({
      adapter: mocks.adapter,
    });

    const result = await database.transaction(async () => "success");

    expect(result).toBe("success");
    expect(mocks.beginTransaction).toHaveBeenCalledOnce();
    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(mocks.rollback).not.toHaveBeenCalled();
  });

  it("rolls back and rethrows when a transaction callback fails", async () => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({
      adapter: mocks.adapter,
    });
    const error = new Error("Operation failed");

    await expect(
      database.transaction(async () => {
        throw error;
      }),
    ).rejects.toBe(error);

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("preserves both errors when the callback and rollback fail", async () => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({
      adapter: mocks.adapter,
    });
    const operationError = new Error("Operation failed");
    const rollbackError = new Error("Rollback failed");

    mocks.rollback.mockRejectedValueOnce(rollbackError);

    await expect(
      database.transaction(async () => {
        throw operationError;
      }),
    ).rejects.toMatchObject({
      message: "Database transaction failed and rollback also failed",
      errors: [operationError, rollbackError],
    });
  });

  it("propagates errors when beginning a transaction fails", async () => {
    const mocks = createMockAdapter();
    const error = new Error("Cannot begin transaction");

    mocks.beginTransaction.mockRejectedValueOnce(error);

    const database = new AKSDatabase({
      adapter: mocks.adapter,
    });

    await expect(
      database.transaction(async () => "unused"),
    ).rejects.toBe(error);

    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.rollback).not.toHaveBeenCalled();
  });

  it("disposes the adapter", async () => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({
      adapter: mocks.adapter,
    });

    await database.dispose();

    expect(mocks.dispose).toHaveBeenCalledOnce();
  });

  it("disposes the adapter only once across repeated calls", async () => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({
      adapter: mocks.adapter,
    });

    await Promise.all([
      database.dispose(),
      database.dispose(),
      database.dispose(),
    ]);

    expect(mocks.dispose).toHaveBeenCalledOnce();
  });

  it("rejects queries after disposal", async () => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({
      adapter: mocks.adapter,
    });

    await database.dispose();

    await expect(database.query("SELECT 1")).rejects.toThrow(
      "AKSDatabase has been disposed",
    );

    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("rejects transactions after disposal", async () => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({
      adapter: mocks.adapter,
    });

    await database.dispose();

    await expect(
      database.transaction(async () => "unused"),
    ).rejects.toThrow("AKSDatabase has been disposed");

    expect(mocks.beginTransaction).not.toHaveBeenCalled();
  });

  it("supports adapters without a dispose method", async () => {
    const mocks = createMockAdapter();
    const adapter: DatabaseAdapter = {
      query: mocks.query,
      beginTransaction: mocks.beginTransaction,
    };
    const database = new AKSDatabase({ adapter });

    await expect(database.dispose()).resolves.toBeUndefined();
  });

  it("keeps the database disposed when adapter cleanup fails", async () => {
    const mocks = createMockAdapter();
    mocks.dispose.mockRejectedValueOnce(
      new Error("Adapter cleanup failed"),
    );

    const database = new AKSDatabase({
      adapter: mocks.adapter,
    });

    await expect(database.dispose()).rejects.toThrow(
      "Adapter cleanup failed",
    );

    await expect(database.query("SELECT 1")).rejects.toThrow(
      "AKSDatabase has been disposed",
    );

    // Repeated disposal returns the same rejected cleanup operation.
    await expect(database.dispose()).rejects.toThrow(
      "Adapter cleanup failed",
    );

    expect(mocks.dispose).toHaveBeenCalledOnce();
  });

  
  it.each([
    ["SELECT 1", []],
    ["SELECT * FROM users", []],
    ["DELETE FROM users WHERE id = ?", [1]],
    ["UPDATE users SET name = ? WHERE id = ?", ["Alice", 1]],
    ["INSERT INTO users (name) VALUES (?)", ["Alice"]],
    ["SELECT * FROM users WHERE id = ?", [42]],
    ["SELECT * FROM users WHERE active = ?", [true]],
    ["SELECT * FROM users WHERE deleted_at = ?", [null]],
    ["SELECT * FROM users WHERE id IN (?, ?)", [1, 2]],
    ["SELECT * FROM users WHERE id = ?", [0]],
    ["SELECT * FROM users WHERE name = ?", [""]],
    ["SELECT * FROM users WHERE metadata = ?", [{ role: "admin" }]],
  ])("forwards query and parameters correctly: %s", async (sql, parameters) => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({ adapter: mocks.adapter });

    await database.query(sql, parameters);

    expect(mocks.query).toHaveBeenCalledWith(sql, parameters);
    expect(mocks.query).toHaveBeenCalledOnce();
  });

  it.each([
    { rows: [], rowCount: 0 },
    { rows: [{ id: 1 }], rowCount: 1 },
    {
      rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
      rowCount: 3,
    },
    {
      rows: [{ id: 1, name: null }],
      rowCount: 1,
    },
    {
      rows: [{ id: 1, active: false, count: 0 }],
      rowCount: 1,
    },
  ])("returns the adapter result unchanged: $rowCount rows", async (expected) => {
    const mocks = createMockAdapter();
    mocks.query.mockResolvedValueOnce(expected);

    const database = new AKSDatabase({ adapter: mocks.adapter });
    const result = await database.query("SELECT * FROM users");

    expect(result).toBe(expected);
    expect(result.rows).toEqual(expected.rows);
    expect(result.rowCount).toBe(expected.rowCount);
  });

  it.each([
    ["string result", "success"],
    ["numeric result", 42],
    ["boolean result", true],
    ["null result", null],
    ["object result", { id: 1, saved: true }],
  ])("returns the transaction callback's %s", async (_label, expected) => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({ adapter: mocks.adapter });

    const result = await database.transaction(async () => expected);

    expect(result).toEqual(expected);
    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(mocks.rollback).not.toHaveBeenCalled();
  });

  it("allows multiple queries on the database before disposal", async () => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({ adapter: mocks.adapter });

    await database.query("SELECT 1");
    await database.query("SELECT 2");
    await database.query("SELECT 3");

    expect(mocks.query).toHaveBeenCalledTimes(3);
    expect(mocks.query).toHaveBeenNthCalledWith(1, "SELECT 1", []);
  });

  it("preserves the original query error object", async () => {
    const mocks = createMockAdapter();
    const error = new TypeError("Invalid database parameters");

    mocks.query.mockRejectedValueOnce(error);

    const database = new AKSDatabase({ adapter: mocks.adapter });

    await expect(database.query("SELECT 1")).rejects.toBe(error);
  });

  it("does not begin a transaction for a normal query", async () => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({ adapter: mocks.adapter });

    await database.query("SELECT 1");

    expect(mocks.beginTransaction).not.toHaveBeenCalled();
  });

  it("does not dispose the adapter during a query", async () => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({ adapter: mocks.adapter });

    await database.query("SELECT 1");

    expect(mocks.dispose).not.toHaveBeenCalled();
  });

  it("does not dispose the adapter after a successful transaction", async () => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({ adapter: mocks.adapter });

    await database.transaction(async () => "done");

    expect(mocks.dispose).not.toHaveBeenCalled();
  });

  it("rolls back when a transaction callback throws a string", async () => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({ adapter: mocks.adapter });

    await expect(
      database.transaction(async () => {
        throw "transaction failed";
      }),
    ).rejects.toBe("transaction failed");

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("rolls back when a transaction callback throws null", async () => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({ adapter: mocks.adapter });

    await expect(
      database.transaction(async () => {
        throw null;
      }),
    ).rejects.toBe(null);

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("does not begin a transaction after disposal", async () => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({ adapter: mocks.adapter });

    await database.dispose();

    await expect(
      database.transaction(async () => "unused"),
    ).rejects.toThrow("AKSDatabase has been disposed");

    expect(mocks.beginTransaction).not.toHaveBeenCalled();
  });

  it("does not query the adapter after disposal", async () => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({ adapter: mocks.adapter });

    await database.dispose();

    await expect(database.query("SELECT 1")).rejects.toThrow(
      "AKSDatabase has been disposed",
    );

    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("waits for adapter cleanup to finish before disposal resolves", async () => {
    const mocks = createMockAdapter();
    let cleanupFinished = false;

    mocks.dispose.mockImplementation(async () => {
      await Promise.resolve();
      cleanupFinished = true;
    });

    const database = new AKSDatabase({ adapter: mocks.adapter });

    await database.dispose();

    expect(cleanupFinished).toBe(true);
  });

  it("allows repeated queries after a successful query", async () => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({ adapter: mocks.adapter });

    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 2 }], rowCount: 1 });

    const first = await database.query("SELECT 1");
    const second = await database.query("SELECT 2");

    expect(first.rows).toEqual([{ id: 1 }]);
    expect(second.rows).toEqual([{ id: 2 }]);
  });

  it("allows a new query after a previous query fails", async () => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({ adapter: mocks.adapter });

    mocks.query
      .mockRejectedValueOnce(new Error("Temporary failure"))
      .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });

    await expect(database.query("SELECT 1")).rejects.toThrow(
      "Temporary failure",
    );

    await expect(database.query("SELECT 2")).resolves.toEqual({
      rows: [{ id: 1 }],
      rowCount: 1,
    });
  });

  it("keeps query results independent across successive calls", async () => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({ adapter: mocks.adapter });
    const firstRows = [{ id: 1 }];
    const secondRows = [{ id: 2 }];

    mocks.query
      .mockResolvedValueOnce({ rows: firstRows, rowCount: 1 })
      .mockResolvedValueOnce({ rows: secondRows, rowCount: 1 });

    const first = await database.query("SELECT 1");
    const second = await database.query("SELECT 2");

    expect(first.rows).toEqual(firstRows);
    expect(second.rows).toEqual(secondRows);
    expect(first.rows).not.toBe(second.rows);
  });

  it("propagates a transaction begin error without running the callback", async () => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({ adapter: mocks.adapter });
    const callback = vi.fn(async () => "unused");

    mocks.beginTransaction.mockRejectedValueOnce(
      new Error("Connection unavailable"),
    );

    await expect(database.transaction(callback)).rejects.toThrow(
      "Connection unavailable",
    );

    expect(callback).not.toHaveBeenCalled();
  });

  it("does not commit when the transaction callback rejects", async () => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({ adapter: mocks.adapter });

    await expect(
      database.transaction(async () => {
        throw new Error("write failed");
      }),
    ).rejects.toThrow("write failed");

    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("does not roll back a successful transaction", async () => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({ adapter: mocks.adapter });

    await database.transaction(async () => ({ saved: true }));

    expect(mocks.rollback).not.toHaveBeenCalled();
  });

  it("supports sequential transactions on the same database", async () => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({ adapter: mocks.adapter });

    const first = await database.transaction(async () => "first");
    const second = await database.transaction(async () => "second");

    expect(first).toBe("first");
    expect(second).toBe("second");
    expect(mocks.beginTransaction).toHaveBeenCalledTimes(2);
    expect(mocks.commit).toHaveBeenCalledTimes(2);
  });

  it("can query again after a transaction callback fails", async () => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({ adapter: mocks.adapter });

    await expect(
      database.transaction(async () => {
        throw new Error("transaction failed");
      }),
    ).rejects.toThrow("transaction failed");

    await expect(database.query("SELECT 1")).resolves.toEqual({
      rows: [],
      rowCount: 0,
    });
  });

  it("disposes successfully when called once", async () => {
    const mocks = createMockAdapter();
    const database = new AKSDatabase({ adapter: mocks.adapter });

    await expect(database.dispose()).resolves.toBeUndefined();
    expect(mocks.dispose).toHaveBeenCalledOnce();
  });

  it("rejects queries after cleanup has failed", async () => {
    const mocks = createMockAdapter();
    mocks.dispose.mockRejectedValueOnce(new Error("Cleanup failed"));

    const database = new AKSDatabase({ adapter: mocks.adapter });

    await expect(database.dispose()).rejects.toThrow("Cleanup failed");

    await expect(database.query("SELECT 1")).rejects.toThrow(
      "AKSDatabase has been disposed",
    );

    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("does not begin transactions after cleanup has failed", async () => {
    const mocks = createMockAdapter();
    mocks.dispose.mockRejectedValueOnce(new Error("Cleanup failed"));

    const database = new AKSDatabase({ adapter: mocks.adapter });

    await expect(database.dispose()).rejects.toThrow("Cleanup failed");

    await expect(
      database.transaction(async () => "unused"),
    ).rejects.toThrow("AKSDatabase has been disposed");

    expect(mocks.beginTransaction).not.toHaveBeenCalled();
  });

  
describe("AKSDatabase additional edge cases", () => {
  it("rolls back when transaction commit fails", async () => {
    const commitError = new Error("Commit failed");
    const rollback = vi.fn().mockResolvedValue(undefined);

    const transaction: DatabaseTransaction = {
      query: vi.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
      }),
      commit: vi.fn().mockRejectedValue(commitError),
      rollback,
    };

    const adapter: DatabaseAdapter = {
      query: vi.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
      }),
      beginTransaction: vi.fn().mockResolvedValue(transaction),
    };

    const database = new AKSDatabase({ adapter });

    await expect(
      database.transaction(async () => "result"),
    ).rejects.toBe(commitError);

    expect(rollback).toHaveBeenCalledOnce();
  });

  it("aggregates commit and rollback errors when both fail", async () => {
    const commitError = new Error("Commit failed");
    const rollbackError = new Error("Rollback failed");

    const transaction: DatabaseTransaction = {
      query: vi.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
      }),
      commit: vi.fn().mockRejectedValue(commitError),
      rollback: vi.fn().mockRejectedValue(rollbackError),
    };

    const adapter: DatabaseAdapter = {
      query: vi.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
      }),
      beginTransaction: vi.fn().mockResolvedValue(transaction),
    };

    const database = new AKSDatabase({ adapter });

    let thrown: unknown;

    try {
      await database.transaction(async () => "result");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AggregateError);

    const aggregateError = thrown as AggregateError;

    expect(aggregateError.message).toBe(
      "Database transaction failed and rollback also failed",
    );
    expect(aggregateError.errors).toEqual([
      commitError,
      rollbackError,
    ]);
  });

  it("passes the original transaction to the callback", async () => {
    const transaction: DatabaseTransaction = {
      query: vi.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
      }),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
    };

    const adapter: DatabaseAdapter = {
      query: vi.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
      }),
      beginTransaction: vi.fn().mockResolvedValue(transaction),
    };

    const database = new AKSDatabase({ adapter });
    let receivedTransaction: DatabaseTransaction | undefined;

    await database.transaction(async (tx) => {
      receivedTransaction = tx;
    });

    expect(receivedTransaction).toBe(transaction);
  });

  it("rejects new queries immediately after disposal starts", async () => {
    let finishDisposal!: () => void;

    const adapter: DatabaseAdapter = {
      query: vi.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
      }),
      beginTransaction: vi.fn(),
      dispose: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finishDisposal = resolve;
          }),
      ),
    };

    const database = new AKSDatabase({ adapter });
    const disposal = database.dispose();

    await expect(database.query("SELECT 1")).rejects.toThrow(
      "AKSDatabase has been disposed",
    );

    finishDisposal();
    await disposal;
  });

  it("rejects new transactions immediately after disposal starts", async () => {
    let finishDisposal!: () => void;

    const adapter: DatabaseAdapter = {
      query: vi.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
      }),
      beginTransaction: vi.fn(),
      dispose: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finishDisposal = resolve;
          }),
      ),
    };

    const database = new AKSDatabase({ adapter });
    const disposal = database.dispose();

    await expect(
      database.transaction(async () => "result"),
    ).rejects.toThrow("AKSDatabase has been disposed");

    expect(adapter.beginTransaction).not.toHaveBeenCalled();

    finishDisposal();
    await disposal;
  });

  it("allows a transaction already started to finish after disposal begins", async () => {
    let finishTransaction!: (value: string) => void;

    const transaction: DatabaseTransaction = {
      query: vi.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
      }),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
    };

    const adapter: DatabaseAdapter = {
      query: vi.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
      }),
      beginTransaction: vi.fn().mockResolvedValue(transaction),
    };

    const database = new AKSDatabase({ adapter });

    const pendingTransaction = database.transaction(
      () =>
        new Promise<string>((resolve) => {
          finishTransaction = resolve;
        }),
    );

    // Let the transaction callback start and register its resolver.
    await Promise.resolve();
    await Promise.resolve();

    const disposal = database.dispose();

    finishTransaction("completed");

    await expect(pendingTransaction).resolves.toBe("completed");
    await disposal;

    expect(transaction.commit).toHaveBeenCalledOnce();
  });

  it("supports a callback that throws synchronously", async () => {
    const callbackError = new Error("Synchronous callback failure");

    const transaction: DatabaseTransaction = {
      query: vi.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
      }),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
    };

    const adapter: DatabaseAdapter = {
      query: vi.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
      }),
      beginTransaction: vi.fn().mockResolvedValue(transaction),
    };

    const database = new AKSDatabase({ adapter });

    await expect(
      database.transaction(() => {
        throw callbackError;
      }),
    ).rejects.toBe(callbackError);

    expect(transaction.rollback).toHaveBeenCalledOnce();
    expect(transaction.commit).not.toHaveBeenCalled();
  });
});


it("waits for an active query before disposing the adapter", async () => {
  let finishQuery!: (
    result: DatabaseQueryResult<{ id: number }>,
  ) => void;

  const query = vi.fn(
    () =>
      new Promise<DatabaseQueryResult<{ id: number }>>((resolve) => {
        finishQuery = resolve;
      }),
  );

  const adapter: DatabaseAdapter = {
    query,
    beginTransaction: vi.fn(),
    dispose: vi.fn().mockResolvedValue(undefined),
  };

  const database = new AKSDatabase({ adapter });

  const pendingQuery = database.query<{ id: number }>(
    "SELECT id FROM users",
  );

  // Ensure the adapter query has started.
  await vi.waitFor(() => {
    expect(query).toHaveBeenCalledOnce();
  });

  let disposalFinished = false;

  const disposal = database.dispose().then(() => {
    disposalFinished = true;
  });

  // Disposal must not finish while the query is pending.
  await Promise.resolve();
  expect(disposalFinished).toBe(false);
  expect(adapter.dispose).not.toHaveBeenCalled();

  finishQuery({
    rows: [{ id: 42 }],
    rowCount: 1,
  });

  await expect(pendingQuery).resolves.toEqual({
    rows: [{ id: 42 }],
    rowCount: 1,
  });

  await disposal;

  expect(disposalFinished).toBe(true);
  expect(adapter.dispose).toHaveBeenCalledOnce();
});


it("disposes the adapter after an active query fails", async () => {
  const queryError = new Error("Query failed");

  let rejectQuery!: (error: Error) => void;

  const adapter: DatabaseAdapter = {
    query: vi.fn(
      () =>
        new Promise<DatabaseQueryResult>((_resolve, reject) => {
          rejectQuery = reject;
        }),
    ),
    beginTransaction: vi.fn(),
    dispose: vi.fn().mockResolvedValue(undefined),
  };

  const database = new AKSDatabase({ adapter });
  const pendingQuery = database.query("SELECT 1");

  await vi.waitFor(() => {
    expect(adapter.query).toHaveBeenCalledOnce();
  });

  // Attach a rejection handler before deliberately rejecting the query.
  const observedQuery = expect(pendingQuery).rejects.toBe(queryError);
  const disposal = database.dispose();

  rejectQuery(queryError);

  await observedQuery;
  await disposal;

  expect(adapter.dispose).toHaveBeenCalledOnce();
});

it("waits for an active transaction before disposing the adapter", async () => {
  let finishCallback!: (value: string) => void;

  const transaction: DatabaseTransaction = {
    query: vi.fn().mockResolvedValue({
      rows: [],
      rowCount: 0,
    }),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
  };

  const adapter: DatabaseAdapter = {
    query: vi.fn().mockResolvedValue({
      rows: [],
      rowCount: 0,
    }),
    beginTransaction: vi.fn().mockResolvedValue(transaction),
    dispose: vi.fn().mockResolvedValue(undefined),
  };

  const database = new AKSDatabase({ adapter });

  const pendingTransaction = database.transaction(
    () =>
      new Promise<string>((resolve) => {
        finishCallback = resolve;
      }),
  );

  await vi.waitFor(() => {
    expect(adapter.beginTransaction).toHaveBeenCalledOnce();
  });

  const disposal = database.dispose();

  await Promise.resolve();
  expect(adapter.dispose).not.toHaveBeenCalled();

  finishCallback("committed");

  await expect(pendingTransaction).resolves.toBe("committed");
  await disposal;

  expect(transaction.commit).toHaveBeenCalledOnce();
  expect(adapter.dispose).toHaveBeenCalledOnce();
});

it("waits for a failed transaction to roll back before disposing", async () => {
  const callbackError = new Error("Transaction callback failed");

  let rejectCallback!: (error: Error) => void;

  const transaction: DatabaseTransaction = {
    query: vi.fn().mockResolvedValue({
      rows: [],
      rowCount: 0,
    }),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
  };

  const adapter: DatabaseAdapter = {
    query: vi.fn().mockResolvedValue({
      rows: [],
      rowCount: 0,
    }),
    beginTransaction: vi.fn().mockResolvedValue(transaction),
    dispose: vi.fn().mockResolvedValue(undefined),
  };

  const database = new AKSDatabase({ adapter });

  const pendingTransaction = database.transaction(
    () =>
      new Promise<string>((_resolve, reject) => {
        rejectCallback = reject;
      }),
  );

  await vi.waitFor(() => {
    expect(adapter.beginTransaction).toHaveBeenCalledOnce();
  });

  const observedTransaction =
    expect(pendingTransaction).rejects.toBe(callbackError);

  const disposal = database.dispose();

  rejectCallback(callbackError);

  await observedTransaction;
  await disposal;

  expect(transaction.rollback).toHaveBeenCalledOnce();
  expect(transaction.commit).not.toHaveBeenCalled();
  expect(adapter.dispose).toHaveBeenCalledOnce();
});



});
