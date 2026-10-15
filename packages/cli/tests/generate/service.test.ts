
import { join } from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  serviceGenerator,
} from "../../src/generate/generators/service.js";

import type {
  GeneratorContext,
} from "../../src/generate/types.js";

describe("service generator", () => {
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
    expect(serviceGenerator.name).toBe("service");

    expect(serviceGenerator.description).toBe(
      "Generate an application service.",
    );
  });

  it("generates a service file", async () => {
    const files = await serviceGenerator.createFiles(
      createContext("users"),
    );

    expect(files).toHaveLength(1);

    expect(files[0].path).toBe(
      join(
        "E:/aks-framework",
        "src",
        "services",
        "users.service.ts",
      ),
    );

    expect(files[0].content).toBe(
      "export class UsersService {}\n",
    );
  });

  it("normalizes PascalCase names", async () => {
    const files = await serviceGenerator.createFiles(
      createContext("UserProfile"),
    );

    expect(files[0].path).toBe(
      join(
        "E:/aks-framework",
        "src",
        "services",
        "user-profile.service.ts",
      ),
    );

    expect(files[0].content).toBe(
      "export class UserProfileService {}\n",
    );
  });

  it("normalizes snake_case names", async () => {
    const files = await serviceGenerator.createFiles(
      createContext("user_profile"),
    );

    expect(files[0].path).toBe(
      join(
        "E:/aks-framework",
        "src",
        "services",
        "user-profile.service.ts",
      ),
    );

    expect(files[0].content).toBe(
      "export class UserProfileService {}\n",
    );
  });

  it("normalizes kebab-case names", async () => {
    const files = await serviceGenerator.createFiles(
      createContext("user-profile"),
    );

    expect(files[0].path).toBe(
      join(
        "E:/aks-framework",
        "src",
        "services",
        "user-profile.service.ts",
      ),
    );

    expect(files[0].content).toBe(
      "export class UserProfileService {}\n",
    );
  });

  it("uses the supplied project directory", async () => {
    const files = await serviceGenerator.createFiles({
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
        "services",
        "users.service.ts",
      ),
    );
  });
});
