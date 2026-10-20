
export interface DatabaseQueryResult<Row = Record<string, unknown>> {
  rows: Row[];
  rowCount: number;
}

export interface DatabaseTransaction {
  query<Row = Record<string, unknown>>(
    sql: string,
    parameters?: readonly unknown[],
  ): Promise<DatabaseQueryResult<Row>>;

  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface DatabaseAdapter {
  query<Row = Record<string, unknown>>(
    sql: string,
    parameters?: readonly unknown[],
  ): Promise<DatabaseQueryResult<Row>>;

  beginTransaction(): Promise<DatabaseTransaction>;

  dispose?(): void | Promise<void>;
}

export interface AKSDatabaseOptions {
  adapter: DatabaseAdapter;
}

export class AKSDatabase {
  private readonly adapter: DatabaseAdapter;
  private readonly activeOperations = new Set<Promise<void>>();
  private disposalPromise?: Promise<void>;

  constructor(options: AKSDatabaseOptions) {
    this.adapter = options.adapter;
  }

  async query<Row = Record<string, unknown>>(
    sql: string,
    parameters: readonly unknown[] = [],
  ): Promise<DatabaseQueryResult<Row>> {
    this.assertNotDisposed();

    return this.trackOperation(() =>
      this.adapter.query<Row>(sql, parameters),
    );
  }

  async transaction<T>(
    callback: (transaction: DatabaseTransaction) => Promise<T>,
  ): Promise<T> {
    this.assertNotDisposed();

    return this.trackOperation(async () => {
      const transaction = await this.adapter.beginTransaction();

      try {
        const result = await callback(transaction);
        await transaction.commit();

        return result;
      } catch (error) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          throw new AggregateError(
            [error, rollbackError],
            "Database transaction failed and rollback also failed",
          );
        }

        throw error;
      }
    });
  }

  dispose(): Promise<void> {
    if (this.disposalPromise) {
      return this.disposalPromise;
    }

    // Set this synchronously so no new operations can enter.
    this.disposalPromise = this.finishDisposal();

    return this.disposalPromise;
  }

  private async finishDisposal(): Promise<void> {
  // Wait until every operation that entered before disposal settles.
  while (this.activeOperations.size > 0) {
    await Promise.all([...this.activeOperations]);
  }

  await this.adapter.dispose?.();
}

  private trackOperation<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    const operationPromise = Promise.resolve().then(operation);

    // Track settlement rather than the operation's result so failures
    // cannot prevent disposal from proceeding.
    const settledPromise = operationPromise.then(
      () => undefined,
      () => undefined,
    );

    this.activeOperations.add(settledPromise);

    void settledPromise.then(() => {
      this.activeOperations.delete(settledPromise);
    });

    return operationPromise;
  }

  private assertNotDisposed(): void {
    if (this.disposalPromise) {
      throw new Error("AKSDatabase has been disposed");
    }
  }
}
