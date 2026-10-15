import type { IncomingMessage } from "node:http";

export async function parseJSONBody(
  req: IncomingMessage,
): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const rawBody = Buffer.concat(chunks).toString("utf-8");

  if (rawBody.trim() === "") {
    return undefined;
  }

  return JSON.parse(rawBody);
}