import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";

import {
  tmpdir,
} from "node:os";

import {
  join,
} from "node:path";

import {
  loadEnvFiles,
  parseEnv,
} from "../src/env.js";
import { AKSConfig } from "../src/config.js";

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
});

describe("loadEnvFiles", () => {
  let directory: string;

  afterEach(() => {
    if (directory) {
      rmSync(directory, {
        recursive: true,
        force: true,
      });
    }
  });

  it("returns an empty object for missing files", () => {
    directory = mkdtempSync(
      join(tmpdir(), "aks-env-"),
    );

    expect(
      loadEnvFiles({
        file: join(
          directory,
          ".env",
        ),
        local: false,
        environmentFile: false,
        environmentLocalFile: false,
      }),
    ).toEqual({});
  });

  it("loads the base env file", () => {
    directory = mkdtempSync(
      join(tmpdir(), "aks-env-"),
    );

    writeFileSync(
      join(directory, ".env"),
      "PORT=3000\nHOST=localhost\n",
    );

    expect(
      loadEnvFiles({
        file: join(
          directory,
          ".env",
        ),
        local: false,
        environmentFile: false,
        environmentLocalFile: false,
      }),
    ).toEqual({
      PORT: "3000",
      HOST: "localhost",
    });
  });

  it("loads environment-specific values", () => {
    directory = mkdtempSync(
      join(tmpdir(), "aks-env-"),
    );

    writeFileSync(
      join(directory, ".env"),
      "PORT=3000\n",
    );

    writeFileSync(
      join(directory, ".env.test"),
      "PORT=4000\nMODE=test\n",
    );

    expect(
      loadEnvFiles({
        file: join(
          directory,
          ".env",
        ),
        environment: "test",
        local: false,
        environmentFile: true,
        environmentLocalFile: false,
      }),
    ).toEqual({
      PORT: "4000",
      MODE: "test",
    });
  });

  it("loads local values after environment values", () => {
    directory = mkdtempSync(
      join(tmpdir(), "aks-env-"),
    );

    writeFileSync(
      join(directory, ".env"),
      "PORT=3000\n",
    );

    writeFileSync(
      join(directory, ".env.test"),
      "PORT=4000\n",
    );

    writeFileSync(
      join(directory, ".env.local"),
      "PORT=5000\n",
    );

    expect(
      loadEnvFiles({
        file: join(
          directory,
          ".env",
        ),
        environment: "test",
        local: true,
        environmentFile: true,
        environmentLocalFile: false,
      }),
    ).toEqual({
      PORT: "5000",
    });
  });

  it("gives environment-local the highest file priority", () => {
    directory = mkdtempSync(
      join(tmpdir(), "aks-env-"),
    );

    writeFileSync(
      join(directory, ".env"),
      "PORT=3000\n",
    );

    writeFileSync(
      join(directory, ".env.test"),
      "PORT=4000\n",
    );

    writeFileSync(
      join(directory, ".env.local"),
      "PORT=5000\n",
    );

    writeFileSync(
      join(directory, ".env.test.local"),
      "PORT=6000\n",
    );

    expect(
      loadEnvFiles({
        file: join(
          directory,
          ".env",
        ),
        environment: "test",
        local: true,
        environmentFile: true,
        environmentLocalFile: true,
      }),
    ).toEqual({
      PORT: "6000",
    });
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

it("explicit env overrides .env", () => {
  const directory = mkdtempSync(
    join(tmpdir(), "aks-config-"),
  );

  try {
    writeFileSync(
      join(directory, ".env"),
      "PORT=3000\n",
    );

    const config = new AKSConfig({
      env: {
        PORT: "4000",
      },
      envFile: {
        file: join(directory, ".env"),
        local: false,
        environmentFile: false,
        environmentLocalFile: false,
      },
    });

    expect(config.get("PORT")).toBe("4000");
  } finally {
    rmSync(directory, {
      recursive: true,
      force: true,
    });
  }
});

it("programmatic values override .env", () => {
  const directory = mkdtempSync(
    join(tmpdir(), "aks-config-"),
  );

  try {
    writeFileSync(
      join(directory, ".env"),
      "PORT=3000\n",
    );

    const config = new AKSConfig({
      values: {
        PORT: 5000,
      },
      envFile: {
        file: join(directory, ".env"),
        local: false,
        environmentFile: false,
        environmentLocalFile: false,
      },
    });

    expect(config.get("PORT")).toBe(5000);
  } finally {
    rmSync(directory, {
      recursive: true,
      force: true,
    });
  }
});

it("keeps .env values as strings", () => {
  const directory = mkdtempSync(
    join(tmpdir(), "aks-config-"),
  );

  try {
    writeFileSync(
      join(directory, ".env"),
      [
        "PORT=3000",
        "DEBUG=true",
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
    expect(config.get("DEBUG")).toBe("true");

    expect(config.getNumber("PORT")).toBe(3000);
    expect(config.getBoolean("DEBUG")).toBe(true);
  } finally {
    rmSync(directory, {
      recursive: true,
      force: true,
    });
  }
});

});