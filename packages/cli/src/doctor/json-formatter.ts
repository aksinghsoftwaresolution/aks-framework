import type { DiagnosticResult } from "./types.js";

export interface DoctorJsonOutput {
  command: "doctor";
  success: boolean;
  results: DiagnosticResult[];
}

export function formatDoctorResultsJson(
  results: DiagnosticResult[],
): string {
  const output: DoctorJsonOutput = {
    command: "doctor",
    success: !results.some(
      (result) => result.severity === "error",
    ),
    results,
  };

  return JSON.stringify(output, null, 2);
}