import { DoctorRunner } from "../doctor/doctor.js";
import { checkDependencies } from "../doctor/checks/dependencies.js";
import { checkFramework } from "../doctor/checks/framework.js";
import { checkPackageJson } from "../doctor/checks/package-json.js";
import { checkProject } from "../doctor/checks/project.js";
import { checkRuntime } from "../doctor/checks/runtime.js";
import { checkTypeScript } from "../doctor/checks/typescript.js";
import { formatDoctorResults } from "../doctor/formatter.js";
import type { DiagnosticResult } from "../doctor/types.js";
import type { DoctorCheck } from "../doctor/types.js";

export interface DiagnoseOptions {
  json?: boolean;
  cwd?: string;
  checks?: DoctorCheck[];
  log?: (message: string) => void;
}

export function formatDiagnoseResultsJson(results: DiagnosticResult[]): string {
  return JSON.stringify(
    {
      command: "diagnose",
      success: !results.some((result) => result.severity === "error"),
      results,
    },
    null,
    2,
  );
}

export async function runDiagnose(
  options: DiagnoseOptions = {},
): Promise<void> {
  const runner = new DoctorRunner(
    options.checks ?? [
      checkFramework,
      checkRuntime,
      checkProject,
      checkPackageJson,
      checkDependencies,
      checkTypeScript,
    ],
  );

  const results = await runner.run({
    cwd: options.cwd ?? process.cwd(),
  });

  const log = options.log ?? console.log;

  if (options.json) {
    log(formatDiagnoseResultsJson(results));
  } else {
    log(formatDoctorResults(results).replace(/^AKS Doctor/m, "AKS Diagnose"));
  }

  if (results.some((result) => result.severity === "error")) {
    process.exitCode = 1;
  }
}
