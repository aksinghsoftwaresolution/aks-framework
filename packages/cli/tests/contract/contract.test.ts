import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatContractResultsJson,
  runContract,
} from "../../src/commands/contract.js";

describe("runContract", () => {
  let directory: string | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    process.exitCode = 0;

    if (directory) {
      await rm(directory, { recursive: true, force: true });
      directory = undefined;
    }
  });

  async function createDirectory(): Promise<string> {
    directory = await mkdtemp(join(tmpdir(), "aks-contract-"));
    return directory;
  }

  it("validates a valid OpenAPI document", async () => {
    const cwd = await createDirectory();

    await writeFile(
      join(cwd, "openapi.json"),
      JSON.stringify({
        openapi: "3.0.3",
        info: {
          title: "Example API",
          version: "1.0.0",
        },
        paths: {},
      }),
    );

    const log = vi.fn();

    await runContract({
      file: "openapi.json",
      cwd,
      json: true,
      log,
    });

    const result = JSON.parse(log.mock.calls[0][0]);

    expect(result.command).toBe("contract");
    expect(result.success).toBe(true);
    expect(result.openapi).toBe("3.0.3");
    expect(result.title).toBe("Example API");
    expect(result.version).toBe("1.0.0");
    expect(process.exitCode).not.toBe(1);
  });

  it("reports an invalid OpenAPI document", async () => {
    const cwd = await createDirectory();

    await writeFile(
      join(cwd, "invalid.json"),
      JSON.stringify({
        openapi: "3.0.3",
        info: {
          title: "Invalid API",
        },
        paths: {},
      }),
    );

    const log = vi.fn();

    await runContract({
      file: "invalid.json",
      cwd,
      json: true,
      log,
    });

    const result = JSON.parse(log.mock.calls[0][0]);

    expect(result.success).toBe(false);
    expect(result.message).toBeTruthy();
    expect(process.exitCode).toBe(1);
  });

  it("reports a missing file", async () => {
    const cwd = await createDirectory();
    const log = vi.fn();

    await runContract({
      file: "missing.yaml",
      cwd,
      json: true,
      log,
    });

    const result = JSON.parse(log.mock.calls[0][0]);

    expect(result.success).toBe(false);
    expect(result.message).toBeTruthy();
    expect(process.exitCode).toBe(1);
  });

  it("reports a missing document path", async () => {
    const log = vi.fn();

    await runContract({
      json: true,
      log,
    });

    const result = JSON.parse(log.mock.calls[0][0]);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Missing OpenAPI document path");
    expect(process.exitCode).toBe(1);
  });

  it("formats JSON results", () => {
    const result = JSON.parse(
      formatContractResultsJson({
        command: "contract",
        success: true,
        openapi: "3.0.3",
        title: "Example API",
        version: "1.0.0",
        message: "OpenAPI document is valid.",
      }),
    );

    expect(result.command).toBe("contract");
    expect(result.success).toBe(true);
    expect(result.title).toBe("Example API");
  });

  it("prints human-readable output", async () => {
    const cwd = await createDirectory();

    await writeFile(
      join(cwd, "openapi.json"),
      JSON.stringify({
        openapi: "3.0.3",
        info: {
          title: "Example API",
          version: "1.0.0",
        },
        paths: {},
      }),
    );

    const log = vi.fn();

    await runContract({
      file: "openapi.json",
      cwd,
      log,
    });

    expect(log).toHaveBeenCalledWith("AKS Contract");
    expect(log).toHaveBeenCalledWith("Status: valid");
  });
});
