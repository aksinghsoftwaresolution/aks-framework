import { describe, expect, it } from "vitest";

import { AKSConfig } from "../src/config.js";

import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";

import { tmpdir } from "node:os";

import { join } from "node:path";

describe("AKSConfig", () => {
  it("reads programmatic values", () => {
    const config = new AKSConfig({
      port: 3000,
    });

    expect(config.get<number>("port")).toBe(3000);
  });

  it("checks whether a value exists", () => {
    const config = new AKSConfig({
      port: 3000,
    });

    expect(config.has("port")).toBe(true);
    expect(config.has("host")).toBe(false);
  });

  it("reads nested values", () => {
    const config = new AKSConfig({
      server: {
        port: 3000,
      },
    });

    expect(config.get<number>("server.port")).toBe(3000);
  });

  it("returns default values", () => {
    const config = new AKSConfig();

    expect(config.getOrDefault("port", 3000)).toBe(3000);
  });

  it("returns configured value instead of default", () => {
    const config = new AKSConfig({
      port: 4000,
    });

    expect(config.getOrDefault("port", 3000)).toBe(4000);
  });

  it("returns required values", () => {
  const config = new AKSConfig({
    database: {
      url: "postgres://localhost",
    },
  });

  expect(config.require<string>("database.url")).toBe(
    "postgres://localhost",
  );
});

it("throws when required configuration is missing", () => {
  const config = new AKSConfig();

  expect(() => config.require("database.url")).toThrow(
    'Required configuration "database.url" is missing',
  );
});

it("reads environment values", () => {
  const config = new AKSConfig({
    env: {
      PORT: "8080",
    },
  });

  expect(config.get<string>("PORT")).toBe("8080");
});

it("prefers programmatic values over environment values", () => {
  const config = new AKSConfig({
    values: {
      PORT: 3000,
    },
    env: {
      PORT: "8080",
    },
  });

  expect(config.get<number>("PORT")).toBe(3000);
});

it("does not use undefined environment values", () => {
  const config = new AKSConfig({
    env: {
      PORT: undefined,
    },
  });

  expect(config.get("PORT")).toBeUndefined();
});

it("supports direct configuration values", () => {
  const config = new AKSConfig({
    appName: "AKS Framework",
    port: 3000,
  });

  expect(config.get<string>("appName")).toBe("AKS Framework");
  expect(config.get<number>("port")).toBe(3000);
});

it("supports explicit values and environment sources together", () => {
  const config = new AKSConfig({
    values: {
      port: 3000,
    },
    env: {
      HOST: "localhost",
    },
  });

  expect(config.get<number>("port")).toBe(3000);
  expect(config.get<string>("HOST")).toBe("localhost");
});

it("keeps environment values as strings", () => {
  const config = new AKSConfig({
    env: {
      PORT: "3000",
      DEBUG: "true",
    },
  });

  expect(config.get<string>("PORT")).toBe("3000");
  expect(config.get<string>("DEBUG")).toBe("true");
});

it("preserves empty environment values", () => {
  const config = new AKSConfig({
    env: {
      EMPTY: "",
    },
  });

  expect(config.has("EMPTY")).toBe(true);
  expect(config.get<string>("EMPTY")).toBe("");
  expect(config.getOrDefault("EMPTY", "fallback")).toBe("");
  expect(config.require<string>("EMPTY")).toBe("");
});

it("prefers exact environment keys over nested programmatic values", () => {
  const config = new AKSConfig({
    values: {
      database: {
        host: "localhost",
      },
    },
    env: {
      "database.host": "db.example.com",
    },
  });

  expect(config.get<string>("database.host")).toBe("db.example.com");
});

it("prefers exact programmatic keys over exact environment keys", () => {
  const config = new AKSConfig({
    values: {
      "database.host": "programmatic.example.com",
    },
    env: {
      "database.host": "environment.example.com",
    },
  });

  expect(config.get<string>("database.host"))
    .toBe("programmatic.example.com");
});

it("parses environment values as numbers", () => {
  const config = new AKSConfig({
    env: {
      PORT: "3000",
    },
  });

  expect(config.getNumber("PORT")).toBe(3000);
});

it("returns programmatic numbers from getNumber", () => {
  const config = new AKSConfig({
    port: 3000,
  });

  expect(config.getNumber("port")).toBe(3000);
});

it("returns undefined when getNumber value is missing", () => {
  const config = new AKSConfig();

  expect(config.getNumber("PORT")).toBeUndefined();
});

it("returns undefined for invalid numeric values", () => {
  const config = new AKSConfig({
    env: {
      PORT: "not-a-number",
    },
  });

  expect(config.getNumber("PORT")).toBeUndefined();
});

it("parses decimal numeric values", () => {
  const config = new AKSConfig({
    env: {
      RATE: "12.5",
    },
  });

  expect(config.getNumber("RATE")).toBe(12.5);
});

it("preserves zero as a valid number", () => {
  const config = new AKSConfig({
    env: {
      PORT: "0",
    },
  });

  expect(config.getNumber("PORT")).toBe(0);
});

it("parses numeric values with surrounding whitespace", () => {
  const config = new AKSConfig({
    env: {
      PORT: " 3000 ",
    },
  });

  expect(config.getNumber("PORT")).toBe(3000);
});

it("parses scientific notation", () => {
  const config = new AKSConfig({
    env: {
      LIMIT: "1e3",
    },
  });

  expect(config.getNumber("LIMIT")).toBe(1000);
});

it("parses environment values as booleans", () => {
  const config = new AKSConfig({
    env: {
      DEBUG: "true",
      FEATURE_ENABLED: "false",
    },
  });

  expect(config.getBoolean("DEBUG")).toBe(true);
  expect(config.getBoolean("FEATURE_ENABLED")).toBe(false);
});

it("returns programmatic booleans from getBoolean", () => {
  const config = new AKSConfig({
    debug: true,
    production: false,
  });

  expect(config.getBoolean("debug")).toBe(true);
  expect(config.getBoolean("production")).toBe(false);
});

it("returns undefined for missing boolean values", () => {
  const config = new AKSConfig();

  expect(config.getBoolean("DEBUG")).toBeUndefined();
});

it("returns undefined for invalid boolean values", () => {
  const config = new AKSConfig({
    env: {
      DEBUG: "yes",
    },
  });

  expect(config.getBoolean("DEBUG")).toBeUndefined();
});

it("parses boolean values case-insensitively", () => {
  const config = new AKSConfig({
    env: {
      ENABLED: "TRUE",
      DISABLED: "FALSE",
    },
  });

  expect(config.getBoolean("ENABLED")).toBe(true);
  expect(config.getBoolean("DISABLED")).toBe(false);
});

it("parses boolean values with surrounding whitespace", () => {
  const config = new AKSConfig({
    env: {
      ENABLED: " true ",
      DISABLED: " false ",
    },
  });

  expect(config.getBoolean("ENABLED")).toBe(true);
  expect(config.getBoolean("DISABLED")).toBe(false);
});

it("returns the default number when configuration is missing", () => {
  const config = new AKSConfig();

  expect(config.getNumberOrDefault("PORT", 3000)).toBe(3000);
});

it("returns the configured number instead of the default", () => {
  const config = new AKSConfig({
    env: {
      PORT: "8080",
    },
  });

  expect(config.getNumberOrDefault("PORT", 3000)).toBe(8080);
});

it("returns the default number for an invalid value", () => {
  const config = new AKSConfig({
    env: {
      PORT: "invalid",
    },
  });

  expect(config.getNumberOrDefault("PORT", 3000)).toBe(3000);
});

it("returns the default boolean when configuration is missing", () => {
  const config = new AKSConfig();

  expect(config.getBooleanOrDefault("DEBUG", false)).toBe(false);
});

it("returns the configured boolean instead of the default", () => {
  const config = new AKSConfig({
    env: {
      DEBUG: "true",
    },
  });

  expect(config.getBooleanOrDefault("DEBUG", false)).toBe(true);
});

it("returns the default boolean for an invalid value", () => {
  const config = new AKSConfig({
    env: {
      DEBUG: "invalid",
    },
  });

  expect(config.getBooleanOrDefault("DEBUG", false)).toBe(false);
});

it("diagnoses a configured value", () => {
  const config = new AKSConfig({
    env: {
      DATABASE_URL: "postgres://localhost/aks",
    },
  });

  expect(config.diagnose("DATABASE_URL")).toEqual({
    key: "DATABASE_URL",
    status: "configured",
    value: "postgres://localhost/aks",
  });
});

it("diagnoses a missing value", () => {
  const config = new AKSConfig();

  expect(config.diagnose("JWT_SECRET")).toEqual({
    key: "JWT_SECRET",
    status: "missing",
  });
});

it("diagnoses a valid numeric value", () => {
  const config = new AKSConfig({
    env: {
      PORT: "3000",
    },
  });

  expect(config.diagnoseNumber("PORT")).toEqual({
    key: "PORT",
    status: "configured",
    value: 3000,
  });
});

it("diagnoses an invalid numeric value", () => {
  const config = new AKSConfig({
    env: {
      PORT: "abc",
    },
  });

  expect(config.diagnoseNumber("PORT")).toEqual({
    key: "PORT",
    status: "invalid",
  });
});

it("diagnoses a missing numeric value", () => {
  const config = new AKSConfig();

  expect(config.diagnoseNumber("PORT")).toEqual({
    key: "PORT",
    status: "missing",
  });
});

it("diagnoses a valid boolean value", () => {
  const config = new AKSConfig({
    env: {
      DEBUG: "true",
    },
  });

  expect(config.diagnoseBoolean("DEBUG")).toEqual({
    key: "DEBUG",
    status: "configured",
    value: true,
  });
});

it("diagnoses an invalid boolean value", () => {
  const config = new AKSConfig({
    env: {
      DEBUG: "invalid",
    },
  });

  expect(config.diagnoseBoolean("DEBUG")).toEqual({
    key: "DEBUG",
    status: "invalid",
  });
});

it("diagnoses a missing boolean value", () => {
  const config = new AKSConfig();

  expect(config.diagnoseBoolean("DEBUG")).toEqual({
    key: "DEBUG",
    status: "missing",
  });
});

it("diagnoses multiple configuration keys", () => {
  const config = new AKSConfig({
    env: {
      PORT: "3000",
      DEBUG: "true",
    },
  });

  expect(
    config.diagnoseMany(["PORT", "DEBUG", "DATABASE_URL"]),
  ).toEqual([
    {
      key: "PORT",
      status: "configured",
      value: "3000",
    },
    {
      key: "DEBUG",
      status: "configured",
      value: "true",
    },
    {
      key: "DATABASE_URL",
      status: "missing",
    },
  ]);
});

it("preserves bulk diagnostic key order", () => {
  const config = new AKSConfig({
    env: {
      FIRST: "one",
      SECOND: "two",
    },
  });

  expect(
    config.diagnoseMany(["SECOND", "MISSING", "FIRST"]),
  ).toEqual([
    {
      key: "SECOND",
      status: "configured",
      value: "two",
    },
    {
      key: "MISSING",
      status: "missing",
    },
    {
      key: "FIRST",
      status: "configured",
      value: "one",
    },
  ]);
});

it("diagnoses required and typed configuration rules", () => {
  const config = new AKSConfig({
    env: {
      PORT: "3000",
      DEBUG: "true",
    },
  });

  expect(
    config.diagnoseRules([
      {
        key: "PORT",
        required: true,
        type: "number",
      },
      {
        key: "DEBUG",
        required: true,
        type: "boolean",
      },
    ]),
  ).toEqual([
    {
      key: "PORT",
      status: "configured",
      value: 3000,
      required: true,
      expectedType: "number",
    },
    {
      key: "DEBUG",
      status: "configured",
      value: true,
      required: true,
      expectedType: "boolean",
    },
  ]);
});

it("diagnoses a missing required configuration", () => {
  const config = new AKSConfig();

  expect(
    config.diagnoseRules([
      {
        key: "DATABASE_URL",
        required: true,
        type: "string",
      },
    ]),
  ).toEqual([
    {
      key: "DATABASE_URL",
      status: "missing",
      required: true,
      expectedType: "string",
    },
  ]);
});

it("diagnoses an invalid typed configuration", () => {
  const config = new AKSConfig({
    env: {
      PORT: "abc",
      DEBUG: "maybe",
    },
  });

  expect(
    config.diagnoseRules([
      {
        key: "PORT",
        required: true,
        type: "number",
      },
      {
        key: "DEBUG",
        required: true,
        type: "boolean",
      },
    ]),
  ).toEqual([
    {
      key: "PORT",
      status: "invalid",
      required: true,
      expectedType: "number",
    },
    {
      key: "DEBUG",
      status: "invalid",
      required: true,
      expectedType: "boolean",
    },
  ]);
});

it("reads values from .env files", () => {
  const directory = mkdtempSync(
    join(tmpdir(), "aks-config-"),
  );

  try {
    writeFileSync(
      join(directory, ".env"),
      [
        "PORT=3000",
        "HOST=localhost",
      ].join("\n"),
    );

    const config = new AKSConfig({
      envFile: {
        file: join(directory, ".env"),
        local: false,
        environmentFile: false,
        environmentLocalFile: false,
      },
    });

    expect(config.get("PORT")).toBe("3000");
    expect(config.get("HOST")).toBe("localhost");
  } finally {
    rmSync(directory, {
      recursive: true,
      force: true,
    });
  }
});


});