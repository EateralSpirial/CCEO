import fs from "node:fs/promises";
import path from "node:path";
import { homedir } from "node:os";

export const appRoot = process.cwd();
export const dataRoot = path.join(appRoot, ".codex-manager");
export const registryRoot = path.join(dataRoot, "registry");
export const generatedRoot = path.join(dataRoot, "generated");
export const auditLogPath = path.join(dataRoot, "audit.log.jsonl");
export const codexHome = path.join(homedir(), ".codex");
export const codexConfigPath = path.join(codexHome, "config.toml");
export const cronLoopManageScript = "/home/sal/.codex/skills/cron-loop/scripts/manage_cron.py";

export async function ensureManagerDirs(): Promise<void> {
  await fs.mkdir(registryRoot, { recursive: true });
  await fs.mkdir(path.join(generatedRoot, "personas"), { recursive: true });
}
