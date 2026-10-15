import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  fixDependencies,
} from "../../src/doctor/fix-dependencies.js";

import type {
  DependencyUpdate,
} from "../../src/doctor/checks/dependencies.js";

function createDependency(
  overrides: Partial<DependencyUpdate> = {},
): DependencyUpdate {
  return {
    name: "@types/node",
    requested: "^26.6.0",
    installed: "26.6.3",
    latest: "26.6.4",
    withinRequestedRange: true,
    ...overrides,
  };
}

describe("fixDependencies", () => {
  it("updates safe dependencies", async () => {
    const update = vi.fn(
      async (
        _cwd: string,
        _packages: string[],
      ) => {},
    );

    const result = await fixDependencies({
      cwd: process.cwd(),
      dependencies: [
        createDependency(),
      ],
      update,
    });

    expect(update).toHaveBeenCalledTimes(1);

    expect(update).toHaveBeenCalledWith(
      process.cwd(),
      ["@types/node"],
    );

    expect(result).toEqual({
      updated: true,
      skipped: false,
      message: "Updated 1 dependency.",
    });
  });

  it("updates multiple safe dependencies", async () => {
    const update = vi.fn(
      async (
        _cwd: string,
        _packages: string[],
      ) => {},
    );

    const dependencies = [
      createDependency({
        name: "@types/node",
      }),
      createDependency({
        name: "typescript",
        requested: "^7.0.0",
        installed: "7.0.1",
        latest: "7.0.2",
      }),
      createDependency({
        name: "vitest",
        requested: "^5.0.0",
        installed: "5.0.2",
        latest: "5.0.3",
      }),
    ];

    const result = await fixDependencies({
      cwd: process.cwd(),
      dependencies,
      update,
    });

    expect(update).toHaveBeenCalledTimes(1);

    expect(update).toHaveBeenCalledWith(
      process.cwd(),
      [
        "@types/node",
        "typescript",
        "vitest",
      ],
    );

    expect(result).toEqual({
      updated: true,
      skipped: false,
      message: "Updated 3 dependencies.",
    });
  });

  it("does not update unsafe dependencies", async () => {
    const update = vi.fn(
      async (
        _cwd: string,
        _packages: string[],
      ) => {},
    );

    const dependencies = [
      createDependency({
        name: "@types/node",
        withinRequestedRange: true,
      }),
      createDependency({
        name: "typescript",
        withinRequestedRange: false,
        latest: "8.0.0",
      }),
    ];

    const result = await fixDependencies({
      cwd: process.cwd(),
      dependencies,
      update,
    });

    expect(update).toHaveBeenCalledTimes(1);

    expect(update).toHaveBeenCalledWith(
      process.cwd(),
      ["@types/node"],
    );

    expect(result).toEqual({
      updated: true,
      skipped: false,
      message: "Updated 1 dependency.",
    });
  });

  it("skips when there are no dependencies", async () => {
    const update = vi.fn(
      async (
        _cwd: string,
        _packages: string[],
      ) => {},
    );

    const result = await fixDependencies({
      cwd: process.cwd(),
      dependencies: [],
      update,
    });

    expect(update).not.toHaveBeenCalled();

    expect(result).toEqual({
      updated: false,
      skipped: true,
      message:
        "No safe dependency updates are available.",
    });
  });

  it("skips when all updates are unsafe", async () => {
    const update = vi.fn(
      async (
        _cwd: string,
        _packages: string[],
      ) => {},
    );

    const result = await fixDependencies({
      cwd: process.cwd(),
      dependencies: [
        createDependency({
          withinRequestedRange: false,
          latest: "27.0.0",
        }),
        createDependency({
          name: "typescript",
          withinRequestedRange: false,
          latest: "8.0.0",
        }),
      ],
      update,
    });

    expect(update).not.toHaveBeenCalled();

    expect(result).toEqual({
      updated: false,
      skipped: true,
      message:
        "No safe dependency updates are available.",
    });
  });

  it("propagates update failures", async () => {
    const update = vi.fn(
      async (
        _cwd: string,
        _packages: string[],
      ) => {
        throw new Error(
          "npm update failed",
        );
      },
    );

    await expect(
      fixDependencies({
        cwd: process.cwd(),
        dependencies: [
          createDependency(),
        ],
        update,
      }),
    ).rejects.toThrow(
      "npm update failed",
    );

    expect(update).toHaveBeenCalledTimes(1);
  });

  it("passes the provided working directory to the updater", async () => {
    const update = vi.fn(
      async (
        _cwd: string,
        _packages: string[],
      ) => {},
    );

    const cwd =
      "E:\\aks-framework-test";

    await fixDependencies({
      cwd,
      dependencies: [
        createDependency(),
      ],
      update,
    });

    expect(update).toHaveBeenCalledWith(
      cwd,
      ["@types/node"],
    );
  });

  it("does not mutate the dependency array", async () => {
    const update = vi.fn(
      async (
        _cwd: string,
        _packages: string[],
      ) => {},
    );

    const dependencies = [
      createDependency(),
      createDependency({
        name: "typescript",
        withinRequestedRange: false,
      }),
    ];

    const original = structuredClone(
      dependencies,
    );

    await fixDependencies({
      cwd: process.cwd(),
      dependencies,
      update,
    });

    expect(dependencies).toEqual(
      original,
    );
  });

  it("only passes safe dependency names to the updater", async () => {
    const update = vi.fn(
      async (
        _cwd: string,
        _packages: string[],
      ) => {},
    );

    await fixDependencies({
      cwd: process.cwd(),
      dependencies: [
        createDependency({
          name: "safe-package",
          withinRequestedRange: true,
        }),
        createDependency({
          name: "unsafe-package",
          withinRequestedRange: false,
        }),
        createDependency({
          name: "another-safe-package",
          withinRequestedRange: true,
        }),
      ],
      update,
    });

    const packages =
      update.mock.calls[0]?.[1];

    expect(packages).toEqual([
      "safe-package",
      "another-safe-package",
    ]);
  });

  it("supports an async updater", async () => {
    const calls: string[] = [];

    const update = vi.fn(
      async (
        _cwd: string,
        packages: string[],
      ) => {
        await Promise.resolve();
        calls.push(...packages);
      },
    );

    const result = await fixDependencies({
      cwd: process.cwd(),
      dependencies: [
        createDependency(),
      ],
      update,
    });

    expect(calls).toEqual([
      "@types/node",
    ]);

    expect(result.updated).toBe(true);
    expect(result.skipped).toBe(false);
  });

  it("uses exactly one update invocation for all safe dependencies", async () => {
    const update = vi.fn(
      async (
        _cwd: string,
        _packages: string[],
      ) => {},
    );

    await fixDependencies({
      cwd: process.cwd(),
      dependencies: [
        createDependency({
          name: "package-a",
        }),
        createDependency({
          name: "package-b",
        }),
        createDependency({
          name: "package-c",
        }),
      ],
      update,
    });

    expect(update).toHaveBeenCalledTimes(1);
  });

  it("does not call the updater when every dependency is outside the requested range", async () => {
    const update = vi.fn(
      async (
        _cwd: string,
        _packages: string[],
      ) => {},
    );

    await fixDependencies({
      cwd: process.cwd(),
      dependencies: [
        createDependency({
          name: "package-a",
          latest: "2.0.0",
          withinRequestedRange: false,
        }),
        createDependency({
          name: "package-b",
          latest: "3.0.0",
          withinRequestedRange: false,
        }),
        createDependency({
          name: "package-c",
          latest: "4.0.0",
          withinRequestedRange: false,
        }),
      ],
      update,
    });

    expect(update).not.toHaveBeenCalled();
  });

  it("reports the singular message for one updated dependency", async () => {
    const update = vi.fn(
      async (
        _cwd: string,
        _packages: string[],
      ) => {},
    );

    const result = await fixDependencies({
      cwd: process.cwd(),
      dependencies: [
        createDependency(),
      ],
      update,
    });

    expect(result.message).toBe(
      "Updated 1 dependency.",
    );
  });

  it("reports the plural message for multiple updated dependencies", async () => {
    const update = vi.fn(
      async (
        _cwd: string,
        _packages: string[],
      ) => {},
    );

    const result = await fixDependencies({
      cwd: process.cwd(),
      dependencies: [
        createDependency({
          name: "package-a",
        }),
        createDependency({
          name: "package-b",
        }),
      ],
      update,
    });

    expect(result.message).toBe(
      "Updated 2 dependencies.",
    );
  });
});