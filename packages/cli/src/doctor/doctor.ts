import type {
  DiagnosticResult,
  DoctorCheck,
  DoctorContext,
} from "./types.js";

export class DoctorRunner {
  private readonly checks: DoctorCheck[];

  constructor(checks: DoctorCheck[] = []) {
    this.checks = checks;
  }

  async run(
    context: DoctorContext = {
      cwd: process.cwd(),
    },
  ): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    for (const check of this.checks) {
      try {
        const result = await check(context);
        results.push(result);
      } catch (error) {
        results.push({
          check: "doctor",
          severity: "error",
          message: "Diagnostic check failed.",
          details:
            error instanceof Error
              ? error.message
              : String(error),
        });
      }
    }

    return results;
  }
}