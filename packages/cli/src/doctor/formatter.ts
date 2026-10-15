import type { DiagnosticResult } from "./types.js";

function symbolFor(
  severity: DiagnosticResult["severity"],
): string {
  switch (severity) {
    case "info":
      return "✓";
    case "warning":
      return "⚠";
    case "error":
      return "✗";
  }
}

export function formatDoctorResults(
  results: DiagnosticResult[],
): string {
  const lines: string[] = [
    "AKS Doctor",
    "",
  ];

  for (const result of results) {
    lines.push(
      `${symbolFor(result.severity)} ${result.check.padEnd(16)} ${result.message}`,
    );

    if (result.details) {
      lines.push(
        `  ${result.details}`,
      );
    }
  }

  const hasErrors = results.some(
    (result) => result.severity === "error",
  );

  const hasWarnings = results.some(
    (result) => result.severity === "warning",
  );

  lines.push("");

  if (hasErrors) {
    lines.push("Doctor found errors.");
  } else if (hasWarnings) {
    lines.push("Doctor completed with warnings.");
  } else {
    lines.push("Doctor completed successfully.");
  }

  return lines.join("\n");
}