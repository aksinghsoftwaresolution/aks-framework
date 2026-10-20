export type Factory<T> = (
  container: DIContainer,
) => T;

interface Provider {
  factory: Factory<unknown>;
  singleton: boolean;
  instance?: unknown;
}

export interface Disposable {
  dispose(): void | Promise<void>;
}

export class DIContainer {
  private readonly providers = new Map<
    string | symbol,
    Provider
  >();

  private readonly resolving = new Set<string | symbol>();

  private disposalPromise?: Promise<void>;

  private readonly singletonInstances = new Map<
    string | symbol,
    unknown
  >();

  register<T>(
    token: string | symbol,
    factory: Factory<T>,
  ): this {
    this.providers.set(token, {
      factory,
      singleton: false,
    });

    return this;
  }

  registerSingleton<T>(
    token: string | symbol,
    factory: Factory<T>,
  ): this {
    this.providers.set(token, {
      factory,
      singleton: true,
    });

    return this;
  }

  has(token: string | symbol): boolean {
    return this.providers.has(token);
  }

  tryResolve<T>(token: string | symbol): T | undefined {
    if (!this.providers.has(token)) {
      return undefined;
    }

    return this.resolve<T>(token);
  }

  remove(token: string | symbol): boolean {
    return this.providers.delete(token);
  }

    resolve<T>(token: string | symbol): T {
    const provider = this.providers.get(token);

    if (!provider) {
      throw new Error(
        `No dependency registered for token: ${String(token)}`,
      );
    }

    if (this.resolving.has(token)) {
      throw new Error(
        `Circular dependency detected: ${String(token)}`,
      );
    }

    this.resolving.add(token);

    try {
      if (provider.singleton) {
        if (provider.instance === undefined) {
          provider.instance = provider.factory(this);
          this.singletonInstances.set(token, provider.instance);
        }

        return provider.instance as T;
      }

      return provider.factory(this) as T;
    } finally {
      this.resolving.delete(token);
    }
  }

  dispose(): Promise<void> {
    if (this.disposalPromise) {
      return this.disposalPromise;
    }

    let disposal!: Promise<void>;

    disposal = Promise.resolve()
      .then(() => this.finishDisposal())
      .finally(() => {
        if (this.disposalPromise === disposal) {
          this.disposalPromise = undefined;
        }
      });

    this.disposalPromise = disposal;

    return disposal;
  }

  private async finishDisposal(): Promise<void> {
    const errors: unknown[] = [];

    for (const instance of this.singletonInstances.values()) {
      if (
        typeof instance === "object" &&
        instance !== null &&
        "dispose" in instance &&
        typeof instance.dispose === "function"
      ) {
        try {
          await instance.dispose();
        } catch (error) {
          errors.push(error);
        }
      }
    }

    this.singletonInstances.clear();

    if (errors.length > 0) {
      throw errors[0];
    }
  }

}