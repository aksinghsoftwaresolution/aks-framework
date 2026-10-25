
export interface DatabaseCapabilities {
  readonly sql?: boolean;
  readonly transactions?: boolean;
  readonly documents?: boolean;
  readonly keyValue?: boolean;
}

export interface DatabaseAdapterBase {
  readonly capabilities: DatabaseCapabilities;

  dispose?(): void | Promise<void>;
}

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

export interface DatabaseAdapter extends DatabaseAdapterBase {
  query<Row = Record<string, unknown>>(
    sql: string,
    parameters?: readonly unknown[],
  ): Promise<DatabaseQueryResult<Row>>;

  beginTransaction(): Promise<DatabaseTransaction>;
}

export interface AKSDatabaseOptions {
  adapter: DatabaseAdapter;
}

export interface SQLDatabaseAdapter extends DatabaseAdapterBase {
  readonly capabilities: DatabaseCapabilities & {
    readonly sql: true;
  };

  query<Row = Record<string, unknown>>(
    sql: string,
    parameters?: readonly unknown[],
  ): Promise<DatabaseQueryResult<Row>>;

  beginTransaction?(): Promise<DatabaseTransaction>;
}

export interface DocumentDatabaseAdapter extends DatabaseAdapterBase {
  readonly capabilities: DatabaseCapabilities & {
    readonly documents: true;
  };

  find<T = Record<string, unknown>>(
    collection: string,
    filter?: Record<string, unknown>,
  ): Promise<T[]>;

  insert<T = Record<string, unknown>>(
    collection: string,
    document: T,
  ): Promise<T>;

  update(
    collection: string,
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
  ): Promise<number>;

  delete(
    collection: string,
    filter: Record<string, unknown>,
  ): Promise<number>;
}

export interface KeyValueDatabaseAdapter extends DatabaseAdapterBase {
  readonly capabilities: DatabaseCapabilities & {
    readonly keyValue: true;
  };

  get(key: string): Promise<string | null>;

  set(
    key: string,
    value: string,
    options?: { expiresInSeconds?: number },
  ): Promise<void>;

  delete(key: string): Promise<boolean>;
}

export interface AKSDatabaseClientOptions {
  adapter: DatabaseAdapterBase;
}


export class AKSDatabaseClient {
  private readonly baseAdapter: DatabaseAdapterBase;
  private readonly activeOperations = new Set<Promise<void>>();
  private disposalPromise?: Promise<void>;

  constructor(options: AKSDatabaseClientOptions) {
    this.baseAdapter = options.adapter;
  }

  dispose(): Promise<void> {
    if (this.disposalPromise) {
      return this.disposalPromise;
    }

    this.disposalPromise = this.finishDisposal();

    return this.disposalPromise;
  }

  protected trackOperation<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    this.assertNotDisposed();

    const operationPromise = Promise.resolve().then(operation);

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

  protected assertNotDisposed(): void {
  if (this.disposalPromise) {
    throw new Error(this.disposedErrorMessage());
  }
}

protected disposedErrorMessage(): string {
  return "Database client has been disposed";
}

  private async finishDisposal(): Promise<void> {
    while (this.activeOperations.size > 0) {
      await Promise.all([...this.activeOperations]);
    }

    await this.baseAdapter.dispose?.();
  }
}

export class AKSDatabase extends AKSDatabaseClient {
  private readonly adapter: DatabaseAdapter;

  constructor(options: AKSDatabaseOptions) {
    super({ adapter: options.adapter });
    this.adapter = options.adapter;
  }

    protected override disposedErrorMessage(): string {
    return "AKSDatabase has been disposed";
  }

  async query<Row = Record<string, unknown>>(
    sql: string,
    parameters: readonly unknown[] = [],
  ): Promise<DatabaseQueryResult<Row>> {
    return this.trackOperation(() =>
      this.adapter.query<Row>(sql, parameters),
    );
  }

  async transaction<T>(
    callback: (transaction: DatabaseTransaction) => Promise<T>,
  ): Promise<T> {
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
}
