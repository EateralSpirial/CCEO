import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parse } from "smol-toml";
import type { CodexDiscovery, CodexDiscoveryMcpServer, CodexDiscoverySkill } from "../../shared/models.js";
import { codexConfigPath, codexHome } from "./paths.js";

async function listSkillFolders(root: string): Promise<CodexDiscoverySkill[]> {
  async function walk(dir: string, depth: number): Promise<CodexDiscoverySkill[]> {
    if (depth > 3) {
      return [];
    }
    let entries: Dirent[] = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    const results: CodexDiscoverySkill[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const skillFile = path.join(fullPath, "SKILL.md");
        try {
          await fs.access(skillFile);
          results.push({ name: entry.name, path: fullPath });
          continue;
        } catch {
          results.push(...(await walk(fullPath, depth + 1)));
        }
      }
    }
    return results;
  }

  return walk(root, 0);
}

export async function discoverCodexEnvironment(): Promise<CodexDiscovery> {
  let parsedConfig: Record<string, unknown> = {};
  try {
    const raw = await fs.readFile(codexConfigPath, "utf8");
    parsedConfig = parse(raw) as Record<string, unknown>;
  } catch {
    parsedConfig = {};
  }

  const cliVersion = spawnSync("codex", ["--version"], { encoding: "utf8" }).stdout.trim() || "unknown";
  const mcpRaw = ((parsedConfig.mcp_servers ?? {}) as Record<string, Record<string, unknown>>) ?? {};
  const mcpServers: CodexDiscoveryMcpServer[] = Object.entries(mcpRaw).map(([id, config]) => ({
    id,
    enabled: config.enabled === false ? false : true,
    transport: typeof config.url === "string" ? "http" : "stdio",
    target:
      (typeof config.url === "string" && config.url) ||
      [config.command, ...(Array.isArray(config.args) ? config.args.map(String) : [])].filter(Boolean).join(" "),
  }));

  const projectsRaw = ((parsedConfig.projects ?? {}) as Record<string, { trust_level?: string }>) ?? {};
  const trustedProjects = Object.entries(projectsRaw).map(([projectPath, config]) => ({
    path: projectPath,
    trustLevel: config?.trust_level ?? "unknown",
  }));

  const skills = await listSkillFolders(path.join(codexHome, "skills"));
  return {
    cliVersion,
    defaultModel: String(parsedConfig.model ?? ""),
    defaultReasoningEffort: String(parsedConfig.model_reasoning_effort ?? ""),
    mcpServers,
    trustedProjects,
    skills: skills.sort((a, b) => a.name.localeCompare(b.name)),
  };
}
