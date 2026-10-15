import type {
  GenerateResult,
  GeneratedFile,
  Generator,
  GeneratorContext,
} from "./types.js";

import {
  writeGeneratedFile,
} from "./filesystem.js";

export interface GeneratorFile {
  path: string;
  content: string;
}

export interface GeneratorDefinition
  extends Generator {
  createFiles(
    context: GeneratorContext,
  ): Promise<GeneratorFile[]>;
}

export async function runGenerator(
  generator: GeneratorDefinition,
  context: GeneratorContext,
): Promise<GenerateResult> {
  const files =
    await generator.createFiles(
      context,
    );

  const generatedFiles: GeneratedFile[] = [];

  for (const file of files) {
    const result =
      await writeGeneratedFile(
        file.path,
        file.content,
        {
          force: context.force,
          dryRun: !context.write,
        },
      );

    generatedFiles.push(result);
  }

  return {
    success: true,
    generator: generator.name,
    name: context.name,
    files: generatedFiles,
    message:
      `${generator.name} generated successfully.`,
  };
}