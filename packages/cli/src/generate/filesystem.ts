import {
  access,
  mkdir,
  writeFile,
} from "node:fs/promises";

import { dirname } from "node:path";

export interface WriteFileOptions {
  /**
   * Whether an existing file may be overwritten.
   */
  force?: boolean;

  /**
   * When true, report what would happen without
   * actually writing anything.
   */
  dryRun?: boolean;
}

export interface WriteFileResult {
  /**
   * Absolute or caller-provided file path.
   */
  path: string;

  /**
   * Whether the file existed before this operation.
   */
  existed: boolean;

  /**
   * Whether the file was actually written.
   */
  written: boolean;
}

export async function fileExists(
  path: string,
): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function writeGeneratedFile(
  path: string,
  content: string,
  options: WriteFileOptions = {},
): Promise<WriteFileResult> {
  const existed = await fileExists(path);

  if (existed && !options.force) {
    throw new Error(
      `File already exists: ${path}`,
    );
  }

  if (options.dryRun) {
    return {
      path,
      existed,
      written: false,
    };
  }

  await mkdir(dirname(path), {
    recursive: true,
  });

  await writeFile(
    path,
    content,
    "utf8",
  );

  return {
    path,
    existed,
    written: true,
  };
}