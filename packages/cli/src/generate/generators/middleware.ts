import {
  join,
} from "node:path";

import { normalizeName } from "../naming.js";

import type {
GeneratorDefinition,
GeneratorFile,
} from "../generator.js";

import type {
GeneratorContext,
} from "../types.js";

export const middlewareGenerator: GeneratorDefinition = {
name: "middleware",

description: "Generate application middleware.",

async createFiles(
context: GeneratorContext,
): Promise<GeneratorFile[]> {
const name = normalizeName(context.name);

const functionName =
  `${name.pascal[0].toLowerCase()}${name.pascal.slice(1)}Middleware`;

const filePath = join(
  context.cwd,
  "src",
  "middleware",
  `${name.kebab}.middleware.ts`,
);

const content = [
  'import type { Middleware } from "@aks-framework/core";',
  "",
  `export const ${functionName}: Middleware = async (ctx, next) => {`,
  "  // TODO: Add middleware logic.",
  "  await next();",
  "};",
  "",
].join("\n");

return [
  {
    path: filePath,
    content,
  },
];

},
};