export type DiagnosticSeverity =
  | "info"
  | "warning"
  | "error";

export interface DiagnosticResult {
  check: string;
  severity: DiagnosticSeverity;
  message: string;
  details?: string;
}

export interface DoctorContext {
  cwd: string;
}

export type DoctorCheck = (
  context: DoctorContext,
) => DiagnosticResult | Promise<DiagnosticResult>;