
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";

import { tmpdir } from "node:os";
import { join } from "node:path";

import { runUpdate } from "../../src/commands/update.js";

const temporaryDirectories: string[] = [];

async function createProject(options: {
  requestedVersion?: string;
  installedVersion?: string;
  packageManager?: string;
} = {}): Promise<string> {
  const cwd = await mkdtemp(
    join(tmpdir(), "aks-update-"),
  );

  temporaryDirectories.push(cwd);

  const packageJson = {
    name: "update-test-project",
    version: "1.0.0",
    ...(options.packageManager
      ? { packageManager: options.packageManager }
      : {}),
    dependencies: {
      "@aks-framework/cli":
        options.requestedVersion ?? "^0.1.0",
    },
  };

  await writeFile(
    join(cwd, "package.json"),
    JSON.stringify(packageJson, null, 2),
  );

  const installedPackageDirectory = join(
    cwd,
    "node_modules",
    "@aks-framework",
    "cli",
  );

  await mkdir(installedPackageDirectory, {
    recursive: true,
  });

  await writeFile(
    join(installedPackageDirectory, "package.json"),
    JSON.stringify({
      name: "@aks-framework/cli",
      version: options.installedVersion ?? "0.1.0",
    }),
  );

  return cwd;
}

function registryResponse(
  version: string,
): Response {
  return new Response(
    JSON.stringify({ version }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}

describe("runUpdate", () => {
  afterEach(async () => {
    vi.restoreAllMocks();

    await Promise.all(
      temporaryDirectories.splice(0).map(directory =>
        rm(directory, {
          recursive: true,
          force: true,
        }),
      ),
    );
  });

  it("handles unpublished packages without throwing", async () => {
    const cwd = await createProject();

    const log = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const fetchFn = vi.fn(async () =>
      new Response(null, { status: 404 }),
    ) as unknown as typeof fetch;

    await runUpdate({
      cwd,
      dryRun: true,
      fetch: fetchFn,
    });

    expect(log).toHaveBeenCalledWith(
      "No updates could be confirmed.",
    );

    expect(error).not.toHaveBeenCalled();
  });

  it("compares the latest version with the installed version", async () => {
    const cwd = await createProject({
      requestedVersion: "^0.0.1",
      installedVersion: "0.1.0",
      packageManager: "pnpm@9.0.0",
    });

    const log = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    const fetchFn = vi.fn(async () =>
      registryResponse("0.2.0"),
    ) as unknown as typeof fetch;

    await runUpdate({
      cwd,
      dryRun: true,
      fetch: fetchFn,
    });

    expect(log).toHaveBeenCalledWith(
      "  @aks-framework/cli: 0.1.0 → 0.2.0",
    );

    expect(log).toHaveBeenCalledWith(
      "  pnpm add @aks-framework/cli@0.2.0",
    );

    expect(log).toHaveBeenCalledWith(
      "Dry run: no files were changed.",
    );
  });

  it("reports when all checked packages are up to date", async () => {
    const cwd = await createProject({
      installedVersion: "0.1.0",
    });

    const log = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    const fetchFn = vi.fn(async () =>
      registryResponse("0.1.0"),
    ) as unknown as typeof fetch;

    await runUpdate({
      cwd,
      fetch: fetchFn,
    });

    expect(log).toHaveBeenCalledWith(
      "All checked AKS Framework packages are up to date.",
    );
  });

  it("does not modify project files during a dry run", async () => {
    const cwd = await createProject({
      installedVersion: "0.1.0",
    });

    const packageJsonPath = join(cwd, "package.json");
    const installedPackagePath = join(
      cwd,
      "node_modules",
      "@aks-framework",
      "cli",
      "package.json",
    );

    const packageJsonBefore = await readFile(
      packageJsonPath,
      "utf8",
    );

    const installedPackageBefore = await readFile(
      installedPackagePath,
      "utf8",
    );

    vi.spyOn(console, "log").mockImplementation(() => {});

    const fetchFn = vi.fn(async () =>
      registryResponse("0.2.0"),
    ) as unknown as typeof fetch;

    await runUpdate({
      cwd,
      dryRun: true,
      fetch: fetchFn,
    });

    expect(
      await readFile(packageJsonPath, "utf8"),
    ).toBe(packageJsonBefore);

    expect(
      await readFile(installedPackagePath, "utf8"),
    ).toBe(installedPackageBefore);
  });

  it("does not recommend prerelease versions", async () => {
    const cwd = await createProject();

    const log = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    const fetchFn = vi.fn(async () =>
      registryResponse("0.2.0-beta.1"),
    ) as unknown as typeof fetch;

    await runUpdate({
      cwd,
      dryRun: true,
      fetch: fetchFn,
    });

    expect(log).toHaveBeenCalledWith(
      "No updates could be confirmed.",
    );
  });
});
