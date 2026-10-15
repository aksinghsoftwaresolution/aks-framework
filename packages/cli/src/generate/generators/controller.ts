import {
  join,
} from "node:path";

import {
  normalizeName,
} from "../naming.js";

import type {
  GeneratorContext,
} from "../types.js";

import type {
  GeneratorFile,
} from "../generator.js";

export interface ControllerGenerator {
  readonly name: "controller";
  readonly description: string;

  createFiles(
    context: GeneratorContext,
  ): Promise<GeneratorFile[]>;
}

export const controllerGenerator:
  ControllerGenerator = {
    name: "controller",

    description:
      "Generate an HTTP controller.",

    async createFiles(
      context,
    ) {
      const name =
        normalizeName(
          context.name,
        );

      const filePath =
        join(
          context.cwd,
          "src",
          "controllers",
          `${name.kebab}.controller.ts`,
        );

      const content = `export class ${name.pascal}Controller {}
`;

      return [
        {
          path: filePath,
          content,
        },
      ];
    },
  };