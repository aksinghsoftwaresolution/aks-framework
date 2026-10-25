import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import * as ts from "typescript";

export type GraphNodeType =
  "controller" | "service" | "module" | "middleware" | "other";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  file: string;
  imports: string[];
  runtimeImports: string[];
  incomingDependencies: number;
  outgoingDependencies: number;
  isolated: boolean;
}

export interface GraphResult {
  command: "graph";
  success: boolean;
  root: string;
  nodes: GraphNode[];
  edges: Array<{ from: string; to: string }>;
  cycles: GraphCycle[];
  cyclesTruncated: boolean;
  cycleSearchTruncated: boolean;
  message: string;
}

export interface GraphOptions {
  cwd?: string;
  json?: boolean;
  log?: (message: string) => void;
  maxCycles?: number;
  maxCycleSearchSteps?: number;
}

interface DfsFrame {
  node: string;
  neighbors: string[];
  nextIndex: number;
}

export interface CycleDetectionResult {
  cycles: GraphCycle[];
  truncated: boolean;
  searchTruncated: boolean;
}

const DEFAULT_MAX_CYCLES = 1_000;
const DEFAULT_MAX_CYCLE_SEARCH_STEPS = 1_000_000;

export interface ParsedImports {
  imports: string[];
  runtimeImports: string[];
}

export type GraphCycle = string[];

function detectCyclesWithLimit(
  nodes: GraphNode[],
  edges: Array<{ from: string; to: string }>,
  maxCycles: number,
  maxCycleSearchSteps: number,
): CycleDetectionResult {
  const adjacency = new Map<string, Set<string>>();

  for (const node of nodes) {
    adjacency.set(node.id, new Set());
  }

  for (const edge of edges) {
    adjacency.get(edge.from)?.add(edge.to);
  }

  const sortedAdjacency = new Map<string, string[]>();

  for (const [nodeId, neighbors] of adjacency) {
    sortedAdjacency.set(nodeId, [...neighbors].sort());
  }

  const nodeIds = [...adjacency.keys()].sort();
  const cycles: GraphCycle[] = [];
  const cycleKeys = new Set<string>();
  let truncated = false;
  let searchTruncated = false;
  let searchSteps = 0;

  for (const start of nodeIds) {
    if (truncated || searchTruncated) break;
    const path = [start];
    const inPath = new Set<string>([start]);

    const stack: DfsFrame[] = [
      {
        node: start,
        neighbors: sortedAdjacency.get(start) ?? [],
        nextIndex: 0,
      },
    ];

    while (stack.length > 0 && !truncated && !searchTruncated) {
      const frame = stack[stack.length - 1];

      if (frame.nextIndex >= frame.neighbors.length) {
        stack.pop();

        if (stack.length > 0) {
          const removed = path.pop();

          if (removed !== undefined) {
            inPath.delete(removed);
          }
        }

        continue;
      }

      if (searchSteps >= maxCycleSearchSteps) {
        searchTruncated = true;
        break;
      }

      searchSteps++;

      const next = frame.neighbors[frame.nextIndex++];

      if (next === start) {
        const cycle = [...path, start];
        const key = cycle.join("->");

        if (!cycleKeys.has(key)) {
          if (cycles.length === maxCycles) {
            truncated = true;
            break;
          }

          cycleKeys.add(key);
          cycles.push(cycle);
        }

        continue;
      }

      // Start each cycle at its lexicographically smallest node.
      if (next.localeCompare(start) < 0 || inPath.has(next)) {
        continue;
      }

      path.push(next);
      inPath.add(next);

      stack.push({
        node: next,
        neighbors: sortedAdjacency.get(next) ?? [],
        nextIndex: 0,
      });
    }

    if (truncated || searchTruncated) break;
  }

  cycles.sort((a, b) => a.join("->").localeCompare(b.join("->")));

  return { cycles, truncated, searchTruncated };
}

export function detectCycles(
  nodes: GraphNode[],
  edges: Array<{ from: string; to: string }>,
): GraphCycle[] {
  return detectCyclesWithLimit(
    nodes,
    edges,
    Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER,
  ).cycles;
}

function getNodeType(file: string): GraphNodeType {
  const name = file.toLowerCase();

  if (name.endsWith(".controller.ts")) return "controller";
  if (name.endsWith(".service.ts")) return "service";
  if (name.endsWith(".module.ts")) return "module";
  if (name.endsWith(".middleware.ts")) return "middleware";

  return "other";
}

async function collectFiles(
  directory: string,
  root: string,
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".git" ||
      entry.name === "dist" ||
      entry.name === "coverage"
    ) {
      continue;
    }

    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(path, root)));
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".d.ts")
    ) {
      files.push(path);
    }
  }

  return files;
}

function getImports(source: string): ParsedImports {
  const sourceFile = ts.createSourceFile(
    "graph-source.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const imports = new Set<string>();
  const runtimeImports = new Set<string>();

  function addSpecifier(specifier: string, isRuntime: boolean): void {
    if (!specifier.startsWith(".")) {
      return;
    }

    imports.add(specifier);

    if (isRuntime) {
      runtimeImports.add(specifier);
    }
  }

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;

      if (ts.isStringLiteral(moduleSpecifier)) {
        const clause = node.importClause;
        let isRuntime = true;

        if (clause?.isTypeOnly) {
          isRuntime = false;
        } else if (clause) {
          const bindings = clause.namedBindings;

          if (
            !clause.name &&
            bindings &&
            ts.isNamedImports(bindings) &&
            bindings.elements.length > 0 &&
            bindings.elements.every((element) => element.isTypeOnly)
          ) {
            isRuntime = false;
          }
        }

        addSpecifier(moduleSpecifier.text, isRuntime);
      }
    } else if (ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        addSpecifier(node.moduleSpecifier.text, !node.isTypeOnly);
      }
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      addSpecifier(node.arguments[0].text, true);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return {
    imports: [...imports].sort(),
    runtimeImports: [...runtimeImports].sort(),
  };
}

function getImportCandidates(sourceBase: string): string[] {
  return [
    sourceBase,
    `${sourceBase}.ts`,
    `${sourceBase}.tsx`,
    `${sourceBase}.mts`,
    `${sourceBase}.cts`,
    `${sourceBase}.js`,
    `${sourceBase}/index.ts`,
    `${sourceBase}/index.tsx`,
  ];
}

export function formatGraphResultsJson(result: GraphResult): string {
  return JSON.stringify(result, null, 2);
}

export async function runGraph(options: GraphOptions = {}): Promise<void> {
  const log = options.log ?? console.log;
  const root = resolve(options.cwd ?? process.cwd());

  let result: GraphResult;

  try {
    const files = await collectFiles(root, root);
    const sourceFiles = files.filter(
      (file) => relative(root, file).split(sep)[0] !== "node_modules",
    );

    const nodes: GraphNode[] = [];

    for (const file of sourceFiles) {
      const source = await readFile(file, "utf8");
      const path = relative(root, file).split(sep).join("/");
      const type = getNodeType(path);
      const parsedImports = getImports(source);

      nodes.push({
        id: path,
        type,
        file: path,
        imports: parsedImports.imports,
        runtimeImports: parsedImports.runtimeImports,
        incomingDependencies: 0,
        outgoingDependencies: 0,
        isolated: true,
      });
    }
    nodes.sort((a, b) => a.file.localeCompare(b.file));

    const fileIds = new Set(nodes.map((node) => node.id));
    const edgeKeys = new Set<string>();
    const edges: GraphResult["edges"] = [];

    for (const node of nodes) {
      for (const specifier of node.runtimeImports) {
        const resolvedBase = resolve(root, dirname(node.file), specifier);

        const normalizedBase = relative(root, resolvedBase)
          .split(sep)
          .join("/");

        const sourceBase = normalizedBase.replace(
          /\.(?:js|mjs|cjs|mts|cts)$/,
          "",
        );

        const candidates = getImportCandidates(sourceBase);

        let target = candidates.find((candidate) => fileIds.has(candidate));

        if (!target) {
          const sourceFallback = sourceBase.replace(
            /(^|\/)dist(?=\/|$)/,
            "$1src",
          );

          if (sourceFallback !== sourceBase) {
            target = getImportCandidates(sourceFallback).find((candidate) =>
              fileIds.has(candidate),
            );
          }
        }

        if (target) {
          const edgeKey = `${node.id}->${target}`;

          if (!edgeKeys.has(edgeKey)) {
            edgeKeys.add(edgeKey);
            edges.push({
              from: node.id,
              to: target,
            });
          }
        }
      }
    }

    const incomingCounts = new Map<string, number>();
    const outgoingCounts = new Map<string, number>();
    for (const node of nodes) {
      incomingCounts.set(node.id, 0);
      outgoingCounts.set(node.id, 0);
    }

    for (const edge of edges) {
      outgoingCounts.set(edge.from, (outgoingCounts.get(edge.from) ?? 0) + 1);

      incomingCounts.set(edge.to, (incomingCounts.get(edge.to) ?? 0) + 1);
    }

    for (const node of nodes) {
      node.incomingDependencies = incomingCounts.get(node.id) ?? 0;
      node.outgoingDependencies = outgoingCounts.get(node.id) ?? 0;
      node.isolated =
        node.incomingDependencies === 0 && node.outgoingDependencies === 0;
    }

    const maxCycles = options.maxCycles ?? DEFAULT_MAX_CYCLES;

    if (!Number.isSafeInteger(maxCycles) || maxCycles < 1) {
      throw new Error("maxCycles must be a positive safe integer.");
    }

    const maxCycleSearchSteps =
      options.maxCycleSearchSteps ?? DEFAULT_MAX_CYCLE_SEARCH_STEPS;

    if (!Number.isSafeInteger(maxCycleSearchSteps) || maxCycleSearchSteps < 1) {
      throw new Error("maxCycleSearchSteps must be a positive safe integer.");
    }

    const cycleResult = detectCyclesWithLimit(
      nodes,
      edges,
      maxCycles,
      maxCycleSearchSteps,
    );

    const cycles = cycleResult.cycles;

    result = {
      command: "graph",
      success: true,
      root,
      nodes,
      edges,
      cycles,
      cyclesTruncated: cycleResult.truncated,
      cycleSearchTruncated: cycleResult.searchTruncated,
      message: `Discovered ${nodes.length} TypeScript files and ${edges.length} local import relationships.`,
    };
  } catch (error) {
    result = {
      command: "graph",
      success: false,
      root,
      nodes: [],
      edges: [],
      cycles: [],
      cyclesTruncated: false,
      cycleSearchTruncated: false,
      message: error instanceof Error ? error.message : String(error),
    };

    process.exitCode = 1;
  }

  if (options.json) {
    log(formatGraphResultsJson(result));
    return;
  }

  log("AKS Dependency Graph");
  log("");
  log(`Root: ${result.root}`);
  log(result.message);

  if (!result.success) return;

  const isolatedCount = result.nodes.filter((node) => node.isolated).length;

  log("");
  log("Graph Summary");
  log(`  Files: ${result.nodes.length}`);
  log(`  Import relationships: ${result.edges.length}`);
  log(`  Isolated files: ${isolatedCount}`);
  log(`  Circular dependencies: ${result.cycles.length}`);
  if (result.cyclesTruncated) {
    log(
      `  Warning: cycle list truncated at ${
        options.maxCycles ?? DEFAULT_MAX_CYCLES
      } cycles.`,
    );
  }
  if (result.cycleSearchTruncated) {
    log(
      "  Warning: cycle search stopped after reaching " +
        `${options.maxCycleSearchSteps ?? DEFAULT_MAX_CYCLE_SEARCH_STEPS} ` +
        "examined edges. The cycle list may be incomplete.",
    );
  }

  log("");
  log("Files");

  for (const node of result.nodes) {
    log(`[${node.type}] ${node.id}`);

    for (const specifier of node.imports) {
      log(`  imports: ${specifier}`);
    }
  }

  log("");
  log("Circular dependencies:");

  if (result.cycles.length === 0) {
    log("  No circular dependencies detected.");
  } else {
    for (const cycle of result.cycles) {
      log(`  ${cycle.join(" -> ")}`);
    }
  }
}
