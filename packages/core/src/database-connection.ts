import {
  AKSDatabase,
} from "./database.js";

import type {
  DatabaseAdapter,
  DatabaseAdapterBase,
} from "./database.js";

export interface DatabaseConnectionOptions {
  readonly connectionString?: string;
  readonly settings?: Readonly<Record<string, unknown>>;
}

export interface DatabaseDriver {
  readonly name: string;

  connect(
    options: DatabaseConnectionOptions,
  ): Promise<DatabaseAdapterBase>;
}

export class DatabaseConnectionError extends Error {
  readonly driverName: string;

  constructor(driverName: string, cause: unknown) {
    super(
      `Failed to connect using database driver "${driverName}"`,
      { cause },
    );

    this.name = "DatabaseConnectionError";
    this.driverName = driverName;
  }
}

export class DatabaseAdapterCapabilityError extends Error {
  readonly driverName: string;

  constructor(driverName: string) {
    super(
      `Database driver "${driverName}" did not provide a compatible SQL adapter`,
    );

    this.name = "DatabaseAdapterCapabilityError";
    this.driverName = driverName;
  }
}

export class DatabaseDriverRegistry {
  private readonly drivers = new Map<string, DatabaseDriver>();

  private normalizeName(name: string): string {
    return name.trim().toLowerCase();
  }

  register(driver: DatabaseDriver): this {
    const name = this.normalizeName(driver.name);

    if (!name) {
      throw new Error("Database driver name must not be empty");
    }

    if (this.drivers.has(name)) {
      throw new Error(`Database driver "${name}" is already registered`);
    }

    this.drivers.set(name, driver);
    return this;
  }

  has(name: string): boolean {
    return this.drivers.has(this.normalizeName(name));
  }

  get(name: string): DatabaseDriver {
    const normalizedName = this.normalizeName(name);
    const driver = this.drivers.get(normalizedName);

    if (!driver) {
      throw new Error(
        `Database driver "${normalizedName}" is not registered`,
      );
    }

    return driver;
  }

    async connect(
    name: string,
    options: DatabaseConnectionOptions = {},
  ): Promise<DatabaseAdapterBase> {
    const driver = this.get(name);

    try {
      return await driver.connect(options);
    } catch (error) {
      throw new DatabaseConnectionError(driver.name.trim(), error);
    }
  }

  async connectDatabase(
    name: string,
    options: DatabaseConnectionOptions = {},
  ): Promise<AKSDatabase> {
    const driver = this.get(name);
    const adapter = await this.connect(name, options);

    const isCompatible =
      adapter.capabilities.sql === true &&
      typeof (adapter as Partial<DatabaseAdapter>).query === "function" &&
      typeof (adapter as Partial<DatabaseAdapter>).beginTransaction === "function";

    if (!isCompatible) {
      try {
        await adapter.dispose?.();
      } catch (disposeError) {
        throw new AggregateError(
          [
            new DatabaseAdapterCapabilityError(driver.name.trim()),
            disposeError,
          ],
          "Database adapter validation failed and cleanup also failed",
        );
      }

      throw new DatabaseAdapterCapabilityError(driver.name.trim());
    }

    return new AKSDatabase({
      adapter: adapter as DatabaseAdapter,
    });
  }

  list(): string[] {
    return [...this.drivers.keys()];
  }
}
