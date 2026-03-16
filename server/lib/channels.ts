import type {
  ChannelDefinition,
  ChannelDeliveryMode,
  ChannelDeliveryReport,
  ChannelStatus,
  ChannelValidationReport,
  SlackConnectionMode,
} from "../../shared/models.js";
import { nowIso } from "./json-store.js";

const DEFAULT_TELEGRAM_API_BASE = "https://api.telegram.org";
const DEFAULT_SLACK_WEBHOOK_PATH = "/slack/events";
const REVIEW_MODE = process.env.CCEO_REVIEW_MODE === "1";

type DeliveryResult = {
  httpStatus: number;
  ok: boolean;
  responsePreview: string;
};

function trim(value: string | undefined): string {
  return String(value ?? "").trim();
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function redactWebhookUrl(value: string): string {
  const url = parseUrl(value);
  if (!url) {
    return value;
  }
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length > 0) {
    segments[segments.length - 1] = "***";
    url.pathname = `/${segments.join("/")}`;
  }
  return url.toString();
}

function redactToken(token: string): string {
  const value = trim(token);
  if (!value) {
    return "";
  }
  if (value.length <= 8) {
    return "***";
  }
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

function truncate(value: string, limit = 280): string {
  const text = trim(value);
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit - 1)}…`;
}

export function resolveSlackMode(channel: ChannelDefinition): SlackConnectionMode {
  const mode = trim(channel.config.slackMode);
  if (mode === "webhook" || mode === "socket" || mode === "http") {
    return mode;
  }
  if (trim(channel.config.slackSigningSecret)) {
    return "http";
  }
  if (trim(channel.config.slackBotToken) || trim(channel.config.slackAppToken)) {
    return "socket";
  }
  if (trim(channel.config.slackWebhookUrl)) {
    return "webhook";
  }
  return "socket";
}

function deriveChannelStatus(report: ChannelValidationReport): ChannelStatus {
  if (report.liveReady) {
    return "configured";
  }
  if (report.issues.every((issue) => issue.startsWith("缺少"))) {
    return "unconfigured";
  }
  return "error";
}

function buildSlackWebhookPayload(channel: ChannelDefinition, message: string): Record<string, string> {
  const payload: Record<string, string> = {
    text: trim(message),
  };
  const username = trim(channel.identity);
  if (username) {
    payload.username = username;
  }
  const overrideChannel = trim(channel.config.slackChannel);
  if (overrideChannel) {
    payload.channel = overrideChannel;
  }
  return payload;
}

function buildSlackApiText(channel: ChannelDefinition, message: string): string {
  const identity = trim(channel.identity);
  return identity ? `【${identity}】\n${trim(message)}` : trim(message);
}

function buildSlackApiPayload(params: {
  channel: ChannelDefinition;
  message: string;
  target?: string;
  threadTs?: string;
}): Record<string, string> {
  const target = trim(params.target) || trim(params.channel.config.slackChannel);
  const payload: Record<string, string> = {
    channel: target,
    text: buildSlackApiText(params.channel, params.message),
  };
  if (trim(params.threadTs)) {
    payload.thread_ts = trim(params.threadTs);
  }
  return payload;
}

function buildTelegramPayload(channel: ChannelDefinition, message: string): Record<string, string> {
  const identity = trim(channel.identity);
  return {
    chat_id: trim(channel.config.telegramChatId),
    text: identity ? `【${identity}】\n${trim(message)}` : trim(message),
  };
}

function buildSlackRequestPreview(channel: ChannelDefinition, message: string): ChannelDeliveryReport["requestPreview"] {
  const slackMode = resolveSlackMode(channel);
  if (slackMode === "webhook") {
    return {
      method: "POST",
      url: redactWebhookUrl(channel.config.slackWebhookUrl),
      body: JSON.stringify(buildSlackWebhookPayload(channel, message), null, 2),
    };
  }

  return {
    method: "POST",
    url: "https://slack.com/api/chat.postMessage",
    body: JSON.stringify(
      {
        ...buildSlackApiPayload({ channel, message }),
        tokenHint: redactToken(channel.config.slackBotToken),
      },
      null,
      2,
    ),
  };
}

function buildRequestPreview(channel: ChannelDefinition, message: string): ChannelDeliveryReport["requestPreview"] {
  if (channel.type === "slack") {
    return buildSlackRequestPreview(channel, message);
  }

  const apiBase = trim(channel.config.telegramApiBaseUrl) || DEFAULT_TELEGRAM_API_BASE;
  return {
    method: "POST",
    url: `${apiBase.replace(/\/+$/, "")}/bot${redactToken(channel.config.telegramBotToken)}/sendMessage`,
    body: JSON.stringify(buildTelegramPayload(channel, message), null, 2),
  };
}

export function validateChannel(channel: ChannelDefinition): ChannelValidationReport {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!channel.enabled) {
    warnings.push("渠道当前为禁用状态，项目自动路由不会主动使用它。");
  }

  if (channel.type === "slack") {
    const slackMode = resolveSlackMode(channel);
    if (slackMode === "webhook") {
      const webhookUrl = trim(channel.config.slackWebhookUrl);
      if (!webhookUrl) {
        issues.push("缺少 Slack webhook URL。");
      } else {
        const parsed = parseUrl(webhookUrl);
        if (!parsed) {
          issues.push("Slack webhook URL 格式无效。");
        } else if (!["http:", "https:"].includes(parsed.protocol)) {
          issues.push("Slack webhook URL 必须是 http 或 https。");
        } else if (parsed.protocol !== "https:") {
          warnings.push("Slack webhook 建议使用 HTTPS。");
        }
      }

      if (!trim(channel.config.slackChannel)) {
        warnings.push("未填写 Slack channel；若 webhook 已固定目标频道可忽略。");
      }
    } else {
      if (!trim(channel.config.slackBotToken)) {
        issues.push("缺少 Slack bot token。");
      }
      if (slackMode === "socket" && !trim(channel.config.slackAppToken)) {
        issues.push("缺少 Slack app token。");
      }
      if (slackMode === "http" && !trim(channel.config.slackSigningSecret)) {
        issues.push("缺少 Slack signing secret。");
      }
      if (slackMode === "http") {
        const webhookPath = trim(channel.config.slackWebhookPath) || DEFAULT_SLACK_WEBHOOK_PATH;
        if (!webhookPath.startsWith("/")) {
          issues.push("Slack webhook path 必须以 / 开头。");
        }
      }
      if (!trim(channel.config.slackChannel)) {
        warnings.push("未填写默认 Slack target；真实发送测试需要目标 channel 或 DM。");
      }
      if (!trim(channel.config.slackDefaultProjectId)) {
        warnings.push("未指定 Slack 默认项目；DM 或未命中绑定的消息会回落到首个项目。");
      }
    }
  } else {
    const botToken = trim(channel.config.telegramBotToken);
    const chatId = trim(channel.config.telegramChatId);
    const apiBaseUrl = trim(channel.config.telegramApiBaseUrl) || DEFAULT_TELEGRAM_API_BASE;

    if (!botToken) {
      issues.push("缺少 Telegram bot token。");
    }
    if (!chatId) {
      issues.push("缺少 Telegram chat id。");
    }
    if (!parseUrl(apiBaseUrl)) {
      issues.push("Telegram API Base URL 格式无效。");
    }
  }

  const liveReady = issues.length === 0;
  const ok = liveReady;
  const summary = liveReady
    ? warnings.length
      ? "配置可用，但仍有提醒需要注意。"
      : "配置通过，已具备真实投递条件。"
    : `配置未通过，存在 ${issues.length} 个问题。`;

  return {
    channelId: channel.id,
    channelType: channel.type,
    checkedAt: nowIso(),
    ok,
    liveReady,
    issues,
    warnings,
    summary,
  };
}

export function deriveChannelRuntimePatch(report: ChannelValidationReport): {
  status: ChannelStatus;
  lastValidatedAt: string;
  lastValidationOk: boolean;
  lastValidationSummary: string;
  lastError?: string;
} {
  return {
    status: deriveChannelStatus(report),
    lastValidatedAt: report.checkedAt,
    lastValidationOk: report.ok,
    lastValidationSummary: report.summary,
    lastError: report.ok ? "" : report.issues.join(" "),
  };
}

async function sendSlackWebhookMessage(channel: ChannelDefinition, message: string): Promise<DeliveryResult> {
  const response = await fetch(channel.config.slackWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildSlackWebhookPayload(channel, message)),
  });
  const responseText = await response.text();
  return {
    httpStatus: response.status,
    ok: response.ok,
    responsePreview: truncate(responseText || response.statusText),
  };
}

async function sendSlackApiMessage(params: {
  channel: ChannelDefinition;
  message: string;
  target?: string;
  threadTs?: string;
}): Promise<DeliveryResult> {
  const payload = buildSlackApiPayload(params);
  if (!trim(payload.channel)) {
    throw new Error("Slack target 不能为空。请填写默认 Slack channel，或在路由里提供目标房间。");
  }

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.channel.config.slackBotToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  });
  const raw = await response.text();

  let apiOk = response.ok;
  let preview = raw || response.statusText;
  try {
    const parsed = JSON.parse(raw) as { ok?: boolean; error?: string; channel?: string; ts?: string };
    apiOk = response.ok && parsed.ok === true;
    if (parsed.ok) {
      preview = `ok channel=${parsed.channel ?? payload.channel}${parsed.ts ? ` ts=${parsed.ts}` : ""}`;
    } else if (parsed.error) {
      preview = parsed.error;
    }
  } catch {
    apiOk = response.ok;
  }

  return {
    httpStatus: response.status,
    ok: apiOk,
    responsePreview: truncate(preview),
  };
}

export async function deliverSlackLiveMessage(params: {
  channel: ChannelDefinition;
  message: string;
  target?: string;
  threadTs?: string;
}): Promise<DeliveryResult> {
  const slackMode = resolveSlackMode(params.channel);
  if (slackMode === "webhook") {
    return sendSlackWebhookMessage(params.channel, params.message);
  }
  return sendSlackApiMessage(params);
}

async function sendTelegramMessage(channel: ChannelDefinition, message: string): Promise<DeliveryResult> {
  const apiBase = (trim(channel.config.telegramApiBaseUrl) || DEFAULT_TELEGRAM_API_BASE).replace(/\/+$/, "");
  const response = await fetch(`${apiBase}/bot${channel.config.telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildTelegramPayload(channel, message)),
  });
  const raw = await response.text();

  let description = raw;
  let apiOk = response.ok;
  try {
    const payload = JSON.parse(raw) as { ok?: boolean; description?: string };
    apiOk = response.ok && payload.ok === true;
    description = payload.description || raw;
  } catch {
    apiOk = response.ok;
  }

  return {
    httpStatus: response.status,
    ok: apiOk,
    responsePreview: truncate(description || response.statusText),
  };
}

export async function deliverChannelTest(params: {
  channel: ChannelDefinition;
  message: string;
  mode: ChannelDeliveryMode;
}): Promise<ChannelDeliveryReport> {
  const { channel, mode } = params;
  const message = trim(params.message);
  const validation = validateChannel(channel);
  const requestPreview = buildRequestPreview(channel, message);

  if (mode === "dry-run") {
    return {
      ...validation,
      ok: true,
      mode,
      delivered: false,
      requestPreview,
      summary: validation.liveReady ? "dry-run 已生成请求预览，可以执行真实发送。" : "dry-run 已生成请求预览，但真实发送配置仍不完整。",
    };
  }

  if (!validation.liveReady) {
    return {
      ...validation,
      ok: false,
      mode,
      delivered: false,
      requestPreview,
      summary: "真实发送前仍有配置问题，已阻止发送。",
    };
  }

  if (REVIEW_MODE && mode === "live") {
    return {
      ...validation,
      checkedAt: nowIso(),
      ok: true,
      mode,
      delivered: true,
      requestPreview,
      httpStatus: 200,
      responsePreview: "review-mode: live delivery skipped",
      summary: "review server 已拦截真实发送，只验证了请求预览与前端交互，不会触发外部消息。",
    };
  }

  try {
    const result =
      channel.type === "slack" ? await deliverSlackLiveMessage({ channel, message }) : await sendTelegramMessage(channel, message);

    return {
      ...validation,
      checkedAt: nowIso(),
      ok: result.ok,
      mode,
      delivered: result.ok,
      requestPreview,
      httpStatus: result.httpStatus,
      responsePreview: result.responsePreview,
      summary: result.ok ? "测试消息已发送。" : "测试消息发送失败。",
      issues: result.ok ? validation.issues : [...validation.issues, `投递失败，HTTP ${result.httpStatus}。`],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      ...validation,
      checkedAt: nowIso(),
      ok: false,
      mode,
      delivered: false,
      requestPreview,
      responsePreview: truncate(errorMessage),
      summary: `测试消息发送失败：${truncate(errorMessage)}`,
      issues: [...validation.issues, `发送异常：${truncate(errorMessage)}`],
    };
  }
}

export function deriveChannelDeliveryRuntimePatch(report: ChannelDeliveryReport): {
  status: ChannelStatus;
  lastValidatedAt: string;
  lastValidationOk: boolean;
  lastValidationSummary: string;
  lastDeliveryAt: string;
  lastDeliveryMode: ChannelDeliveryMode;
  lastDeliveryOk: boolean;
  lastDeliverySummary: string;
  lastError?: string;
} {
  return {
    status: report.ok ? deriveChannelStatus(report) : "error",
    lastValidatedAt: report.checkedAt,
    lastValidationOk: report.liveReady,
    lastValidationSummary: report.liveReady ? "发送前配置校验通过。" : report.summary,
    lastDeliveryAt: report.checkedAt,
    lastDeliveryMode: report.mode,
    lastDeliveryOk: report.delivered,
    lastDeliverySummary: report.summary,
    lastError: report.ok ? "" : report.issues.join(" "),
  };
}
