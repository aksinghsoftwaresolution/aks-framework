
import {
  access,
  readFile,
} from "node:fs/promises";

import { join } from "node:path";
import {
  gt,
  prerelease,
  valid,
} from "semver";

interface ProjectPackageJson {
  packageManager?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface InstalledPackageJson {
  version?: unknown;
}

interface RegistryPackage {
  version?: unknown;
}

type PackageManager = "npm" | "pnpm" | "yarn";

interface UpdateTarget {
  name: string;
  installed: string;
  latest: string;
}

async function readJson<T>(
  path: string,
): Promise<T | undefined> {
  try {
    return JSON.parse(
      await readFile(path, "utf8"),
    ) as T;
  } catch {
    return undefined;
  }
}

async function detectPackageManager(
  cwd: string,
  packageJson: ProjectPackageJson,
): Promise<PackageManager> {
  const declared = packageJson.packageManager;

  if (declared?.startsWith("pnpm@")) {
    return "pnpm";
  }

  if (declared?.startsWith("yarn@")) {
    return "yarn";
  }

  if (declared?.startsWith("npm@")) {
    return "npm";
  }

  for (const [file, manager] of [
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["package-lock.json", "npm"],
  ] as const) {
    try {
      await access(join(cwd, file));
      return manager;
    } catch {
      // Try the next lockfile.
    }
  }

  return "npm";
}

async function getInstalledVersion(
  cwd: string,
  packageName: string,
): Promise<string | undefined> {
  const packagePath = join(
    cwd,
    "node_modules",
    ...packageName.split("/"),
    "package.json",
  );

  const packageJson =
    await readJson<InstalledPackageJson>(packagePath);

  if (typeof packageJson?.version !== "string") {
    return undefined;
  }

  return valid(packageJson.version) ?? undefined;
}

async function getLatestStableVersion(
  packageName: string,
  fetchFn: typeof fetch,
): Promise<string | undefined> {
  try {
    const response = await fetchFn(
      `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`,
      {
        headers: {
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(5_000),
      },
    );

    if (!response.ok) {
      return undefined;
    }

    const data =
      (await response.json()) as RegistryPackage;

    if (typeof data.version !== "string") {
      return undefined;
    }

    const version = valid(data.version);

    if (!version || prerelease(version) !== null) {
      return undefined;
    }

    return version;
  } catch {
    return undefined;
  }
}

export interface UpdateOptions {
  cwd?: string;
  dryRun?: boolean;
  fetch?: typeof fetch;
}

export async function runUpdate(
  options: UpdateOptions = {},
): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const fetchFn = options.fetch ?? fetch;

  console.log("AKS Framework Update");
  console.log("");

  const packageJson =
    await readJson<ProjectPackageJson>(
      join(cwd, "package.json"),
    );

  if (!packageJson) {
    console.error(
      "Could not read package.json in the current directory.",
    );
    process.exitCode = 1;
    return;
  }

  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const packageNames = [
    "@aks-framework/core",
    "@aks-framework/cli",
  ].filter(name => Boolean(dependencies[name]));

  if (packageNames.length === 0) {
    console.log(
      "No AKS Framework dependencies were found in package.json.",
    );
    return;
  }

  const targets: UpdateTarget[] = [];
  let failedChecks = 0;

  for (const name of packageNames) {
    const latest = await getLatestStableVersion(
      name,
      fetchFn,
    );

    if (!latest) {
      failedChecks++;

      console.log(
        `Could not check ${name}. The package may not be published, or the registry may be unavailable.`,
      );

      continue;
    }

    const installed = await getInstalledVersion(
      cwd,
      name,
    );

    if (!installed) {
      failedChecks++;

      console.log(
        `Could not determine the installed version of ${name}; skipping comparison.`,
      );

      continue;
    }

    if (gt(latest, installed)) {
      targets.push({
        name,
        installed,
        latest,
      });
    }
  }

  if (targets.length === 0) {
    console.log("");

    if (failedChecks > 0) {
      console.log("No updates could be confirmed.");
      console.log(
        "Resolve the package or registry checks above and try again.",
      );
    } else {
      console.log(
        "All checked AKS Framework packages are up to date.",
      );
    }

    return;
  }

  console.log("");
  console.log("Updates available:");

  for (const target of targets) {
    console.log(
      `  ${target.name}: ${target.installed} → ${target.latest}`,
    );
  }

  const packageManager =
    await detectPackageManager(cwd, packageJson);

  const packages = targets
    .map(target => `${target.name}@${target.latest}`)
    .join(" ");

  const command =
    packageManager === "npm"
      ? `npm install ${packages}`
      : packageManager === "pnpm"
        ? `pnpm add ${packages}`
        : `yarn add ${packages}`;

  console.log("");
  console.log("Proposed command:");
  console.log(`  ${command}`);

  if (options.dryRun) {
    console.log("");
    console.log("Dry run: no files were changed.");
    return;
  }

  console.log("");
  console.log(
    "Automatic installation is not enabled yet.",
  );
  console.log(
    "Review the proposed command and run it manually when you are ready.",
  );
}
