import {
  loadEnvFiles,
  type EnvFileOptions,
} from "./env.js";

export interface AKSConfigOptions {
  values?: Record<string, unknown>;
  env?: Record<string, string | undefined>;
  envFile?: EnvFileOptions;
  [key: string]: unknown;
}

export type ConfigDiagnosticStatus =
  | "configured"
  | "missing"
  | "invalid";

export interface ConfigDiagnostic {
  key: string;
  status: ConfigDiagnosticStatus;
  value?: unknown;
}

export type ConfigValueType =
  | "string"
  | "number"
  | "boolean";

export interface ConfigRule {
  key: string;
  required?: boolean;
  type?: ConfigValueType;
}

export interface ConfigRuleDiagnostic
  extends ConfigDiagnostic {
  required: boolean;
  expectedType?: ConfigValueType;
}

export class AKSConfig {
  private readonly values: Record<string, unknown>;
  private readonly env: Record<string, string | undefined>;

  constructor(options: AKSConfigOptions = {}) {
    const rawOptions = { ...options };

    const sourceValues =
      "values" in rawOptions && rawOptions.values !== undefined
        ? (rawOptions.values as Record<string, unknown>)
        : !("env" in rawOptions) &&
            !("envFile" in rawOptions)
          ? (rawOptions as Record<string, unknown>)
          : {};

    const fileEnv = loadEnvFiles(
      rawOptions.envFile as EnvFileOptions | undefined,
    );

    const processEnv = process.env;

    const sourceEnv: Record<
      string,
      string | undefined
    > = {
      ...processEnv,
      ...fileEnv,
      ...(rawOptions.env ?? {}),
    };

    this.values = {
      ...sourceValues,
    };

    this.env = sourceEnv;
  }

  has(key: string): boolean {
    return this.getValue(key) !== undefined;
  }

  diagnose(key: string): ConfigDiagnostic {
  const value = this.getValue(key);

  if (value === undefined) {
    return {
      key,
      status: "missing",
    };
  }

  return {
    key,
    status: "configured",
    value,
  };
}

diagnoseNumber(key: string): ConfigDiagnostic {
  const value = this.getNumber(key);

  if (value !== undefined) {
    return {
      key,
      status: "configured",
      value,
    };
  }

  if (this.getValue(key) === undefined) {
    return {
      key,
      status: "missing",
    };
  }

  return {
    key,
    status: "invalid",
  };
}

diagnoseBoolean(key: string): ConfigDiagnostic {
  const value = this.getBoolean(key);

  if (value !== undefined) {
    return {
      key,
      status: "configured",
      value,
    };
  }

  if (this.getValue(key) === undefined) {
    return {
      key,
      status: "missing",
    };
  }

  return {
    key,
    status: "invalid",
  };
}

diagnoseMany(keys: string[]): ConfigDiagnostic[] {
  return keys.map((key) => this.diagnose(key));
}

diagnoseRules(
  rules: ConfigRule[],
): ConfigRuleDiagnostic[] {
  return rules.map((rule) => {
    const required = rule.required ?? false;

    if (!rule.type) {
      const diagnostic = this.diagnose(rule.key);

      return {
        ...diagnostic,
        required,
      };
    }

    if (rule.type === "number") {
      const diagnostic = this.diagnoseNumber(rule.key);

      return {
        ...diagnostic,
        required,
        expectedType: "number",
      };
    }

    if (rule.type === "boolean") {
      const diagnostic = this.diagnoseBoolean(rule.key);

      return {
        ...diagnostic,
        required,
        expectedType: "boolean",
      };
    }

    const value = this.get(rule.key);

    if (value === undefined) {
      return {
        key: rule.key,
        status: "missing",
        required,
        expectedType: "string",
      };
    }

    if (typeof value !== "string") {
      return {
        key: rule.key,
        status: "invalid",
        required,
        expectedType: "string",
      };
    }

    return {
      key: rule.key,
      status: "configured",
      value,
      required,
      expectedType: "string",
    };
  });
}

  get<T = unknown>(key: string): T | undefined {
    return this.getValue(key) as T | undefined;
  }

  getNumber(key: string): number | undefined {
  const value = this.getValue(key);

  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
}

getNumberOrDefault(
  key: string,
  defaultValue: number,
): number {
  return this.getNumber(key) ?? defaultValue;
}

getBoolean(key: string): boolean | undefined {
  const value = this.getValue(key);

  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return undefined;
}

getBooleanOrDefault(
  key: string,
  defaultValue: boolean,
): boolean {
  return this.getBoolean(key) ?? defaultValue;
}

  getOrDefault<T>(key: string, defaultValue: T): T {
    const value = this.get<T>(key);

    return value === undefined ? defaultValue : value;
  }

  require<T = unknown>(key: string): T {
    const value = this.get<T>(key);

    if (value === undefined) {
      throw new Error(`Required configuration "${key}" is missing`);
    }

    return value;
  }

  private getValue(key: string): unknown {
    if (key in this.values) {
      return this.values[key];
    }

    if (this.env[key] !== undefined) {
      return this.env[key];
    }

    const parts = key.split(".");
    let current: unknown = this.values;

    for (const part of parts) {
      if (
        typeof current !== "object" ||
        current === null ||
        !(part in current)
      ) {
        return undefined;
      }

      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }
}