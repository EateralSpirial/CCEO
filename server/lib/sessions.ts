import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import type { SessionLink, SessionSummary } from "../../shared/models.js";
import { codexHome } from "./paths.js";

const ACTIVE_ROOT = path.join(codexHome, "sessions");
const ARCHIVE_ROOT = path.join(codexHome, "archived_sessions", "sessions");

async function walkSessionFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries: Dirent[] = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        files.push(fullPath);
      }
    }
  }
  await walk(root);
  return files;
}

function extractSessionMeta(raw: string): { id?: string; cwd?: string; timestamp?: string } {
  const lines = raw.split("\n");
  for (const line of lines.slice(0, 12)) {
    if (!line.trim()) {
      continue;
    }
    try {
      const parsed = JSON.parse(line) as { type?: string; payload?: Record<string, unknown> };
      if (parsed.type !== "session_meta") {
        continue;
      }
      const payload = parsed.payload ?? {};
      return {
        id: typeof payload.id === "string" ? payload.id : undefined,
        cwd: typeof payload.cwd === "string" ? payload.cwd : undefined,
        timestamp: typeof payload.timestamp === "string" ? payload.timestamp : undefined,
      };
    } catch {
      continue;
    }
  }
  return {};
}

async function readSessionHead(filePath: string, bytes = 24 * 1024): Promise<string> {
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

export async function discoverSessions(links: SessionLink[]): Promise<SessionSummary[]> {
  const [activeFiles, archivedFiles] = await Promise.all([walkSessionFiles(ACTIVE_ROOT), walkSessionFiles(ARCHIVE_ROOT)]);
  const files = [
    ...activeFiles.map((filePath) => ({ filePath, archived: false })),
    ...archivedFiles.map((filePath) => ({ filePath, archived: true })),
  ];
  const filesWithStat = await Promise.all(
    files.map(async (entry) => ({
      ...entry,
      stat: await fs.stat(entry.filePath),
    })),
  );
  const recentFiles = filesWithStat
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
    .slice(0, 200);

  const summaries = await Promise.all(
    recentFiles.map(async ({ filePath, archived, stat }) => {
      const rawHead = await readSessionHead(filePath);
      const meta = extractSessionMeta(rawHead);
      const sessionId = meta.id ?? path.basename(filePath).replace(/^rollout-/, "").replace(/\.jsonl$/, "");
      const link = links.find((item) => item.sessionId === sessionId);
      return {
        sessionId,
        filePath,
        archived,
        cwd: meta.cwd ?? "",
        startedAt: meta.timestamp,
        lastUpdatedAt: stat.mtime.toISOString(),
        summary: meta.cwd ? `Session in ${meta.cwd}` : `Session file ${path.basename(filePath)}`,
        projectId: link?.projectId,
        personaId: link?.personaId,
        notes: link?.notes,
      } satisfies SessionSummary;
    }),
  );

  return summaries.sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt));
}
