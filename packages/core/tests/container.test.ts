import { describe, expect, it } from "vitest";

import { DIContainer } from "../src/container.js";

describe("DIContainer", () => {
  it("registers and resolves a dependency", () => {
    const container = new DIContainer();

    container.register("config", () => ({
      port: 3000,
    }));

    const config = container.resolve<{ port: number }>("config");

    expect(config).toEqual({
      port: 3000,
    });
  });

  it("supports symbol tokens", () => {
    const container = new DIContainer();

    const token = Symbol("service");

    container.register(token, () => ({
      name: "UserService",
    }));

    const service = container.resolve<{ name: string }>(token);

    expect(service).toEqual({
      name: "UserService",
    });
  });

  it("creates a new value when resolving a factory", () => {
    const container = new DIContainer();

    container.register("service", () => ({
      id: Math.random(),
    }));

    const first = container.resolve<{ id: number }>("service");
    const second = container.resolve<{ id: number }>("service");

    expect(first).not.toBe(second);
  });

  it("throws when resolving an unregistered dependency", () => {
    const container = new DIContainer();

    expect(() => {
      container.resolve("missing");
    }).toThrow(
      "No dependency registered for token: missing",
    );
  });

  it("supports chaining register calls", () => {
    const container = new DIContainer();

    container
      .register("one", () => 1)
      .register("two", () => 2);

    expect(container.resolve<number>("one")).toBe(1);
    expect(container.resolve<number>("two")).toBe(2);
  });

  it("resolves the same instance for a singleton", () => {
  const container = new DIContainer();

  container.registerSingleton("service", () => ({
    id: Math.random(),
  }));

  const first = container.resolve<{ id: number }>("service");
  const second = container.resolve<{ id: number }>("service");

  expect(first).toBe(second);
});

it("creates the singleton lazily", () => {
  const container = new DIContainer();

  let factoryCalls = 0;

  container.registerSingleton("service", () => {
    factoryCalls += 1;

    return {
      name: "UserService",
    };
  });

  expect(factoryCalls).toBe(0);

  container.resolve<{ name: string }>("service");

  expect(factoryCalls).toBe(1);

  container.resolve<{ name: string }>("service");

  expect(factoryCalls).toBe(1);
});

it("replaces an existing registration", () => {
  const container = new DIContainer();

  container.register("service", () => "first");
  container.register("service", () => "second");

  expect(container.resolve<string>("service")).toBe("second");
});

it("allows a factory to resolve another dependency", () => {
  const container = new DIContainer();

  container.register("config", () => ({
    port: 3000,
  }));

  container.register("server", (container) => {
    const config = container.resolve<{ port: number }>("config");

    return {
      port: config.port,
    };
  });

  const server = container.resolve<{ port: number }>("server");

  expect(server).toEqual({
    port: 3000,
  });
});

it("supports dependencies inside a singleton factory", () => {
  const container = new DIContainer();

  container.registerSingleton("config", () => ({
    port: 3000,
  }));

  container.registerSingleton("server", (container) => {
    const config = container.resolve<{ port: number }>("config");

    return {
      port: config.port,
    };
  });

  const first = container.resolve<{ port: number }>("server");
  const second = container.resolve<{ port: number }>("server");

  expect(first).toBe(second);
  expect(first.port).toBe(3000);
});

it("detects a circular dependency", () => {
  const container = new DIContainer();

  container.register("a", (container) => {
    return container.resolve("b");
  });

  container.register("b", (container) => {
    return container.resolve("a");
  });

  expect(() => {
    container.resolve("a");
  }).toThrow("Circular dependency detected");
});

it("cleans up circular resolution state after a failed resolution", () => {
  const container = new DIContainer();

  let shouldFail = true;

  container.register("service", () => {
    if (shouldFail) {
      throw new Error("Service failed");
    }

    return {
      name: "UserService",
    };
  });

  expect(() => {
    container.resolve("service");
  }).toThrow("Service failed");

  shouldFail = false;

  const service = container.resolve<{ name: string }>("service");

  expect(service).toEqual({
    name: "UserService",
  });
});

it("checks whether a dependency is registered", () => {
  const container = new DIContainer();

  container.register("config", () => ({
    port: 3000,
  }));

  expect(container.has("config")).toBe(true);
  expect(container.has("missing")).toBe(false);
});

it("checks registered symbol tokens", () => {
  const container = new DIContainer();
  const token = Symbol("service");

  container.register(token, () => ({
    name: "AKS",
  }));

  expect(container.has(token)).toBe(true);
  expect(container.has(Symbol("service"))).toBe(false);
});

it("returns undefined when an optional dependency is not registered", () => {
  const container = new DIContainer();

  expect(container.tryResolve("missing")).toBeUndefined();
});

it("resolves a registered optional dependency", () => {
  const container = new DIContainer();

  container.register("logger", () => ({
    name: "AKS Logger",
  }));

  const logger = container.tryResolve<{ name: string }>(
    "logger",
  );

  expect(logger).toEqual({
    name: "AKS Logger",
  });
});

it("propagates errors from a registered dependency", () => {
  const container = new DIContainer();

  container.register("service", () => {
    throw new Error("Service failed");
  });

  expect(() => {
    container.tryResolve("service");
  }).toThrow("Service failed");
});

it("removes a registered dependency", () => {
  const container = new DIContainer();

  container.register("service", () => ({
    name: "UserService",
  }));

  expect(container.has("service")).toBe(true);

  expect(container.remove("service")).toBe(true);

  expect(container.has("service")).toBe(false);

  expect(() => {
    container.resolve("service");
  }).toThrow(
    "No dependency registered for token: service",
  );
});

it("returns false when removing an unregistered dependency", () => {
  const container = new DIContainer();

  expect(container.remove("missing")).toBe(false);
});

it("allows a removed singleton to be registered again", () => {
  const container = new DIContainer();

  container.registerSingleton("service", () => ({
    id: Symbol(),
  }));

  const first = container.resolve<{ id: symbol }>("service");

  expect(container.remove("service")).toBe(true);

  container.registerSingleton("service", () => ({
    id: Symbol(),
  }));

  const second = container.resolve<{ id: symbol }>("service");

  expect(second).not.toBe(first);
});

it("tracks instantiated singleton dependencies", () => {
  const container = new DIContainer();

  const service = {
    dispose() {},
  };

  container.registerSingleton("service", () => service);

  expect(container.resolve("service")).toBe(service);
});

it("disposes an instantiated singleton", async () => {
  const container = new DIContainer();

  let disposed = false;

  container.registerSingleton("service", () => ({
    dispose() {
      disposed = true;
    },
  }));

  container.resolve("service");

  await container.dispose();

  expect(disposed).toBe(true);
});

it("awaits asynchronous singleton disposal", async () => {
  const container = new DIContainer();

  let disposed = false;

  container.registerSingleton("service", () => ({
    async dispose() {
      await Promise.resolve();
      disposed = true;
    },
  }));

  container.resolve("service");

  await container.dispose();

  expect(disposed).toBe(true);
});

it("continues disposing other singletons when one disposal fails", async () => {
  const container = new DIContainer();

  let firstDisposed = false;
  let secondDisposed = false;

  container.registerSingleton("first", () => ({
    dispose() {
      firstDisposed = true;
      throw new Error("first disposal failed");
    },
  }));

  container.registerSingleton("second", () => ({
    dispose() {
      secondDisposed = true;
    },
  }));

  container.resolve("first");
  container.resolve("second");

  await expect(container.dispose()).rejects.toThrow(
    "first disposal failed",
  );

  expect(firstDisposed).toBe(true);
  expect(secondDisposed).toBe(true);
});

it("does not dispose a singleton more than once", async () => {
  const container = new DIContainer();

  let disposeCount = 0;

  container.registerSingleton("service", () => ({
    dispose() {
      disposeCount += 1;
    },
  }));

  container.resolve("service");

  await container.dispose();
  await container.dispose();

  expect(disposeCount).toBe(1);
});

it("does not dispose a singleton that was never resolved", async () => {
  const container = new DIContainer();

  let factoryCalled = false;
  let disposeCalled = false;

  container.registerSingleton("service", () => {
    factoryCalled = true;

    return {
      dispose() {
        disposeCalled = true;
      },
    };
  });

  await container.dispose();

  expect(factoryCalled).toBe(false);
  expect(disposeCalled).toBe(false);
});

it("disposes an instantiated singleton after it is removed", async () => {
  const container = new DIContainer();

  let disposeCalled = false;

  container.registerSingleton("service", () => ({
    dispose() {
      disposeCalled = true;
    },
  }));

  container.resolve("service");
  container.remove("service");

  await container.dispose();

  expect(disposeCalled).toBe(true);
});

it("does not dispose transient dependencies", async () => {
  const container = new DIContainer();

  let disposeCount = 0;

  container.register("service", () => ({
    dispose() {
      disposeCount += 1;
    },
  }));

  container.resolve("service");
  container.resolve("service");

  await container.dispose();

  expect(disposeCount).toBe(0);
});

it("can dispose and then track a newly registered singleton", async () => {
  const container = new DIContainer();

  let firstDisposeCount = 0;
  let secondDisposeCount = 0;

  container.registerSingleton("service", () => ({
    dispose() {
      firstDisposeCount += 1;
    },
  }));

  container.resolve("service");

  await container.dispose();

  container.registerSingleton("service", () => ({
    dispose() {
      secondDisposeCount += 1;
    },
  }));

  container.resolve("service");

  await container.dispose();

  expect(firstDisposeCount).toBe(1);
  expect(secondDisposeCount).toBe(1);
});

it("disposes a singleton only once during concurrent disposal", async () => {
  const container = new DIContainer();

  let finishDisposal!: () => void;
  let disposeCount = 0;
  let disposalFinished = false;

  const disposalGate = new Promise<void>((resolve) => {
    finishDisposal = resolve;
  });

  container.registerSingleton("service", () => ({
    async dispose() {
      disposeCount += 1;

      await disposalGate;

      disposalFinished = true;
    },
  }));

  container.resolve("service");

  const firstDisposal = container.dispose();
  const secondDisposal = container.dispose();

  expect(secondDisposal).toBe(firstDisposal);

  // Allow cleanup to start while keeping the resource blocked.
  await Promise.resolve();
  await Promise.resolve();

  expect(disposeCount).toBe(1);
  expect(disposalFinished).toBe(false);

  finishDisposal();

  await Promise.all([
    firstDisposal,
    secondDisposal,
  ]);

  expect(disposeCount).toBe(1);
  expect(disposalFinished).toBe(true);
});

it("shares a disposal failure between concurrent callers", async () => {
  const container = new DIContainer();
  const disposalError = new Error("Disposal failed");

  let disposeCount = 0;

  container.registerSingleton("service", () => ({
    dispose() {
      disposeCount += 1;
      throw disposalError;
    },
  }));

  container.resolve("service");

  const firstDisposal = container.dispose();
  const secondDisposal = container.dispose();

  expect(secondDisposal).toBe(firstDisposal);

  await expect(firstDisposal).rejects.toBe(disposalError);
  await expect(secondDisposal).rejects.toBe(disposalError);

  expect(disposeCount).toBe(1);
});

});