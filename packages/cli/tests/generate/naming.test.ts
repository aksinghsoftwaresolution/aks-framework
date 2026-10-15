import { describe, expect, it } from "vitest";

import {
  normalizeName,
  toCamelCase,
  toKebabCase,
  toPascalCase,
} from "../../src/generate/naming.js";

describe("generate naming", () => {
  describe("toKebabCase", () => {
    it("converts camel case", () => {
      expect(
        toKebabCase("UserProfile"),
      ).toBe("user-profile");
    });

    it("converts Pascal case", () => {
      expect(
        toKebabCase("UserProfileController"),
      ).toBe(
        "user-profile-controller",
      );
    });

    it("converts underscores", () => {
      expect(
        toKebabCase("user_profile"),
      ).toBe("user-profile");
    });

    it("converts spaces", () => {
      expect(
        toKebabCase("user profile"),
      ).toBe("user-profile");
    });

    it("preserves already normalized names", () => {
      expect(
        toKebabCase("user-profile"),
      ).toBe("user-profile");
    });
  });

  describe("toPascalCase", () => {
    it("converts kebab case", () => {
      expect(
        toPascalCase("user-profile"),
      ).toBe("UserProfile");
    });

    it("converts snake case", () => {
      expect(
        toPascalCase("user_profile"),
      ).toBe("UserProfile");
    });

    it("converts camel case", () => {
      expect(
        toPascalCase("userProfile"),
      ).toBe("UserProfile");
    });
  });

  describe("toCamelCase", () => {
    it("converts kebab case", () => {
      expect(
        toCamelCase("user-profile"),
      ).toBe("userProfile");
    });

    it("converts Pascal case", () => {
      expect(
        toCamelCase("UserProfile"),
      ).toBe("userProfile");
    });

    it("converts snake case", () => {
      expect(
        toCamelCase("user_profile"),
      ).toBe("userProfile");
    });
  });

  describe("normalizeName", () => {
    it("returns all normalized forms", () => {
      expect(
        normalizeName("UserProfile"),
      ).toEqual({
        original: "UserProfile",
        kebab: "user-profile",
        pascal: "UserProfile",
        camel: "userProfile",
      });
    });

    it("trims surrounding whitespace", () => {
      expect(
        normalizeName(
          "  user-profile  ",
        ),
      ).toEqual({
        original: "user-profile",
        kebab: "user-profile",
        pascal: "UserProfile",
        camel: "userProfile",
      });
    });

    it("handles a single word", () => {
      expect(
        normalizeName("users"),
      ).toEqual({
        original: "users",
        kebab: "users",
        pascal: "Users",
        camel: "users",
      });
    });
  });
});