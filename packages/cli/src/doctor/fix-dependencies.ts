import {
  execFile,
} from "node:child_process";

import type {
  DependencyUpdate,
} from "./checks/dependencies.js";

export interface FixDependenciesOptions {
  cwd: string;
  dependencies: DependencyUpdate[];
  update?: (
    cwd: string,
    packages: string[],
  ) => Promise<void>;
}

export interface FixDependenciesResult {
  updated: boolean;
  skipped: boolean;
  message: string;
}

function runNpmUpdate(
  cwd: string,
  packages: string[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const command =
      process.platform === "win32"
        ? "npm.cmd"
        : "npm";

    const child = execFile(
      command,
      [
        "update",
        ...packages,
      ],
      {
        cwd,
        windowsHide: false,
      },
    );

    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);

    child.once("error", reject);

    child.once("exit", code => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `npm update exited with code ${code ?? "unknown"}.`,
        ),
      );
    });
  });
}

export async function fixDependencies(
  options: FixDependenciesOptions,
): Promise<FixDependenciesResult> {
  const safeUpdates =
    options.dependencies.filter(
      dependency =>
        dependency.withinRequestedRange,
    );

  if (safeUpdates.length === 0) {
    return {
      updated: false,
      skipped: true,
      message:
        "No safe dependency updates are available.",
    };
  }

  const packageNames = safeUpdates.map(
    dependency => dependency.name,
  );

  const update =
    options.update ?? runNpmUpdate;

  await update(
    options.cwd,
    packageNames,
  );

  return {
  updated: true,
  skipped: false,
  message:
    `Updated ${packageNames.length} ${
      packageNames.length === 1
        ? "dependency"
        : "dependencies"
    }.`,
};
}