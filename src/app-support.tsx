import type {
  BootstrapPayload,
  ChannelConnectionReport,
  ChannelDeliveryReport,
  ChannelDefinition,
  ChannelValidationReport,
  SlackConnectionMode,
  KnowledgeBaseDefinition,
  PersonaDefinition,
  ProjectDefinition,
} from "../shared/models";

export type TabKey = "dashboard" | "manager" | "personas" | "sessions" | "knowledge" | "projects" | "cron" | "channels";
export type ChannelActionReport = ChannelValidationReport | ChannelDeliveryReport | ChannelConnectionReport;
export type CronActionName = "stop" | "start" | "validate" | "paths" | "destroy";
export type CronActionResult = {
  job: string;
  action: CronActionName;
  ok: boolean;
  output: string;
};

export const tabNavigation: Array<{ key: TabKey; label: string; description: string; ariaLabel: string }> = [
  { key: "dashboard", label: "总览", description: "看全局健康与下一步", ariaLabel: "切换到总览页，查看系统健康和下一步建议" },
  { key: "manager", label: "总经理", description: "发治理指令并追踪运行", ariaLabel: "切换到总经理页，发起治理指令并查看运行时间线" },
  { key: "personas", label: "角色", description: "管理人格、模型与工具", ariaLabel: "切换到角色页，配置人格、模型和工具边界" },
  { key: "sessions", label: "会话", description: "复用历史记忆与归属", ariaLabel: "切换到会话页，复用历史会话并维护归属" },
  { key: "knowledge", label: "知识库", description: "绑定 Qdrant 与读写权限", ariaLabel: "切换到知识库页，管理 Qdrant 连接和读写权限" },
  { key: "projects", label: "项目", description: "定义经理、成员与渠道", ariaLabel: "切换到项目页，配置经理角色、成员和渠道绑定" },
  { key: "cron", label: "Cron", description: "管理持续迭代任务", ariaLabel: "切换到 Cron 页，管理持续迭代任务和调度状态" },
  { key: "channels", label: "渠道", description: "接入 Slack 与 Telegram", ariaLabel: "切换到渠道页，接入 Slack 和 Telegram" },
];

const tabKeys = new Set<TabKey>(tabNavigation.map((item) => item.key));

type GuideTone = "accent" | "warn" | "neutral";

type GuideCard = {
  eyebrow: string;
  title: string;
  detail: string;
  items: string[];
  footnote?: string;
  tone?: GuideTone;
};

const slackSocketManifestDefinition = {
  display_information: {
    name: "Codex Executive Officer",
    description: "Slack bridge for Codex Executive Officer",
  },
  features: {
    bot_user: {
      display_name: "CCEO",
      always_online: false,
    },
    app_home: {
      messages_tab_enabled: true,
      messages_tab_read_only_enabled: false,
    },
  },
  oauth_config: {
    scopes: {
      bot: ["app_mentions:read", "channels:history", "groups:history", "im:history", "mpim:history", "chat:write"],
    },
  },
  settings: {
    socket_mode_enabled: true,
    event_subscriptions: {
      bot_events: ["app_mention", "message.channels", "message.groups", "message.im", "message.mpim"],
    },
  },
};

export const slackSocketManifest = JSON.stringify(slackSocketManifestDefinition, null, 2);

export function blankPersona(): PersonaDefinition {
  const now = new Date().toISOString();
  return {
    id: "",
    name: "新角色",
    description: "",
    scope: "global",
    personality: "pragmatic",
    model: "gpt-5.4",
    reasoningEffort: "xhigh",
    verbosity: "high",
    webSearch: "live",
    profile: "",
    useProjectDocs: true,
    replaceBuiltInInstructions: false,
    systemPrompt: "",
    developerInstructions: "",
    skills: [],
    mcpServers: [],
    tools: [],
    channelIdentity: {
      displayName: "角色名",
      replyRules: "直接、可执行。",
      deliveryStyle: "统一管理口径",
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function blankProject(): ProjectDefinition {
  const now = new Date().toISOString();
  return {
    id: "",
    name: "新项目",
    description: "",
    path: "",
    managerPersonaId: "",
    participantPersonaIds: [],
    projectMcpServers: [],
    projectSkills: [],
    projectTools: [],
    knowledgeBaseIds: [],
    writableKnowledgeBaseIds: [],
    channelBindings: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function blankKnowledgeBase(): KnowledgeBaseDefinition {
  const now = new Date().toISOString();
  return {
    id: "",
    name: "新知识库",
    description: "",
    scope: "global",
    url: "http://127.0.0.1:6333",
    collectionName: "",
    readOnly: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function blankChannel(): ChannelDefinition {
  const now = new Date().toISOString();
  return {
    id: "",
    type: "slack",
    name: "新渠道",
    enabled: false,
    status: "unconfigured",
    identity: "总经理",
    notes: "",
    config: {
      slackMode: "socket",
      slackWebhookUrl: "",
      slackChannel: "",
      slackBotToken: "",
      slackAppToken: "",
      slackSigningSecret: "",
      slackWebhookPath: "/slack/events",
      slackRequireMention: true,
      slackDefaultProjectId: "",
      telegramBotToken: "",
      telegramChatId: "",
      telegramApiBaseUrl: "https://api.telegram.org",
    },
    runtime: {},
    createdAt: now,
    updatedAt: now,
  };
}

function stableList(values: string[]) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function personaDraftSnapshot(persona: PersonaDefinition) {
  return {
    name: persona.name.trim(),
    description: persona.description.trim(),
    scope: persona.scope,
    personality: persona.personality,
    model: persona.model.trim(),
    reasoningEffort: persona.reasoningEffort,
    verbosity: persona.verbosity,
    webSearch: persona.webSearch,
    profile: persona.profile.trim(),
    useProjectDocs: persona.useProjectDocs,
    replaceBuiltInInstructions: persona.replaceBuiltInInstructions,
    systemPrompt: persona.systemPrompt.trim(),
    developerInstructions: persona.developerInstructions.trim(),
    skills: stableList(persona.skills),
    mcpServers: stableList(persona.mcpServers),
    tools: stableList(persona.tools),
    channelIdentity: {
      displayName: persona.channelIdentity.displayName.trim(),
      replyRules: persona.channelIdentity.replyRules.trim(),
      deliveryStyle: persona.channelIdentity.deliveryStyle.trim(),
    },
  };
}

function projectDraftSnapshot(project: ProjectDefinition) {
  return {
    name: project.name.trim(),
    description: project.description.trim(),
    path: project.path.trim(),
    managerPersonaId: project.managerPersonaId,
    participantPersonaIds: stableList(project.participantPersonaIds),
    projectMcpServers: stableList(project.projectMcpServers),
    projectSkills: stableList(project.projectSkills),
    projectTools: stableList(project.projectTools),
    knowledgeBaseIds: stableList(project.knowledgeBaseIds),
    writableKnowledgeBaseIds: stableList(project.writableKnowledgeBaseIds),
    channelBindings: [...project.channelBindings]
      .map((binding) => ({
        channelId: binding.channelId,
        room: binding.room.trim(),
        alias: binding.alias.trim(),
      }))
      .sort((left, right) => left.channelId.localeCompare(right.channelId)),
  };
}

function knowledgeDraftSnapshot(knowledgeBase: KnowledgeBaseDefinition) {
  return {
    name: knowledgeBase.name.trim(),
    description: knowledgeBase.description.trim(),
    scope: knowledgeBase.scope,
    url: knowledgeBase.url.trim(),
    collectionName: knowledgeBase.collectionName.trim(),
    readOnly: knowledgeBase.readOnly,
  };
}

function channelDraftSnapshot(channel: ChannelDefinition) {
  return {
    type: channel.type,
    name: channel.name.trim(),
    enabled: channel.enabled,
    status: channel.status,
    identity: channel.identity.trim(),
    notes: channel.notes.trim(),
    config: {
      slackMode: channel.config.slackMode,
      slackWebhookUrl: channel.config.slackWebhookUrl.trim(),
      slackChannel: channel.config.slackChannel.trim(),
      slackBotToken: channel.config.slackBotToken.trim(),
      slackAppToken: channel.config.slackAppToken.trim(),
      slackSigningSecret: channel.config.slackSigningSecret.trim(),
      slackWebhookPath: channel.config.slackWebhookPath.trim(),
      slackRequireMention: channel.config.slackRequireMention,
      slackDefaultProjectId: channel.config.slackDefaultProjectId,
      telegramBotToken: channel.config.telegramBotToken.trim(),
      telegramChatId: channel.config.telegramChatId.trim(),
      telegramApiBaseUrl: channel.config.telegramApiBaseUrl.trim(),
    },
  };
}

export function hasPersonaDraftChanges(draft: PersonaDefinition, current: PersonaDefinition | null) {
  const baseline = draft.id ? current : blankPersona();
  return JSON.stringify(personaDraftSnapshot(draft)) !== JSON.stringify(personaDraftSnapshot(baseline ?? blankPersona()));
}

export function hasProjectDraftChanges(draft: ProjectDefinition, current: ProjectDefinition | null) {
  const baseline = draft.id ? current : blankProject();
  return JSON.stringify(projectDraftSnapshot(draft)) !== JSON.stringify(projectDraftSnapshot(baseline ?? blankProject()));
}

export function hasKnowledgeDraftChanges(draft: KnowledgeBaseDefinition, current: KnowledgeBaseDefinition | null) {
  const baseline = draft.id ? current : blankKnowledgeBase();
  return JSON.stringify(knowledgeDraftSnapshot(draft)) !== JSON.stringify(knowledgeDraftSnapshot(baseline ?? blankKnowledgeBase()));
}

export function hasChannelDraftChanges(draft: ChannelDefinition, current: ChannelDefinition | null) {
  const baseline = draft.id ? current : blankChannel();
  return JSON.stringify(channelDraftSnapshot(draft)) !== JSON.stringify(channelDraftSnapshot(baseline ?? blankChannel()));
}

export function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function toggleChannelBinding(bindings: ProjectDefinition["channelBindings"], channelId: string): ProjectDefinition["channelBindings"] {
  return bindings.some((binding) => binding.channelId === channelId)
    ? bindings.filter((binding) => binding.channelId !== channelId)
    : [...bindings, { channelId, room: "", alias: "" }];
}

export function updateChannelBinding(
  bindings: ProjectDefinition["channelBindings"],
  channelId: string,
  patch: Partial<ProjectDefinition["channelBindings"][number]>,
): ProjectDefinition["channelBindings"] {
  return bindings.map((binding) => (binding.channelId === channelId ? { ...binding, ...patch } : binding));
}

export function parseTabHash(hashLike: string | null | undefined): TabKey {
  const cleaned = String(hashLike || "")
    .replace(/^#/, "")
    .trim() as TabKey;
  return tabKeys.has(cleaned) ? cleaned : "dashboard";
}

export function formatDateTime(value: string | null | undefined, fallback = "未执行") {
  if (!value) {
    return fallback;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function SectionHeader(props: { eyebrow: string; title: string; detail: string }) {
  return (
    <header className="section-header">
      <span>{props.eyebrow}</span>
      <h2>{props.title}</h2>
      <p>{props.detail}</p>
    </header>
  );
}

export function Pill(props: { children: string; tone?: "good" | "warn" | "neutral" }) {
  return <span className={`pill ${props.tone ?? "neutral"}`}>{props.children}</span>;
}

export function GuidePanel(props: GuideCard) {
  return (
    <article className={`guide-panel ${props.tone ?? "accent"}`}>
      <span>{props.eyebrow}</span>
      <h3>{props.title}</h3>
      <p>{props.detail}</p>
      <ul className="guide-list">
        {props.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {props.footnote ? <small>{props.footnote}</small> : null}
    </article>
  );
}

function reportStatePills(report: ChannelActionReport) {
  if ("action" in report) {
    return [
      report.connectionState,
      report.connected ? "connected" : "not-connected",
      report.liveReady ? "config-ready" : "config-incomplete",
    ];
  }

  if ("mode" in report) {
    return [
      report.mode,
      report.liveReady ? "live-ready" : "not-live-ready",
      report.delivered ? "delivered" : "not-delivered",
    ];
  }

  return [report.liveReady ? "live-ready" : "not-live-ready", report.ok ? "valid" : "invalid"];
}

export function ChannelActionDetails(props: { report: ChannelActionReport }) {
  const { report } = props;
  const issues = report.issues.filter(Boolean);
  const warnings = report.warnings.filter(Boolean);

  return (
    <article className="report-card">
      <div className="report-header">
        <div>
          <strong>
            {"action" in report
              ? `${report.action === "connect" ? "连接" : "断开"}结果`
              : "mode" in report
                ? `${report.mode === "live" ? "真实发送" : "Dry Run"} 结果`
                : "校验结果"}
          </strong>
          <span>{report.summary}</span>
        </div>
        <div className="inline-pills">
          {reportStatePills(report).map((item) => (
            <Pill key={item}>{item}</Pill>
          ))}
        </div>
      </div>

      {issues.length ? (
        <div className="report-block">
          <strong>需要处理</strong>
          <ul className="guide-list compact">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length ? (
        <div className="report-block">
          <strong>提醒</strong>
          <ul className="guide-list compact">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {"requestPreview" in report ? (
        <div className="report-grid">
          <div className="report-block">
            <strong>请求预览</strong>
            <small>
              {report.requestPreview.method} {report.requestPreview.url}
            </small>
            <pre className="output-box compact">{report.requestPreview.body}</pre>
          </div>
          <div className="report-block">
            <strong>投递反馈</strong>
            <small>HTTP {report.httpStatus ?? "未发出"}</small>
            <pre className="output-box compact">{report.responsePreview || "当前结果没有额外响应正文。"}</pre>
          </div>
        </div>
      ) : null}
    </article>
  );
}

const cronFieldLabels: Record<string, string> = {
  active: "crontab 激活",
  cron_dir: "cron 目录",
  cron_dir_exists: "cron 目录存在",
  job: "loop 标签",
  latest_file: "latest 文件",
  latest_log: "latest 日志",
  lock_file: "锁文件",
  installed_entry_state: "安装状态",
  issues_events_exists: "issues events 存在",
  issues_lock_exists: "issues 锁存在",
  issues_registry_exists: "issues registry 存在",
  issues_rules_exists: "issues rules 存在",
  issues_summary_exists: "issues summary 存在",
  paused: "暂停标记",
  project_root: "项目根目录",
  project_root_exists: "项目根目录存在",
  prompt_file: "prompt 文件",
  prompt_exists: "prompt 文件存在",
  registry_entry_exists: "registry 项存在",
  registry_file_exists: "registry 文件存在",
  runner_file: "runner 文件",
  runner_exists: "runner 文件存在",
  runner_executable: "runner 可执行",
  schedule: "调度计划",
  singleton_entry: "唯一条目",
  skip_when_running: "运行中跳过重入",
  state_exists: "状态文件存在",
  state_file: "状态文件",
  validation: "结构校验",
  within_soft_limit: "体积在预算内",
};

const cronActionFallbackSummary: Record<CronActionName, string> = {
  stop: "停止请求已发送。现在最重要的是确认 loop 是否真的进入 paused 状态。",
  start: "启动请求已发送。现在最重要的是确认 loop 是否重新纳入调度。",
  validate: "结构校验已执行。先看 flat .cron-loop 文件是否完整，再看 active / paused 状态。",
  paths: "路径检查已执行。可用这些路径核对 prompt、runner、state 和 latest 是否一致。",
  destroy: "销毁请求已发送。请确认 crontab 条目、状态文件和 .cron-loop 目录是否都按预期清理。",
};

function looksLikeCronScheduleLine(line: string) {
  return /^([*/0-9,-]+)\s+([*/0-9,-]+)\s+([*/0-9,-]+)\s+([*/0-9A-Za-z,-]+)\s+([*/0-9A-Za-z,-]+)\s+/.test(line);
}

function parseCronActionOutput(result: CronActionResult) {
  const lines = result.output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const fields: Array<{ key: string; value: string }> = [];
  const narrative: string[] = [];

  for (const line of lines) {
    const matched = line.match(/^([a-zA-Z0-9_.-]+)=(.*)$/);
    if (matched) {
      fields.push({ key: matched[1], value: matched[2] });
    } else {
      narrative.push(line);
    }
  }

  const fieldMap = new Map(fields.map((field) => [field.key, field.value]));
  const hints: string[] = [];

  if (result.action === "validate") {
    if (fieldMap.get("validation") === "ok") {
      hints.push("flat `.cron-loop/` 结构完整，说明当前管理器已能识别 prompt、runner、state 和日志文件。");
    }
    if (fieldMap.get("active") === "1") {
      hints.push("singleton loop 已装入当前用户 crontab，会按既定 schedule 自动触发。");
    }
    if (fieldMap.get("state_exists") === "False" || fieldMap.get("state_exists") === "false") {
      hints.push("状态文件不存在，通常说明 singleton loop 尚未完成安装，或关键文件被移动。");
    }
  }

  if (result.action === "paths") {
    hints.push("这些路径是排查 runner、prompt、state、latest 和 lock 是否对齐的第一现场。");
  }
  if (result.action === "stop") {
    hints.push("停止后 loop 不会继续自动触发，适合在大改动前先止住循环任务。");
  }
  if (result.action === "start") {
    hints.push("启动后 loop 会重新按 schedule 运行，适合在手工改动和验证完成后恢复迭代。");
  }
  if (fieldMap.get("paused") === "1") {
    hints.push("当前状态仍显示为 paused；若希望它继续推进，需要再执行一次 start。");
  }
  if (fieldMap.get("schedule")) {
    hints.push(`当前调度计划：${fieldMap.get("schedule")}`);
  }

  const preferredNarrative = narrative.find((line) => !looksLikeCronScheduleLine(line));

  return {
    summary:
      preferredNarrative ||
      (result.ok
        ? cronActionFallbackSummary[result.action]
        : "动作执行失败。先看下方原始输出，再检查 `.cron-loop/` 文件与 crontab 是否一致。"),
    fields,
    hints,
  };
}

export function CronActionDetails(props: { result: CronActionResult | null }) {
  const { result } = props;

  if (!result) {
    return (
      <article className="guide-panel neutral">
        <span>Action Interpretation</span>
        <h3>还没有执行 cron 动作</h3>
        <p>先从左侧 singleton loop 卡片执行 `validate` 或 `paths`。这块区域会给出人类可读解释，并保留原始输出作为证据。</p>
        <ul className="guide-list compact">
          <li>`validate` 适合先看结构是否完整、是否已装入 crontab。</li>
          <li>`stop / start` 适合在大改动前后控制循环任务。</li>
          <li>`paths` 适合快速定位 prompt、runner、state 和 latest 文件。</li>
        </ul>
      </article>
    );
  }

  const parsed = parseCronActionOutput(result);

  return (
    <article className={`guide-panel ${result.ok ? "neutral" : "warn"}`}>
      <span>Action Interpretation</span>
      <h3>
        {result.job} · {result.action}
      </h3>
      <p>{parsed.summary}</p>
      <div className="inline-pills">
        <Pill tone={result.ok ? "good" : "warn"}>{result.ok ? "ok" : "needs-attention"}</Pill>
        <Pill>{result.action}</Pill>
      </div>
      {parsed.hints.length ? (
        <ul className="guide-list compact">
          {parsed.hints.map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
      ) : null}
      {parsed.fields.length ? (
        <dl className="key-value-grid">
          {parsed.fields.map((field) => (
            <div key={`${field.key}:${field.value}`} className="key-value-row">
              <dt>{cronFieldLabels[field.key] || field.key}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <details className="expand-box">
        <summary>查看原始输出</summary>
        <pre className="output-box compact">{result.output || "当前动作没有额外输出。"}</pre>
      </details>
    </article>
  );
}

const slackModeGuides: Record<SlackConnectionMode, GuideCard> = {
  socket: {
    eyebrow: "Setup Guide",
    title: "Socket Mode 适合让总经理常驻接入 Slack",
    detail: "推荐模式。不需要公网 webhook，保存并校验通过后，直接点 `Connect Slack` 建立常驻连接即可。",
    items: [
      "先在 Slack API 创建 App，并打开 Socket Mode。",
      "准备 `Slack Bot Token` 和 `Slack App Token`；两者都需要。",
      "把 bot 邀请进目标频道，再去“项目”页补齐对应 `channelBindings.room`。",
    ],
    footnote: "如果你只是单向发送测试消息，可以临时改成 webhook；但要做消息回流和总经理常驻处理，优先用 socket。",
  },
  webhook: {
    eyebrow: "Setup Guide",
    title: "Webhook 模式适合最小投递验证",
    detail: "只需要 `Slack Webhook URL` 就能验证最小发消息链路，但它不负责 Slack 消息回流。",
    items: [
      "在 Slack App 里启用 Incoming Webhooks，并复制目标频道的 webhook URL。",
      "保存后先执行“校验配置”，再做 Dry Run 或真实发送测试。",
      "如果后续要做总经理回流和频道监听，再切回 socket 或 http 模式。",
    ],
  },
  http: {
    eyebrow: "Setup Guide",
    title: "HTTP 模式适合你明确要走 Events API 回调时",
    detail: "这个模式会要求 bot token、signing secret 和 webhook path，适用于已有公网反向代理或事件回调入口的部署形态。",
    items: [
      "准备 `Slack Bot Token` 与 `Slack Signing Secret`，并确认外部可访问的回调路径。",
      "在 Slack API 的 Event Subscriptions 中把 Request URL 指向 `Slack Webhook Path` 对应的入口。",
      "保存并校验通过后，重点看最近回流状态，而不是只看测试投递是否成功。",
    ],
    footnote: "如果你并不需要公网事件回调，优先回到 socket mode，部署和排错成本会低很多。",
  },
};

export function ChannelSetupGuide(props: { channel: ChannelDefinition }) {
  const { channel } = props;

  if (channel.type === "slack") {
    const currentModeGuide = slackModeGuides[channel.config.slackMode];
    const checklist =
      channel.config.slackMode === "socket"
        ? [
            "`Slack Bot Token` 以 `xoxb-` 开头，负责发消息和读取频道历史。",
            "`Slack App Token` 以 `xapp-` 开头，只在 socket mode 下需要。",
            "保存后先点“校验配置”，通过后再点 `Connect Slack`，然后看连接态是否变成 `connected`。",
          ]
        : channel.config.slackMode === "webhook"
          ? [
              "只需要 `Slack Webhook URL`，不需要 `Connect Slack` 常驻连接。",
              "先做 Dry Run 再做真实发送测试，确认目标频道与身份显示符合预期。",
              "如果你发现需要消息回流或项目路由，再改用 socket / http。",
            ]
          : [
              "需要 `Slack Bot Token`、`Slack Signing Secret` 和可访问的 `Slack Webhook Path`。",
              "Slack 侧必须把 Event Subscriptions 指到正确地址，否则回流永远不会命中。",
              "验证时重点看“最近一次运行态”的回流时间、路由项目和线程是否刷新。",
            ];

    return (
      <div className="list-stack">
        <GuidePanel {...currentModeGuide} />
        <article className="list-card">
          <strong>保存前检查表</strong>
          <span>根据当前模式确认字段是否齐全，再执行保存和校验。</span>
          <ul className="guide-list compact">
            {checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="list-card">
          <strong>Socket Manifest 摘要</strong>
          <span>这份 manifest 主要解决三件事：bot scopes、事件订阅、Socket Mode 开关。</span>
          <ul className="guide-list compact">
            <li>Bot Scopes：{slackSocketManifestDefinition.oauth_config.scopes.bot.join(" / ")}</li>
            <li>Bot Events：{slackSocketManifestDefinition.settings.event_subscriptions.bot_events.join(" / ")}</li>
            <li>Bot Display Name：{slackSocketManifestDefinition.features.bot_user.display_name}</li>
          </ul>
          <details className="expand-box" data-testid="channel-guide-details">
            <summary data-testid="channel-guide-summary">查看完整 Socket Manifest JSON</summary>
            <pre className="output-box compact">{slackSocketManifest}</pre>
          </details>
        </article>
      </div>
    );
  }

  return (
    <div className="list-stack">
      <GuidePanel
        eyebrow="Setup Guide"
        title="Telegram 接入适合先走最短链路验证"
        detail="Telegram 侧不需要 Socket Mode。核心是准备好 bot token、目标 chat id，并先完成 dry-run / live 两步验证。"
        items={[
          "在 BotFather 创建 bot，拿到 `Telegram Bot Token`。",
          "把 bot 拉进目标私聊、群组或频道，并确认它有发言权限。",
          "填写 `Telegram Chat ID` 后先做 Dry Run，再做真实发送测试。",
        ]}
        footnote="群组或频道的 chat id 通常形如 `-100...`；如果只做私聊，常见是纯数字 ID。"
      />
      <article className="list-card">
        <strong>保存前检查表</strong>
        <span>Telegram 模式更简单，但最容易填错的是 chat id 与 bot 权限。</span>
        <ul className="guide-list compact">
          <li>`Telegram Bot Token` 应来自 BotFather，而不是手写占位值。</li>
          <li>`Telegram Chat ID` 要和 bot 实际所在目标一致；群组、频道和私聊的值不一样。</li>
          <li>默认 `Telegram API Base` 保持 `https://api.telegram.org` 即可，只有代理或自建网关时才需要改。</li>
        </ul>
      </article>
      <article className="list-card">
        <strong>完成后的判定方法</strong>
        <span>不要只看“保存成功”。真正接入完成，至少要满足下面两条。</span>
        <ul className="guide-list compact">
          <li>“最近一次运行态”里出现新的校验和投递时间，而不是一直停留在“未执行”。</li>
          <li>真实发送测试后，目标聊天里能看到消息，前端的投递摘要也同步更新。</li>
        </ul>
        <details className="expand-box" data-testid="channel-guide-details">
          <summary data-testid="channel-guide-summary">查看 Telegram 接入补充说明</summary>
          <pre className="output-box compact">{`Telegram 补充说明

- 群组 / 频道常见 chat id 以 -100 开头。
- 如果 bot 已加入目标对话但仍无法发送，先检查管理员权限。
- 真正完成不是“保存成功”，而是 live 测试和最近运行态都刷新。`}</pre>
        </details>
      </article>
    </div>
  );
}

export const tabGuides: Record<TabKey, GuideCard> = {
  dashboard: {
    eyebrow: "Operator Guide",
    title: "先看全局，再进入具体工作面",
    detail: "总览页不是装饰页，它应该帮助你在十秒内判断系统是否可治理、下一步应该去哪一页。",
    items: [
      "先看 Codex、Qdrant、MCP 和 Cron 总量，确认系统基础面是否健康。",
      "如果你要推进项目，下一跳通常是“总经理”或“项目”页，而不是直接改底层数据。",
      "当 Slack 或 cron-loop 有动作时，这里应该成为你判断系统状态的第一入口。",
    ],
  },
  manager: {
    eyebrow: "Operator Guide",
    title: "把总经理当成治理入口，而不是普通聊天框",
    detail: "这里最适合发“带上下文的治理命令”，例如要求总经理扫描项目、安排角色、恢复会话或处理 cron 任务。",
    items: [
      "先选角色、项目和是否恢复旧会话，再发指令。",
      "尽量让 prompt 明确目标、范围和验收条件，这样运行轨迹更可读。",
      "右侧运行时间线是判定“真做了事还是只说了话”的证据区。",
    ],
  },
  personas: {
    eyebrow: "Operator Guide",
    title: "角色页决定总经理的口径和工具边界",
    detail: "人格、模型、系统提示词和渠道身份都在这里定义。一个角色应该能跨项目、跨会话复用，而不是和单个历史绑死。",
    items: [
      "优先把角色描述写成职责边界，而不是口号。",
      "只有在确有必要时再替换内建指令，避免把模型推向不可维护状态。",
      "技能、MCP 和工具集要围绕工作职责组合，不要一股脑全开。",
    ],
  },
  sessions: {
    eyebrow: "Operator Guide",
    title: "会话页负责把历史资产重新挂回治理流程",
    detail: "这里的重点不是看 transcript 本身，而是把可复用的 session 重新链接到角色和项目，让 resume 真正可用。",
    items: [
      "优先把高价值 session 绑定到项目和角色，而不是让它们漂在列表里。",
      "当会话很多时，先按 cwd 和最近更新时间判断是否值得保留。",
      "总经理页里的 resume 选择器会直接复用这里维护的上下文关系。",
    ],
  },
  knowledge: {
    eyebrow: "Operator Guide",
    title: "知识库页要解决“可连接、可归属、可写入”三件事",
    detail: "知识库不是 URL 清单。它要明确 collection、读写权限和项目归属，才能真正成为治理资产。",
    items: [
      "先确认 Qdrant 是否在线，再讨论 collection 和写权限。",
      "能读但不能写的知识库，应显式标成只读。",
      "项目页中的可读/可写绑定，决定了后续自动化能否安全落库。",
    ],
  },
  projects: {
    eyebrow: "Operator Guide",
    title: "项目页是总经理的治理边界",
    detail: "角色、知识库、渠道和 cron 都应围绕项目组织。项目定义越清晰，总经理的自动调度越稳定。",
    items: [
      "经理角色定义项目默认口径，参与角色定义可调度的协作编队。",
      "项目的渠道绑定要写成真实房间或频道，而不是抽象备注。",
      "把项目路径、知识库权限和渠道绑定补齐，后续自动化才有稳定上下文。",
    ],
  },
  cron: {
    eyebrow: "Operator Guide",
    title: "cron 页负责把“持续推进”从口头承诺变成可审计机制",
    detail: "一个有用的 cron-loop singleton loop 必须有明确目标、日志、最新结论、状态文件和可停止/启动控制。",
    items: [
      "优先看每个 singleton loop 的 latest.md 和状态，而不是只看 crontab。",
      "改动大结构前先 stop，验证完再 start，避免循环任务撞上手工改动。",
      "如果任务只是写总结、不推动真实流程，那就不算有效自动化。",
    ],
  },
  channels: {
    eyebrow: "Operator Guide",
    title: "渠道页要让接入流程可读、可校验、可回流",
    detail: "这里不仅保存 token。它还要告诉操作者当前模式、下一步该填什么、连接是否成功，以及消息会被路由到哪里。",
    items: [
      "Slack 优先使用 socket mode；只有明确需要公网事件回调时再走 http。",
      "先保存再校验，再 connect，最后看回流状态和路由项目是否正确。",
      "尽量让用户选择项目和目标频道，而不是手写难记的技术参数。",
    ],
  },
};

export const tabWorkflowGuides: Partial<Record<TabKey, GuideCard[]>> = {
  dashboard: [
    {
      eyebrow: "Workflow",
      title: "总览页的推荐阅读顺序",
      detail: "先判断系统还能不能治理，再决定要去哪一页处理。",
      items: [
        "先读四个指标卡：角色、会话、Cron、MCP，确认系统资产量级。",
        "再看三张说明卡：当前页用途、当前上下文、下一步建议。",
        "最后检查 Trusted Roots 和 Knowledge，确认项目路径与知识库连接是否对得上。",
      ],
      footnote: "如果这里已经暴露出 Slack 未连接、Cron 未装入或 Qdrant 离线，不要直接跳进深层编辑页硬改参数。",
    },
  ],
  manager: [
    {
      eyebrow: "Workflow",
      title: "总经理页的正确使用方式",
      detail: "这里最适合发治理命令，不适合把它当成无上下文聊天框。",
      items: [
        "先选角色、项目、是否恢复旧会话，确保运行边界正确。",
        "Prompt 里写清目标、范围、验收条件和是否要修改代码或配置。",
        "发送后盯右侧运行时间线，看它是否真的发起了 codex exec / resume。",
        "结果满意后，记住 session 归属，方便后续在会话页继续复用。",
      ],
      footnote: "如果运行失败，优先看右侧 command preview 和 error 事件，而不是重复发送相同 prompt。",
    },
    {
      eyebrow: "Done Signal",
      title: "怎样判断一次治理运行真的完成",
      detail: "不是看到模型有回复就算完成，至少要满足下面三条。",
      items: [
        "运行状态进入 completed 或 failed，而不是一直卡在 in_progress。",
        "事件流里出现可读的动作证据，例如命令预览、关键输出或错误回显。",
        "本地对象状态有刷新，例如会话新增、项目配置变化或日志更新时间变化。",
      ],
      tone: "neutral",
    },
  ],
  personas: [
    {
      eyebrow: "Workflow",
      title: "角色编辑的四步法",
      detail: "角色是人格和工具边界的组合体，不要把会话历史混进来。",
      items: [
        "先定义名称、职责描述、模型、reasoning 和 verbosity。",
        "再写 system prompt / developer instructions，明确这个角色能做什么、不能做什么。",
        "然后按职责选择技能、MCP 和工具，而不是默认全开。",
        "最后补齐渠道身份、回复规则和发言风格，确保外部接入时口径稳定。",
      ],
    },
    {
      eyebrow: "Done Signal",
      title: "怎样判断一个角色可投产",
      detail: "可投产角色应该能被项目复用，而不是只在单个页面里留一堆字段。",
      items: [
        "描述能说明职责边界，别人不看 prompt 也知道它负责什么。",
        "模型与工具选择和职责相符，不存在明显越权或冗余授权。",
        "渠道身份能直接拿去接 Slack / Telegram，而不是继续靠手工脑补。",
      ],
      tone: "neutral",
    },
  ],
  sessions: [
    {
      eyebrow: "Workflow",
      title: "会话页的整理顺序",
      detail: "这里的目标不是阅读大段 transcript，而是把高价值会话重新纳入治理流程。",
      items: [
        "先看 cwd 和最近更新时间，判断它是不是当前项目的有效资产。",
        "再给它挂回项目、角色和备注，避免它继续漂在索引里。",
        "当你需要恢复推进时，再回总经理页选择该 session 做 resume。",
      ],
      footnote: "备注最好写“这段会话推进到了什么阶段”，而不是只写一个含糊标签。",
    },
  ],
  knowledge: [
    {
      eyebrow: "Workflow",
      title: "知识库页的最短闭环",
      detail: "先确认服务可达，再谈 collection 和读写权限。",
      items: [
        "先看右下角 Qdrant Reachable 状态；离线时先恢复服务。",
        "填写名称、Qdrant URL、collection 和描述。",
        "明确它是否只读，再去项目页绑定读写权限。",
      ],
      footnote: "如果 collection 名称还是空的，项目页里的读写绑定就只是空壳配置。",
    },
  ],
  projects: [
    {
      eyebrow: "Workflow",
      title: "项目编辑的推荐顺序",
      detail: "项目页定义的是治理边界，字段顺序最好按实际决策顺序来走。",
      items: [
        "先填项目名称和真实路径，确保后续扫描到正确工作区。",
        "再选经理角色和参与角色，定义这个项目由谁主导、谁协作。",
        "然后绑定可读知识库、可写知识库和渠道。",
        "如果绑定了渠道，必须继续填写房间/频道和项目别名，别停留在半配置状态。",
      ],
    },
    {
      eyebrow: "Done Signal",
      title: "项目什么时候算配置完整",
      detail: "至少要让总经理、知识库和外部渠道三条链路都能对上。",
      items: [
        "项目路径准确可访问，经理角色不是空值。",
        "读写知识库权限和实际 collection 关系一致，没有“能写却没 collection”的空配置。",
        "每条渠道绑定都有真实 room 和 alias，便于外部消息正确路由。",
      ],
      tone: "neutral",
    },
  ],
  cron: [
    {
      eyebrow: "Workflow",
      title: "Cron 页的标准排查顺序",
      detail: "先确认结构，再决定 stop/start，不要盲目重装或重启。",
      items: [
        "先执行 validate，确认 prompt、runner、state、latest、lock 都在。",
        "再看 latest 摘要和状态，判断最近一轮到底推进了什么。",
        "大改动前先 stop；修改、验证和服务恢复完成后再 start。",
        "如果结构异常，再用 paths 快速定位真实文件路径。",
      ],
    },
    {
      eyebrow: "Done Signal",
      title: "怎样判断一个 cron-loop 真的健康",
      detail: "健康不是“crontab 里有一行”这么简单。",
      items: [
        "validate 返回 ok，且 action interpretation 给出人类可读解释。",
        "latest.md 和 state.json 能持续刷新，而不是长期停在旧时间。",
        "singleton loop 的摘要能说明真实推进结果，而不是只有占位文字。",
      ],
      tone: "neutral",
    },
  ],
  channels: [
    {
      eyebrow: "Workflow",
      title: "渠道接入的标准步骤",
      detail: "所有渠道都按“保存 -> 校验 -> dry-run -> live -> 观察运行态”的顺序走。",
      items: [
        "先选 Slack 或 Telegram，再填当前模式所需的最小字段集。",
        "先保存配置，再执行校验，确认 liveReady、issues 和 warnings。",
        "校验通过后先做 Dry Run，再做真实发送测试。",
        "Slack socket mode 额外需要 Connect Slack，然后观察连接态、回流时间和路由项目。",
      ],
    },
    {
      eyebrow: "Done Signal",
      title: "怎样判断渠道已经可用",
      detail: "不要只看“保存成功”。真正可用至少要满足下面三条。",
      items: [
        "最近一次运行态刷新了校验和投递时间，而不是一直显示未执行。",
        "真实发送测试能在目标房间、频道或聊天里看到消息。",
        "Slack 额外要看到 connectionState 正确、回流时间更新，Telegram 则要确认 chat id 与 bot 权限匹配。",
      ],
      tone: "neutral",
    },
  ],
};

export function buildContextGuide(params: {
  activeTab: TabKey;
  selectedProject: ProjectDefinition | null;
  selectedPersona: PersonaDefinition | null;
  selectedChannel: ChannelDefinition | null;
}): GuideCard {
  const items = [
    `当前项目：${params.selectedProject?.name || "未选择"}${params.selectedProject?.path ? ` · ${params.selectedProject.path}` : ""}`,
    `当前角色：${params.selectedPersona?.name || "未选择"}${params.selectedPersona?.model ? ` · ${params.selectedPersona.model}` : ""}`,
  ];

  if (params.activeTab === "channels") {
    items.push(
      `当前渠道：${params.selectedChannel?.name || "未选择"} · ${params.selectedChannel?.type || "unknown"} · ${
        params.selectedChannel?.runtime.connectionState || params.selectedChannel?.status || "unknown"
      }`,
    );
  } else if (params.selectedProject?.channelBindings.length) {
    items.push(`已绑定渠道：${params.selectedProject.channelBindings.length} 个`);
  } else {
    items.push("当前项目还没有渠道绑定。");
  }

  return {
    eyebrow: "Current Context",
    title: "当前工作上下文",
    detail: "不必把所有对象都记在脑子里。这里应该让你随时知道本轮操作的角色、项目和外部连接边界。",
    items,
    footnote: "如果这里的上下文不对，先切换它，再做保存、连接或总经理运行。",
    tone: "neutral",
  };
}

export function buildRecommendedActions(params: {
  bootstrap: BootstrapPayload;
  totalCronJobs: number;
  threadMessageCount: number;
}): GuideCard {
  const actions: string[] = [];
  const hasSlackConnected = params.bootstrap.channels.some(
    (channel) => channel.type === "slack" && channel.runtime.connectionState === "connected",
  );
  const hasProjectChannelBinding = params.bootstrap.projects.some((project) => project.channelBindings.length > 0);

  if (!hasSlackConnected) {
    actions.push("去“渠道”页把 Slack Bridge 切到 socket mode，填入 bot/app token 后执行 connect。");
  }
  if (!params.totalCronJobs) {
    actions.push("去“Cron”页确认并管理当前项目的 singleton cron-loop，让项目进入持续迭代节奏。");
  }
  if (!params.threadMessageCount) {
    actions.push("去“总经理”页发出第一条治理命令，建立主线程和运行轨迹。");
  }
  if (!hasProjectChannelBinding) {
    actions.push("去“项目”页为当前项目补齐 Slack / Telegram 绑定，让外部消息能命中真实项目。");
  }
  if (!params.bootstrap.qdrant.reachable) {
    actions.push("先恢复 Qdrant，再继续知识库治理，否则很多状态只会停留在配置层。");
  }
  if (!actions.length) {
    actions.push("系统关键面已经有基础配置，下一步应优先打磨前端说明层和自动化回路。");
    actions.push("沿着总经理、项目、渠道三条主线做精细化治理，避免继续堆原始字段。");
  }

  return {
    eyebrow: "Next Moves",
    title: "下一步建议",
    detail: "这不是静态说明，而是根据当前系统状态给出的实际动作提示。优先完成前两项，整个管理面会更顺手。",
    items: actions.slice(0, 4),
    tone: actions.length > 2 ? "warn" : "accent",
  };
}
