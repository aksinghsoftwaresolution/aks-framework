export interface HealthOptions {
  url?: string;
  json?: boolean;
  log?: (message: string) => void;
  fetchImpl?: typeof fetch;
}

export interface HealthResult {
  command: "health";
  success: boolean;
  url?: string;
  status?: number;
  message: string;
}

export function formatHealthResultsJson(result: HealthResult): string {
  return JSON.stringify(result, null, 2);
}

export async function runHealth(options: HealthOptions = {}): Promise<void> {
  const log = options.log ?? console.log;
  const url = options.url;

  let result: HealthResult;

  if (!url) {
    result = {
      command: "health",
      success: false,
      message: "Missing endpoint URL. Use --url <endpoint>.",
    };
  } else {
    try {
      const parsedUrl = new URL(url);

      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        throw new Error("Endpoint URL must use HTTP or HTTPS.");
      }

      const fetchImpl = options.fetchImpl ?? fetch;
      const response = await fetchImpl(parsedUrl);

      result = {
        command: "health",
        success: response.ok,
        url: parsedUrl.toString(),
        status: response.status,
        message: response.ok
          ? "Endpoint is healthy."
          : `Endpoint returned HTTP ${response.status}.`,
      };
    } catch (error) {
      result = {
        command: "health",
        success: false,
        url,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  if (options.json) {
    log(formatHealthResultsJson(result));
  } else {
    log("AKS Health");
    log("");
    log(`Status: ${result.success ? "healthy" : "unhealthy"}`);

    if (result.url) {
      log(`URL: ${result.url}`);
    }

    if (result.status !== undefined) {
      log(`HTTP status: ${result.status}`);
    }

    log(`Message: ${result.message}`);
  }

  if (!result.success) {
    process.exitCode = 1;
  }
}
