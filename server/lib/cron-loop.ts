import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { CronJobSummary, ProjectDefinition } from "../../shared/models.js";
import { cronLoopManageScript } from "./paths.js";

const JOB_PATTERN = /^(.*)\.(runner\.sh|prompt\.md|cron\.log|latest\.log|latest\.md|lock|state\.json|ledger\.md|ledger\.json)$/;

async function readMaybe(filePath: string, limit = 400): Promise<string | undefined> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return raw.slice(0, limit).trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function scanProjectCronJobs(project: ProjectDefinition): Promise<CronJobSummary[]> {
  const cronDir = path.join(project.path, ".cron-loop");
  let entries: Dirent[] = [];
  try {
    entries = await fs.readdir(cronDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const jobs = new Map<string, Set<string>>();
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const match = entry.name.match(JOB_PATTERN);
    if (!match) {
      continue;
    }
    const job = match[1];
    if (!job) {
      continue;
    }
    const set = jobs.get(job) ?? new Set<string>();
    set.add(entry.name);
    jobs.set(job, set);
  }

  const summaries = await Promise.all(
    Array.from(jobs.entries()).map(async ([job, files]) => {
      const stateFile = path.join(cronDir, `${job}.state.json`);
      const latestMessagePath = path.join(cronDir, `${job}.latest.md`);
      let state: { status?: string; schedule?: string } = {};
      try {
        state = JSON.parse(await fs.readFile(stateFile, "utf8")) as { status?: string; schedule?: string };
      } catch {
        state = {};
      }
      return {
        id: `${project.id}:${job}`,
        job,
        projectId: project.id,
        projectPath: project.path,
        cronDir,
        status: state.status ?? "unknown",
        schedule: state.schedule,
        latestMessage: await readMaybe(latestMessagePath),
        stateFile,
        files: Array.from(files).sort().map((name) => path.join(cronDir, name)),
      } satisfies CronJobSummary;
    }),
  );

  return summaries.sort((a, b) => a.job.localeCompare(b.job));
}

export async function runCronAction(
  projectPath: string,
  job: string,
  action: "pause" | "resume" | "validate" | "paths" | "uninstall",
): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn("/usr/bin/python3", [cronLoopManageScript, action, "--project-root", projectPath, "--job", job], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        output: [stdout.trim(), stderr.trim()].filter(Boolean).join("\n"),
      });
    });
  });
}
