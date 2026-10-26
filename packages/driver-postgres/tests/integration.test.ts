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
  AKSDatabase,
  DatabaseDriverRegistry,
} from "@aks-framework/core";

import {
  PostgresDatabaseDriver,
} from "../src/index.js";

describe("PostgreSQL driver integration", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("connects through the registry and executes a query through AKSDatabase", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ id: 7, name: "Ada" }],
        rowCount: 1,
      });

    const registry = new DatabaseDriverRegistry();
    registry.register(new PostgresDatabaseDriver());

    const adapter = await registry.connect("postgres", {
      connectionString: "postgres://test:test@localhost:5432/test",
    });

    const database = new AKSDatabase({
      adapter: adapter as import("@aks-framework/core").DatabaseAdapter,
    });

    await expect(
      database.query<{ id: number; name: string }>(
        "SELECT id, name FROM users WHERE id = $1",
        [7],
      ),
    ).resolves.toEqual({
      rows: [{ id: 7, name: "Ada" }],
      rowCount: 1,
    });

    expect(mocks.poolConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: "postgres://test:test@localhost:5432/test",
      }),
    );

    expect(mocks.query).toHaveBeenNthCalledWith(1, "SELECT 1");
    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      "SELECT id, name FROM users WHERE id = $1",
      [7],
    );

    await database.dispose();

    expect(mocks.end).toHaveBeenCalledTimes(1);
  });
  
});