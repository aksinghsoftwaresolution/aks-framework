import { AKS_VERSION } from "@aks-framework/core";

import type {
  DiagnosticResult,
  DoctorContext,
} from "../types.js";

const CORE_PACKAGE_NAME = "@aks-framework/core";
const REGISTRY_TIMEOUT_MS = 5_000;

type FetchFunction = typeof fetch;

interface RegistryPackage {
  version?: unknown;
}

export interface FrameworkCheckOptions {
  fetch?: FetchFunction;
  currentVersion?: string;
}

async function getLatestStableVersion(
  fetchFn: FetchFunction,
): Promise<string | undefined> {
  try {
    const response = await fetchFn(
      `https://registry.npmjs.org/${CORE_PACKAGE_NAME}/latest`,
      {
        headers: {
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      return undefined;
    }

    const data =
      (await response.json()) as RegistryPackage;

    if (typeof data.version !== "string") {
      return undefined;
    }

    // Only accept stable semantic versions.
    // Prereleases contain a hyphen, such as 1.0.0-beta.1.
    if (
      !/^\d+\.\d+\.\d+$/.test(data.version)
    ) {
      return undefined;
    }

    return data.version;
  } catch {
    // Network failures must not prevent Doctor from running.
    return undefined;
  }
}

export async function checkFramework(
  _context: DoctorContext,
  options: FrameworkCheckOptions = {},
): Promise<DiagnosticResult> {
  const currentVersion =
    options.currentVersion ?? AKS_VERSION;

  const fetchFn = options.fetch ?? fetch;

  const latestVersion =
    await getLatestStableVersion(fetchFn);

  if (!latestVersion) {
    return {
      check: "framework",
      severity: "info",
      message: `AKS Framework ${currentVersion}`,
      details:
        "Latest release could not be checked. The package may not be published yet, or the npm registry may be unavailable.",
    };
  }

  const currentParts =
    currentVersion.split(".").map(Number);

  const latestParts =
    latestVersion.split(".").map(Number);

  const isUpdateAvailable =
    latestParts.some(
      (part, index) =>
        part >
        (currentParts[index] ?? 0) &&
        latestParts
          .slice(0, index)
          .every(
            (previous, previousIndex) =>
              previous ===
              (currentParts[previousIndex] ?? 0),
          ),
    );

  if (isUpdateAvailable) {
    return {
      check: "framework",
      severity: "warning",
      message:
        `AKS Framework update available: ${currentVersion} → ${latestVersion}`,
      details:
        "A newer stable release is available. Review the release notes before upgrading.",
    };
  }

  return {
    check: "framework",
    severity: "info",
    message: `AKS Framework ${currentVersion} is up to date.`,
  };
}
