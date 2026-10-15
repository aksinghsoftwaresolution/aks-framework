import type {
  GeneratorDefinition,
} from "./generator.js";

import {
  controllerGenerator,
} from "./generators/controller.js";

import {
  serviceGenerator,
} from "./generators/service.js";

import {
  moduleGenerator,
} from "./generators/module.js";

import {
  middlewareGenerator,
} from "./generators/middleware.js";

const generators: GeneratorDefinition[] = [
  controllerGenerator,
  serviceGenerator,
  moduleGenerator,
  middlewareGenerator
];

export function getGenerators(): GeneratorDefinition[] {
  return generators;
}

export function findGenerator(
  name: string,
): GeneratorDefinition | undefined {
  return generators.find(
    (generator) =>
      generator.name === name,
  );
}