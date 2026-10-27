
import { describe, expect, it, vi } from "vitest";

import { BearerTokenStrategy } from "../src/auth/bearer-token-strategy.js";
import type { AuthResult } from "../src/auth/types.js";

const result: AuthResult = {
  user: {
    id: "user-123",
    attributes: { role: "admin" },
  },
};

describe("BearerTokenStrategy", () => {
  it("uses the bearer-token strategy name", () => {
    const strategy = new BearerTokenStrategy(() => result);

    expect(strategy.name).toBe("bearer-token");
  });

  it("returns the verified user for a valid token", async () => {
    const verifyToken = vi.fn().mockResolvedValue(result);
    const strategy = new BearerTokenStrategy(verifyToken);

    await expect(
      strategy.authenticate("valid-token"),
    ).resolves.toEqual(result);

    expect(verifyToken).toHaveBeenCalledWith("valid-token");
  });

  it("returns null when the token is invalid", async () => {
    const strategy = new BearerTokenStrategy(() => null);

    await expect(
      strategy.authenticate("invalid-token"),
    ).resolves.toBeNull();
  });

  it("rejects non-string credentials without calling the verifier", async () => {
    const verifyToken = vi.fn().mockResolvedValue(result);
    const strategy = new BearerTokenStrategy(verifyToken);

    await expect(strategy.authenticate(undefined)).resolves.toBeNull();
    await expect(strategy.authenticate(123)).resolves.toBeNull();
    await expect(strategy.authenticate({ token: "abc" })).resolves.toBeNull();

    expect(verifyToken).not.toHaveBeenCalled();
  });

  it("rejects an empty token without calling the verifier", async () => {
    const verifyToken = vi.fn().mockResolvedValue(result);
    const strategy = new BearerTokenStrategy(verifyToken);

    await expect(strategy.authenticate("")).resolves.toBeNull();

    expect(verifyToken).not.toHaveBeenCalled();
  });

  it("supports a synchronous verifier", async () => {
    const strategy = new BearerTokenStrategy(() => result);

    await expect(
      strategy.authenticate("valid-token"),
    ).resolves.toEqual(result);
  });

  it("propagates verifier errors", async () => {
    const error = new Error("Token verification unavailable");
    const strategy = new BearerTokenStrategy(() => {
      throw error;
    });

    await expect(
      strategy.authenticate("valid-token"),
    ).rejects.toBe(error);
  });
});
