import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import readline from "node:readline";
import { spawn } from "node:child_process";
import type { ManagerRun, ManagerRunEvent, PersonaDefinition, ProjectDefinition, ReasoningEffort } from "../../shared/models.js";
import { generatedRoot } from "./paths.js";

type RunListener = (event: ManagerRunEvent) => void;

const runs = new Map<string, ManagerRun>();
const listeners = new Map<string, Set<RunListener>>();

function pushEvent(runId: string, event: Omit<ManagerRunEvent, "id" | "runId">): void {
  const run = runs.get(runId);
  if (!run) {
    return;
  }
  const payload: ManagerRunEvent = {
    id: randomUUID(),
    runId,
    ...event,
  };
  run.events.push(payload);
  const activeListeners = listeners.get(runId) ?? new Set<RunListener>();
  for (const listener of activeListeners) {
    listener(payload);
  }
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function usesModernReasoningScale(model?: string): boolean {
  return Boolean(model && /^gpt-5(?:[.-]|$)/i.test(model));
}

function normalizeReasoningEffort(model: string | undefined, reasoningEffort: ReasoningEffort | undefined): ReasoningEffort | undefined {
  if (!reasoningEffort) {
    return undefined;
  }
  if (usesModernReasoningScale(model)) {
    return reasoningEffort === "minimal" ? "low" : reasoningEffort;
  }
  return reasoningEffort === "none" ? "minimal" : reasoningEffort;
}

function buildRuntimeInstructions(persona?: PersonaDefinition, project?: ProjectDefinition): string {
  if (!persona) {
    return "";
  }

  const sections: string[] = [];
  const systemPrompt = persona.systemPrompt.trim();
  if (systemPrompt) {
    sections.push(systemPrompt);
  }

  const runtimeLines: string[] = [];
  if (project?.name || project?.path) {
    runtimeLines.push(`当前治理项目：${project?.name || "未命名项目"}${project?.path ? `（${project.path}）` : ""}。`);
  }
  runtimeLines.push(
    persona.useProjectDocs
      ? "优先读取与当前任务直接相关的项目文档、配置和既有会话。"
      : "除非用户明确要求或当前任务确有必要，否则不要主动读取项目级文档。",
  );
  if (persona.channelIdentity.displayName.trim()) {
    runtimeLines.push(`对外称呼使用「${persona.channelIdentity.displayName.trim()}」。`);
  }
  if (persona.channelIdentity.replyRules.trim()) {
    runtimeLines.push(`回复规则：${persona.channelIdentity.replyRules.trim()}`);
  }
  if (persona.channelIdentity.deliveryStyle.trim()) {
    runtimeLines.push(`表达风格：${persona.channelIdentity.deliveryStyle.trim()}`);
  }
  if (runtimeLines.length) {
    sections.push(["## Runtime Overlay", ...runtimeLines.map((line) => `- ${line}`)].join("\n"));
  }

  const developerInstructions = persona.developerInstructions.trim();
  if (developerInstructions) {
    sections.push(developerInstructions);
  }

  return sections.filter(Boolean).join("\n\n").trim();
}

async function runtimeInstructionPath(runId: string): Promise<string> {
  const runtimeDir = path.join(generatedRoot, "runs");
  await fs.mkdir(runtimeDir, { recursive: true });
  return path.join(runtimeDir, `run-${runId}.instructions.md`);
}

async function materializeRuntimeInstructions(runId: string, persona?: PersonaDefinition, project?: ProjectDefinition): Promise<{
  filePath?: string;
  text?: string;
}> {
  const text = buildRuntimeInstructions(persona, project);
  if (!text) {
    return {};
  }
  const filePath = await runtimeInstructionPath(runId);
  await fs.writeFile(filePath, `${text}\n`, "utf8");
  return { filePath, text };
}

function buildCodexArgs(params: {
  prompt: string;
  persona?: PersonaDefinition;
  project?: ProjectDefinition;
  sessionId?: string;
  outputFile: string;
  runtimeInstructionsFile?: string;
  runtimeInstructionsText?: string;
}): string[] {
  const { persona, project, prompt, sessionId, outputFile, runtimeInstructionsFile, runtimeInstructionsText } = params;
  const args: string[] = [];
  if (project?.path) {
    args.push("-C", project.path);
  }
  if (persona?.model) {
    args.push("-m", persona.model);
  }
  if (persona?.profile) {
    args.push("-p", persona.profile);
  }
  args.push("-c", 'approval_policy="never"');
  args.push("-c", 'sandbox_mode="danger-full-access"');
  const normalizedReasoning = normalizeReasoningEffort(persona?.model, persona?.reasoningEffort);
  if (normalizedReasoning) {
    args.push("-c", `model_reasoning_effort=${tomlString(normalizedReasoning)}`);
  }
  if (persona?.verbosity) {
    args.push("-c", `model_verbosity=${tomlString(persona.verbosity)}`);
  }
  if (persona?.personality && persona.personality !== "none") {
    args.push("-c", `personality=${tomlString(persona.personality)}`);
  }
  if (persona?.webSearch) {
    args.push("-c", `web_search=${tomlString(persona.webSearch)}`);
  }
  if (persona?.replaceBuiltInInstructions && runtimeInstructionsFile) {
    args.push("-c", `model_instructions_file=${tomlString(runtimeInstructionsFile)}`);
  } else if (runtimeInstructionsText) {
    args.push("-c", `developer_instructions=${tomlString(runtimeInstructionsText)}`);
  }

  if (sessionId) {
    args.push("exec", "resume", "--json", "--all", "--skip-git-repo-check", "--output-last-message", outputFile, sessionId, prompt);
  } else {
    args.push("exec", "--json", "--skip-git-repo-check", "--output-last-message", outputFile, prompt);
  }
  return args;
}

export async function startCodexRun(params: {
  prompt: string;
  persona?: PersonaDefinition;
  project?: ProjectDefinition;
  sessionId?: string;
}): Promise<ManagerRun> {
  const runId = randomUUID();
  const run: ManagerRun = {
    id: runId,
    prompt: params.prompt,
    status: "running",
    startedAt: new Date().toISOString(),
    projectId: params.project?.id,
    personaId: params.persona?.id,
    sessionId: params.sessionId,
    finalMessage: "",
    commandPreview: [],
    events: [],
  };
  runs.set(runId, run);
  listeners.set(runId, new Set());

  const outputFile = path.join(generatedRoot, `run-${runId}.last-message.txt`);
  const runtimeInstructions = await materializeRuntimeInstructions(runId, params.persona, params.project);
  const args = buildCodexArgs({
    ...params,
    outputFile,
    runtimeInstructionsFile: runtimeInstructions.filePath,
    runtimeInstructionsText: runtimeInstructions.text,
  });
  run.commandPreview = ["codex", ...args];
  pushEvent(runId, {
    ts: new Date().toISOString(),
    type: "status",
    text: "启动 Codex 运行",
  });

  const child = spawn("codex", args, {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let lastErrorText = "";

  const handleRawLine = (line: string) => {
    try {
      const payload = JSON.parse(line) as Record<string, unknown>;
      const type = String(payload.type ?? "raw");
      if (type === "thread.started" && typeof payload.thread_id === "string") {
        run.sessionId = payload.thread_id;
        pushEvent(runId, {
          ts: new Date().toISOString(),
          type: "status",
          text: `线程已创建: ${payload.thread_id}`,
          sessionId: payload.thread_id,
        });
        return;
      }
      if (type === "item.started" || type === "item.completed") {
        const item = (payload.item ?? {}) as Record<string, unknown>;
        const itemType = String(item.type ?? "");
        if (itemType === "command_execution") {
          pushEvent(runId, {
            ts: new Date().toISOString(),
            type: "command",
            text:
              type === "item.started"
                ? `执行命令: ${String(item.command ?? "")}`
                : `命令完成: ${String(item.command ?? "")}`,
            command: String(item.command ?? ""),
            exitCode: typeof item.exit_code === "number" ? item.exit_code : null,
          });
          return;
        }
        if (type === "item.completed" && itemType === "agent_message") {
          const text = String(item.text ?? "");
          run.finalMessage = text;
          pushEvent(runId, {
            ts: new Date().toISOString(),
            type: "message",
            text,
          });
          return;
        }
      }
      if (type === "turn.completed") {
        pushEvent(runId, {
          ts: new Date().toISOString(),
          type: "status",
          text: "本轮完成",
        });
        return;
      }
      pushEvent(runId, {
        ts: new Date().toISOString(),
        type: "raw",
        text: line,
      });
    } catch {
      pushEvent(runId, {
        ts: new Date().toISOString(),
        type: "raw",
        text: line,
      });
    }
  };

  readline.createInterface({ input: child.stdout }).on("line", handleRawLine);
  readline.createInterface({ input: child.stderr }).on("line", (line) => {
    lastErrorText = line;
    pushEvent(runId, {
      ts: new Date().toISOString(),
      type: "error",
      text: line,
    });
  });

  child.on("close", async (code) => {
    try {
      if (!run.finalMessage) {
        run.finalMessage = (await fs.readFile(outputFile, "utf8")).trim();
      }
    } catch {
      run.finalMessage = run.finalMessage || "";
    }
    if (!run.finalMessage && lastErrorText) {
      run.finalMessage = lastErrorText;
    }
    if (!run.finalMessage && code !== 0) {
      run.finalMessage = `Codex 运行失败，退出码 ${code}`;
    }
    run.status = code === 0 ? "completed" : "failed";
    run.completedAt = new Date().toISOString();
    pushEvent(runId, {
      ts: run.completedAt,
      type: code === 0 ? "status" : "error",
      text: code === 0 ? "Codex 运行完成" : `Codex 运行失败，退出码 ${code}`,
    });
  });

  return run;
}

export function getRun(runId: string): ManagerRun | undefined {
  return runs.get(runId);
}

export function subscribeRun(runId: string, listener: RunListener): () => void {
  const set = listeners.get(runId) ?? new Set<RunListener>();
  set.add(listener);
  listeners.set(runId, set);
  return () => {
    const active = listeners.get(runId);
    if (!active) {
      return;
    }
    active.delete(listener);
  };
}
