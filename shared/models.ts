export type PersonaScope = "global" | "project";
export type PersonaTone = "none" | "friendly" | "pragmatic";
export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
export type VerbosityLevel = "low" | "medium" | "high";
export type WebSearchMode = "disabled" | "cached" | "live";
export type ChannelType = "slack" | "telegram";
export type ChannelStatus = "unconfigured" | "configured" | "error";
export type ChannelDeliveryMode = "dry-run" | "live";
export type ChannelConnectionState = "disconnected" | "connecting" | "connected" | "error";
export type SlackConnectionMode = "webhook" | "socket" | "http";
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

export interface ChannelConfig {
  slackMode: SlackConnectionMode;
  slackWebhookUrl: string;
  slackChannel: string;
  slackBotToken: string;
  slackAppToken: string;
  slackSigningSecret: string;
  slackWebhookPath: string;
  slackRequireMention: boolean;
  slackDefaultProjectId: string;
  telegramBotToken: string;
  telegramChatId: string;
  telegramApiBaseUrl: string;
}

export interface ChannelRuntimeState {
  connectionState?: ChannelConnectionState;
  lastConnectionAt?: string;
  lastConnectionOk?: boolean;
  lastConnectionSummary?: string;
  lastConnectedAt?: string;
  lastDisconnectedAt?: string;
  lastValidatedAt?: string;
  lastValidationOk?: boolean;
  lastValidationSummary?: string;
  lastDeliveryAt?: string;
  lastDeliveryMode?: ChannelDeliveryMode;
  lastDeliveryOk?: boolean;
  lastDeliverySummary?: string;
  lastInboundAt?: string;
  lastInboundSummary?: string;
  lastRoutedProjectId?: string;
  lastRoutedPersonaId?: string;
  lastThreadId?: string;
  lastError?: string;
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
  config: ChannelConfig;
  runtime: ChannelRuntimeState;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelValidationReport {
  channelId: string;
  channelType: ChannelType;
  checkedAt: string;
  ok: boolean;
  liveReady: boolean;
  issues: string[];
  warnings: string[];
  summary: string;
}

export interface ChannelDeliveryReport extends ChannelValidationReport {
  mode: ChannelDeliveryMode;
  delivered: boolean;
  requestPreview: {
    method: string;
    url: string;
    body: string;
  };
  httpStatus?: number;
  responsePreview?: string;
}

export interface ChannelConnectionReport extends ChannelValidationReport {
  action: "connect" | "disconnect";
  connected: boolean;
  connectionState: ChannelConnectionState;
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
