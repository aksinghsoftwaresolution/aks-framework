
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AKSDatabase } from "@aks-framework/core";
import { PostgresDatabaseDriver } from "../src/index.js";

const connectionString = process.env.AKS_TEST_DATABASE_URL;
const requireLiveTests = process.env.AKS_REQUIRE_POSTGRES_TESTS === "1";

if (requireLiveTests && !connectionString) {
  throw new Error(
    "AKS_TEST_DATABASE_URL is required when AKS_REQUIRE_POSTGRES_TESTS=1",
  );
}

const liveTest = connectionString ? describe : describe.skip;

liveTest("PostgreSQL live integration", () => {
  let database: AKSDatabase;

  beforeAll(async () => {
    const adapter = await new PostgresDatabaseDriver().connect({
      connectionString: connectionString!,
      settings: {
        max: 5,
        connectionTimeoutMillis: 5000,
      },
    });

    database = new AKSDatabase({ adapter });

    await database.query(`
      CREATE TABLE IF NOT EXISTS aks_live_transaction_test (
        id bigserial PRIMARY KEY,
        marker text NOT NULL UNIQUE
      )
    `);
  }, 15000);

  afterAll(async () => {
    await database?.dispose();
  }, 15000);

  it("connects to PostgreSQL and returns server information", async () => {
    const result = await database.query<{
      server_version: string;
      answer: number;
    }>(
      "SELECT version() AS server_version, $1::int AS answer",
      [42],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].server_version).toContain("PostgreSQL");
    expect(result.rows[0].answer).toBe(42);
  });

  it("commits a transaction", async () => {
    const marker = randomUUID();

    await database.transaction(async (transaction) => {
      await transaction.query(
        "INSERT INTO aks_live_transaction_test (marker) VALUES ($1)",
        [marker],
      );
    });

    try {
      const result = await database.query<{ marker: string }>(
        "SELECT marker FROM aks_live_transaction_test WHERE marker = $1",
        [marker],
      );

      expect(result.rows).toEqual([{ marker }]);
    } finally {
      await database.query(
        "DELETE FROM aks_live_transaction_test WHERE marker = $1",
        [marker],
      );
    }
  });

  it("rolls back a transaction when its callback fails", async () => {
    const marker = randomUUID();

    await expect(
      database.transaction(async (transaction) => {
        await transaction.query(
          "INSERT INTO aks_live_transaction_test (marker) VALUES ($1)",
          [marker],
        );

        throw new Error("Force rollback");
      }),
    ).rejects.toThrow("Force rollback");

    const result = await database.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM aks_live_transaction_test WHERE marker = $1",
      [marker],
    );

    expect(result.rows[0].count).toBe("0");
  });
});
