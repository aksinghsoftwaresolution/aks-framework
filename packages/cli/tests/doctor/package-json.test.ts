import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkPackageJson } from "../../src/doctor/checks/package-json.js";

describe("checkPackageJson", () => {
  it("accepts a valid package.json", async () => {
    const cwd = await mkdtemp(
      join(tmpdir(), "aks-doctor-"),
    );

    try {
      await writeFile(
        join(cwd, "package.json"),
        JSON.stringify({
          name: "test-app",
          version: "1.0.0",
          scripts: {
            build: "tsc",
          },
          dependencies: {},
          devDependencies: {},
        }),
      );

      const result = await checkPackageJson({ cwd });

      expect(result).toEqual({
        check: "package.json",
        severity: "info",
        message:
          "package.json configuration looks valid.",
      });
    } finally {
      await rm(cwd, {
        recursive: true,
        force: true,
      });
    }
  });

  it("reports an invalid package.json", async () => {
    const cwd = await mkdtemp(
      join(tmpdir(), "aks-doctor-"),
    );

    try {
      await writeFile(
        join(cwd, "package.json"),
        JSON.stringify({
          version: "1.0.0",
        }),
      );

      const result = await checkPackageJson({ cwd });

      expect(result.severity).toBe("error");
      expect(result.message).toBe(
        "package.json has configuration problems.",
      );
      expect(result.details).toContain(
        "Missing package name.",
      );
    } finally {
      await rm(cwd, {
        recursive: true,
        force: true,
      });
    }
  });

  it("reports malformed JSON", async () => {
    const cwd = await mkdtemp(
      join(tmpdir(), "aks-doctor-"),
    );

    try {
      await writeFile(
        join(cwd, "package.json"),
        "{ invalid json",
      );

      const result = await checkPackageJson({ cwd });

      expect(result.severity).toBe("error");
      expect(result.message).toBe(
        "package.json could not be read.",
      );
    } finally {
      await rm(cwd, {
        recursive: true,
        force: true,
      });
    }
  });
});