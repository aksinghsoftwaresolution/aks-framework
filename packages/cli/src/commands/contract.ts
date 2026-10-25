import SwaggerParser from "@apidevtools/swagger-parser";
import { resolve } from "node:path";

export interface ContractOptions {
  file?: string;
  json?: boolean;
  cwd?: string;
  log?: (message: string) => void;
}

export interface ContractResult {
  command: "contract";
  success: boolean;
  file?: string;
  openapi?: string;
  title?: string;
  version?: string;
  message: string;
}

interface OpenApiMetadata {
  openapi?: string;
  swagger?: string;
  info?: {
    title?: string;
    version?: string;
  };
}

export function formatContractResultsJson(result: ContractResult): string {
  return JSON.stringify(result, null, 2);
}

export async function runContract(
  options: ContractOptions = {},
): Promise<void> {
  const log = options.log ?? console.log;
  const cwd = options.cwd ?? process.cwd();
  const file = options.file;

  let result: ContractResult;

  if (!file) {
    result = {
      command: "contract",
      success: false,
      message: "Missing OpenAPI document path. Use --file <path>.",
    };
  } else {
    const absolutePath = resolve(cwd, file);

    try {
      const validated = await SwaggerParser.validate(absolutePath);
      const api = validated as unknown as OpenApiMetadata;

      result = {
        command: "contract",
        success: true,
        file: absolutePath,
        openapi: api.openapi ?? api.swagger,
        title: api.info?.title,
        version: api.info?.version,
        message: "OpenAPI document is valid.",
      };
    } catch (error) {
      result = {
        command: "contract",
        success: false,
        file: absolutePath,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  if (options.json) {
    log(formatContractResultsJson(result));
  } else {
    log("AKS Contract");
    log("");
    log(`Status: ${result.success ? "valid" : "invalid"}`);

    if (result.file) {
      log(`File: ${result.file}`);
    }

    if (result.openapi) {
      log(`OpenAPI: ${result.openapi}`);
    }

    if (result.title) {
      log(`Title: ${result.title}`);
    }

    if (result.version) {
      log(`API version: ${result.version}`);
    }

    log(`Message: ${result.message}`);
  }

  if (!result.success) {
    process.exitCode = 1;
  }
}
