import { readFileSync } from "node:fs";

export interface EnvFileOptions {
  /**
   * Base .env file.
   *
   * Defaults to ".env".
   */
  file?: string;

  /**
   * Current environment name.
   *
   * Example: development, production, test.
   *
   * Defaults to process.env.NODE_ENV.
   */
  environment?: string;

  /**
   * Whether to load .env.local.
   *
   * Defaults to true.
   */
  local?: boolean;

  /**
   * Whether to load .env.<environment>.
   *
   * Defaults to true when environment exists.
   */
  environmentFile?: boolean;

  /**
   * Whether to load .env.<environment>.local.
   *
   * Defaults to true when environment exists.
   */
  environmentLocalFile?: boolean;
}

export interface ParsedEnv {
  [key: string]: string;
}

export function parseEnv(content: string): ParsedEnv {
  const result: ParsedEnv = {};

  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    let line = rawLine.trim();

    if (line === "" || line.startsWith("#")) {
      continue;
    }

    if (line.startsWith("export ")) {
      line = line.slice("export ".length).trim();
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();

    if (!isValidEnvKey(key)) {
      continue;
    }

    const rawValue = line.slice(separatorIndex + 1).trim();

    result[key] = parseEnvValue(rawValue);
  }

  return result;
}

export function loadEnvFile(
  filePath: string,
): ParsedEnv {
  try {
    const content = readFileSync(filePath, "utf-8");

    return parseEnv(content);
  } catch {
    return {};
  }
}

export function loadEnvFiles(
  options: EnvFileOptions = {},
): ParsedEnv {
  const file = options.file ?? ".env";
  const environment =
    options.environment ?? process.env.NODE_ENV;

  const local = options.local ?? true;
  const environmentFile =
    options.environmentFile ?? true;
  const environmentLocalFile =
    options.environmentLocalFile ?? true;

  const files: string[] = [];

  /*
   * Load from lowest priority to highest priority.
   *
   * Later files override earlier files.
   */
  files.push(file);

  if (environmentFile && environment) {
    files.push(`${file}.${environment}`);
  }

  if (local) {
    files.push(`${file}.local`);
  }

  if (environmentLocalFile && environment) {
    files.push(`${file}.${environment}.local`);
  }

  const result: ParsedEnv = {};

  for (const filePath of files) {
    Object.assign(result, loadEnvFile(filePath));
  }

  return result;
}

function isValidEnvKey(key: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
}

function parseEnvValue(value: string): string {
  if (value === "") {
    return "";
  }

  if (value.startsWith('"')) {
    return parseDoubleQuotedValue(value);
  }

  if (value.startsWith("'")) {
    return parseSingleQuotedValue(value);
  }

  return removeInlineComment(value).trim();
}

function parseDoubleQuotedValue(value: string): string {
  let result = "";
  let escaped = false;

  /*
   * Skip the opening quote.
   */
  for (let index = 1; index < value.length; index += 1) {
    const char = value[index];

    if (escaped) {
      switch (char) {
        case "n":
          result += "\n";
          break;

        case "r":
          result += "\r";
          break;

        case "t":
          result += "\t";
          break;

        case '"':
          result += '"';
          break;

        case "\\":
          result += "\\";
          break;

        default:
          result += char;
      }

      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      return result;
    }

    result += char;
  }

  return result;
}

function parseSingleQuotedValue(value: string): string {
  const closingQuote = value.indexOf("'", 1);

  if (closingQuote === -1) {
    return value.slice(1);
  }

  return value.slice(1, closingQuote);
}

function removeInlineComment(value: string): string {
  for (let index = 0; index < value.length - 1; index++) {
    if (
      (value[index] === " " || value[index] === "\t") &&
      value[index + 1] === "#"
    ) {
      return value.slice(0, index);
    }
  }

  return value;
}