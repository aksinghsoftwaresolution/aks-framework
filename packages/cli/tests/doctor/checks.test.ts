import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { checkProject } from "../../src/doctor/checks/project.js";
import { checkDependencies } from "../../src/doctor/checks/dependencies.js";
import { checkTypeScript } from "../../src/doctor/checks/typescript.js";
import {
  inspectDependencies,
} from "../../src/doctor/checks/dependencies.js";

let testRoot: string;

beforeEach(async () => {
  testRoot = await mkdtemp(
    join(tmpdir(), "aks-doctor-tests-"),
  );
});

afterEach(async () => {
  vi.unstubAllGlobals();
  if (testRoot) {
  await rm(testRoot, {
    recursive: true,
    force: true,
  });
}
});

async function createTestRoot(): Promise<string> {
  testRoot = await mkdtemp(
    join(tmpdir(), "aks-doctor-tests-"),
  );

  return testRoot;
}

describe("Doctor checks", () => {
  it("detects a valid project", async () => {
    await mkdir(
      join(testRoot, "node_modules"),
      { recursive: true },
    );

    await writeFile(
      join(testRoot, "package.json"),
      "{}",
    );

    await writeFile(
      join(testRoot, "tsconfig.json"),
      "{}",
    );

    const result = await checkProject({
      cwd: testRoot,
    });

    expect(result).toEqual({
      check: "project",
      severity: "info",
      message: "Project structure looks valid.",
    });
  });

  it("detects missing package.json", async () => {
    await createTestRoot();

    const result = await checkProject({
      cwd: testRoot,
    });

    expect(result.severity).toBe("error");
    expect(result.message).toBe(
      "package.json was not found.",
    );
  });

  it("detects missing node_modules", async () => {
    await createTestRoot();

    const result = await checkDependencies({
      cwd: testRoot,
    });

    expect(result).toEqual({
      check: "dependencies",
      severity: "error",
      message: "node_modules was not found.",
      details:
        "Run npm install before running the application.",
    });
  });

  it("detects a project with no dependencies", async () => {
  await mkdir(
    join(testRoot, "node_modules"),
    { recursive: true },
  );

  await writeFile(
    join(testRoot, "package.json"),
    JSON.stringify({
      name: "test-project",
      version: "1.0.0",
    }),
  );

  const result = await checkDependencies({
    cwd: testRoot,
  });

  expect(result).toEqual({
    check: "dependencies",
    severity: "info",
    message: "No dependencies are declared.",
  });
});

it("detects installed dependencies", async () => {
  await mkdir(
    join(testRoot, "node_modules", "example-package"),
    { recursive: true },
  );

  await writeFile(
    join(testRoot, "package.json"),
    JSON.stringify({
      name: "test-project",
      version: "1.0.0",
      dependencies: {
        "example-package": "^1.0.0",
      },
    }),
  );

  await writeFile(
    join(
      testRoot,
      "node_modules",
      "example-package",
      "package.json",
    ),
    JSON.stringify({
      name: "example-package",
      version: "1.2.0",
    }),
  );

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        version: "1.2.0",
      }),
    })),
  );

  const result = await checkDependencies({
    cwd: testRoot,
  });

  expect(result).toEqual({
    check: "dependencies",
    severity: "info",
    message:
      "Dependencies are installed and up to date.",
  });
});

  it("detects TypeScript configuration", async () => {
    await createTestRoot();

    await writeFile(
      join(testRoot, "tsconfig.json"),
      "{}",
    );

    const result = await checkTypeScript({
      cwd: testRoot,
    });

    expect(result).toEqual({
      check: "typescript",
      severity: "info",
      message: "TypeScript configuration found.",
    });
  });

  it("detects missing TypeScript configuration", async () => {
    await createTestRoot();

    const result = await checkTypeScript({
      cwd: testRoot,
    });

    expect(result).toEqual({
      check: "typescript",
      severity: "warning",
      message:
        "TypeScript configuration was not found.",
    });
  });

  it("detects a missing dependency", async () => {
  await mkdir(
    join(testRoot, "node_modules"),
    { recursive: true },
  );

  await writeFile(
    join(testRoot, "package.json"),
    JSON.stringify({
      name: "test-project",
      version: "1.0.0",
      dependencies: {
        "missing-package": "^1.0.0",
      },
    }),
  );

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        version: "1.0.0",
      }),
    })),
  );

  const result = await checkDependencies({
    cwd: testRoot,
  });

  expect(result.severity).toBe("error");
  expect(result.message).toBe(
    "Dependencies are missing.",
  );
  expect(result.details).toContain(
    "missing-package requires ^1.0.0 but is not installed.",
  );
});

it("detects an incompatible installed dependency", async () => {
  await mkdir(
    join(testRoot, "node_modules", "example-package"),
    { recursive: true },
  );

  await writeFile(
    join(testRoot, "package.json"),
    JSON.stringify({
      name: "test-project",
      version: "1.0.0",
      dependencies: {
        "example-package": "^1.0.0",
      },
    }),
  );

  await writeFile(
    join(
      testRoot,
      "node_modules",
      "example-package",
      "package.json",
    ),
    JSON.stringify({
      name: "example-package",
      version: "2.0.0",
    }),
  );

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        version: "2.0.0",
      }),
    })),
  );

  const result = await checkDependencies({
    cwd: testRoot,
  });

  expect(result.severity).toBe("error");
  expect(result.message).toBe(
    "Installed dependencies do not satisfy package.json.",
  );
  expect(result.details).toContain(
    "example-package requires ^1.0.0 but 2.0.0 is installed.",
  );
});

it("detects an available newer dependency version", async () => {
  await mkdir(
    join(testRoot, "node_modules", "example-package"),
    { recursive: true },
  );

  await writeFile(
    join(testRoot, "package.json"),
    JSON.stringify({
      name: "test-project",
      version: "1.0.0",
      dependencies: {
        "example-package": "^1.0.0",
      },
    }),
  );

  await writeFile(
    join(
      testRoot,
      "node_modules",
      "example-package",
      "package.json",
    ),
    JSON.stringify({
      name: "example-package",
      version: "1.2.0",
    }),
  );

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        version: "1.3.0",
      }),
    })),
  );

  const result = await checkDependencies({
    cwd: testRoot,
  });

  expect(result).toEqual({
    check: "dependencies",
    severity: "warning",
    message:
      "Some dependencies have newer versions.",
    details:
      "example-package: installed 1.2.0, latest 1.3.0.",
  });
});

it("does not fail when the npm registry is unavailable", async () => {
  await mkdir(
    join(testRoot, "node_modules", "example-package"),
    { recursive: true },
  );

  await writeFile(
    join(testRoot, "package.json"),
    JSON.stringify({
      name: "test-project",
      version: "1.0.0",
      dependencies: {
        "example-package": "^1.0.0",
      },
    }),
  );

  await writeFile(
    join(
      testRoot,
      "node_modules",
      "example-package",
      "package.json",
    ),
    JSON.stringify({
      name: "example-package",
      version: "1.2.0",
    }),
  );

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("Network unavailable");
    }),
  );

  const result = await checkDependencies({
    cwd: testRoot,
  });

  expect(result).toEqual({
  check: "dependencies",
  severity: "warning",
  message:
    "Dependencies are installed, but latest versions could not be checked.",
  details:
    "The npm registry could not be reached or returned invalid package metadata.",
});
});

it("identifies safe dependency updates", async () => {
  await mkdir(
    join(testRoot, "node_modules", "example-package"),
    { recursive: true },
  );

  await writeFile(
    join(testRoot, "package.json"),
    JSON.stringify({
      dependencies: {
        "example-package": "^1.0.0",
      },
    }),
  );

  await writeFile(
    join(
      testRoot,
      "node_modules",
      "example-package",
      "package.json",
    ),
    JSON.stringify({
      version: "1.2.0",
    }),
  );

  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: "1.3.0",
      }),
    }),
  );

  const inspection =
    await inspectDependencies({
      cwd: testRoot,
    });

  expect(
    inspection.outdated,
  ).toEqual([
    {
      name: "example-package",
      requested: "^1.0.0",
      installed: "1.2.0",
      latest: "1.3.0",
      withinRequestedRange: true,
    },
  ]);
});

it("marks latest versions outside the requested range as unsafe", async () => {
  await mkdir(
    join(testRoot, "node_modules", "example-package"),
    { recursive: true },
  );

  await writeFile(
    join(testRoot, "package.json"),
    JSON.stringify({
      dependencies: {
        "example-package": "^1.0.0",
      },
    }),
  );

  await writeFile(
    join(
      testRoot,
      "node_modules",
      "example-package",
      "package.json",
    ),
    JSON.stringify({
      version: "1.2.0",
    }),
  );

  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: "2.0.0",
      }),
    }),
  );

  const inspection =
    await inspectDependencies({
      cwd: testRoot,
    });

  expect(
    inspection.outdated,
  ).toEqual([
    {
      name: "example-package",
      requested: "^1.0.0",
      installed: "1.2.0",
      latest: "2.0.0",
      withinRequestedRange: false,
    },
  ]);
});


});