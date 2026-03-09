import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { auditLogPath, registryRoot } from "./paths.js";

export async function readJson<T>(fileName: string, fallback: T): Promise<T> {
  const fullPath = path.join(registryRoot, fileName);
  try {
    const raw = await fs.readFile(fullPath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await writeJson(fileName, fallback);
      return fallback;
    }
    throw error;
  }
}

export async function writeJson<T>(fileName: string, value: T): Promise<void> {
  const fullPath = path.join(registryRoot, fileName);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function recordId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

export async function appendAudit(entry: Record<string, unknown>): Promise<void> {
  const payload = {
    id: randomUUID(),
    ts: nowIso(),
    ...entry,
  };
  await fs.mkdir(path.dirname(auditLogPath), { recursive: true });
  await fs.appendFile(auditLogPath, `${JSON.stringify(payload)}\n`, "utf8");
}
