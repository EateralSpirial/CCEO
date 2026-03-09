export type PersonaScope = "global" | "project";
export type PersonaTone = "none" | "friendly" | "pragmatic";
export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
export type VerbosityLevel = "low" | "medium" | "high";
export type WebSearchMode = "disabled" | "cached" | "live";
export type ChannelType = "slack" | "telegram";
export type ChannelStatus = "unconfigured" | "configured" | "error";
export type KnowledgeBaseScope = "global" | "project";
export type RunStatus = "idle" | "running" | "completed" | "failed";

export interface ChannelIdentity {
  displayName: string;
  replyRules: string;
  deliveryStyle: string;
}

export interface PersonaDefinition {
  id: string;
  name: string;
  description: string;
  scope: PersonaScope;
  personality: PersonaTone;
  model: string;
  reasoningEffort: ReasoningEffort;
  verbosity: VerbosityLevel;
  webSearch: WebSearchMode;
  profile: string;
  useProjectDocs: boolean;
  replaceBuiltInInstructions: boolean;
  systemPrompt: string;
  developerInstructions: string;
  skills: string[];
  mcpServers: string[];
  tools: string[];
  channelIdentity: ChannelIdentity;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeBaseDefinition {
  id: string;
  name: string;
  description: string;
  scope: KnowledgeBaseScope;
  url: string;
  collectionName: string;
  readOnly: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelBinding {
  channelId: string;
  room: string;
  alias: string;
}

export interface ProjectDefinition {
  id: string;
  name: string;
  description: string;
  path: string;
  managerPersonaId: string;
  participantPersonaIds: string[];
  projectMcpServers: string[];
  projectSkills: string[];
  projectTools: string[];
  knowledgeBaseIds: string[];
  writableKnowledgeBaseIds: string[];
  channelBindings: ChannelBinding[];
  createdAt: string;
  updatedAt: string;
}

export interface ChannelDefinition {
  id: string;
  type: ChannelType;
  name: string;
  enabled: boolean;
  status: ChannelStatus;
  identity: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionLink {
  sessionId: string;
  projectId?: string;
  personaId?: string;
  notes?: string;
  updatedAt: string;
}

export interface SessionSummary {
  sessionId: string;
  filePath: string;
  archived: boolean;
  cwd: string;
  startedAt?: string;
  lastUpdatedAt: string;
  summary: string;
  projectId?: string;
  personaId?: string;
  notes?: string;
}

export interface CodexDiscoveryMcpServer {
  id: string;
  enabled: boolean;
  transport: "http" | "stdio";
  target: string;
}

export interface CodexDiscoverySkill {
  name: string;
  path: string;
}

export interface CodexDiscovery {
  cliVersion: string;
  defaultModel: string;
  defaultReasoningEffort: string;
  mcpServers: CodexDiscoveryMcpServer[];
  trustedProjects: { path: string; trustLevel: string }[];
  skills: CodexDiscoverySkill[];
}

export interface QdrantStatus {
  reachable: boolean;
  url: string;
  collections: string[];
  error?: string;
}

export interface CronJobSummary {
  id: string;
  job: string;
  projectId: string;
  projectPath: string;
  cronDir: string;
  status: string;
  schedule?: string;
  latestMessage?: string;
  stateFile?: string;
  files: string[];
}

export interface ManagerMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  projectId?: string;
  personaId?: string;
  sessionId?: string;
  runId?: string;
}

export interface ManagerThread {
  id: string;
  title: string;
  messages: ManagerMessage[];
  updatedAt: string;
}

export interface ManagerRunEvent {
  id: string;
  runId: string;
  ts: string;
  type: "status" | "command" | "message" | "error" | "raw";
  text: string;
  sessionId?: string;
  command?: string;
  exitCode?: number | null;
}

export interface ManagerRun {
  id: string;
  prompt: string;
  status: RunStatus;
  startedAt: string;
  completedAt?: string;
  projectId?: string;
  personaId?: string;
  sessionId?: string;
  finalMessage?: string;
  commandPreview: string[];
  events: ManagerRunEvent[];
}

export interface BootstrapPayload {
  personas: PersonaDefinition[];
  projects: ProjectDefinition[];
  knowledgeBases: KnowledgeBaseDefinition[];
  channels: ChannelDefinition[];
  sessions: SessionSummary[];
  managerThreads: ManagerThread[];
  discovery: CodexDiscovery;
  qdrant: QdrantStatus;
  cronJobs: Record<string, CronJobSummary[]>;
}
