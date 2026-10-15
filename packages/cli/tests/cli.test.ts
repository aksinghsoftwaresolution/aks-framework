import { afterEach, describe, expect, it, vi } from "vitest";
import { main } from "../src/cli.js";

describe("AKS CLI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints the framework version", async () => {
    const log = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    await main(["--version"]);

    expect(log).toHaveBeenCalledWith("0.1.0");
  });

  it("supports the -v alias", async () => {
    const log = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    await main(["-v"]);

    expect(log).toHaveBeenCalledWith("0.1.0");
  });

  it("prints help when no command is provided", async () => {
    const log = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    await main([]);

    expect(log).toHaveBeenCalledWith("AKS Framework CLI");
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("doctor"),
    );
  });

  it("supports --help", async () => {
    const log = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    await main(["--help"]);

    expect(log).toHaveBeenCalledWith("AKS Framework CLI");
  });

  it("supports -h", async () => {
    const log = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    await main(["-h"]);

    expect(log).toHaveBeenCalledWith("AKS Framework CLI");
  });

  it("dispatches the doctor command", async () => {
  const log = vi
    .spyOn(console, "log")
    .mockImplementation(() => {});

  await main(["doctor"]);

  expect(log).toHaveBeenCalledWith(
    expect.stringContaining("AKS Doctor"),
  );

  expect(log).toHaveBeenCalledWith(
    expect.stringContaining("AKS Framework 0.1.0"),
  );

  expect(log).toHaveBeenCalledWith(
    expect.stringContaining("Doctor completed with warnings."),
  );
});

  
  it("dispatches the generate command", async () => {
    const log = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    await main([
      "generate",
      "controller",
      "users",
      "--dry-run",
    ]);

    expect(log).toHaveBeenCalledWith(
      "controller generated successfully.",
    );

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("would create"),
    );
  });

  it("dispatches generate with normalized names", async () => {
    const log = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    await main([
      "generate",
      "controller",
      "UserProfile",
      "--dry-run",
    ]);

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "user-profile.controller.ts",
      ),
    );
  });

  it("rejects an unknown generator", async () => {
    await expect(
      main([
        "generate",
        "unknown",
        "users",
      ]),
    ).rejects.toThrow(
      "Unknown generator: unknown",
    );
  });


  it("rejects unknown commands", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await main(["something"]);

    expect(error).toHaveBeenCalledWith(
      "Unknown command: something",
    );

    expect(error).toHaveBeenCalledWith(
      "Run 'aks --help' to see available commands.",
    );
  });


});