
import { Pool, type PoolClient, type QueryResultRow } from "pg";

import type {
  DatabaseConnectionOptions,
  DatabaseDriver,
} from "@aks-framework/core";

import type {
  DatabaseCapabilities,
  DatabaseQueryResult,
  DatabaseTransaction,
  SQLDatabaseAdapter,
} from "@aks-framework/core";

export interface PostgresDriverSettings {
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}



class PostgresTransaction implements DatabaseTransaction {
  private finished = false;
  private completionPromise?: Promise<void>;
  private activeQueries = 0;
  private resolveQueriesDrained?: () => void;

  constructor(
    private readonly client: PoolClient,
    private readonly onFinish: () => void,
  ) {}

  async query<Row = Record<string, unknown>>(
    sql: string,
    parameters: readonly unknown[] = [],
  ): Promise<DatabaseQueryResult<Row>> {
    this.assertActive();
    this.activeQueries++;

    try {
      const result = await this.client.query<QueryResultRow>(
        sql,
        [...parameters],
      );

      return {
        rows: result.rows as Row[],
        rowCount: result.rowCount ?? 0,
      };
    } finally {
      this.activeQueries--;

      if (this.activeQueries === 0) {
        this.resolveQueriesDrained?.();
        this.resolveQueriesDrained = undefined;
      }
    }
  }

  
  commit(): Promise<void> {
    if (this.completionPromise) {
      return this.completionPromise;
    }

    this.assertActive();

    this.completionPromise = this.complete("COMMIT");
    return this.completionPromise;
  }

  rollback(): Promise<void> {
    if (this.finished) {
      return Promise.resolve();
    }

    if (this.completionPromise) {
      return this.completionPromise;
    }

    this.completionPromise = this.complete("ROLLBACK");
    return this.completionPromise;
  }

  private async complete(
    command: "COMMIT" | "ROLLBACK",
  ): Promise<void> {
    try {
      await this.waitForQueriesToDrain();
      await this.client.query(command);
    } catch (error) {
      this.finish(error instanceof Error ? error : true);
      throw error;
    }

    this.finish();
  }

  private async waitForQueriesToDrain(): Promise<void> {
    if (this.activeQueries === 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.resolveQueriesDrained = resolve;
    });
  }

  private finish(releaseError?: Error | boolean): void {
    if (this.finished) return;

    this.finished = true;

    if (releaseError !== undefined) {
      this.client.release(releaseError);
    } else {
      this.client.release();
    }

    this.onFinish();
  }

  private assertActive(): void {
    if (this.finished || this.completionPromise) {
      throw new Error("PostgreSQL transaction has already finished");
    }
  }
}

export class PostgresDatabaseAdapter implements SQLDatabaseAdapter {
  readonly capabilities: DatabaseCapabilities & {
    readonly sql: true;
    readonly transactions: true;
  } = {
    sql: true,
    transactions: true,
  };

  private disposed = false;
  private disposalPromise?: Promise<void>;

  private readonly activeTransactions = new Set<symbol>();
  private resolveTransactionsDrained?: () => void;

  private activeQueries = 0;
  private resolveQueriesDrained?: () => void;

  constructor(private readonly pool: Pool) {}

  async query<Row = Record<string, unknown>>(
    sql: string,
    parameters: readonly unknown[] = [],
  ): Promise<DatabaseQueryResult<Row>> {
    this.assertActive();
    this.activeQueries++;

    try {
    const result = await this.pool.query<QueryResultRow>(
      sql,
      [...parameters],
    );

    return {
      rows: result.rows as Row[],
      rowCount: result.rowCount ?? 0,
    };
  } finally {
    this.activeQueries--;
    if (this.activeQueries === 0) {
      this.resolveQueriesDrained?.();
      this.resolveQueriesDrained = undefined;
    }
  }
  }

  async beginTransaction(): Promise<DatabaseTransaction> {
    this.assertActive();

    // Track acquisition too, so disposal cannot close the pool
    // while a transaction is waiting for a client.
    const transactionId = Symbol("postgres-transaction");
    this.activeTransactions.add(transactionId);

    let client: PoolClient | undefined;

    try {
      client = await this.pool.connect();

      // Disposal may have started while connect() was pending.
      if (this.disposed) {
        throw new Error("PostgreSQL adapter has been disposed");
      }

      await client.query("BEGIN");

      return new PostgresTransaction(client, () => {
        this.finishTransaction(transactionId);
      });
    } catch (error) {
      if (client) {
        client.release(error instanceof Error ? error : true);
      }

      this.finishTransaction(transactionId);
      throw error;
    }
  }

  dispose(): Promise<void> {
    if (this.disposalPromise) {
      return this.disposalPromise;
    }

    // Reject new work immediately.
    this.disposed = true;
    this.disposalPromise = this.closeWhenTransactionsFinish();

    return this.disposalPromise;
  }

  private async closeWhenTransactionsFinish(): Promise<void> {
    if (this.activeQueries > 0) {
      await new Promise<void>((resolve) => {
        this.resolveQueriesDrained = resolve;
      });
    }
    if (this.activeTransactions.size > 0) {
      await new Promise<void>((resolve) => {
        this.resolveTransactionsDrained = resolve;
      });
    }

    await this.pool.end();
  }

  private finishTransaction(transactionId: symbol): void {
    this.activeTransactions.delete(transactionId);

    if (
      this.disposed &&
      this.activeTransactions.size === 0
    ) {
      this.resolveTransactionsDrained?.();
      this.resolveTransactionsDrained = undefined;
    }
  }

  private assertActive(): void {
    if (this.disposed) {
      throw new Error("PostgreSQL adapter has been disposed");
    }
  }
}

export class PostgresDatabaseDriver implements DatabaseDriver {
  readonly name = "postgres";

  async connect(
    options: DatabaseConnectionOptions = {},
  ): Promise<PostgresDatabaseAdapter> {
    const settings = options.settings as PostgresDriverSettings | undefined;

    const pool = new Pool({
      connectionString: options.connectionString,
      max: settings?.max,
      idleTimeoutMillis: settings?.idleTimeoutMillis,
      connectionTimeoutMillis: settings?.connectionTimeoutMillis,
    });

    try {
      await pool.query("SELECT 1");
      return new PostgresDatabaseAdapter(pool);
    } catch (error) {
      await pool.end().catch(() => undefined);
      throw error;
    }
  }
}
