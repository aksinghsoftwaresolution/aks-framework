
import { join } from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  moduleGenerator,
} from "../../src/generate/generators/module.js";

import type {
  GeneratorContext,
} from "../../src/generate/types.js";

describe("module generator", () => {
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
    expect(moduleGenerator.name).toBe("module");

    expect(moduleGenerator.description).toBe(
      "Generate an application module.",
    );
  });

  it("generates a module file", async () => {
    const files = await moduleGenerator.createFiles(
      createContext("users"),
    );

    expect(files).toHaveLength(1);

    expect(files[0].path).toBe(
      join(
        "E:/aks-framework",
        "src",
        "modules",
        "users.module.ts",
      ),
    );

    expect(files[0].content).toBe(
      "export class UsersModule {}\n",
    );
  });

  it("normalizes PascalCase names", async () => {
    const files = await moduleGenerator.createFiles(
      createContext("UserProfile"),
    );

    expect(files[0].path).toBe(
      join(
        "E:/aks-framework",
        "src",
        "modules",
        "user-profile.module.ts",
      ),
    );

    expect(files[0].content).toBe(
      "export class UserProfileModule {}\n",
    );
  });

  it("normalizes snake_case names", async () => {
    const files = await moduleGenerator.createFiles(
      createContext("user_profile"),
    );

    expect(files[0].path).toBe(
      join(
        "E:/aks-framework",
        "src",
        "modules",
        "user-profile.module.ts",
      ),
    );

    expect(files[0].content).toBe(
      "export class UserProfileModule {}\n",
    );
  });

  it("normalizes kebab-case names", async () => {
    const files = await moduleGenerator.createFiles(
      createContext("user-profile"),
    );

    expect(files[0].path).toBe(
      join(
        "E:/aks-framework",
        "src",
        "modules",
        "user-profile.module.ts",
      ),
    );

    expect(files[0].content).toBe(
      "export class UserProfileModule {}\n",
    );
  });

  it("uses the supplied project directory", async () => {
    const files = await moduleGenerator.createFiles({
      cwd: "C:/projects/example",
      name: "users",
      originalName: "users",
      write: true,
      force: false,
    });

    expect(files[0].path).toBe(
      join(
        "C:/projects/example",
        "src",
        "modules",
        "users.module.ts",
      ),
    );
  });
});
