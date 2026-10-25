import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatHealthResultsJson,
  runHealth,
} from "../../src/commands/health.js";

describe("runHealth", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it("reports a successful HTTP response", async () => {
    const log = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    await runHealth({
      url: "http://localhost:3000/health",
      json: true,
      log,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const output = JSON.parse(log.mock.calls[0][0]);

    expect(output.command).toBe("health");
    expect(output.success).toBe(true);
    expect(output.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("reports unsuccessful HTTP responses", async () => {
    const log = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });

    await runHealth({
      url: "http://localhost:3000/health",
      json: true,
      log,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const output = JSON.parse(log.mock.calls[0][0]);

    expect(output.success).toBe(false);
    expect(output.status).toBe(503);
    expect(process.exitCode).toBe(1);
  });

  it("handles connection failures", async () => {
    const log = vi.fn();
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new Error("Connection refused"));

    await runHealth({
      url: "http://localhost:3000/health",
      json: true,
      log,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const output = JSON.parse(log.mock.calls[0][0]);

    expect(output.success).toBe(false);
    expect(output.message).toContain("Connection refused");
    expect(process.exitCode).toBe(1);
  });

  it("reports a missing URL", async () => {
    const log = vi.fn();

    await runHealth({
      json: true,
      log,
    });

    const output = JSON.parse(log.mock.calls[0][0]);

    expect(output.success).toBe(false);
    expect(output.message).toContain("Missing endpoint URL");
    expect(process.exitCode).toBe(1);
  });

  it("rejects non-HTTP URLs", async () => {
    const log = vi.fn();
    const fetchImpl = vi.fn();

    await runHealth({
      url: "file:///tmp/health",
      json: true,
      log,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const output = JSON.parse(log.mock.calls[0][0]);

    expect(output.success).toBe(false);
    expect(output.message).toContain("HTTP or HTTPS");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("formats JSON results", () => {
    const output = JSON.parse(
      formatHealthResultsJson({
        command: "health",
        success: true,
        url: "http://localhost:3000/health",
        status: 200,
        message: "Endpoint is healthy.",
      }),
    );

    expect(output.command).toBe("health");
    expect(output.success).toBe(true);
    expect(output.status).toBe(200);
  });

  it("uses the health heading in human-readable output", async () => {
    const log = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    await runHealth({
      url: "http://localhost:3000/health",
      log,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(log).toHaveBeenCalled();
    expect(log.mock.calls[0][0]).toBe("AKS Health");
  });
});
