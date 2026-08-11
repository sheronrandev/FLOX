import { readFile } from "node:fs/promises";
import { expect, type APIRequestContext, type Download } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

export function diagram(title = "Shared process") {
  const now = new Date().toISOString();
  return { format: "activity-diagram", version: 1, metadata: { title, createdAt: now, updatedAt: now }, nodes: [], edges: [], lanes: [], appearance: { canvasColor: "#fafafa", gridColor: "#d7dde1", controlFlowColor: "#58666d", objectFlowColor: "#58666d" } };
}

export async function register(api: APIRequestContext, prefix: string) {
  const email = `${prefix}-${crypto.randomUUID()}@example.com`;
  const response = await api.post("/api/auth/register", { data: { displayName: prefix, email, password: "correct horse battery staple" } });
  expect(response.ok()).toBeTruthy();
  const value = await response.json();
  return { email, csrf: value.csrfToken as string, user: value.user as { id: string } };
}

export async function readDownload(download: Download) {
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error(`Download ${download.suggestedFilename()} has no readable path`);
  return { filename: download.suggestedFilename(), bytes: new Uint8Array(await readFile(downloadPath)) };
}

export function readZipEntries(bytes: Uint8Array): Record<string, Uint8Array> {
  return unzipSync(bytes);
}

export function decodeBytes(bytes: Uint8Array): string {
  return strFromU8(bytes);
}
