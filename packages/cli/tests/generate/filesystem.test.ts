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
  fileExists,
  writeGeneratedFile,
} from "../../src/generate/filesystem.js";

describe("generate filesystem", () => {
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
          "aks-generate-",
        ),
      );

    temporaryDirectories.push(
      directory,
    );

    return directory;
  }

  it("detects an existing file", async () => {
    const directory =
      await createTempDirectory();

    const path = join(
      directory,
      "example.ts",
    );

    await writeGeneratedFile(
      path,
      "hello",
    );

    expect(
      await fileExists(path),
    ).toBe(true);
  });

  it("creates a new file", async () => {
    const directory =
      await createTempDirectory();

    const path = join(
      directory,
      "example.ts",
    );

    const result =
      await writeGeneratedFile(
        path,
        "hello",
      );

    expect(result).toEqual({
      path,
      existed: false,
      written: true,
    });

    expect(
      await readFile(
        path,
        "utf8",
      ),
    ).toBe("hello");
  });

  it("creates parent directories automatically", async () => {
    const directory =
      await createTempDirectory();

    const path = join(
      directory,
      "nested",
      "deep",
      "example.ts",
    );

    const result =
      await writeGeneratedFile(
        path,
        "hello",
      );

    expect(result.written).toBe(
      true,
    );

    expect(
      await readFile(
        path,
        "utf8",
      ),
    ).toBe("hello");
  });

  it("rejects an existing file by default", async () => {
    const directory =
      await createTempDirectory();

    const path = join(
      directory,
      "example.ts",
    );

    await writeGeneratedFile(
      path,
      "original",
    );

    await expect(
      writeGeneratedFile(
        path,
        "replacement",
      ),
    ).rejects.toThrow(
      `File already exists: ${path}`,
    );

    expect(
      await readFile(
        path,
        "utf8",
      ),
    ).toBe("original");
  });

  it("overwrites an existing file with force", async () => {
    const directory =
      await createTempDirectory();

    const path = join(
      directory,
      "example.ts",
    );

    await writeGeneratedFile(
      path,
      "original",
    );

    const result =
      await writeGeneratedFile(
        path,
        "replacement",
        {
          force: true,
        },
      );

    expect(result).toEqual({
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

  it("does not write during a dry run", async () => {
    const directory =
      await createTempDirectory();

    const path = join(
      directory,
      "example.ts",
    );

    const result =
      await writeGeneratedFile(
        path,
        "hello",
        {
          dryRun: true,
        },
      );

    expect(result).toEqual({
      path,
      existed: false,
      written: false,
    });

    expect(
      await fileExists(path),
    ).toBe(false);
  });

  it("does not overwrite during a dry run", async () => {
    const directory =
      await createTempDirectory();

    const path = join(
      directory,
      "example.ts",
    );

    await writeGeneratedFile(
      path,
      "original",
    );

    const result =
      await writeGeneratedFile(
        path,
        "replacement",
        {
          dryRun: true,
          force: true,
        },
      );

    expect(result).toEqual({
      path,
      existed: true,
      written: false,
    });

    expect(
      await readFile(
        path,
        "utf8",
      ),
    ).toBe("original");
  });

  it("reports an existing file during dry run without force", async () => {
    const directory =
      await createTempDirectory();

    const path = join(
      directory,
      "example.ts",
    );

    await writeGeneratedFile(
      path,
      "original",
    );

    await expect(
      writeGeneratedFile(
        path,
        "replacement",
        {
          dryRun: true,
        },
      ),
    ).rejects.toThrow(
      `File already exists: ${path}`,
    );
  });
});