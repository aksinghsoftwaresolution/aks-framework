import { describe, expect, it, vi } from "vitest";

import { checkFramework } from "../../src/doctor/checks/framework.js";

import type { DoctorContext } from "../../src/doctor/types.js";

const context: DoctorContext = {
  cwd: process.cwd(),
};

function mockFetch(
  status: number,
  body?: unknown,
): typeof fetch {
  return vi.fn(async () =>
    new Response(
      body === undefined
        ? null
        : JSON.stringify(body),
      {
        status,
        headers: {
          "Content-Type": "application/json",
        },
      },
    ),
  ) as unknown as typeof fetch;
}

describe("checkFramework", () => {
  it("reports the current version when no release is available", async () => {
    const result = await checkFramework(context, {
      currentVersion: "0.1.0",
      fetch: mockFetch(404),
    });

    expect(result.check).toBe("framework");
    expect(result.severity).toBe("info");
    expect(result.message).toContain("0.1.0");
    expect(result.details).toContain(
      "Latest release could not be checked",
    );
  });

  it("reports a newer stable release", async () => {
    const result = await checkFramework(context, {
      currentVersion: "0.1.0",
      fetch: mockFetch(200, {
        version: "0.2.0",
      }),
    });

    expect(result.severity).toBe("warning");
    expect(result.message).toContain(
      "0.1.0 → 0.2.0",
    );
  });

  it("reports the framework as up to date", async () => {
    const result = await checkFramework(context, {
      currentVersion: "0.2.0",
      fetch: mockFetch(200, {
        version: "0.2.0",
      }),
    });

    expect(result.severity).toBe("info");
    expect(result.message).toContain(
      "is up to date",
    );
  });

  it("does not treat a lower registry version as an update", async () => {
    const result = await checkFramework(context, {
      currentVersion: "1.0.0",
      fetch: mockFetch(200, {
        version: "0.9.0",
      }),
    });

    expect(result.severity).toBe("info");
    expect(result.message).toContain("1.0.0");
  });

  it("ignores prerelease versions", async () => {
    const result = await checkFramework(context, {
      currentVersion: "0.1.0",
      fetch: mockFetch(200, {
        version: "0.2.0-beta.1",
      }),
    });

    expect(result.severity).toBe("info");
    expect(result.details).toContain(
      "Latest release could not be checked",
    );
  });

  it("handles registry errors without throwing", async () => {
    const fetchFn = vi.fn().mockRejectedValue(
      new Error("Network unavailable"),
    ) as unknown as typeof fetch;

    const result = await checkFramework(context, {
      currentVersion: "0.1.0",
      fetch: fetchFn,
    });

    expect(result.severity).toBe("info");
    expect(result.message).toContain("0.1.0");
  });
});
