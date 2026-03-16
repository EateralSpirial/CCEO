import SlackBolt from "@slack/bolt";
import type {
  ChannelConnectionReport,
  ChannelDefinition,
  PersonaDefinition,
  ProjectDefinition,
} from "../../shared/models.js";
import { getRun, subscribeRun } from "./codex.js";
import { deliverSlackLiveMessage, resolveSlackMode, validateChannel } from "./channels.js";
import { nowIso } from "./json-store.js";
import { dispatchManagerPrompt } from "./manager.js";
import { ensureRegistry, updateChannelRuntime } from "./registry.js";
import type { RegistrySnapshot } from "./registry.js";

type SlackApp = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  message: (listener: (args: unknown) => Promise<void> | void) => void;
  error: (listener: (error: unknown) => Promise<void> | void) => void;
  client: {
    auth: {
      test: (args?: Record<string, unknown>) => Promise<Record<string, unknown>>;
    };
  };
};

type SlackBridge = {
  channelId: string;
  app: SlackApp;
  botUserId: string;
};

type SlackInboundEvent = {
  channel: string;
  channelType: string;
  text: string;
  user: string;
  ts: string;
  threadTs?: string;
};

const slackBoltModule = SlackBolt as typeof import("@slack/bolt") & {
  default?: typeof import("@slack/bolt");
};
const slackBolt =
  (slackBoltModule.App ? slackBoltModule : slackBoltModule.default) ?? slackBoltModule;
const { App } = slackBolt;
const REVIEW_MODE = process.env.CCEO_REVIEW_MODE === "1";

const activeBridges = new Map<string, SlackBridge>();

function trim(value: string | undefined): string {
  return String(value ?? "").trim();
}

function extractSlackInboundEvent(raw: unknown): SlackInboundEvent | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const event = raw as Record<string, unknown>;
  const subtype = trim(typeof event.subtype === "string" ? event.subtype : "");
  if (subtype && subtype !== "thread_broadcast") {
    return null;
  }
  const user = trim(typeof event.user === "string" ? event.user : "");
  const text = trim(typeof event.text === "string" ? event.text : "");
  const channel = trim(typeof event.channel === "string" ? event.channel : "");
  const ts = trim(typeof event.ts === "string" ? event.ts : "");
  const channelType = trim(typeof event.channel_type === "string" ? event.channel_type : "");
  const threadTs = trim(typeof event.thread_ts === "string" ? event.thread_ts : "");
  if (!user || !text || !channel || !ts) {
    return null;
  }
  return {
    user,
    text,
    channel,
    ts,
    channelType,
    threadTs: threadTs || undefined,
  };
}

function buildConnectionReport(params: {
  channel: ChannelDefinition;
  action: "connect" | "disconnect";
  connected: boolean;
  connectionState: ChannelConnectionReport["connectionState"];
  summary: string;
  issues?: string[];
  warnings?: string[];
}) {
  const validation = validateChannel(params.channel);
  return {
    ...validation,
    checkedAt: nowIso(),
    ok: params.connected || (params.action === "disconnect" && params.connectionState === "disconnected"),
    action: params.action,
    connected: params.connected,
    connectionState: params.connectionState,
    issues: params.issues ?? validation.issues,
    warnings: params.warnings ?? validation.warnings,
    summary: params.summary,
  };
}

function buildThreadId(channelId: string, event: SlackInboundEvent): string {
  if (event.channelType === "im") {
    return `thread-slack-${channelId}-dm-${event.channel}`;
  }
  return `thread-slack-${channelId}-${event.channel}-${event.threadTs ?? event.ts}`;
}

function sanitizeSlackPrompt(text: string, botUserId: string): string {
  const mention = botUserId ? new RegExp(`<@${botUserId}>`, "g") : null;
  const withoutMention = mention ? text.replace(mention, " ") : text;
  return withoutMention.replace(/\s+/g, " ").trim();
}

function resolveProjectForInbound(registry: RegistrySnapshot, channel: ChannelDefinition, event: SlackInboundEvent): ProjectDefinition | undefined {
  const exactBoundProject = registry.projects.find((project) =>
    project.channelBindings.some((binding) => binding.channelId === channel.id && trim(binding.room) === event.channel),
  );
  if (exactBoundProject) {
    return exactBoundProject;
  }

  const configuredDefault = registry.projects.find((project) => project.id === trim(channel.config.slackDefaultProjectId));
  if (configuredDefault) {
    return configuredDefault;
  }

  const channelBoundProjects = registry.projects.filter((project) =>
    project.channelBindings.some((binding) => binding.channelId === channel.id),
  );
  if (channelBoundProjects.length === 1) {
    return channelBoundProjects[0];
  }
  return registry.projects[0];
}

function resolvePersonaForProject(registry: RegistrySnapshot, project?: ProjectDefinition): PersonaDefinition | undefined {
  if (!project) {
    return registry.personas[0];
  }
  return registry.personas.find((persona) => persona.id === project.managerPersonaId) ?? registry.personas[0];
}

function buildSlackManagerPrompt(params: {
  event: SlackInboundEvent;
  project?: ProjectDefinition;
  persona?: PersonaDefinition;
  cleanedText: string;
}): string {
  return [
    "以下消息来自 Slack 渠道，请直接回复 Slack 对话，不要暴露内部实现细节。",
    `Slack channel type: ${params.event.channelType || "unknown"}`,
    `Slack channel id: ${params.event.channel}`,
    `Slack user id: ${params.event.user}`,
    params.project ? `Routing project: ${params.project.name} (${params.project.id})` : "Routing project: unresolved",
    params.persona ? `Routing persona: ${params.persona.name} (${params.persona.id})` : "Routing persona: unresolved",
    "",
    params.cleanedText,
  ].join("\n");
}

async function sendSlackRunReply(params: {
  channel: ChannelDefinition;
  slackChannelId: string;
  threadTs?: string;
  runId: string;
}) {
  const sendReply = async (): Promise<boolean> => {
    const run = getRun(params.runId);
    if (!run || run.status === "running") {
      return false;
    }

    const text = trim(run.finalMessage) || (run.status === "failed" ? "总经理运行失败。" : "总经理运行结束，但没有返回内容。");
    const result = await deliverSlackLiveMessage({
      channel: params.channel,
      message: text,
      target: params.slackChannelId,
      threadTs: params.threadTs,
    });

    await updateChannelRuntime(params.channel.id, {
      status: result.ok ? "configured" : "error",
      lastDeliveryAt: nowIso(),
      lastDeliveryMode: "live",
      lastDeliveryOk: result.ok,
      lastDeliverySummary: result.ok ? `Slack 回复已回传到 ${params.slackChannelId}。` : `Slack 回复回传失败：${result.responsePreview}`,
      lastError: result.ok ? "" : result.responsePreview,
    });
    return true;
  };

  if (await sendReply()) {
    return;
  }

  const unsubscribe = subscribeRun(params.runId, () => {
    void sendReply()
      .then((done) => {
        if (done) {
          unsubscribe();
        }
      })
      .catch(async (error) => {
        unsubscribe();
        await updateChannelRuntime(params.channel.id, {
          status: "error",
          lastDeliveryAt: nowIso(),
          lastDeliveryMode: "live",
          lastDeliveryOk: false,
          lastDeliverySummary: "Slack 回复回传失败。",
          lastError: error instanceof Error ? error.message : String(error),
        });
      });
  });
}

async function handleSlackInboundMessage(channelId: string, botUserId: string, rawMessage: unknown): Promise<void> {
  const inbound = extractSlackInboundEvent(rawMessage);
  if (!inbound || inbound.user === botUserId) {
    return;
  }

  const registry = await ensureRegistry();
  const channel = registry.channels.find((entry) => entry.id === channelId && entry.type === "slack");
  if (!channel || !channel.enabled) {
    return;
  }

  const cleanedText = sanitizeSlackPrompt(inbound.text, botUserId);
  if (!cleanedText) {
    return;
  }

  const isDirectMessage = inbound.channelType === "im";
  const mentionRequired = channel.config.slackRequireMention;
  const hasMention = inbound.text.includes(`<@${botUserId}>`);
  if (!isDirectMessage && mentionRequired && !hasMention) {
    return;
  }

  const project = resolveProjectForInbound(registry, channel, inbound);
  const persona = resolvePersonaForProject(registry, project);
  const threadId = buildThreadId(channel.id, inbound);
  const sessionId =
    registry.managerThreads
      .find((thread) => thread.id === threadId)
      ?.messages.slice()
      .reverse()
      .find((message) => trim(message.sessionId))
      ?.sessionId ?? undefined;

  const prompt = buildSlackManagerPrompt({
    event: inbound,
    project,
    persona,
    cleanedText,
  });
  const displayText = `[Slack ${isDirectMessage ? "DM" : inbound.channel}] ${cleanedText}`;

  await updateChannelRuntime(channel.id, {
    status: "configured",
    lastInboundAt: nowIso(),
    lastInboundSummary: `收到 Slack ${isDirectMessage ? "DM" : "channel"} 消息：${cleanedText.slice(0, 96)}`,
    lastRoutedProjectId: project?.id,
    lastRoutedPersonaId: persona?.id,
    lastThreadId: threadId,
    lastError: "",
  });

  const dispatch = await dispatchManagerPrompt({
    prompt,
    displayText,
    threadId,
    projectId: project?.id,
    personaId: persona?.id,
    sessionId,
  });

  await sendSlackRunReply({
    channel,
    slackChannelId: inbound.channel,
    threadTs: isDirectMessage ? undefined : inbound.threadTs ?? inbound.ts,
    runId: dispatch.runId,
  });
}

async function stopSlackBridge(channelId: string): Promise<void> {
  const existing = activeBridges.get(channelId);
  if (!existing) {
    return;
  }
  activeBridges.delete(channelId);
  await existing.app.stop();
}

export async function connectSlackChannel(channelId: string): Promise<ChannelConnectionReport> {
  const registry = await ensureRegistry();
  const channel = registry.channels.find((entry) => entry.id === channelId);
  if (!channel || channel.type !== "slack") {
    throw new Error("slack channel not found");
  }

  const validation = validateChannel(channel);
  const slackMode = resolveSlackMode(channel);
  if (!channel.enabled) {
    await stopSlackBridge(channel.id);
    const report = buildConnectionReport({
      channel,
      action: "connect",
      connected: false,
      connectionState: "disconnected",
      summary: "渠道未启用，未启动 Slack 常驻连接。",
    });
    await updateChannelRuntime(channel.id, {
      status: "unconfigured",
      connectionState: report.connectionState,
      lastConnectionAt: report.checkedAt,
      lastConnectionOk: report.connected,
      lastConnectionSummary: report.summary,
      lastDisconnectedAt: report.checkedAt,
      lastError: "",
    });
    return report;
  }

  if (slackMode !== "socket") {
    await stopSlackBridge(channel.id);
    const report = buildConnectionReport({
      channel,
      action: "connect",
      connected: false,
      connectionState: "disconnected",
      summary: `Slack ${slackMode} 模式不需要常驻 socket 连接。`,
    });
    await updateChannelRuntime(channel.id, {
      status: validation.liveReady ? "configured" : "error",
      connectionState: report.connectionState,
      lastConnectionAt: report.checkedAt,
      lastConnectionOk: report.connected,
      lastConnectionSummary: report.summary,
      lastDisconnectedAt: report.checkedAt,
      lastError: validation.liveReady ? "" : validation.issues.join(" "),
    });
    return report;
  }

  if (!validation.liveReady) {
    await stopSlackBridge(channel.id);
    const report = buildConnectionReport({
      channel,
      action: "connect",
      connected: false,
      connectionState: "error",
      summary: "Slack socket 配置不完整，无法建立连接。",
      issues: validation.issues,
      warnings: validation.warnings,
    });
    await updateChannelRuntime(channel.id, {
      status: "error",
      connectionState: report.connectionState,
      lastConnectionAt: report.checkedAt,
      lastConnectionOk: false,
      lastConnectionSummary: report.summary,
      lastError: report.issues.join(" "),
    });
    return report;
  }

  if (REVIEW_MODE) {
    const report = buildConnectionReport({
      channel,
      action: "connect",
      connected: true,
      connectionState: "connected",
      summary: "review server 已模拟 Slack socket 连接，不会建立真实外部常驻连接。",
    });
    await updateChannelRuntime(channel.id, {
      status: "configured",
      connectionState: report.connectionState,
      lastConnectionAt: report.checkedAt,
      lastConnectionOk: true,
      lastConnectionSummary: report.summary,
      lastConnectedAt: report.checkedAt,
      lastValidatedAt: validation.checkedAt,
      lastValidationOk: validation.ok,
      lastValidationSummary: validation.summary,
      lastError: "",
    });
    return report;
  }

  await stopSlackBridge(channel.id);
  await updateChannelRuntime(channel.id, {
    status: "configured",
    connectionState: "connecting",
    lastConnectionAt: nowIso(),
    lastConnectionOk: false,
    lastConnectionSummary: "正在建立 Slack socket 连接...",
    lastError: "",
  });

  try {
    const app = new App({
      token: channel.config.slackBotToken,
      appToken: channel.config.slackAppToken,
      socketMode: true,
    }) as unknown as SlackApp;

    let botUserId = "";
    app.message(async (args: unknown) => {
      const payload = args as { message?: unknown };
      await handleSlackInboundMessage(channel.id, botUserId, payload.message);
    });
    app.error(async (error: unknown) => {
      await updateChannelRuntime(channel.id, {
        status: "error",
        connectionState: "error",
        lastConnectionAt: nowIso(),
        lastConnectionOk: false,
        lastConnectionSummary: "Slack socket 运行时出现错误。",
        lastError: error instanceof Error ? error.message : String(error),
      });
    });

    await app.start();
    const auth = await app.client.auth.test({ token: channel.config.slackBotToken });
    botUserId = trim(typeof auth.user_id === "string" ? auth.user_id : "");

    activeBridges.set(channel.id, {
      channelId: channel.id,
      app,
      botUserId,
    });

    const report = buildConnectionReport({
      channel,
      action: "connect",
      connected: true,
      connectionState: "connected",
      summary: `Slack socket 已连接${botUserId ? `，bot user=${botUserId}` : ""}。`,
    });
    await updateChannelRuntime(channel.id, {
      status: "configured",
      connectionState: report.connectionState,
      lastConnectionAt: report.checkedAt,
      lastConnectionOk: true,
      lastConnectionSummary: report.summary,
      lastConnectedAt: report.checkedAt,
      lastValidatedAt: validation.checkedAt,
      lastValidationOk: validation.ok,
      lastValidationSummary: validation.summary,
      lastError: "",
    });
    return report;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const report = buildConnectionReport({
      channel,
      action: "connect",
      connected: false,
      connectionState: "error",
      summary: `Slack socket 连接失败：${message}`,
      issues: [...validation.issues, message],
      warnings: validation.warnings,
    });
    await updateChannelRuntime(channel.id, {
      status: "error",
      connectionState: report.connectionState,
      lastConnectionAt: report.checkedAt,
      lastConnectionOk: false,
      lastConnectionSummary: report.summary,
      lastError: report.issues.join(" "),
    });
    return report;
  }
}

export async function disconnectSlackChannel(channelId: string, reason = "已断开 Slack 连接。"): Promise<ChannelConnectionReport> {
  const registry = await ensureRegistry();
  const channel = registry.channels.find((entry) => entry.id === channelId);
  if (!channel || channel.type !== "slack") {
    throw new Error("slack channel not found");
  }

  if (REVIEW_MODE) {
    const validation = validateChannel(channel);
    const report = buildConnectionReport({
      channel,
      action: "disconnect",
      connected: false,
      connectionState: "disconnected",
      summary: "review server 已模拟 Slack 断开，不会影响真实外部连接。",
    });
    await updateChannelRuntime(channel.id, {
      status: validation.liveReady ? "configured" : "error",
      connectionState: report.connectionState,
      lastConnectionAt: report.checkedAt,
      lastConnectionOk: true,
      lastConnectionSummary: report.summary,
      lastDisconnectedAt: report.checkedAt,
      lastError: "",
    });
    return report;
  }

  await stopSlackBridge(channelId);
  const validation = validateChannel(channel);
  const nextStatus = validation.liveReady
    ? "configured"
    : validation.issues.every((issue) => issue.startsWith("缺少"))
      ? "unconfigured"
      : "error";
  const report = buildConnectionReport({
    channel,
    action: "disconnect",
    connected: false,
    connectionState: "disconnected",
    summary: reason,
  });
  await updateChannelRuntime(channel.id, {
    status: nextStatus,
    connectionState: report.connectionState,
    lastConnectionAt: report.checkedAt,
    lastConnectionOk: true,
    lastConnectionSummary: report.summary,
    lastDisconnectedAt: report.checkedAt,
    lastError: "",
  });
  return report;
}

export async function syncSlackChannels(): Promise<void> {
  const registry = await ensureRegistry();
  const slackChannelIds = new Set(
    registry.channels.filter((channel) => channel.type === "slack").map((channel) => channel.id),
  );

  for (const activeId of activeBridges.keys()) {
    const current = registry.channels.find((channel) => channel.id === activeId);
    if (!current || current.type !== "slack" || !current.enabled || resolveSlackMode(current) !== "socket") {
      await disconnectSlackChannel(activeId, "Slack 配置已变更，已停止旧连接。");
    }
  }

  for (const channel of registry.channels) {
    if (channel.type !== "slack" || !slackChannelIds.has(channel.id)) {
      continue;
    }
    if (channel.enabled && resolveSlackMode(channel) === "socket") {
      await connectSlackChannel(channel.id);
      continue;
    }
    if (!channel.enabled || resolveSlackMode(channel) !== "socket") {
      await disconnectSlackChannel(channel.id, !channel.enabled ? "渠道已禁用。" : "当前模式未使用 Slack socket。");
    }
  }
}
