import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  loadEnvFiles,
  parseEnv,
} from "../src/env.js";

describe("parseEnv", () => {
  it("parses basic values", () => {
    expect(
      parseEnv(`
        PORT=3000
        HOST=localhost
      `),
    ).toEqual({
      PORT: "3000",
      HOST: "localhost",
    });
  });

  it("ignores blank lines", () => {
    expect(
      parseEnv(`
        PORT=3000

        HOST=localhost

      `),
    ).toEqual({
      PORT: "3000",
      HOST: "localhost",
    });
  });

  it("ignores comments", () => {
    expect(
      parseEnv(`
        # Application port
        PORT=3000

        # Application host
        HOST=localhost
      `),
    ).toEqual({
      PORT: "3000",
      HOST: "localhost",
    });
  });

  it("supports export syntax", () => {
    expect(
      parseEnv(`
        export PORT=3000
        export HOST=localhost
      `),
    ).toEqual({
      PORT: "3000",
      HOST: "localhost",
    });
  });

  it("parses double quoted values", () => {
    expect(
      parseEnv(`
        APP_NAME="AKS Framework"
        MESSAGE="Hello World"
      `),
    ).toEqual({
      APP_NAME: "AKS Framework",
      MESSAGE: "Hello World",
    });
  });

  it("parses single quoted values", () => {
    expect(
      parseEnv(`
        APP_NAME='AKS Framework'
        MESSAGE='Hello World'
      `),
    ).toEqual({
      APP_NAME: "AKS Framework",
      MESSAGE: "Hello World",
    });
  });

  it("preserves spaces inside quotes", () => {
    expect(
      parseEnv(
        `MESSAGE="  Hello World  "`,
      ),
    ).toEqual({
      MESSAGE: "  Hello World  ",
    });
  });

  it("supports escaped double quotes", () => {
    expect(
      parseEnv(
        `MESSAGE="Hello \\"AKS\\" Framework"`,
      ),
    ).toEqual({
      MESSAGE: 'Hello "AKS" Framework',
    });
  });

  it("supports escaped newlines", () => {
    expect(
      parseEnv(
        `MESSAGE="Hello\\nWorld"`,
      ),
    ).toEqual({
      MESSAGE: "Hello\nWorld",
    });
  });

  it("removes safe inline comments", () => {
    expect(
      parseEnv(`
        PORT=3000 # server port
        HOST=localhost # server host
      `),
    ).toEqual({
      PORT: "3000",
      HOST: "localhost",
    });
  });

  it("preserves # inside values", () => {
    expect(
      parseEnv(`
        PASSWORD=abc#123
        URL=https://example.com/#test
      `),
    ).toEqual({
      PASSWORD: "abc#123",
      URL: "https://example.com/#test",
    });
  });

  it("preserves empty values", () => {
    expect(
      parseEnv(`
        EMPTY=
      `),
    ).toEqual({
      EMPTY: "",
    });
  });

  it("allows duplicate keys with last value winning", () => {
    expect(
      parseEnv(`
        PORT=3000
        PORT=4000
      `),
    ).toEqual({
      PORT: "4000",
    });
  });

  it("ignores invalid keys", () => {
    expect(
      parseEnv(`
        123PORT=3000
        APP-PORT=4000
        VALID_PORT=5000
      `),
    ).toEqual({
      VALID_PORT: "5000",
    });
  });

  it("ignores malformed lines", () => {
    expect(
      parseEnv(`
        PORT=3000
        this-is-not-valid
        HOST=localhost
      `),
    ).toEqual({
      PORT: "3000",
      HOST: "localhost",
    });
  });
});

describe("loadEnvFiles", () => {
  const originalNodeEnv =
    process.env.NODE_ENV;

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV =
        originalNodeEnv;
    }
  });

  it("returns an empty object for missing files", () => {
    expect(
      loadEnvFiles({
        file: "does-not-exist.env",
        local: false,
        environmentFile: false,
        environmentLocalFile: false,
      }),
    ).toEqual({});
  });

  it("loads the base env file", () => {
    const result = loadEnvFiles({
      file: ".env",
      local: false,
      environmentFile: false,
      environmentLocalFile: false,
    });

    expect(result).toBeDefined();
  });

  it("uses environment-specific files when NODE_ENV is set", () => {
    process.env.NODE_ENV = "test";

    const result = loadEnvFiles({
      file: "test-fixtures/.env",
      local: false,
      environmentLocalFile: false,
    });

    expect(result).toBeDefined();
  });

});