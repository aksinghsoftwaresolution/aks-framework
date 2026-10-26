import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const temp = await mkdtemp(join(tmpdir(), "aks-consumer-"));

const npmCli =
  process.platform === "win32"
    ? "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"
    : null;

function runNpm(args, cwd) {
  const command = npmCli ? process.execPath : "npm";
  const commandArgs = npmCli ? [npmCli, ...args] : args;

  const result = spawnSync(command, commandArgs, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.error || result.status !== 0) {
    throw new Error(
      `npm ${args.join(" ")} failed.\n` +
      `Status: ${result.status}\n` +
      `Error: ${result.error?.message ?? "none"}\n` +
      `stdout:\n${result.stdout ?? ""}\n` +
      `stderr:\n${result.stderr ?? ""}`,
    );
  }

  return result.stdout;
}

try {
  const packagesDir = join(temp, "packages");
  const consumerDir = join(temp, "consumer");

  await mkdir(packagesDir, { recursive: true });
  await mkdir(consumerDir, { recursive: true });

  runNpm(
    [
      "pack",
      "./packages/core",
      "./packages/cli",
      "./packages/driver-postgres",
      "--pack-destination",
      packagesDir,
    ],
    root,
  );

  const expectedArchives = [
    "aks-framework-core-0.1.0.tgz",
    "aks-framework-cli-0.1.0.tgz",
    "aks-framework-driver-postgres-0.1.0.tgz",
  ];

  const archivesFound = await readdir(packagesDir);

  for (const archive of expectedArchives) {
    assert.ok(
      archivesFound.includes(archive),
      `Missing package archive: ${archive}`,
    );
  }

  await writeFile(
    join(consumerDir, "package.json"),
    JSON.stringify(
      {
        name: "aks-consumer-smoke-test",
        version: "1.0.0",
        private: true,
        type: "module",
      },
      null,
      2,
    ),
  );

  const archivePaths = expectedArchives.map((name) =>
    join(packagesDir, name),
  );

  runNpm(
    ["install", "--no-audit", "--no-fund", ...archivePaths],
    consumerDir,
  );

  const importTest = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
        import * as core from "@aks-framework/core";
        import * as cli from "@aks-framework/cli";
        import * as postgres from "@aks-framework/driver-postgres";

        if (Object.keys(core).length === 0) {
          throw new Error("Core has no public exports");
        }
        if (Object.keys(cli).length === 0) {
          throw new Error("CLI has no public exports");
        }
        if (Object.keys(postgres).length === 0) {
          throw new Error("PostgreSQL driver has no public exports");
        }

        console.log("Core exports:", Object.keys(core).length);
        console.log("CLI exports:", Object.keys(cli).length);
        console.log("PostgreSQL exports:", Object.keys(postgres).length);
      `,
    ],
    { cwd: consumerDir, encoding: "utf8", windowsHide: true },
  );

  assert.equal(
    importTest.status,
    0,
    `Consumer imports failed:\n${importTest.stdout ?? ""}\n${importTest.stderr ?? ""}`,
  );

  const cliPackage = JSON.parse(
    await readFile(
      join(
        consumerDir,
        "node_modules",
        "@aks-framework",
        "cli",
        "package.json",
      ),
      "utf8",
    ),
  );

  assert.equal(cliPackage.bin.aks, "dist/cli.js");

  const cliRun = spawnSync(
    process.execPath,
    [
      join(
        consumerDir,
        "node_modules",
        "@aks-framework",
        "cli",
        "dist",
        "cli.js",
      ),
      "--version",
    ],
    { cwd: consumerDir, encoding: "utf8", windowsHide: true },
  );

  assert.equal(
    cliRun.status,
    0,
    `Installed CLI failed:\n${cliRun.stdout ?? ""}\n${cliRun.stderr ?? ""}`,
  );

  assert.match(cliRun.stdout ?? "", /0\.1\.0/);

  console.log("Consumer package smoke test passed.");
  console.log(importTest.stdout.trim());
  console.log("Installed CLI version:", cliRun.stdout.trim());
} finally {
  await rm(temp, { recursive: true, force: true });
}
