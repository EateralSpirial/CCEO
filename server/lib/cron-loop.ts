import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import type { CronJobSummary, ProjectDefinition } from "../../shared/models.js";

const PRIMARY_SINGLETON_FILES = new Set(["manage.mjs", "runner.sh", "prompt.md", "state.json", "latest.md"]);

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

  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
  if (!files.some((name) => PRIMARY_SINGLETON_FILES.has(name))) {
    return [];
  }

  const stateFile = path.join(cronDir, "state.json");
  const latestMessagePath = path.join(cronDir, "latest.md");
  let state: { status?: string; schedule?: string } = {};
  try {
    state = JSON.parse(await fs.readFile(stateFile, "utf8")) as { status?: string; schedule?: string };
  } catch {
    state = {};
  }
  return [
    {
      id: `${project.id}:singleton`,
      job: path.basename(project.path),
      projectId: project.id,
      projectPath: project.path,
      cronDir,
      status: state.status ?? "unknown",
      schedule: state.schedule,
      latestMessage: await readMaybe(latestMessagePath),
      stateFile,
      files: files.map((name) => path.join(cronDir, name)),
    } satisfies CronJobSummary,
  ];
}

export async function runCronAction(
  projectPath: string,
  _job: string,
  action: "stop" | "start" | "validate" | "paths" | "destroy",
): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(projectPath, ".cron-loop", "manage.mjs"), action], {
      cwd: projectPath,
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
    child.on("error", (error) => {
      resolve({
        ok: false,
        output: error.message,
      });
    });
  });
}
