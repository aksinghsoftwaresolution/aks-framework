import { afterEach, describe, expect, it, vi } from "vitest";
import { main } from "../src/cli.js";
import { runDoctor } from "../src/commands/doctor.js";
import { runDiagnose } from "../src/commands/diagnose.js";
import { runHealth } from "../src/commands/health.js";
import { runGraph } from "../src/commands/graph.js";
import { runContract } from "../src/commands/contract.js";

vi.mock("../src/commands/diagnose.js", () => ({
  runDiagnose: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/commands/health.js", () => ({
  runHealth: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/commands/graph.js", () => ({
  runGraph: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/commands/doctor.js", () => ({
  runDoctor: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/commands/contract.js", () => ({
  runContract: vi.fn().mockResolvedValue(undefined),
}));

describe("AKS CLI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    process.exitCode = 0;
  });

  it("prints the framework version", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await main(["--version"]);

    expect(log).toHaveBeenCalledWith("0.1.0");
  });

  it("supports the -v alias", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await main(["-v"]);

    expect(log).toHaveBeenCalledWith("0.1.0");
  });

  it("prints help when no command is provided", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await main([]);

    expect(log).toHaveBeenCalledWith("AKS Framework CLI");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("doctor"));
  });

  it("supports --help", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await main(["--help"]);

    expect(log).toHaveBeenCalledWith("AKS Framework CLI");
  });

  it("supports -h", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await main(["-h"]);

    expect(log).toHaveBeenCalledWith("AKS Framework CLI");
  });

  it("dispatches the doctor command", async () => {
    await main(["doctor"]);

    expect(runDoctor).toHaveBeenCalledWith({
      json: false,
      fix: false,
    });
  });

  it("dispatches the generate command", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await main(["generate", "controller", "users", "--dry-run"]);

    expect(log).toHaveBeenCalledWith("controller generated successfully.");

    expect(log).toHaveBeenCalledWith(expect.stringContaining("would create"));
  });

  it("dispatches generate with normalized names", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await main(["generate", "controller", "UserProfile", "--dry-run"]);

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("user-profile.controller.ts"),
    );
  });

  it("rejects an unknown generator", async () => {
    await expect(main(["generate", "unknown", "users"])).rejects.toThrow(
      "Unknown generator: unknown",
    );
  });

  it("rejects unknown commands", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await main(["something"]);

    expect(error).toHaveBeenCalledWith("Unknown command: something");

    expect(error).toHaveBeenCalledWith(
      "Run 'aks --help' to see available commands.",
    );
  });

  it("registers each command name only once", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await main(["--help"]);

    const output = log.mock.calls.flat().join("\n");

    const commandNames = output
      .split("\n")
      .filter((line) => /^\s{2}\S/.test(line))
      .map((line) => line.trim().split(/\s+/)[0])
      .filter((name) =>
        [
          "update",
          "health",
          "doctor",
          "generate",
          "diagnose",
          "graph",
          "contract",
          "security",
        ].includes(name),
      );

    expect(new Set(commandNames).size).toBe(commandNames.length);
  });

  it("dispatches diagnose with JSON output enabled", async () => {
    await main(["diagnose", "--json"]);

    expect(runDiagnose).toHaveBeenCalledWith({
      json: true,
    });
  });

  it("dispatches graph with JSON output enabled", async () => {
    await main(["graph", "--json"]);

    expect(runGraph).toHaveBeenCalledWith({
      json: true,
    });
  });

  it("dispatches health with its URL and JSON output enabled", async () => {
    await main(["health", "--url", "http://localhost:3000/health", "--json"]);

    expect(runHealth).toHaveBeenCalledWith({
      url: "http://localhost:3000/health",
      json: true,
    });
  });

  it("handles a missing health URL when another option follows", async () => {
    await main(["health", "--url", "--json"]);

    expect(runHealth).toHaveBeenCalledWith({
      url: undefined,
      json: true,
    });
  });

  it("dispatches contract with its file and JSON output enabled", async () => {
    await main(["contract", "--file", "openapi.yaml", "--json"]);

    expect(runContract).toHaveBeenCalledWith({
      file: "openapi.yaml",
      json: true,
    });
  });

  it("handles a missing contract file when another option follows", async () => {
    await main(["contract", "--file", "--json"]);

    expect(runContract).toHaveBeenCalledWith({
      file: undefined,
      json: true,
    });
  });

  it("prints contract-specific help", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await main(["contract", "--help"]);

    expect(log).toHaveBeenCalledWith("AKS Framework Contract");
    expect(log).toHaveBeenCalledWith("  aks contract --file <path> [options]");
  });
});
