import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  compare,
  satisfies,
  validRange,
} from "semver";

import type {
  DiagnosticResult,
  DoctorContext,
} from "../types.js";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface InstalledPackageJson {
  version?: string;
}

export interface DependencyInfo {
  name: string;
  requested: string;
  installed?: string;
  latest?: string;
  registryCheckable: boolean;
}

export interface DependencyUpdate {
  name: string;
  requested: string;
  installed: string;
  latest: string;
  withinRequestedRange: boolean;
}

export interface DependencyInspection {
  dependencies: DependencyInfo[];
  outdated: DependencyUpdate[];
  missing: DependencyInfo[];
  incompatible: DependencyInfo[];
  registryUnavailable: DependencyInfo[];
  unsupportedSpecs: DependencyInfo[];
}

async function readJson<T>(
  path: string,
): Promise<T | undefined> {
  try {
    const content = await readFile(path, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return undefined;
  }
}

type RegistryResult =
  | {
      available: true;
      version: string;
    }
  | {
      available: false;
      reason: string;
    };

async function getLatestVersion(
  packageName: string,
): Promise<RegistryResult> {
  try {
    const response = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`,
      {
        headers: {
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(5_000),
      },
    );

    if (!response.ok) {
      return {
        available: false,
        reason:
          `Registry returned HTTP ${response.status}.`,
      };
    }

    const data = (await response.json()) as {
      version?: unknown;
    };

    if (typeof data.version !== "string") {
      return {
        available: false,
        reason:
          "Registry response did not contain a valid version.",
      };
    }

    return {
      available: true,
      version: data.version,
    };
  } catch (error) {
    return {
      available: false,
      reason:
        error instanceof Error
          ? error.message
          : String(error),
    };
  }
}

async function inspectDependency(
  cwd: string,
  name: string,
  requested: string,
  checkRegistry: boolean,
): Promise<DependencyInfo> {

  const installedPackagePath = join(
    cwd,
    "node_modules",
    name,
    "package.json",
  );

  const installedPackage =
    await readJson<InstalledPackageJson>(
      installedPackagePath,
    );

  const registryCheckable =
    validRange(requested) !== null;

  const registryResult =
  checkRegistry && registryCheckable
    ? await getLatestVersion(name)
    : undefined;

const latest =
  registryResult?.available
    ? registryResult.version
    : undefined;

  return {
    name,
    requested,
    installed: installedPackage?.version,
    latest,
    registryCheckable,
  };
}

export async function inspectDependencies(
  context: DoctorContext,
  options: { checkRegistry?: boolean } = {},
): Promise<DependencyInspection> {
  const checkRegistry = options.checkRegistry ?? true;

  const packagePath = join(
    context.cwd,
    "package.json",
  );

  const packageJson =
    await readJson<PackageJson>(packagePath);

  if (!packageJson) {
    return {
      dependencies: [],
      outdated: [],
      missing: [],
      incompatible: [],
      registryUnavailable: [],
      unsupportedSpecs: [],
    };
  }

  const dependencyVersions = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const names = Object.keys(dependencyVersions);

  const dependencies = await Promise.all(
    names.map(name =>
      inspectDependency(
        context.cwd,
        name,
        dependencyVersions[name],
        checkRegistry,
      ),
    ),
  );

  const missing = dependencies.filter(
    dependency => !dependency.installed,
  );

  const incompatible = dependencies.filter(
    dependency =>
      dependency.installed &&
      dependency.registryCheckable &&
      !satisfies(
        dependency.installed,
        dependency.requested,
      ),
  );

  const unsupportedSpecs = dependencies.filter(
    dependency => !dependency.registryCheckable,
  );

  const outdated = dependencies
    .filter(
      dependency =>
        dependency.installed &&
        dependency.latest &&
        compare(
          dependency.installed,
          dependency.latest,
        ) < 0,
    )
    .map(dependency => ({
      name: dependency.name,
      requested: dependency.requested,
      installed: dependency.installed!,
      latest: dependency.latest!,
      withinRequestedRange: satisfies(
        dependency.latest!,
        dependency.requested,
      ),
    }));

  const registryUnavailable = checkRegistry ? dependencies.filter(
    dependency =>
      dependency.registryCheckable &&
      !dependency.latest,
  ):[];

  return {
    dependencies,
    outdated,
    missing,
    incompatible,
    registryUnavailable,
    unsupportedSpecs,
  };
}

export async function checkDependencies(
  context: DoctorContext,
): Promise<DiagnosticResult> {
  try {
    await access(
      join(context.cwd, "node_modules"),
    );
  } catch {
    return {
      check: "dependencies",
      severity: "error",
      message: "node_modules was not found.",
      details:
        "Run npm install before running the application.",
    };
  }

  const packagePath = join(
    context.cwd,
    "package.json",
  );

  const packageJson =
    await readJson<PackageJson>(packagePath);

  if (!packageJson) {
    return {
      check: "dependencies",
      severity: "error",
      message: "package.json could not be read.",
    };
  }

  const dependencyNames = Object.keys({
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  });

  if (dependencyNames.length === 0) {
    return {
      check: "dependencies",
      severity: "info",
      message: "No dependencies are declared.",
    };
  }

  const inspection =
    await inspectDependencies(context, { checkRegistry: false },);

  if (inspection.missing.length > 0) {
    return {
      check: "dependencies",
      severity: "error",
      message: "Dependencies are missing.",
      details: inspection.missing
        .map(
          dependency =>
            `${dependency.name} requires ${dependency.requested} but is not installed.`,
        )
        .join(" "),
    };
  }

  if (inspection.incompatible.length > 0) {
    return {
      check: "dependencies",
      severity: "error",
      message:
        "Installed dependencies do not satisfy package.json.",
      details: inspection.incompatible
        .map(
          dependency =>
            `${dependency.name} requires ${dependency.requested} but ${dependency.installed} is installed.`,
        )
        .join(" "),
    };
  }

  if (inspection.outdated.length > 0) {
    return {
      check: "dependencies",
      severity: "warning",
      message:
        "Some dependencies have newer versions.",
      details: inspection.outdated
        .map(dependency =>
          dependency.withinRequestedRange
            ? `${dependency.name}: installed ${dependency.installed}, latest ${dependency.latest}.`
            : `${dependency.name}: installed ${dependency.installed}, latest ${dependency.latest} (outside requested range ${dependency.requested}).`,
        )
        .join(" "),
    };
  }

  if (inspection.registryUnavailable.length > 0) {
    return {
      check: "dependencies",
      severity: "warning",
      message:
        "Dependencies are installed, but latest versions could not be checked.",
      details:
        "The npm registry could not be reached or returned invalid package metadata.",
    };
  }

  if (inspection.unsupportedSpecs.length > 0) {
    return {
      check: "dependencies",
      severity: "info",
      message:
        "Dependencies are installed; some version specifications could not be compared.",
      details: inspection.unsupportedSpecs
        .map(
          dependency =>
            `${dependency.name}: ${dependency.requested}`,
        )
        .join(" "),
    };
  }

  return {
    check: "dependencies",
    severity: "info",
    message:
      "Dependencies are installed and satisfy package.json.",
  };
}