
import { join } from "node:path";

import { normalizeName } from "../naming.js";

import type { GeneratorContext } from "../types.js";
import type { GeneratorDefinition, GeneratorFile } from "../generator.js";

export const serviceGenerator: GeneratorDefinition = {
  name: "service",

  description: "Generate an application service.",

  async createFiles(
    context: GeneratorContext,
  ): Promise<GeneratorFile[]> {
    const name = normalizeName(context.name);

    const filePath = join(
      context.cwd,
      "src",
      "services",
      `${name.kebab}.service.ts`,
    );

    const content =
      `export class ${name.pascal}Service {}\n`;

    return [
      {
        path: filePath,
        content,
      },
    ];
  },
};
