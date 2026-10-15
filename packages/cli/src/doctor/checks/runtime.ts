import type {
  DiagnosticResult,
  DoctorContext,
} from "../types.js";

export function checkRuntime(
  _context: DoctorContext,
): DiagnosticResult {
  return {
    check: "runtime",
    severity: "info",
    message: `Node.js ${process.version}`,
  };
}