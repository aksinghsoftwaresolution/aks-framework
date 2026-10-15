import {
  normalizeName,
} from "../generate/naming.js";

import {
  runGenerator,
} from "../generate/generator.js";

import {
  findGenerator,
} from "../generate/registry.js";

export interface GenerateOptions {
  cwd?: string;
  dryRun: boolean;
  force: boolean;
}

export async function runGenerate(
  args: string[],
  options: GenerateOptions = {
    dryRun: false,
    force: false,
  },
): Promise<void> {
  const positionalArgs = args.filter(
    (arg) =>
      !arg.startsWith("--"),
  );

  const generatorName =
    positionalArgs[0];

  const resourceName =
    positionalArgs[1];

  if (!generatorName) {
    throw new Error(
      "Missing generator name.\n\n" +
      "Usage: aks generate <generator> <name>\n\n" +
      "Example:\n" +
      "  aks generate controller users",
    );
  }

  if (!resourceName) {
    throw new Error(
      `Missing resource name for generator "${generatorName}".\n\n` +
      "Usage: aks generate <generator> <name>\n\n" +
      "Example:\n" +
      "  aks generate controller users",
    );
  }

  const generator =
    findGenerator(
      generatorName,
    );

  if (!generator) {
    throw new Error(
      `Unknown generator: ${generatorName}`,
    );
  }

  const dryRun =
    options.dryRun ||
    args.includes("--dry-run");

  const force =
    options.force ||
    args.includes("--force");

  const normalized =
    normalizeName(
      resourceName,
    );

  if (!normalized.kebab) {
    throw new Error(
      "Resource name cannot be empty.",
    );
  }

  const result =
    await runGenerator(
      generator,
      {
        cwd:
          options.cwd ??
          process.cwd(),
        name: normalized.kebab,
        originalName: normalized.original,
        write: !dryRun,
        force,
      },
    );

  console.log(
    result.message ??
      `${generator.name} generated successfully.`,
  );

  for (const file of result.files) {
    if (file.written) {
      console.log(
        `  created ${file.path}`,
      );
      continue;
    }

    if (file.existed) {
      console.log(
        `  would overwrite ${file.path}`,
      );
      continue;
    }

    console.log(
      `  would create ${file.path}`,
    );
  }
}
