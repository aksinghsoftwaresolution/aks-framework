import {
  describe,
  expect,
  it,
} from "vitest";

import { formatDoctorResults } from "../../src/doctor/formatter.js";
import { formatDoctorResultsJson } from '../../src/doctor/json-formatter';

describe("formatDoctorResults", () => {
  it("formats successful diagnostics", () => {
    const output = formatDoctorResults([
      {
        check: "framework",
        severity: "info",
        message: "AKS Framework 0.1.0",
      },
      {
        check: "runtime",
        severity: "info",
        message: "Node.js v24.15.0",
      },
    ]);

    expect(output).toContain("AKS Doctor");
    expect(output).toContain(
      "✓ framework",
    );
    expect(output).toContain(
      "AKS Framework 0.1.0",
    );
    expect(output).toContain(
      "Doctor completed successfully.",
    );
  });

  it("formats warnings", () => {
    const output = formatDoctorResults([
      {
        check: "project",
        severity: "warning",
        message: "tsconfig.json was not found.",
      },
    ]);

    expect(output).toContain(
      "⚠ project",
    );
    expect(output).toContain(
      "Doctor completed with warnings.",
    );
  });

  it("formats errors", () => {
    const output = formatDoctorResults([
      {
        check: "dependencies",
        severity: "error",
        message: "node_modules was not found.",
        details: "Run npm install before running the application.",
      },
    ]);

    expect(output).toContain(
      "✗ dependencies",
    );
    expect(output).toContain(
      "Run npm install before running the application.",
    );
    expect(output).toContain(
      "Doctor found errors.",
    );
  });

  it("formats successful diagnostics as JSON", () => {
    const output = formatDoctorResultsJson([
      {
        check: "framework",
        severity: "info",
        message: "AKS Framework 0.1.0",
      },
    ]);

    expect(JSON.parse(output)).toEqual({
      command: "doctor",
      success: true,
      results: [
        {
          check: "framework",
          severity: "info",
          message: "AKS Framework 0.1.0",
        },
      ],
    });
  });

  it("reports success as false when an error exists", () => {
    const output = formatDoctorResultsJson([
      {
        check: "dependencies",
        severity: "error",
        message: "node_modules was not found.",
      },
    ]);

    expect(JSON.parse(output)).toEqual({
      command: "doctor",
      success: false,
      results: [
        {
          check: "dependencies",
          severity: "error",
          message: "node_modules was not found.",
        },
      ],
    });
  });

  it("preserves diagnostic details", () => {
    const output = formatDoctorResultsJson([
      {
        check: "project",
        severity: "warning",
        message: "tsconfig.json was not found.",
        details: "Project root: E:\\example",
      },
    ]);

    expect(JSON.parse(output)).toEqual({
      command: "doctor",
      success: true,
      results: [
        {
          check: "project",
          severity: "warning",
          message: "tsconfig.json was not found.",
          details: "Project root: E:\\example",
        },
      ],
    });
  });

});