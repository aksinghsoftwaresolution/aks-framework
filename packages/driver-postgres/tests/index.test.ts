
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  end: vi.fn().mockResolvedValue(undefined),
  clientQuery: vi.fn(),
  release: vi.fn(),
  poolConstructor: vi.fn(),
}));

vi.mock("pg", () => ({
  Pool: class {
    query = mocks.query;
    connect = mocks.connect;
    end = mocks.end;

    constructor(options: unknown) {
      mocks.poolConstructor(options);
    }
  },
}));

import {
  PostgresDatabaseAdapter,
  PostgresDatabaseDriver,
} from "../src/index.js";

function createAdapter() {
  return new PostgresDatabaseAdapter({
    query: mocks.query,
    connect: mocks.connect,
    end: mocks.end,
  } as never);
}

function configureClient() {
  mocks.connect.mockResolvedValue({
    query: mocks.clientQuery,
    release: mocks.release,
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("PostgresDatabaseDriver", () => {
  it("uses the postgres driver name", () => {
    expect(new PostgresDatabaseDriver().name).toBe("postgres");
  });

  it("passes connection options to pg.Pool and verifies connectivity", async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{ "?column?": 1 }],
      rowCount: 1,
    });

    await new PostgresDatabaseDriver().connect({
      connectionString: "postgres://localhost/test",
      settings: {
        max: 5,
        idleTimeoutMillis: 1000,
        connectionTimeoutMillis: 2000,
      },
    });

    expect(mocks.poolConstructor).toHaveBeenCalledWith({
      connectionString: "postgres://localhost/test",
      max: 5,
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 2000,
    });
    expect(mocks.query).toHaveBeenCalledWith("SELECT 1");
  });

  it("wraps query results in the framework result shape", async () => {
    const adapter = createAdapter();

    mocks.query.mockResolvedValueOnce({
      rows: [{ id: 1 }],
      rowCount: 1,
    });

    await expect(
      adapter.query("SELECT * FROM users WHERE id = $1", [1]),
    ).resolves.toEqual({
      rows: [{ id: 1 }],
      rowCount: 1,
    });

    expect(mocks.query).toHaveBeenCalledWith(
      "SELECT * FROM users WHERE id = $1",
      [1],
    );
  });

  it("advertises SQL and transaction capabilities", () => {
    expect(createAdapter().capabilities).toEqual({
      sql: true,
      transactions: true,
    });
  });

  it("begins a transaction and commits it", async () => {
    configureClient();
    mocks.clientQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const transaction = await createAdapter().beginTransaction();

    expect(mocks.clientQuery).toHaveBeenCalledWith("BEGIN");

    await transaction.commit();

    expect(mocks.clientQuery).toHaveBeenCalledWith("COMMIT");
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("rolls back a transaction and releases the client", async () => {
    configureClient();
    mocks.clientQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const transaction = await createAdapter().beginTransaction();

    await transaction.rollback();

    expect(mocks.clientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("runs parameterized queries inside a transaction", async () => {
    configureClient();
    mocks.clientQuery.mockResolvedValue({
      rows: [{ id: 7 }],
      rowCount: 1,
    });

    const transaction = await createAdapter().beginTransaction();

    await expect(
      transaction.query("SELECT * FROM users WHERE id = $1", [7]),
    ).resolves.toEqual({
      rows: [{ id: 7 }],
      rowCount: 1,
    });

    expect(mocks.clientQuery).toHaveBeenCalledWith(
      "SELECT * FROM users WHERE id = $1",
      [7],
    );

    await transaction.rollback();
  });

  it("rejects queries after a transaction has finished", async () => {
    configureClient();
    mocks.clientQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const transaction = await createAdapter().beginTransaction();

    await transaction.commit();

    await expect(
      transaction.query("SELECT 1"),
    ).rejects.toThrow("PostgreSQL transaction has already finished");
  });

  it("does not release a transaction client twice", async () => {
    configureClient();
    mocks.clientQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const transaction = await createAdapter().beginTransaction();

    await transaction.rollback();
    await transaction.rollback();

    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("closes the pool on disposal", async () => {
    const adapter = createAdapter();

    await adapter.dispose();

    expect(mocks.end).toHaveBeenCalledOnce();
  });

  it("does not close the pool more than once", async () => {
    const adapter = createAdapter();

    await adapter.dispose();
    await adapter.dispose();

    expect(mocks.end).toHaveBeenCalledOnce();
  });

  it("rejects queries after disposal", async () => {
    const adapter = createAdapter();

    await adapter.dispose();

    await expect(adapter.query("SELECT 1")).rejects.toThrow(
      "PostgreSQL adapter has been disposed",
    );
  });

  it("closes the pool if the connection check fails", async () => {
    mocks.query.mockRejectedValueOnce(new Error("Connection refused"));

    await expect(
      new PostgresDatabaseDriver().connect({
        connectionString: "postgres://localhost/test",
      }),
    ).rejects.toThrow("Connection refused");

    expect(mocks.end).toHaveBeenCalledOnce();
  });

  it("releases the client if beginning a transaction fails", async () => {
    configureClient();
    mocks.clientQuery.mockRejectedValueOnce(
      new Error("BEGIN failed"),
    );

    await expect(
      createAdapter().beginTransaction(),
    ).rejects.toThrow("BEGIN failed");

    expect(mocks.release).toHaveBeenCalledOnce();
  });

  
  it("releases the client with an error if commit fails", async () => {
    configureClient();

    const commitError = new Error("COMMIT failed");
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockRejectedValueOnce(commitError);

    const transaction = await createAdapter().beginTransaction();

    await expect(transaction.commit()).rejects.toThrow("COMMIT failed");

    expect(mocks.release).toHaveBeenCalledWith(commitError);

    await expect(
      transaction.query("SELECT 1"),
    ).rejects.toThrow("PostgreSQL transaction has already finished");
  });

  it("releases the client with an error if rollback fails", async () => {
    configureClient();

    const rollbackError = new Error("ROLLBACK failed");
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockRejectedValueOnce(rollbackError);

    const transaction = await createAdapter().beginTransaction();

    await expect(transaction.rollback()).rejects.toThrow("ROLLBACK failed");

    expect(mocks.release).toHaveBeenCalledWith(rollbackError);

    await transaction.rollback();

    expect(mocks.release).toHaveBeenCalledOnce();
  });

  
it("shares the same promise for concurrent disposal calls", async () => {
  let finishDisposal!: () => void;

  mocks.end.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finishDisposal = resolve;
    }),
  );

  const adapter = createAdapter();

  const first = adapter.dispose();
  const second = adapter.dispose();

  expect(second).toBe(first);

  // Allow the asynchronous pool.end() call to start.
  await Promise.resolve();

  expect(mocks.end).toHaveBeenCalledOnce();

  let disposalFinished = false;
  void first.then(() => {
    disposalFinished = true;
  });

  await Promise.resolve();
  expect(disposalFinished).toBe(false);

  finishDisposal();

  await expect(Promise.all([first, second])).resolves.toEqual([
    undefined,
    undefined,
  ]);
});

it("rejects new queries while disposal is in progress", async () => {
  let finishDisposal!: () => void;

  mocks.end.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finishDisposal = resolve;
    }),
  );

  const adapter = createAdapter();
  const disposal = adapter.dispose();

  await expect(adapter.query("SELECT 1")).rejects.toThrow(
    "PostgreSQL adapter has been disposed",
  );

  finishDisposal();
  await disposal;
});


it("waits for active transactions before closing the pool", async () => {
  configureClient();

  mocks.clientQuery.mockResolvedValue({
    rows: [],
    rowCount: 0,
  });

  const adapter = createAdapter();
  const transaction = await adapter.beginTransaction();

  const firstDisposal = adapter.dispose();
  const secondDisposal = adapter.dispose();

  expect(firstDisposal).toBe(secondDisposal);

  // The pool must remain open while the transaction is active.
  await Promise.resolve();
  expect(mocks.end).not.toHaveBeenCalled();

  // Existing transactions may finish during shutdown.
  await expect(
    transaction.query("SELECT 1"),
  ).resolves.toEqual({
    rows: [],
    rowCount: 0,
  });

  // New work is rejected once shutdown starts.
  await expect(adapter.query("SELECT 1")).rejects.toThrow(
    "PostgreSQL adapter has been disposed",
  );

  await expect(adapter.beginTransaction()).rejects.toThrow(
    "PostgreSQL adapter has been disposed",
  );

  await transaction.commit();
  await firstDisposal;

  expect(mocks.end).toHaveBeenCalledOnce();
});


it("releases a client acquired after disposal starts", async () => {
  let resolveConnect!: (client: {
    query: typeof mocks.clientQuery;
    release: typeof mocks.release;
  }) => void;

  mocks.connect.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveConnect = resolve;
    }),
  );

  const adapter = createAdapter();

  const transactionPromise = adapter.beginTransaction();
  const disposalPromise = adapter.dispose();

  // Disposal must wait while client acquisition is pending.
  await Promise.resolve();
  expect(mocks.end).not.toHaveBeenCalled();

  resolveConnect({
    query: mocks.clientQuery,
    release: mocks.release,
  });

  await expect(transactionPromise).rejects.toThrow(
    "PostgreSQL adapter has been disposed",
  );

  await disposalPromise;

  expect(mocks.release).toHaveBeenCalledOnce();
  expect(mocks.end).toHaveBeenCalledOnce();
});

it("closes the pool when a commit fails during disposal", async () => {
  configureClient();

  const commitError = new Error("COMMIT failed");

  mocks.clientQuery
    .mockResolvedValueOnce({ rows: [], rowCount: 0 })
    .mockRejectedValueOnce(commitError);

  const adapter = createAdapter();
  const transaction = await adapter.beginTransaction();

  const disposalPromise = adapter.dispose();

  // The pool must remain open while the transaction is active.
  await Promise.resolve();
  expect(mocks.end).not.toHaveBeenCalled();

  await expect(transaction.commit()).rejects.toThrow("COMMIT failed");

  await disposalPromise;

  expect(mocks.release).toHaveBeenCalledWith(commitError);
  expect(mocks.end).toHaveBeenCalledOnce();
});


it("propagates errors from ordinary pool queries", async () => {
  const adapter = createAdapter();
  const queryError = new Error("Query failed");

  mocks.query.mockRejectedValueOnce(queryError);

  await expect(
    adapter.query("SELECT * FROM users"),
  ).rejects.toBe(queryError);

  expect(mocks.query).toHaveBeenCalledWith(
    "SELECT * FROM users",
    [],
  );
});

it("propagates errors from transactional queries", async () => {
  configureClient();

  const queryError = new Error("Transactional query failed");

  mocks.clientQuery
    .mockResolvedValueOnce({ rows: [], rowCount: 0 })
    .mockRejectedValueOnce(queryError);

  const transaction = await createAdapter().beginTransaction();

  await expect(
    transaction.query("SELECT * FROM users WHERE id = $1", [7]),
  ).rejects.toBe(queryError);

  // A failed query does not automatically finish the transaction.
  // The caller can still roll it back.
  await expect(transaction.rollback()).resolves.toBeUndefined();

  expect(mocks.release).toHaveBeenCalledOnce();
  expect(mocks.clientQuery).toHaveBeenNthCalledWith(
    2,
    "SELECT * FROM users WHERE id = $1",
    [7],
  );
  expect(mocks.clientQuery).toHaveBeenNthCalledWith(3, "ROLLBACK");
});


it("prevents concurrent commit and rollback operations", async () => {
  configureClient();

  let finishCommit!: (result: { rows: never[]; rowCount: number }) => void;

  mocks.clientQuery
    .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishCommit = resolve;
        }),
    )
    .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ROLLBACK

  const transaction = await createAdapter().beginTransaction();

  const commitPromise = transaction.commit();

  // Allow commit() to reach the pending COMMIT query.
  await Promise.resolve();

  const rollbackPromise = transaction.rollback();

  // ROLLBACK must not be issued while COMMIT is pending.
  expect(mocks.clientQuery).not.toHaveBeenCalledWith("ROLLBACK");

  finishCommit({ rows: [], rowCount: 0 });

  await commitPromise;
  await rollbackPromise;

  expect(mocks.clientQuery).toHaveBeenCalledTimes(2);
  expect(mocks.clientQuery).toHaveBeenCalledWith("COMMIT");
  expect(mocks.release).toHaveBeenCalledOnce();
});


it("shares one operation for concurrent commit calls", async () => {
  configureClient();

  let finishCommit:
    | ((result: { rows: never[]; rowCount: number }) => void)
    | undefined;

  // Isolate this test from any queued mock implementations.
  mocks.clientQuery.mockReset();

  mocks.clientQuery
    .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishCommit = resolve;
        }),
    );

  const transaction = await createAdapter().beginTransaction();

  const firstCommit = transaction.commit();
  const secondCommit = transaction.commit();

  expect(secondCommit).toBe(firstCommit);

  // Wait for the COMMIT implementation itself to run.
  await vi.waitFor(() => {
    expect(finishCommit).toBeTypeOf("function");
  });

  expect(mocks.clientQuery).toHaveBeenCalledTimes(2);
  expect(mocks.clientQuery).toHaveBeenLastCalledWith("COMMIT");

  finishCommit!({ rows: [], rowCount: 0 });

  await Promise.all([firstCommit, secondCommit]);

  expect(mocks.release).toHaveBeenCalledOnce();
});

});