import {
  mkdtemp,
  readFile,
  rm,
  access,
} from "node:fs/promises";

import {
  tmpdir,
} from "node:os";

import {
  join,
} from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runGenerate,
} from "../../src/commands/generate.js";

describe("generate command", () => {
  async function createProject(): Promise<string> {
    return mkdtemp(
      join(
        tmpdir(),
        "aks-generate-",
      ),
    );
  }

  async function fileExists(
    path: string,
  ): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  async function cleanup(
    cwd: string,
  ): Promise<void> {
    await rm(
      cwd,
      {
        recursive: true,
        force: true,
      },
    );
  }

  it("generates a controller", async () => {
    const cwd =
      await createProject();

    try {
      await runGenerate(
        [
          "controller",
          "users",
        ],
        {
          cwd,
          dryRun: false,
          force: false,
        },
      );

      const filePath =
        join(
          cwd,
          "src",
          "controllers",
          "users.controller.ts",
        );

      expect(
        await fileExists(filePath),
      ).toBe(true);

      expect(
        await readFile(
          filePath,
          "utf8",
        ),
      ).toBe(
        "export class UsersController {}\n",
      );
    } finally {
      await cleanup(cwd);
    }
  });

  it("does not create files during dry-run", async () => {
    const cwd =
      await createProject();

    try {
      await runGenerate(
        [
          "controller",
          "users",
          "--dry-run",
        ],
        {
          cwd,
          dryRun: false,
          force: false,
        },
      );

      const filePath =
        join(
          cwd,
          "src",
          "controllers",
          "users.controller.ts",
        );

      expect(
        await fileExists(filePath),
      ).toBe(false);
    } finally {
      await cleanup(cwd);
    }
  });

  it("normalizes PascalCase resource names", async () => {
    const cwd =
      await createProject();

    try {
      await runGenerate(
        [
          "controller",
          "UserProfile",
        ],
        {
          cwd,
          dryRun: false,
          force: false,
        },
      );

      const filePath =
        join(
          cwd,
          "src",
          "controllers",
          "user-profile.controller.ts",
        );

      expect(
        await fileExists(filePath),
      ).toBe(true);

      expect(
        await readFile(
          filePath,
          "utf8",
        ),
      ).toBe(
        "export class UserProfileController {}\n",
      );
    } finally {
      await cleanup(cwd);
    }
  });

  it("rejects an existing file without force", async () => {
    const cwd =
      await createProject();

    try {
      await runGenerate(
        [
          "controller",
          "users",
        ],
        {
          cwd,
          dryRun: false,
          force: false,
        },
      );

      await expect(
        runGenerate(
          [
            "controller",
            "users",
          ],
          {
            cwd,
            dryRun: false,
            force: false,
          },
        ),
      ).rejects.toThrow(
        "File already exists:",
      );
    } finally {
      await cleanup(cwd);
    }
  });

  it("overwrites an existing file with force", async () => {
    const cwd =
      await createProject();

    try {
      await runGenerate(
        [
          "controller",
          "users",
        ],
        {
          cwd,
          dryRun: false,
          force: false,
        },
      );

      const filePath =
        join(
          cwd,
          "src",
          "controllers",
          "users.controller.ts",
        );

      expect(
        await fileExists(filePath),
      ).toBe(true);

      await runGenerate(
        [
          "controller",
          "users",
          "--force",
        ],
        {
          cwd,
          dryRun: false,
          force: false,
        },
      );

      expect(
        await readFile(
          filePath,
          "utf8",
        ),
      ).toBe(
        "export class UsersController {}\n",
      );
    } finally {
      await cleanup(cwd);
    }
  });

  it("rejects an unknown generator", async () => {
    const cwd =
      await createProject();

    try {
      await expect(
        runGenerate(
          [
            "unknown",
            "users",
          ],
          {
            cwd,
            dryRun: false,
            force: false,
          },
        ),
      ).rejects.toThrow(
        "Unknown generator: unknown",
      );
    } finally {
      await cleanup(cwd);
    }
  });

  it("rejects a missing generator name", async () => {
    const cwd =
      await createProject();

    try {
      await expect(
        runGenerate(
          [],
          {
            cwd,
            dryRun: false,
            force: false,
          },
        ),
      ).rejects.toThrow(
        "Missing generator name.",
      );
    } finally {
      await cleanup(cwd);
    }
  });

  it("rejects a missing resource name", async () => {
    const cwd =
      await createProject();

    try {
      await expect(
        runGenerate(
          [
            "controller",
          ],
          {
            cwd,
            dryRun: false,
            force: false,
          },
        ),
      ).rejects.toThrow(
        'Missing resource name for generator "controller".',
      );
    } finally {
      await cleanup(cwd);
    }
  });
});