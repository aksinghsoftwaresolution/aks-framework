import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatDiagnoseResultsJson,
  runDiagnose,
} from "../../src/commands/diagnose.js";

describe("runDiagnose", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it("outputs structured JSON diagnostics", async () => {
    const log = vi.fn();

    await runDiagnose({
      cwd: process.cwd(),
      json: true,
      log,
      checks: [
        () => ({
          check: "example",
          severity: "info",
          message: "Diagnostic passed",
        }),
      ],
    });

    expect(log).toHaveBeenCalledOnce();

    const output = JSON.parse(log.mock.calls[0][0] as string);

    expect(output.command).toBe("diagnose");
    expect(output.success).toBe(true);
    expect(output.results.length).toBeGreaterThan(0);
  });

  it("uses the diagnose heading in human-readable output", async () => {
    const log = vi.fn();

    await runDiagnose({
      cwd: process.cwd(),
      log,
      checks: [
        () => ({
          check: "example",
          severity: "info",
          message: "Diagnostic passed",
        }),
      ],
    });

    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0][0]).toContain("AKS Diagnose");
  });

  it("reports error results as unsuccessful JSON", () => {
    const output = JSON.parse(
      formatDiagnoseResultsJson([
        {
          check: "example",
          severity: "error",
          message: "Example failure",
        },
      ]),
    );

    expect(output.command).toBe("diagnose");
    expect(output.success).toBe(false);
    expect(output.results[0].severity).toBe("error");
  });
});
