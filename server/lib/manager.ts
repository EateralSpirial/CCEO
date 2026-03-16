import type { ManagerMessage, PersonaDefinition, ProjectDefinition } from "../../shared/models.js";
import { getRun, startCodexRun, subscribeRun } from "./codex.js";
import { nowIso, recordId } from "./json-store.js";
import { appendThreadMessage, ensureRegistry } from "./registry.js";

export interface DispatchManagerPromptParams {
  prompt: string;
  threadId: string;
  displayText?: string;
  personaId?: string;
  projectId?: string;
  sessionId?: string;
}

export interface DispatchManagerPromptResult {
  runId: string;
  sessionId?: string;
  persona?: PersonaDefinition;
  project?: ProjectDefinition;
  threadId: string;
}

export async function dispatchManagerPrompt(params: DispatchManagerPromptParams): Promise<DispatchManagerPromptResult> {
  const registry = await ensureRegistry();
  const persona = registry.personas.find((entry) => entry.id === params.personaId) ?? registry.personas[0];
  const project = registry.projects.find((entry) => entry.id === params.projectId) ?? registry.projects[0];
  const userMessage: ManagerMessage = {
    id: recordId("msg"),
    role: "user",
    content: params.displayText ?? params.prompt,
    createdAt: nowIso(),
    personaId: persona?.id,
    projectId: project?.id,
    sessionId: params.sessionId,
  };
  await appendThreadMessage(params.threadId, userMessage);

  const run = await startCodexRun({
    prompt: params.prompt,
    persona,
    project,
    sessionId: params.sessionId,
  });

  let persisted = false;
  const persistRunCompletion = async () => {
    if (persisted) {
      return;
    }
    const activeRun = getRun(run.id);
    if (!activeRun || activeRun.status === "running") {
      return;
    }
    persisted = true;
    const message: ManagerMessage = {
      id: recordId("msg"),
      role: activeRun.status === "completed" ? "assistant" : "system",
      content: activeRun.finalMessage || "运行结束，但没有生成最终消息。",
      createdAt: activeRun.completedAt ?? nowIso(),
      personaId: persona?.id,
      projectId: project?.id,
      sessionId: activeRun.sessionId,
      runId: activeRun.id,
    };
    await appendThreadMessage(params.threadId, message);
  };

  const unsubscribe = subscribeRun(run.id, () => {
    void persistRunCompletion().finally(() => {
      const activeRun = getRun(run.id);
      if (activeRun?.status !== "running") {
        unsubscribe();
      }
    });
  });
  await persistRunCompletion();

  return {
    runId: run.id,
    sessionId: run.sessionId,
    persona,
    project,
    threadId: params.threadId,
  };
}
