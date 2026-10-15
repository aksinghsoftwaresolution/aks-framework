
import { join } from "node:path";

import { normalizeName } from "../naming.js";

import type { GeneratorDefinition, GeneratorFile } from "../generator.js";
import type { GeneratorContext } from "../types.js";

export const moduleGenerator: GeneratorDefinition = {
  name: "module",

  description: "Generate an application module.",

  async createFiles(
    context: GeneratorContext,
  ): Promise<GeneratorFile[]> {
    const name = normalizeName(context.name);

    const filePath = join(
      context.cwd,
      "src",
      "modules",
      `${name.kebab}.module.ts`,
    );

    const content =
      `export class ${name.pascal}Module {}\n`;

    return [
      {
        path: filePath,
        content,
      },
    ];
  },
};
