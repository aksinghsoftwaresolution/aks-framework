import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { detectCycles, runGraph } from "../../src/commands/graph.js";

describe("graph command", () => {
  let root: string;

  afterEach(async () => {
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  async function createProject(): Promise<string> {
    root = await mkdtemp(join(tmpdir(), "aks-graph-"));
    return root;
  }

  it("does not report type-only imports as runtime dependencies", async () => {
    const cwd = await createProject();

    await mkdir(join(cwd, "src"), { recursive: true });

    await writeFile(
      join(cwd, "src", "app.ts"),
      [
        'import type { Service } from "./service.js";',
        "export type { Service };",
        "export const app = true;",
      ].join("\n"),
    );

    await writeFile(
      join(cwd, "src", "service.ts"),
      [
        'import type { App } from "./app.js";',
        "export interface Service {",
        "  app?: App;",
        "}",
      ].join("\n"),
    );

    const logs: string[] = [];

    await runGraph({
      cwd,
      json: true,
      log: (message) => logs.push(message),
    });

    const result = JSON.parse(logs.join("\n"));

    expect(result.success).toBe(true);
    expect(result.edges).toEqual([]);
    expect(result.cycleSearchTruncated).toBe(false);
    expect(result.cycles).toEqual([]);

    const app = result.nodes.find(
      (node: { file: string }) => node.file === "src/app.ts",
    );

    expect(app.imports).toContain("./service.js");
    expect(app.runtimeImports).not.toContain("./service.js");
  });

  it("classifies inline type imports as type-only dependencies", async () => {
    const cwd = await createProject();

    await mkdir(join(cwd, "src"), { recursive: true });

    await writeFile(
      join(cwd, "src", "app.ts"),
      [
        'import { type Service } from "./service.js";',
        "export const app = true;",
      ].join("\n"),
    );

    await writeFile(
      join(cwd, "src", "service.ts"),
      ["export interface Service {", "  name: string;", "}"].join("\n"),
    );

    const logs: string[] = [];

    await runGraph({
      cwd,
      json: true,
      log: (message) => logs.push(message),
    });

    const result = JSON.parse(logs.join("\n"));
    const app = result.nodes.find(
      (node: { file: string }) => node.file === "src/app.ts",
    );

    expect(app.imports).toContain("./service.js");
    expect(app.runtimeImports).not.toContain("./service.js");
    expect(result.edges).toEqual([]);
  });

  it("classifies runtime imports as runtime dependencies", async () => {
    const cwd = await createProject();

    await mkdir(join(cwd, "src"), { recursive: true });

    await writeFile(
      join(cwd, "src", "app.ts"),
      [
        'import { Service } from "./service.js";',
        "export const app = new Service();",
      ].join("\n"),
    );

    await writeFile(
      join(cwd, "src", "service.ts"),
      ["export class Service {}"].join("\n"),
    );

    const logs: string[] = [];

    await runGraph({
      cwd,
      json: true,
      log: (message) => logs.push(message),
    });

    const result = JSON.parse(logs.join("\n"));
    const app = result.nodes.find(
      (node: { file: string }) => node.file === "src/app.ts",
    );

    expect(app.runtimeImports).toContain("./service.js");
    expect(result.edges).toHaveLength(1);
  });

  it("classifies type-only re-exports as non-runtime dependencies", async () => {
    const cwd = await createProject();

    await mkdir(join(cwd, "src"), { recursive: true });

    await writeFile(
      join(cwd, "src", "index.ts"),
      [
        'export type { Service } from "./service.js";',
        "export const ready = true;",
      ].join("\n"),
    );

    await writeFile(
      join(cwd, "src", "service.ts"),
      ["export interface Service {", "  name: string;", "}"].join("\n"),
    );

    const logs: string[] = [];

    await runGraph({
      cwd,
      json: true,
      log: (message) => logs.push(message),
    });

    const result = JSON.parse(logs.join("\n"));
    const index = result.nodes.find(
      (node: { file: string }) => node.file === "src/index.ts",
    );

    expect(index.imports).toContain("./service.js");
    expect(index.runtimeImports).not.toContain("./service.js");
    expect(result.edges).toEqual([]);
  });

  it("classifies runtime re-exports as runtime dependencies", async () => {
    const cwd = await createProject();

    await mkdir(join(cwd, "src"), { recursive: true });

    await writeFile(
      join(cwd, "src", "index.ts"),
      ['export { Service } from "./service.js";'].join("\n"),
    );

    await writeFile(
      join(cwd, "src", "service.ts"),
      ["export class Service {}"].join("\n"),
    );

    const logs: string[] = [];

    await runGraph({
      cwd,
      json: true,
      log: (message) => logs.push(message),
    });

    const result = JSON.parse(logs.join("\n"));
    const index = result.nodes.find(
      (node: { file: string }) => node.file === "src/index.ts",
    );

    expect(index.runtimeImports).toContain("./service.js");
    expect(result.edges).toHaveLength(1);
  });

  it("classifies dynamic imports as runtime dependencies", async () => {
    const cwd = await createProject();

    await mkdir(join(cwd, "src"), { recursive: true });

    await writeFile(
      join(cwd, "src", "app.ts"),
      [
        "export async function loadService() {",
        '  return import("./service.js");',
        "}",
      ].join("\n"),
    );

    await writeFile(
      join(cwd, "src", "service.ts"),
      ["export const service = true;"].join("\n"),
    );

    const logs: string[] = [];

    await runGraph({
      cwd,
      json: true,
      log: (message) => logs.push(message),
    });

    const result = JSON.parse(logs.join("\n"));
    const app = result.nodes.find(
      (node: { file: string }) => node.file === "src/app.ts",
    );

    expect(app.runtimeImports).toContain("./service.js");
    expect(result.edges).toHaveLength(1);
  });

  it("discovers TypeScript files and classifies generated components", async () => {
    const cwd = await createProject();

    await mkdir(join(cwd, "src"), { recursive: true });
    await writeFile(
      join(cwd, "src", "users.controller.ts"),
      "export const usersController = true;",
    );
    await writeFile(
      join(cwd, "src", "users.service.ts"),
      "export const usersService = true;",
    );
    await writeFile(
      join(cwd, "src", "users.module.ts"),
      "export const usersModule = true;",
    );
    await writeFile(
      join(cwd, "src", "auth.middleware.ts"),
      "export const authMiddleware = true;",
    );

    const logs: string[] = [];

    await runGraph({
      cwd,
      json: true,
      log: (message) => logs.push(message),
    });

    const result = JSON.parse(logs.join("\n"));

    expect(result.success).toBe(true);
    expect(result.nodes).toHaveLength(4);
    expect(
      result.nodes.map((node: { type: string }) => node.type).sort(),
    ).toEqual(["controller", "middleware", "module", "service"]);
  });

  it("resolves JavaScript-style imports to TypeScript files", async () => {
    const cwd = await createProject();

    await mkdir(join(cwd, "src"), { recursive: true });
    await writeFile(
      join(cwd, "src", "app.ts"),
      'import { service } from "./service.js";\nexport { service };',
    );
    await writeFile(
      join(cwd, "src", "service.ts"),
      "export const service = true;",
    );

    const logs: string[] = [];

    await runGraph({
      cwd,
      json: true,
      log: (message) => logs.push(message),
    });

    const result = JSON.parse(logs.join("\n"));

    expect(result.edges).toContainEqual({
      from: "src/app.ts",
      to: "src/service.ts",
    });
  });

  it("resolves dist JavaScript imports to TypeScript source files", async () => {
    const cwd = await createProject();

    await mkdir(join(cwd, "examples"), { recursive: true });
    await mkdir(join(cwd, "packages", "core", "src"), {
      recursive: true,
    });
    await mkdir(join(cwd, "packages", "core", "dist"), {
      recursive: true,
    });

    await writeFile(
      join(cwd, "examples", "hello-api.ts"),
      [
        'import { AKSApp } from "../packages/core/dist/index.js";',
        "export { AKSApp };",
      ].join("\n"),
    );

    await writeFile(
      join(cwd, "packages", "core", "src", "index.ts"),
      "export const AKSApp = true;",
    );

    await writeFile(
      join(cwd, "packages", "core", "dist", "index.js"),
      "export const AKSApp = true;",
    );

    const logs: string[] = [];

    await runGraph({
      cwd,
      json: true,
      log: (message) => logs.push(message),
    });

    const result = JSON.parse(logs.join("\n"));

    expect(result.success).toBe(true);
    expect(
      result.nodes.map((node: { file: string }) => node.file),
    ).not.toContain("packages/core/dist/index.js");

    expect(result.edges).toContainEqual({
      from: "examples/hello-api.ts",
      to: "packages/core/src/index.ts",
    });
  });

  it("outputs valid JSON with the graph command metadata", async () => {
    const cwd = await createProject();
    const logs: string[] = [];

    await runGraph({
      cwd,
      json: true,
      log: (message) => logs.push(message),
    });

    const result = JSON.parse(logs.join("\n"));

    expect(result.command).toBe("graph");
    expect(result.success).toBe(true);
    expect(result.root).toBe(cwd);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it("excludes generated dist and node_modules directories", async () => {
    const cwd = await createProject();

    await mkdir(join(cwd, "src"), { recursive: true });
    await mkdir(join(cwd, "dist"), { recursive: true });
    await mkdir(join(cwd, "node_modules", "example"), {
      recursive: true,
    });

    await writeFile(join(cwd, "src", "app.ts"), "export const app = true;");
    await writeFile(
      join(cwd, "dist", "app.ts"),
      "export const builtApp = true;",
    );
    await writeFile(
      join(cwd, "node_modules", "example", "index.ts"),
      "export const dependency = true;",
    );

    const logs: string[] = [];

    await runGraph({
      cwd,
      json: true,
      log: (message) => logs.push(message),
    });

    const result = JSON.parse(logs.join("\n"));

    expect(result.nodes.map((node: { file: string }) => node.file)).toEqual([
      "src/app.ts",
    ]);
  });

  it("does not create edges for external package imports", async () => {
    const cwd = await createProject();

    await mkdir(join(cwd, "src"), { recursive: true });

    await writeFile(
      join(cwd, "src", "app.ts"),
      [
        'import { readFile } from "node:fs/promises";',
        'import { describe } from "vitest";',
        'import { service } from "./service.js";',
        "export { readFile, describe, service };",
      ].join("\n"),
    );

    await writeFile(
      join(cwd, "src", "service.ts"),
      "export const service = true;",
    );

    const logs: string[] = [];

    await runGraph({
      cwd,
      json: true,
      log: (message) => logs.push(message),
    });

    const result = JSON.parse(logs.join("\n"));

    expect(result.success).toBe(true);
    expect(result.edges).toEqual([
      {
        from: "src/app.ts",
        to: "src/service.ts",
      },
    ]);
  });

  it("does not create edges for unresolved relative imports", async () => {
    const cwd = await createProject();

    await mkdir(join(cwd, "src"), { recursive: true });

    await writeFile(
      join(cwd, "src", "app.ts"),
      ['import { missing } from "./missing.js";', "export { missing };"].join(
        "\n",
      ),
    );

    const logs: string[] = [];

    await runGraph({
      cwd,
      json: true,
      log: (message) => logs.push(message),
    });

    const result = JSON.parse(logs.join("\n"));

    expect(result.success).toBe(true);
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toEqual([]);
  });

  it("does not create duplicate edges for the same target file", async () => {
    const cwd = await createProject();

    await mkdir(join(cwd, "src"), { recursive: true });

    await writeFile(
      join(cwd, "src", "app.ts"),
      [
        'import { service as first } from "./service";',
        'import { service as second } from "./service.js";',
        "export { first, second };",
      ].join("\n"),
    );

    await writeFile(
      join(cwd, "src", "service.ts"),
      "export const service = true;",
    );

    const logs: string[] = [];

    await runGraph({
      cwd,
      json: true,
      log: (message) => logs.push(message),
    });

    const result = JSON.parse(logs.join("\n"));

    expect(result.success).toBe(true);
    expect(result.edges).toEqual([
      {
        from: "src/app.ts",
        to: "src/service.ts",
      },
    ]);
  });

  it("counts incoming dependencies", async () => {
    const cwd = await createProject();

    await mkdir(join(cwd, "src"), { recursive: true });

    await writeFile(
      join(cwd, "src", "app.ts"),
      'import { service } from "./service.js";\nexport { service };',
    );

    await writeFile(
      join(cwd, "src", "worker.ts"),
      'import { service } from "./service.js";\nexport { service };',
    );

    await writeFile(
      join(cwd, "src", "service.ts"),
      "export const service = true;",
    );

    const logs: string[] = [];

    await runGraph({
      cwd,
      json: true,
      log: (message) => logs.push(message),
    });

    const result = JSON.parse(logs.join("\n"));
    const service = result.nodes.find(
      (node: { file: string }) => node.file === "src/service.ts",
    );

    expect(service.incomingDependencies).toBe(2);
  });

  it("counts outgoing dependencies", async () => {
    const cwd = await createProject();

    await mkdir(join(cwd, "src"), { recursive: true });

    await writeFile(
      join(cwd, "src", "app.ts"),
      [
        'import { service } from "./service.js";',
        'import { repository } from "./repository.js";',
        "export { service, repository };",
      ].join("\n"),
    );

    await writeFile(
      join(cwd, "src", "service.ts"),
      "export const service = true;",
    );

    await writeFile(
      join(cwd, "src", "repository.ts"),
      "export const repository = true;",
    );

    const logs: string[] = [];

    await runGraph({
      cwd,
      json: true,
      log: (message) => logs.push(message),
    });

    const result = JSON.parse(logs.join("\n"));
    const app = result.nodes.find(
      (node: { file: string }) => node.file === "src/app.ts",
    );

    expect(app.outgoingDependencies).toBe(2);
  });

  it("detects isolated files", async () => {
    const cwd = await createProject();

    await mkdir(join(cwd, "src"), { recursive: true });

    await writeFile(
      join(cwd, "src", "app.ts"),
      'import { service } from "./service.js";\nexport { service };',
    );

    await writeFile(
      join(cwd, "src", "service.ts"),
      "export const service = true;",
    );

    await writeFile(
      join(cwd, "src", "standalone.ts"),
      "export const standalone = true;",
    );

    const logs: string[] = [];

    await runGraph({
      cwd,
      json: true,
      log: (message) => logs.push(message),
    });

    const result = JSON.parse(logs.join("\n"));

    const app = result.nodes.find(
      (node: { file: string }) => node.file === "src/app.ts",
    );
    const service = result.nodes.find(
      (node: { file: string }) => node.file === "src/service.ts",
    );
    const standalone = result.nodes.find(
      (node: { file: string }) => node.file === "src/standalone.ts",
    );

    expect(app.isolated).toBe(false);
    expect(service.isolated).toBe(false);
    expect(standalone.isolated).toBe(true);
  });

  it("detects a direct circular dependency", () => {
    const nodes = [{ id: "a.ts" }, { id: "b.ts" }].map((node) => ({
      ...node,
      type: "other" as const,
      file: node.id,
      imports: [],
      runtimeImports: [],
      incomingDependencies: 0,
      outgoingDependencies: 0,
      isolated: false,
    }));

    const cycles = detectCycles(nodes, [
      { from: "a.ts", to: "b.ts" },
      { from: "b.ts", to: "a.ts" },
    ]);

    expect(cycles).toEqual([["a.ts", "b.ts", "a.ts"]]);
  });

  it("detects a circular dependency involving three files", () => {
    const nodes = ["a.ts", "b.ts", "c.ts"].map((id) => ({
      id,
      type: "other" as const,
      file: id,
      imports: [],
      runtimeImports: [],
      incomingDependencies: 0,
      outgoingDependencies: 0,
      isolated: false,
    }));

    const cycles = detectCycles(nodes, [
      { from: "a.ts", to: "b.ts" },
      { from: "b.ts", to: "c.ts" },
      { from: "c.ts", to: "a.ts" },
    ]);

    expect(cycles).toEqual([["a.ts", "b.ts", "c.ts", "a.ts"]]);
  });

  it("closes a canonicalized cycle using its canonical starting node", () => {
    const nodes = ["a.ts", "b.ts", "c.ts"].map((id) => ({
      id,
      type: "other" as const,
      file: id,
      imports: [],
      runtimeImports: [],
      incomingDependencies: 0,
      outgoingDependencies: 0,
      isolated: false,
    }));

    const cycles = detectCycles(nodes, [
      { from: "c.ts", to: "b.ts" },
      { from: "b.ts", to: "a.ts" },
      { from: "a.ts", to: "c.ts" },
    ]);

    expect(cycles).toEqual([["a.ts", "c.ts", "b.ts", "a.ts"]]);
  });

  it("detects distinct overlapping cycles without duplicates", () => {
    const nodes = ["a.ts", "b.ts", "c.ts", "d.ts"].map((id) => ({
      id,
      type: "other" as const,
      file: id,
      imports: [],
      runtimeImports: [],
      incomingDependencies: 0,
      outgoingDependencies: 0,
      isolated: false,
    }));

    const cycles = detectCycles(nodes, [
      { from: "a.ts", to: "b.ts" },
      { from: "b.ts", to: "a.ts" },
      { from: "b.ts", to: "c.ts" },
      { from: "c.ts", to: "a.ts" },
      { from: "a.ts", to: "d.ts" },
      { from: "d.ts", to: "b.ts" },
    ]);

    expect(cycles).toEqual([
      ["a.ts", "b.ts", "a.ts"],
      ["a.ts", "b.ts", "c.ts", "a.ts"],
      ["a.ts", "d.ts", "b.ts", "a.ts"],
      ["a.ts", "d.ts", "b.ts", "c.ts", "a.ts"],
    ]);
  });

  it("returns no cycles for an acyclic graph", () => {
    const nodes = ["a.ts", "b.ts", "c.ts"].map((id) => ({
      id,
      type: "other" as const,
      file: id,
      imports: [],
      runtimeImports: [],
      incomingDependencies: 0,
      outgoingDependencies: 0,
      isolated: false,
    }));

    const cycles = detectCycles(nodes, [
      { from: "a.ts", to: "b.ts" },
      { from: "b.ts", to: "c.ts" },
    ]);

    expect(cycles).toEqual([]);
  });

  it("displays circular dependencies in human-readable output", async () => {
    const cwd = await createProject();

    await mkdir(join(cwd, "src"), { recursive: true });

    await writeFile(
      join(cwd, "src", "a.ts"),
      'import { b } from "./b.js";\nexport { b };',
    );

    await writeFile(
      join(cwd, "src", "b.ts"),
      'import { a } from "./a.js";\nexport { a };',
    );

    const logs: string[] = [];

    await runGraph({
      cwd,
      log: (message) => logs.push(message),
    });

    const output = logs.join("\n");

    expect(output).toContain("Circular dependencies: 1");
    expect(output).toContain("src/a.ts -> src/b.ts -> src/a.ts");
  });

  it("displays graph summary counts in human-readable output", async () => {
    const cwd = await createProject();

    await mkdir(join(cwd, "src"), { recursive: true });

    await writeFile(
      join(cwd, "src", "app.ts"),
      'import { service } from "./service.js";\nexport { service };',
    );

    await writeFile(
      join(cwd, "src", "service.ts"),
      "export const service = true;",
    );

    await writeFile(
      join(cwd, "src", "standalone.ts"),
      "export const standalone = true;",
    );

    const logs: string[] = [];

    await runGraph({
      cwd,
      log: (message) => logs.push(message),
    });

    const output = logs.join("\n");

    expect(output).toContain("Graph Summary");
    expect(output).toContain("Files: 3");
    expect(output).toContain("Import relationships: 1");
    expect(output).toContain("Isolated files: 1");
    expect(output).toContain("Circular dependencies: 0");
  });

  it("detects a self-referencing dependency", () => {
    const nodes = [
      {
        id: "a.ts",
        type: "other" as const,
        file: "a.ts",
        imports: ["./a.js"],
        runtimeImports: ["./a.js"],
        incomingDependencies: 1,
        outgoingDependencies: 1,
        isolated: false,
      },
    ];

    const cycles = detectCycles(nodes, [{ from: "a.ts", to: "a.ts" }]);

    expect(cycles).toEqual([["a.ts", "a.ts"]]);
  });

  it("reports when circular dependency output is truncated", async () => {
    const cwd = await createProject();

    await mkdir(join(cwd, "src"), { recursive: true });

    // Every pair of files forms a two-way cycle.
    // Six files create many distinct cycles.
    const files = ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts", "f.ts"];

    for (const file of files) {
      const imports = files
        .filter((other) => other !== file)
        .map((other) => `import "./${other}";`);

      await writeFile(join(cwd, "src", file), imports.join("\n"));
    }

    const logs: string[] = [];

    await runGraph({
      cwd,
      json: true,
      maxCycles: 1,
      log: (message) => logs.push(message),
    });

    const result = JSON.parse(logs.join("\n"));

    expect(result.success).toBe(true);
    expect(result.cyclesTruncated).toBe(true);
    expect(result.cycleSearchTruncated).toBe(false);
    expect(result.cycles).toHaveLength(1);
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["fractional", 1.5],
    ["NaN", Number.NaN],
    ["infinity", Number.POSITIVE_INFINITY],
    ["unsafe integer", Number.MAX_SAFE_INTEGER + 1],
  ])("rejects %s maxCycles", async (_label, maxCycles) => {
    const cwd = await createProject();
    const logs: string[] = [];

    await runGraph({
      cwd,
      json: true,
      maxCycles,
      log: (message) => logs.push(message),
    });

    const result = JSON.parse(logs.join("\n"));

    expect(result.success).toBe(false);
    expect(result.message).toBe("maxCycles must be a positive safe integer.");
    expect(result.cycles).toEqual([]);
    expect(result.cyclesTruncated).toBe(false);
  });

  it("handles a cycle with more than 12,000 nodes without recursion", () => {
    const chainLength = 12_000;
    const descendingIds = Array.from(
      { length: chainLength },
      (_, index) => `n${String(chainLength - 1 - index).padStart(5, "0")}.ts`,
    );

    const ids = ["a.ts", ...descendingIds];

    const nodes = ids.map((id) => ({
      id,
      type: "other" as const,
      file: id,
      imports: [],
      runtimeImports: [],
      incomingDependencies: 0,
      outgoingDependencies: 0,
      isolated: false,
    }));

    const edges = [
      ...ids.slice(0, -1).map((id, index) => ({
        from: id,
        to: ids[index + 1],
      })),
      {
        from: ids[ids.length - 1],
        to: "a.ts",
      },
    ];

    const cycles = detectCycles(nodes, edges);

    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toHaveLength(chainLength + 2);
    expect(cycles[0][0]).toBe("a.ts");
    expect(cycles[0][cycles[0].length - 1]).toBe("a.ts");
  });

  it("reports when cycle search exhausts its work budget", async () => {
    const cwd = await createProject();

    await mkdir(join(cwd, "src"), { recursive: true });

    await writeFile(join(cwd, "src", "a.ts"), 'import "./b";\n');

    await writeFile(join(cwd, "src", "b.ts"), 'import "./a";\n');

    const logs: string[] = [];

    await runGraph({
      cwd,
      json: true,
      maxCycleSearchSteps: 1,
      log: (message) => logs.push(message),
    });

    const result = JSON.parse(logs.join("\n"));

    expect(result.success).toBe(true);
    expect(result.cycleSearchTruncated).toBe(true);
    expect(result.cycles).toEqual([]);
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["fractional", 1.5],
    ["NaN", Number.NaN],
    ["infinity", Number.POSITIVE_INFINITY],
    ["unsafe integer", Number.MAX_SAFE_INTEGER + 1],
  ])("rejects %s maxCycleSearchSteps", async (_label, maxCycleSearchSteps) => {
    const cwd = await createProject();
    const logs: string[] = [];

    await runGraph({
      cwd,
      json: true,
      maxCycleSearchSteps,
      log: (message) => logs.push(message),
    });

    const result = JSON.parse(logs.join("\n"));

    expect(result.success).toBe(false);
    expect(result.message).toBe(
      "maxCycleSearchSteps must be a positive safe integer.",
    );
    expect(result.cycles).toEqual([]);
    expect(result.cyclesTruncated).toBe(false);
    expect(result.cycleSearchTruncated).toBe(false);
  });
});
