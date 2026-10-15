import {
  describe,
  expect,
  it,
} from "vitest";

import { DoctorRunner } from "../../src/doctor/doctor.js";

describe("DoctorRunner", () => {
  it("runs registered checks", async () => {
    const runner = new DoctorRunner([
      () => ({
        check: "test",
        severity: "info",
        message: "Everything is fine.",
      }),
    ]);

    const results = await runner.run({
      cwd: process.cwd(),
    });

    expect(results).toEqual([
      {
        check: "test",
        severity: "info",
        message: "Everything is fine.",
      },
    ]);
  });

  it("supports asynchronous checks", async () => {
    const runner = new DoctorRunner([
      async () => ({
        check: "async",
        severity: "info",
        message: "Async check passed.",
      }),
    ]);

    const results = await runner.run();

    expect(results).toEqual([
      {
        check: "async",
        severity: "info",
        message: "Async check passed.",
      },
    ]);
  });

  it("continues when a check throws", async () => {
    const runner = new DoctorRunner([
      () => {
        throw new Error("Something failed");
      },
      () => ({
        check: "second",
        severity: "info",
        message: "Second check passed.",
      }),
    ]);

    const results = await runner.run();

    expect(results).toHaveLength(2);

    expect(results[0]).toEqual({
      check: "doctor",
      severity: "error",
      message: "Diagnostic check failed.",
      details: "Something failed",
    });

    expect(results[1]).toEqual({
      check: "second",
      severity: "info",
      message: "Second check passed.",
    });
  });
});