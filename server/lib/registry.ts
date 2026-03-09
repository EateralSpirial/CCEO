import path from "node:path";
import fs from "node:fs/promises";
import type {
  ChannelDefinition,
  KnowledgeBaseDefinition,
  ManagerThread,
  PersonaDefinition,
  ProjectDefinition,
  SessionLink,
} from "../../shared/models.js";
import { appendAudit, nowIso, readJson, recordId, writeJson } from "./json-store.js";
import { ensureManagerDirs, generatedRoot } from "./paths.js";

const PERSONAS_FILE = "personas.json";
const PROJECTS_FILE = "projects.json";
const KNOWLEDGE_BASES_FILE = "knowledge-bases.json";
const CHANNELS_FILE = "channels.json";
const THREADS_FILE = "manager-threads.json";
const SESSION_LINKS_FILE = "session-links.json";

export interface RegistrySnapshot {
  personas: PersonaDefinition[];
  projects: ProjectDefinition[];
  knowledgeBases: KnowledgeBaseDefinition[];
  channels: ChannelDefinition[];
  managerThreads: ManagerThread[];
  sessionLinks: SessionLink[];
}

function defaultPersona(): PersonaDefinition {
  const ts = nowIso();
  return {
    id: "persona-cceo-main",
    name: "全权总经理",
    description: "以项目推进和系统治理为中心的 Codex Executive Officer 角色。",
    scope: "global",
    personality: "pragmatic",
    model: "gpt-5.4",
    reasoningEffort: "xhigh",
    verbosity: "high",
    webSearch: "live",
    profile: "",
    useProjectDocs: true,
    replaceBuiltInInstructions: false,
    systemPrompt:
      "你是本机 Codex 项目的全权总经理。你负责按项目上下文组织角色、知识库、会话、cron-loop 和渠道桥接。",
    developerInstructions:
      "优先读取项目文档、角色配置和既有会话；以推进真实目标为优先，不要停留在空泛总结。",
    skills: ["using-superpowers", "cron-loop", "openai-docs"],
    mcpServers: ["openaiDeveloperDocs", "wxfilehelper"],
    tools: ["shell", "web_search", "view_image", "spawn_agent"],
    channelIdentity: {
      displayName: "总经理",
      replyRules: "直接、明确、面向执行，默认中文。",
      deliveryStyle: "统一管理口径",
    },
    createdAt: ts,
    updatedAt: ts,
  };
}

function defaultProject(): ProjectDefinition {
  const ts = nowIso();
  return {
    id: "project-workspace-root",
    name: "当前工作区",
    description: "管理当前 workspace 的总控项目。",
    path: process.cwd(),
    managerPersonaId: "persona-cceo-main",
    participantPersonaIds: ["persona-cceo-main"],
    projectMcpServers: ["openaiDeveloperDocs", "wxfilehelper"],
    projectSkills: ["using-superpowers", "cron-loop"],
    projectTools: ["shell", "web_search", "view_image"],
    knowledgeBaseIds: ["kb-local-qdrant"],
    writableKnowledgeBaseIds: [],
    channelBindings: [],
    createdAt: ts,
    updatedAt: ts,
  };
}

function defaultKnowledgeBase(): KnowledgeBaseDefinition {
  const ts = nowIso();
  return {
    id: "kb-local-qdrant",
    name: "本机 Qdrant",
    description: "本机 6333 端口上的 Qdrant 默认入口。",
    scope: "global",
    url: "http://127.0.0.1:6333",
    collectionName: "",
    readOnly: false,
    createdAt: ts,
    updatedAt: ts,
  };
}

function defaultChannels(): ChannelDefinition[] {
  const ts = nowIso();
  return [
    {
      id: "channel-slack-primary",
      type: "slack",
      name: "Slack Bridge",
      enabled: false,
      status: "unconfigured",
      identity: "总经理",
      notes: "预留给现有 OpenClaw Slack 接入桥。",
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: "channel-telegram-primary",
      type: "telegram",
      name: "Telegram Bridge",
      enabled: false,
      status: "unconfigured",
      identity: "总经理",
      notes: "预留 Telegram Bot / webhook 桥接。",
      createdAt: ts,
      updatedAt: ts,
    },
  ];
}

function defaultThreads(): ManagerThread[] {
  const ts = nowIso();
  return [
    {
      id: "thread-cceo-main",
      title: "CCEO 主线程",
      messages: [],
      updatedAt: ts,
    },
  ];
}

async function ensurePersonaArtifacts(persona: PersonaDefinition): Promise<void> {
  const personaDir = path.join(generatedRoot, "personas", persona.id);
  const content = [
    `# ${persona.name}`,
    "",
    "## Persona System Prompt",
    persona.systemPrompt || "(empty)",
    "",
    "## Developer Instructions",
    persona.developerInstructions || "(empty)",
    "",
    "## Runtime Intent",
    `- Role scope: ${persona.scope}`,
    `- Personality: ${persona.personality}`,
    `- Tools: ${persona.tools.join(", ") || "(none)"}`,
    `- Skills: ${persona.skills.join(", ") || "(none)"}`,
    `- MCPs: ${persona.mcpServers.join(", ") || "(none)"}`,
    "",
    "## Channel Identity",
    `- Display name: ${persona.channelIdentity.displayName}`,
    `- Delivery style: ${persona.channelIdentity.deliveryStyle}`,
    `- Reply rules: ${persona.channelIdentity.replyRules}`,
    "",
  ].join("\n");
  await fs.mkdir(personaDir, { recursive: true });
  await fs.writeFile(path.join(personaDir, "instructions.md"), content, "utf8");
}

export async function ensureRegistry(): Promise<RegistrySnapshot> {
  await ensureManagerDirs();
  const personas = await readJson<PersonaDefinition[]>(PERSONAS_FILE, [defaultPersona()]);
  const projects = await readJson<ProjectDefinition[]>(PROJECTS_FILE, [defaultProject()]);
  const knowledgeBases = await readJson<KnowledgeBaseDefinition[]>(KNOWLEDGE_BASES_FILE, [defaultKnowledgeBase()]);
  const channels = await readJson<ChannelDefinition[]>(CHANNELS_FILE, defaultChannels());
  const managerThreads = await readJson<ManagerThread[]>(THREADS_FILE, defaultThreads());
  const sessionLinks = await readJson<SessionLink[]>(SESSION_LINKS_FILE, []);
  await Promise.all(personas.map((persona) => ensurePersonaArtifacts(persona)));
  return { personas, projects, knowledgeBases, channels, managerThreads, sessionLinks };
}

export async function upsertPersona(input: Partial<PersonaDefinition> & Pick<PersonaDefinition, "name">): Promise<PersonaDefinition> {
  const snapshot = await ensureRegistry();
  const existing = snapshot.personas.find((item) => item.id === input.id);
  const ts = nowIso();
  const persona: PersonaDefinition = {
    id: existing?.id ?? input.id ?? recordId("persona"),
    name: input.name,
    description: input.description ?? existing?.description ?? "",
    scope: input.scope ?? existing?.scope ?? "global",
    personality: input.personality ?? existing?.personality ?? "pragmatic",
    model: input.model ?? existing?.model ?? "gpt-5.4",
    reasoningEffort: input.reasoningEffort ?? existing?.reasoningEffort ?? "xhigh",
    verbosity: input.verbosity ?? existing?.verbosity ?? "high",
    webSearch: input.webSearch ?? existing?.webSearch ?? "live",
    profile: input.profile ?? existing?.profile ?? "",
    useProjectDocs: input.useProjectDocs ?? existing?.useProjectDocs ?? true,
    replaceBuiltInInstructions: input.replaceBuiltInInstructions ?? existing?.replaceBuiltInInstructions ?? false,
    systemPrompt: input.systemPrompt ?? existing?.systemPrompt ?? "",
    developerInstructions: input.developerInstructions ?? existing?.developerInstructions ?? "",
    skills: input.skills ?? existing?.skills ?? [],
    mcpServers: input.mcpServers ?? existing?.mcpServers ?? [],
    tools: input.tools ?? existing?.tools ?? [],
    channelIdentity:
      input.channelIdentity ??
      existing?.channelIdentity ?? {
        displayName: input.name,
        replyRules: "直接、可执行。",
        deliveryStyle: "统一管理口径",
      },
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
  };
  const next = snapshot.personas.filter((item) => item.id !== persona.id);
  next.unshift(persona);
  await writeJson(PERSONAS_FILE, next);
  await ensurePersonaArtifacts(persona);
  await appendAudit({ type: "persona.upsert", personaId: persona.id, name: persona.name });
  return persona;
}

export async function upsertKnowledgeBase(
  input: Partial<KnowledgeBaseDefinition> & Pick<KnowledgeBaseDefinition, "name" | "url">,
): Promise<KnowledgeBaseDefinition> {
  const snapshot = await ensureRegistry();
  const existing = snapshot.knowledgeBases.find((item) => item.id === input.id);
  const ts = nowIso();
  const entry: KnowledgeBaseDefinition = {
    id: existing?.id ?? input.id ?? recordId("kb"),
    name: input.name,
    description: input.description ?? existing?.description ?? "",
    scope: input.scope ?? existing?.scope ?? "global",
    url: input.url,
    collectionName: input.collectionName ?? existing?.collectionName ?? "",
    readOnly: input.readOnly ?? existing?.readOnly ?? false,
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
  };
  const next = snapshot.knowledgeBases.filter((item) => item.id !== entry.id);
  next.unshift(entry);
  await writeJson(KNOWLEDGE_BASES_FILE, next);
  await appendAudit({ type: "kb.upsert", knowledgeBaseId: entry.id, name: entry.name });
  return entry;
}

export async function upsertChannel(input: Partial<ChannelDefinition> & Pick<ChannelDefinition, "name" | "type">): Promise<ChannelDefinition> {
  const snapshot = await ensureRegistry();
  const existing = snapshot.channels.find((item) => item.id === input.id);
  const ts = nowIso();
  const channel: ChannelDefinition = {
    id: existing?.id ?? input.id ?? recordId("channel"),
    type: input.type,
    name: input.name,
    enabled: input.enabled ?? existing?.enabled ?? false,
    status: input.status ?? existing?.status ?? "unconfigured",
    identity: input.identity ?? existing?.identity ?? "",
    notes: input.notes ?? existing?.notes ?? "",
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
  };
  const next = snapshot.channels.filter((item) => item.id !== channel.id);
  next.unshift(channel);
  await writeJson(CHANNELS_FILE, next);
  await appendAudit({ type: "channel.upsert", channelId: channel.id, name: channel.name, channelType: channel.type });
  return channel;
}

export async function upsertProject(input: Partial<ProjectDefinition> & Pick<ProjectDefinition, "name" | "path">): Promise<ProjectDefinition> {
  const snapshot = await ensureRegistry();
  const existing = snapshot.projects.find((item) => item.id === input.id);
  const ts = nowIso();
  const project: ProjectDefinition = {
    id: existing?.id ?? input.id ?? recordId("project"),
    name: input.name,
    description: input.description ?? existing?.description ?? "",
    path: input.path,
    managerPersonaId: input.managerPersonaId ?? existing?.managerPersonaId ?? snapshot.personas[0]?.id ?? "",
    participantPersonaIds: input.participantPersonaIds ?? existing?.participantPersonaIds ?? [],
    projectMcpServers: input.projectMcpServers ?? existing?.projectMcpServers ?? [],
    projectSkills: input.projectSkills ?? existing?.projectSkills ?? [],
    projectTools: input.projectTools ?? existing?.projectTools ?? [],
    knowledgeBaseIds: input.knowledgeBaseIds ?? existing?.knowledgeBaseIds ?? [],
    writableKnowledgeBaseIds: input.writableKnowledgeBaseIds ?? existing?.writableKnowledgeBaseIds ?? [],
    channelBindings: input.channelBindings ?? existing?.channelBindings ?? [],
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
  };
  const next = snapshot.projects.filter((item) => item.id !== project.id);
  next.unshift(project);
  await writeJson(PROJECTS_FILE, next);
  await appendAudit({ type: "project.upsert", projectId: project.id, name: project.name, path: project.path });
  return project;
}

export async function upsertSessionLink(sessionId: string, payload: Omit<SessionLink, "sessionId" | "updatedAt">): Promise<SessionLink> {
  const snapshot = await ensureRegistry();
  const ts = nowIso();
  const entry: SessionLink = {
    sessionId,
    projectId: payload.projectId,
    personaId: payload.personaId,
    notes: payload.notes,
    updatedAt: ts,
  };
  const next = snapshot.sessionLinks.filter((item) => item.sessionId !== sessionId);
  next.unshift(entry);
  await writeJson(SESSION_LINKS_FILE, next);
  await appendAudit({ type: "session.link", sessionId, projectId: payload.projectId, personaId: payload.personaId });
  return entry;
}

export async function appendThreadMessage(threadId: string, message: ManagerThread["messages"][number]): Promise<void> {
  const snapshot = await ensureRegistry();
  const existingIndex = snapshot.managerThreads.findIndex((thread) => thread.id === threadId);
  const nextThreads = [...snapshot.managerThreads];

  if (existingIndex === -1) {
    nextThreads.unshift({
      id: threadId,
      title: threadId,
      messages: [message],
      updatedAt: message.createdAt,
    });
    await writeJson(THREADS_FILE, nextThreads);
    return;
  }

  const existingThread = nextThreads[existingIndex];
  if (!existingThread) {
    return;
  }
  const duplicate = existingThread.messages.some(
    (entry) => entry.id === message.id || (Boolean(message.runId) && entry.runId === message.runId && entry.role === message.role),
  );
  if (duplicate) {
    return;
  }

  nextThreads[existingIndex] = {
    ...existingThread,
    messages: [...existingThread.messages, message],
    updatedAt: message.createdAt,
  };
  await writeJson(THREADS_FILE, nextThreads);
}
