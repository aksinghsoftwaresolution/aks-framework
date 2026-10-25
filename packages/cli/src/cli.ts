#!/usr/bin/env node

import { AKS_VERSION } from "@aks-framework/core";
import { runDoctor } from "./commands/doctor.js";
import { runGenerate } from "./commands/generate.js";
import { runUpdate } from "./commands/update.js";
import { runDiagnose } from "./commands/diagnose.js";
import { runHealth } from "./commands/health.js";
import { runGraph } from "./commands/graph.js";
import { runContract } from "./commands/contract.js";

export type CLICommand = {
  name: string;
  description: string;
  execute: (args: string[]) => void | Promise<void>;
};

const commands: CLICommand[] = [
  {
    name: "update",
    description: "Check for available AKS Framework updates",
    execute: (args) =>
      runUpdate({
        dryRun: args.includes("--dry-run"),
      }),
  },
  {
    name: "health",
    description: "Check application health",
    execute: (args) => {
      const urlIndex = args.indexOf("--url");
      const urlCandidate = urlIndex !== -1 ? args[urlIndex + 1] : undefined;

      return runHealth({
        url: urlCandidate?.startsWith("--") ? undefined : urlCandidate,
        json: args.includes("--json"),
      });
    },
  },
  {
    name: "doctor",
    description: "Diagnose the current AKS application",
    execute: (args) =>
      runDoctor({
        json: args.includes("--json"),
        fix: args.includes("--fix"),
      }),
  },
  {
    name: "generate",
    description: "Generate AKS application resources",
    execute: (args) => runGenerate(args),
  },
  {
    name: "diagnose",
    description: "Diagnose application and runtime problems",
    execute: (args) =>
      runDiagnose({
        json: args.includes("--json"),
      }),
  },
  {
    name: "graph",
    description: "Inspect the application dependency graph",
    execute: (args) =>
      runGraph({
        json: args.includes("--json"),
      }),
  },
  {
    name: "contract",
    description: "Validate an OpenAPI API contract",
    execute: (args) => {
      const fileIndex = args.indexOf("--file");
      const fileCandidate = fileIndex !== -1 ? args[fileIndex + 1] : undefined;

      return runContract({
        file:
          fileCandidate && !fileCandidate.startsWith("--")
            ? fileCandidate
            : undefined,
        json: args.includes("--json"),
      });
    },
  },
  {
    name: "security",
    description: "Inspect application security",
    execute: () => {
      console.log("AKS security is not implemented yet.");
    },
  },
];

function printHelp(): void {
  console.log("AKS Framework CLI");
  console.log("");
  console.log("Usage:");
  console.log("  aks <command> [options]");
  console.log("  aks --version");
  console.log("  aks --help");
  console.log("  aks <command> --help");
  console.log("");
  console.log("Commands:");

  for (const command of commands) {
    console.log(`  ${command.name.padEnd(12)} ${command.description}`);
  }

  console.log("");
  console.log("Global options:");
  console.log("  -v, --version  Show the AKS Framework version");
  console.log("  -h, --help     Show help");
  console.log("");
  console.log("Run 'aks <command> --help' for command-specific options.");
}

function printCommandHelp(commandName: string): void {
  switch (commandName) {
    case "generate":
      console.log("AKS Framework Generate");
      console.log("");
      console.log("Usage:");
      console.log("  aks generate <generator> <name> [options]");
      console.log("");
      console.log("Arguments:");
      console.log("  <generator>  Resource type to generate");
      console.log("  <name>       Name of the resource");
      console.log("");
      console.log("Options:");
      console.log("  --dry-run    Preview generated files without writing");
      console.log("  --force      Overwrite existing generated files");
      console.log("  -h, --help   Show this help");
      console.log("");
      console.log("Examples:");
      console.log("  aks generate controller users");
      console.log("  aks generate service users --dry-run");
      console.log("  aks generate controller users --force");
      break;

    case "doctor":
      console.log("AKS Framework Doctor");
      console.log("");
      console.log("Usage:");
      console.log("  aks doctor [options]");
      console.log("");
      console.log("Options:");
      console.log("  --json       Output diagnostics as JSON");
      console.log(
        "  --fix        Offer safe dependency updates for confirmation",
      );
      console.log("  -h, --help   Show this help");
      console.log("");
      console.log("Examples:");
      console.log("  aks doctor");
      console.log("  aks doctor --json");
      console.log("  aks doctor --fix");
      console.log("");
      console.log("Note:");
      console.log("  JSON mode is read-only, even when --fix is supplied.");
      break;

    case "update":
      console.log("AKS Framework Update");
      console.log("");
      console.log("Usage:");
      console.log("  aks update [options]");
      console.log("");
      console.log("Options:");
      console.log(
        "  --dry-run    Preview available updates without changing files",
      );
      console.log("  -h, --help   Show this help");
      console.log("");
      console.log("Examples:");
      console.log("  aks update");
      console.log("  aks update --dry-run");
      console.log("");
      console.log("Note:");
      console.log("  Updates are not installed automatically.");
      console.log(
        "  Review the proposed package-manager command before running it.",
      );
      break;

    case "diagnose":
      console.log("AKS Framework Diagnose");
      console.log("");
      console.log("Usage:");
      console.log("  aks diagnose [options]");
      console.log("");
      console.log("Options:");
      console.log("  --json       Output diagnostics as JSON");
      console.log("  -h, --help   Show this help");
      console.log("");
      console.log("Examples:");
      console.log("  aks diagnose");
      console.log("  aks diagnose --json");
      console.log("");
      console.log("This command is read-only.");
      break;

    case "health":
      console.log("AKS Framework Health");
      console.log("");
      console.log("Usage:");
      console.log("  aks health --url <endpoint> [options]");
      console.log("");
      console.log("Options:");
      console.log("  --url <endpoint>  HTTP or HTTPS endpoint to check");
      console.log("  --json            Output the result as JSON");
      console.log("  -h, --help        Show this help");
      console.log("");
      console.log("Examples:");
      console.log("  aks health --url http://localhost:3000/health");
      console.log("  aks health --url http://localhost:3000/health --json");
      break;

    case "graph":
      console.log("AKS Framework Graph");
      console.log("");
      console.log("Usage:");
      console.log("  aks graph [options]");
      console.log("");
      console.log("Options:");
      console.log("  --json       Output the dependency graph as JSON");
      console.log("  -h, --help   Show this help");
      console.log("");
      console.log("Examples:");
      console.log("  aks graph");
      console.log("  aks graph --json");
      break;

    case "contract":
      console.log("AKS Framework Contract");
      console.log("");
      console.log("Usage:");
      console.log("  aks contract --file <path> [options]");
      console.log("");
      console.log("Options:");
      console.log("  --file <path>  OpenAPI JSON or YAML document");
      console.log("  --json         Output the result as JSON");
      console.log("  -h, --help     Show this help");
      console.log("");
      console.log("Examples:");
      console.log("  aks contract --file openapi.yaml");
      console.log("  aks contract --file openapi.json --json");
      break;

    default: {
      const command = commands.find((item) => item.name === commandName);

      if (!command) {
        console.error(`Unknown command: ${commandName}`);
        console.error("");
        console.error("Run 'aks --help' to see available commands.");
        process.exitCode = 1;
        return;
      }

      console.log(`AKS Framework ${command.name}`);
      console.log("");
      console.log(`  ${command.description}`);
      console.log("");
      console.log("Usage:");
      console.log(`  aks ${command.name} [options]`);
      console.log("");
      console.log(
        "This command does not have additional options documented yet.",
      );
      break;
    }
  }
}

function printVersion(): void {
  console.log(AKS_VERSION);
}

function findCommand(name: string): CLICommand | undefined {
  return commands.find((command) => command.name === name);
}

export async function main(
  args: string[] = process.argv.slice(2),
): Promise<void> {
  if (args.length === 1 && (args[0] === "--version" || args[0] === "-v")) {
    printVersion();
    return;
  }

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printHelp();
    return;
  }

  const [commandName, ...commandArgs] = args;
  const command = findCommand(commandName);

  if (!command) {
    console.error(`Unknown command: ${commandName}`);
    console.error("");
    console.error("Run 'aks --help' to see available commands.");

    process.exitCode = 1;
    return;
  }

  if (commandArgs.includes("--help") || commandArgs.includes("-h")) {
    printCommandHelp(commandName);
    return;
  }

  await command.execute(commandArgs);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));

  process.exitCode = 1;
});
