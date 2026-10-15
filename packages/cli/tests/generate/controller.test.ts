import {
  join,
} from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  controllerGenerator,
} from "../../src/generate/generators/controller.js";

import type {
  GeneratorContext,
} from "../../src/generate/types.js";

describe("controller generator", () => {
  function createContext(
    name: string,
  ): GeneratorContext {
    return {
      cwd: "E:/aks-framework",
      name,
      originalName: name,
      write: true,
      force: false,
    };
  }

  it("has the correct generator metadata", () => {
    expect(
      controllerGenerator.name,
    ).toBe("controller");

    expect(
      controllerGenerator.description,
    ).toBe(
      "Generate an HTTP controller.",
    );
  });

  it("generates a controller file", async () => {
    const files =
      await controllerGenerator.createFiles(
        createContext("users"),
      );

    expect(files).toHaveLength(1);

    expect(
      files[0].path,
    ).toBe(
      join(
        "E:/aks-framework",
        "src",
        "controllers",
        "users.controller.ts",
      ),
    );

    expect(
      files[0].content,
    ).toBe(
      "export class UsersController {}\n",
    );
  });

  it("normalizes PascalCase names", async () => {
    const files =
      await controllerGenerator.createFiles(
        createContext("UserProfile"),
      );

    expect(
      files[0].path,
    ).toBe(
      join(
        "E:/aks-framework",
        "src",
        "controllers",
        "user-profile.controller.ts",
      ),
    );

    expect(
      files[0].content,
    ).toBe(
      "export class UserProfileController {}\n",
    );
  });

  it("normalizes snake_case names", async () => {
    const files =
      await controllerGenerator.createFiles(
        createContext("user_profile"),
      );

    expect(
      files[0].path,
    ).toBe(
      join(
        "E:/aks-framework",
        "src",
        "controllers",
        "user-profile.controller.ts",
      ),
    );

    expect(
      files[0].content,
    ).toBe(
      "export class UserProfileController {}\n",
    );
  });

  it("normalizes kebab-case names", async () => {
    const files =
      await controllerGenerator.createFiles(
        createContext("user-profile"),
      );

    expect(
      files[0].path,
    ).toBe(
      join(
        "E:/aks-framework",
        "src",
        "controllers",
        "user-profile.controller.ts",
      ),
    );

    expect(
      files[0].content,
    ).toBe(
      "export class UserProfileController {}\n",
    );
  });

  it("uses the supplied project directory", async () => {
    const files =
      await controllerGenerator.createFiles({
        cwd: "C:/projects/example",
        name: "users",
        originalName: "users",
        write: true,
        force: false,
      });

    expect(
      files[0].path,
    ).toBe(
      join(
        "C:/projects/example",
        "src",
        "controllers",
        "users.controller.ts",
      ),
    );
  });
});