import { DoctorRunner } from "../doctor/doctor.js";

import {
  checkDependencies,
  inspectDependencies,
} from "../doctor/checks/dependencies.js";

import { checkFramework } from "../doctor/checks/framework.js";
import { checkProject } from "../doctor/checks/project.js";
import { checkRuntime } from "../doctor/checks/runtime.js";
import { checkTypeScript } from "../doctor/checks/typescript.js";
import { checkPackageJson } from "../doctor/checks/package-json.js";

import { formatDoctorResults } from "../doctor/formatter.js";
import { formatDoctorResultsJson } from "../doctor/json-formatter.js";

import { fixDependencies } from "../doctor/fix-dependencies.js";
import { confirm } from "../doctor/prompt.js";

export interface DoctorOptions {
  json?: boolean;
  fix?: boolean;

  confirm?: (
    question: string,
  ) => Promise<boolean>;

  inspectDependencies?: typeof import(
    "../doctor/checks/dependencies.js"
  ).inspectDependencies;

  fixDependencies?: typeof import(
    "../doctor/fix-dependencies.js"
  ).fixDependencies;
}

export async function runDoctor(
  options: DoctorOptions = {},
): Promise<void> {

  const confirmUpdate =
    options.confirm ?? confirm;

  const applyDependencyFix =
    options.fixDependencies ?? fixDependencies;

  const inspect =
    options.inspectDependencies ??
    inspectDependencies;

  const cwd = process.cwd();

  const runner = new DoctorRunner([
    checkFramework,
    checkRuntime,
    checkProject,
    checkPackageJson,
    checkDependencies,
    checkTypeScript,
  ]);

  let results = await runner.run({ cwd });

  /*
   * Normal diagnostic output.
   */
  if (options.json) {
    console.log(
      formatDoctorResultsJson(results),
    );
  } else {
    console.log(
      formatDoctorResults(results),
    );
  }

  /*
   * Without --fix, doctor is read-only.
   */
  if (!options.fix) {
    if (
      results.some(
        result => result.severity === "error",
      )
    ) {
      process.exitCode = 1;
    }

    return;
  }

  /*
   * JSON output must remain machine-readable.
   * Do not prompt or mutate in JSON mode.
   */
  if (options.json) {
    return;
  }

  /*
   * Inspect dependency updates.
   */
  const inspection =
  await inspect({ cwd });

  const safeUpdates =
    inspection.outdated.filter(
      dependency =>
        dependency.withinRequestedRange,
    );

  const unsafeUpdates =
    inspection.outdated.filter(
      dependency =>
        !dependency.withinRequestedRange,
    );


  /*
   * Never automatically install updates
   * outside package.json version ranges.
   */
  if (unsafeUpdates.length > 0) {
    console.log(
      "\nThe following latest versions are outside the requested version ranges:",
    );

    for (const dependency of unsafeUpdates) {
      console.log(
        `  ${dependency.name}: ${dependency.installed} → ${dependency.latest}`,
      );
    }

    console.log(
      "These versions will not be installed automatically.",
    );
  }

  /*
   * Nothing safe to update.
   */
  if (safeUpdates.length === 0) {
    console.log(
      "\nNo safe dependency updates are available.",
    );

    if (
      results.some(
        result => result.severity === "error",
      )
    ) {
      process.exitCode = 1;
    }

    return;
  }

  /*
   * Show safe updates.
   */
  console.log(
    "\nSafe dependency updates available:",
  );

  for (const dependency of safeUpdates) {
    console.log(
      `  ${dependency.name}: ${dependency.installed} → ${dependency.latest}`,
    );
  }

  /*
   * Ask for explicit confirmation.
   */
  const approved =
  await confirmUpdate(
    "Update dependencies?",
  );

  if (!approved) {
    console.log(
      "Dependency updates were skipped.",
    );

    if (
      results.some(
        result => result.severity === "error",
      )
    ) {
      process.exitCode = 1;
    }

    return;
  }

  /*
   * Apply safe updates.
   */
  try {
    const fixResult =
  await applyDependencyFix({
    cwd,
    dependencies: safeUpdates,
  });

    console.log(
      fixResult.message,
    );

    /*
     * Re-run diagnostics after the update.
     */
    results = await runner.run({ cwd });

    console.log(
      "\nDoctor after fix:",
    );

    console.log(
      formatDoctorResults(results),
    );
  } catch (error) {
    console.error(
      "Failed to update dependencies.",
    );

    if (error instanceof Error) {
      console.error(error.message);
    }

    process.exitCode = 1;

    return;
  }

  /*
   * Final exit status.
   */
  if (
    results.some(
      result => result.severity === "error",
    )
  ) {
    process.exitCode = 1;
  }
}