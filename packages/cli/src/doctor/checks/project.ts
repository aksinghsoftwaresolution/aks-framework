import { access } from "node:fs/promises";
import { join } from "node:path";

import type {
  DiagnosticResult,
  DoctorContext,
} from "../types.js";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function checkProject(
  context: DoctorContext,
): Promise<DiagnosticResult> {
  const packageJson = await exists(
    join(context.cwd, "package.json"),
  );

  const tsconfig = await exists(
    join(context.cwd, "tsconfig.json"),
  );

  if (!packageJson) {
    return {
      check: "project",
      severity: "error",
      message: "package.json was not found.",
      details: `Project root: ${context.cwd}`,
    };
  }

  if (!tsconfig) {
    return {
      check: "project",
      severity: "warning",
      message: "tsconfig.json was not found.",
      details: `Project root: ${context.cwd}`,
    };
  }

  return {
    check: "project",
    severity: "info",
    message: "Project structure looks valid.",
  };
}