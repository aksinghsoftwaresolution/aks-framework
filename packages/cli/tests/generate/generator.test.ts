import {
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";

import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  runGenerator,
} from "../../src/generate/generator.js";

import type {
  GeneratorContext,
} from "../../src/generate/types.js";

describe("generator engine", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.map(
        directory =>
          rm(directory, {
            recursive: true,
            force: true,
          }),
      ),
    );

    temporaryDirectories.length = 0;
  });

  async function createTempDirectory() {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          "aks-generator-",
        ),
      );

    temporaryDirectories.push(
      directory,
    );

    return directory;
  }

  function createContext(
    cwd: string,
    overrides: Partial<GeneratorContext> = {},
  ): GeneratorContext {
    return {
      cwd,
      name: "users",
      originalName: "Users",
      write: true,
      force: false,
      ...overrides,
    };
  }

  it("creates generated files", async () => {
    const cwd =
      await createTempDirectory();

    const path = join(
      cwd,
      "users.ts",
    );

    const generator = {
      name: "example",
      description: "Example generator",

      async createFiles() {
        return [
          {
            path,
            content:
              "export const users = [];",
          },
        ];
      },
    };

    const result =
      await runGenerator(
        generator,
        createContext(cwd),
      );

    expect(result.success).toBe(
      true,
    );

    expect(
      result.generator,
    ).toBe("example");

    expect(
      result.name,
    ).toBe("users");

    expect(
      result.files,
    ).toHaveLength(1);

    expect(
      result.files[0],
    ).toEqual({
      path,
      existed: false,
      written: true,
    });

    expect(
      await readFile(
        path,
        "utf8",
      ),
    ).toBe(
      "export const users = [];",
    );
  });

  it("supports multiple generated files", async () => {
    const cwd =
      await createTempDirectory();

    const firstPath =
      join(cwd, "first.ts");

    const secondPath =
      join(cwd, "second.ts");

    const generator = {
      name: "example",
      description: "Example generator",

      async createFiles() {
        return [
          {
            path: firstPath,
            content: "first",
          },
          {
            path: secondPath,
            content: "second",
          },
        ];
      },
    };

    const result =
      await runGenerator(
        generator,
        createContext(cwd),
      );

    expect(
      result.files,
    ).toHaveLength(2);

    expect(
      await readFile(
        firstPath,
        "utf8",
      ),
    ).toBe("first");

    expect(
      await readFile(
        secondPath,
        "utf8",
      ),
    ).toBe("second");
  });

  it("supports dry-run", async () => {
    const cwd =
      await createTempDirectory();

    const path = join(
      cwd,
      "users.ts",
    );

    const generator = {
      name: "example",
      description: "Example generator",

      async createFiles() {
        return [
          {
            path,
            content: "generated",
          },
        ];
      },
    };

    const result =
      await runGenerator(
        generator,
        createContext(cwd, {
          write: false,
        }),
      );

    expect(
      result.files,
    ).toEqual([
      {
        path,
        existed: false,
        written: false,
      },
    ]);

    expect(
      await readFile(
        path,
        "utf8",
      ).catch(() => null),
    ).toBeNull();
  });

  it("supports force mode", async () => {
    const cwd =
      await createTempDirectory();

    const path = join(
      cwd,
      "users.ts",
    );

    const initialGenerator = {
      name: "example",
      description: "Example generator",

      async createFiles() {
        return [
          {
            path,
            content: "original",
          },
        ];
      },
    };

    await runGenerator(
      initialGenerator,
      createContext(cwd),
    );

    const replacementGenerator = {
      name: "example",
      description: "Example generator",

      async createFiles() {
        return [
          {
            path,
            content: "replacement",
          },
        ];
      },
    };

    const result =
      await runGenerator(
        replacementGenerator,
        createContext(cwd, {
          force: true,
        }),
      );

    expect(
      result.files[0],
    ).toEqual({
      path,
      existed: true,
      written: true,
    });

    expect(
      await readFile(
        path,
        "utf8",
      ),
    ).toBe("replacement");
  });

  it("propagates filesystem conflicts", async () => {
    const cwd =
      await createTempDirectory();

    const path = join(
      cwd,
      "users.ts",
    );

    const generator = {
      name: "example",
      description: "Example generator",

      async createFiles() {
        return [
          {
            path,
            content: "generated",
          },
        ];
      },
    };

    await runGenerator(
      generator,
      createContext(cwd),
    );

    await expect(
      runGenerator(
        generator,
        createContext(cwd),
      ),
    ).rejects.toThrow(
      `File already exists: ${path}`,
    );
  });
});