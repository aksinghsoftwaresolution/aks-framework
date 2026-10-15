import { access } from "node:fs/promises";
import { join } from "node:path";

import type {
  DiagnosticResult,
  DoctorContext,
} from "../types.js";

export async function checkTypeScript(
  context: DoctorContext,
): Promise<DiagnosticResult> {
  try {
    await access(
      join(context.cwd, "tsconfig.json"),
    );

    return {
      check: "typescript",
      severity: "info",
      message: "TypeScript configuration found.",
    };
  } catch {
    return {
      check: "typescript",
      severity: "warning",
      message: "TypeScript configuration was not found.",
    };
  }
}