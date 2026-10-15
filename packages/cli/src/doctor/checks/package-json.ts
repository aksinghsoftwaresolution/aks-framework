import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type {
  DiagnosticResult,
  DoctorContext,
} from "../types.js";

interface PackageJson {
  name?: unknown;
  version?: unknown;
  scripts?: unknown;
  dependencies?: unknown;
  devDependencies?: unknown;
}

export async function checkPackageJson(
  context: DoctorContext,
): Promise<DiagnosticResult> {
  const packagePath = join(
    context.cwd,
    "package.json",
  );

  let packageJson: PackageJson;

  try {
    const content = await readFile(
      packagePath,
      "utf8",
    );

    packageJson = JSON.parse(content) as PackageJson;
  } catch (error) {
    return {
      check: "package.json",
      severity: "error",
      message: "package.json could not be read.",
      details:
        error instanceof Error
          ? error.message
          : String(error),
    };
  }

  const problems: string[] = [];

  if (
    typeof packageJson.name !== "string" ||
    packageJson.name.trim() === ""
  ) {
    problems.push("Missing package name.");
  }

  if (
    typeof packageJson.version !== "string" ||
    packageJson.version.trim() === ""
  ) {
    problems.push("Missing package version.");
  }

  if (
    packageJson.scripts !== undefined &&
    (
      typeof packageJson.scripts !== "object" ||
      packageJson.scripts === null
    )
  ) {
    problems.push("The scripts field must be an object.");
  }

  if (
    packageJson.dependencies !== undefined &&
    (
      typeof packageJson.dependencies !== "object" ||
      packageJson.dependencies === null
    )
  ) {
    problems.push(
      "The dependencies field must be an object.",
    );
  }

  if (
    packageJson.devDependencies !== undefined &&
    (
      typeof packageJson.devDependencies !== "object" ||
      packageJson.devDependencies === null
    )
  ) {
    problems.push(
      "The devDependencies field must be an object.",
    );
  }

  if (problems.length > 0) {
    return {
      check: "package.json",
      severity: "error",
      message: "package.json has configuration problems.",
      details: problems.join(" "),
    };
  }

  return {
    check: "package.json",
    severity: "info",
    message: "package.json configuration looks valid.",
  };
}