import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  runDoctor,
} from "../../src/commands/doctor.js";

import type {
  DependencyInspection,
  DependencyUpdate,
} from "../../src/doctor/checks/dependencies.js";

import type {
  DoctorContext,
} from "../../src/doctor/types.js";

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

function createInspection(
  dependencies: DependencyUpdate[] = [],
): DependencyInspection {
  return {
    dependencies,
    outdated: dependencies,
    missing: [],
    incompatible: [],
    registryUnavailable: [],
    unsupportedSpecs: [],
  };
}

function mockInspection(
  dependencies: DependencyUpdate[] = [],
) {
  return vi.fn(
    async (
      _context: DoctorContext,
    ): Promise<DependencyInspection> => {
      return createInspection(dependencies);
    },
  );
}

describe("runDoctor", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.exitCode = undefined;

    logSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            version: "26.6.4",
          }),
          {
            status: 200,
            headers: {
              "content-type":
                "application/json",
            },
          },
        );
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();

    process.exitCode = undefined;
  });

  it("does not update dependencies without --fix", async () => {
    const inspectDependencies =
      mockInspection([
        createDependency(),
      ]);

    const fixDependencies =
      vi.fn(async () => ({
        updated: true,
        skipped: false,
        message:
          "Updated 1 dependency.",
      }));

    const confirm =
      vi.fn(async () => true);

    await runDoctor({
      inspectDependencies,
      fixDependencies,
      confirm,
    });

    expect(inspectDependencies)
      .not.toHaveBeenCalled();

    expect(fixDependencies)
      .not.toHaveBeenCalled();

    expect(confirm)
      .not.toHaveBeenCalled();

    expect(process.exitCode)
      .toBeUndefined();

    expect(logSpy)
      .toHaveBeenCalled();
  });

  it("does not update dependencies when --fix is declined", async () => {
    const dependency =
      createDependency();

    const inspectDependencies =
      mockInspection([
        dependency,
      ]);

    const fixDependencies =
      vi.fn(async () => ({
        updated: true,
        skipped: false,
        message:
          "Updated 1 dependency.",
      }));

    const confirm =
      vi.fn(async () => false);

    await runDoctor({
      fix: true,
      inspectDependencies,
      fixDependencies,
      confirm,
    });

    expect(inspectDependencies)
      .toHaveBeenCalledTimes(1);

    expect(confirm)
      .toHaveBeenCalledTimes(1);

    expect(confirm)
      .toHaveBeenCalledWith(
        "Update dependencies?",
      );

    expect(fixDependencies)
      .not.toHaveBeenCalled();

    expect(logSpy)
      .toHaveBeenCalledWith(
        "Dependency updates were skipped.",
      );

    expect(process.exitCode)
      .toBeUndefined();
  });

  it("updates dependencies when --fix is approved", async () => {
    const dependency =
      createDependency();

    const inspectDependencies =
      mockInspection([
        dependency,
      ]);

    const fixDependencies =
      vi.fn(async () => ({
        updated: true,
        skipped: false,
        message:
          "Updated 1 dependency.",
      }));

    const confirm =
      vi.fn(async () => true);

    await runDoctor({
      fix: true,
      inspectDependencies,
      fixDependencies,
      confirm,
    });

    expect(inspectDependencies)
      .toHaveBeenCalledTimes(1);

    expect(confirm)
      .toHaveBeenCalledTimes(1);

    expect(fixDependencies)
      .toHaveBeenCalledTimes(1);

    expect(fixDependencies)
      .toHaveBeenCalledWith({
        cwd: process.cwd(),
        dependencies: [
          dependency,
        ],
      });

    expect(logSpy)
      .toHaveBeenCalledWith(
        "Updated 1 dependency.",
      );

    expect(process.exitCode)
      .toBeUndefined();
  });

  it("updates only safe dependencies", async () => {
    const safe =
      createDependency({
        name: "safe-package",
        withinRequestedRange: true,
      });

    const unsafe =
      createDependency({
        name: "unsafe-package",
        latest: "2.0.0",
        withinRequestedRange: false,
      });

    const inspectDependencies =
      mockInspection([
        safe,
        unsafe,
      ]);

    const fixDependencies =
      vi.fn(async () => ({
        updated: true,
        skipped: false,
        message:
          "Updated 1 dependency.",
      }));

    const confirm =
      vi.fn(async () => true);

    await runDoctor({
      fix: true,
      inspectDependencies,
      fixDependencies,
      confirm,
    });

    expect(fixDependencies)
      .toHaveBeenCalledTimes(1);

    expect(fixDependencies)
      .toHaveBeenCalledWith({
        cwd: process.cwd(),
        dependencies: [
          safe,
        ],
      });

    expect(logSpy)
      .toHaveBeenCalledWith(
        "\nThe following latest versions are outside the requested version ranges:",
      );

    expect(logSpy)
      .toHaveBeenCalledWith(
        "  unsafe-package: 26.6.3 → 2.0.0",
      );

    expect(process.exitCode)
      .toBeUndefined();
  });

  it("does not mutate dependencies with --fix --json", async () => {
    const dependency =
      createDependency();

    const inspectDependencies =
      mockInspection([
        dependency,
      ]);

    const fixDependencies =
      vi.fn(async () => ({
        updated: true,
        skipped: false,
        message:
          "Updated 1 dependency.",
      }));

    const confirm =
      vi.fn(async () => true);

    await runDoctor({
      fix: true,
      json: true,
      inspectDependencies,
      fixDependencies,
      confirm,
    });

    expect(fixDependencies)
      .not.toHaveBeenCalled();

    expect(confirm)
      .not.toHaveBeenCalled();

    expect(logSpy)
      .toHaveBeenCalledTimes(1);

    const output =
      logSpy.mock.calls[0]?.[0];

    expect(typeof output)
      .toBe("string");

    expect(() => {
      JSON.parse(
        String(output),
      );
    }).not.toThrow();

    expect(process.exitCode)
      .toBeUndefined();
  });

  it("reports no safe updates when only unsafe updates exist", async () => {
    const unsafe =
      createDependency({
        name: "unsafe-package",
        latest: "99.0.0",
        withinRequestedRange: false,
      });

    const inspectDependencies =
      mockInspection([
        unsafe,
      ]);

    const fixDependencies =
      vi.fn(async () => ({
        updated: true,
        skipped: false,
        message:
          "Updated 1 dependency.",
      }));

    const confirm =
      vi.fn(async () => true);

    await runDoctor({
      fix: true,
      inspectDependencies,
      fixDependencies,
      confirm,
    });

    expect(confirm)
      .not.toHaveBeenCalled();

    expect(fixDependencies)
      .not.toHaveBeenCalled();

    expect(logSpy)
      .toHaveBeenCalledWith(
        "\nNo safe dependency updates are available.",
      );

    expect(process.exitCode)
      .toBeUndefined();
  });

  it("handles dependency update failures", async () => {
    const dependency =
      createDependency();

    const inspectDependencies =
      mockInspection([
        dependency,
      ]);

    const fixDependencies =
      vi.fn(async () => {
        throw new Error(
          "npm update failed",
        );
      });

    const confirm =
      vi.fn(async () => true);

    await runDoctor({
      fix: true,
      inspectDependencies,
      fixDependencies,
      confirm,
    });

    expect(fixDependencies)
      .toHaveBeenCalledTimes(1);

    expect(errorSpy)
      .toHaveBeenCalledWith(
        "Failed to update dependencies.",
      );

    expect(errorSpy)
      .toHaveBeenCalledWith(
        "npm update failed",
      );

    expect(process.exitCode)
      .toBe(1);
  });

  it("reruns Doctor after a successful dependency update", async () => {
    const dependency =
      createDependency();

    const inspectDependencies =
      mockInspection([
        dependency,
      ]);

    const fixDependencies =
      vi.fn(async () => ({
        updated: true,
        skipped: false,
        message:
          "Updated 1 dependency.",
      }));

    const confirm =
      vi.fn(async () => true);

    await runDoctor({
      fix: true,
      inspectDependencies,
      fixDependencies,
      confirm,
    });

    expect(inspectDependencies)
      .toHaveBeenCalledTimes(1);

    expect(logSpy)
      .toHaveBeenCalledWith(
        "\nDoctor after fix:",
      );

    expect(logSpy.mock.calls.length)
      .toBeGreaterThanOrEqual(3);

    expect(process.exitCode)
      .toBeUndefined();
  });

  it("does not set exitCode when Doctor completes successfully", async () => {
    const inspectDependencies =
      mockInspection();

    await runDoctor({
      inspectDependencies,
    });

    expect(process.exitCode)
      .toBeUndefined();
  });
});