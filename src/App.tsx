import { startTransition, useEffect, useMemo, useState } from "react";
import {
  connectChannel,
  disconnectChannel,
  getBootstrap,
  getRun,
  linkSession,
  readEmbeddedBootstrap,
  runCronAction,
  saveChannel,
  saveKnowledgeBase,
  savePersona,
  saveProject,
  sendManagerPrompt,
  testChannelDelivery,
  validateChannelConfig,
} from "./api";
import type {
  BootstrapPayload,
  ChannelDefinition,
  CronJobSummary,
  KnowledgeBaseDefinition,
  ManagerRun,
  PersonaDefinition,
  ProjectDefinition,
  SessionSummary,
} from "../shared/models";
import {
  blankChannel,
  blankKnowledgeBase,
  blankPersona,
  blankProject,
  buildContextGuide,
  buildRecommendedActions,
  ChannelSetupGuide,
  ChannelActionDetails,
  CronActionDetails,
  type CronActionName,
  type CronActionResult,
  type ChannelActionReport,
  formatDateTime,
  GuidePanel,
  hasChannelDraftChanges,
  hasKnowledgeDraftChanges,
  hasPersonaDraftChanges,
  hasProjectDraftChanges,
  parseTabHash,
  Pill,
  SectionHeader,
  tabNavigation,
  tabGuides,
  tabWorkflowGuides,
  type TabKey,
  toggleChannelBinding,
  toggleValue,
  updateChannelBinding,
} from "./app-support";

function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(() => readEmbeddedBootstrap());
  const [bootstrapError, setBootstrapError] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>(() =>
    typeof window === "undefined" ? "dashboard" : parseTabHash(window.location.hash),
  );
  const [busyLabel, setBusyLabel] = useState("");
  const [selectedPersonaId, setSelectedPersonaId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [focusedSessionId, setFocusedSessionId] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionShowAll, setSessionShowAll] = useState(false);
  const [personaDraft, setPersonaDraft] = useState<PersonaDefinition>(blankPersona());
  const [projectDraft, setProjectDraft] = useState<ProjectDefinition>(blankProject());
  const [knowledgeDraft, setKnowledgeDraft] = useState<KnowledgeBaseDefinition>(blankKnowledgeBase());
  const [channelDraft, setChannelDraft] = useState<ChannelDefinition>(blankChannel());
  const [chatPrompt, setChatPrompt] = useState("");
  const [activeRun, setActiveRun] = useState<ManagerRun | null>(null);
  const [runError, setRunError] = useState("");
  const [cronActionResult, setCronActionResult] = useState<CronActionResult | null>(null);
  const [channelTestMessage, setChannelTestMessage] = useState("CCEO 渠道桥测试消息。");
  const [channelActionReport, setChannelActionReport] = useState<ChannelActionReport | null>(null);
  const [channelActionError, setChannelActionError] = useState("");
  const [sessionEdits, setSessionEdits] = useState<Record<string, { projectId?: string; personaId?: string; notes?: string }>>({});

  const load = async () => {
    try {
      const payload = await getBootstrap();
      setBootstrap(payload);
      setBootstrapError("");
    } catch (error) {
      setBootstrapError(error instanceof Error ? error.message : String(error));
    }
  };

  useEffect(() => {
    if (!bootstrap) {
      void load();
    }
  }, [bootstrap]);

  useEffect(() => {
    const applyHash = () => setActiveTab(parseTabHash(window.location.hash));
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  useEffect(() => {
    if (!bootstrap) {
      return;
    }
    setSelectedPersonaId((current) => current || bootstrap.personas[0]?.id || "");
    setSelectedProjectId((current) => current || bootstrap.projects[0]?.id || "");
    setSelectedChannelId((current) => current || bootstrap.channels[0]?.id || "");
  }, [bootstrap]);

  useEffect(() => {
    const currentHash = parseTabHash(window.location.hash);
    if (currentHash !== activeTab) {
      window.location.hash = activeTab;
    }
  }, [activeTab]);

  const selectedPersona = useMemo(
    () => bootstrap?.personas.find((item) => item.id === selectedPersonaId) ?? bootstrap?.personas[0] ?? null,
    [bootstrap, selectedPersonaId],
  );
  const selectedProject = useMemo(
    () => bootstrap?.projects.find((item) => item.id === selectedProjectId) ?? bootstrap?.projects[0] ?? null,
    [bootstrap, selectedProjectId],
  );
  const selectedChannel = useMemo(
    () => bootstrap?.channels.find((item) => item.id === selectedChannelId) ?? bootstrap?.channels[0] ?? null,
    [bootstrap, selectedChannelId],
  );
  const selectedKnowledgeBase = useMemo(
    () => bootstrap?.knowledgeBases.find((item) => item.id === knowledgeDraft.id) ?? null,
    [bootstrap?.knowledgeBases, knowledgeDraft.id],
  );
  const thread = bootstrap?.managerThreads[0];
  const currentCronJobs: CronJobSummary[] =
    (selectedProjectId && bootstrap?.cronJobs[selectedProjectId]) || (selectedProject?.id ? bootstrap?.cronJobs[selectedProject.id] : []) || [];
  const personaNameById = useMemo(
    () => new Map((bootstrap?.personas ?? []).map((persona) => [persona.id, persona.name])),
    [bootstrap?.personas],
  );
  const projectNameById = useMemo(
    () => new Map((bootstrap?.projects ?? []).map((project) => [project.id, project.name])),
    [bootstrap?.projects],
  );
  const sortedSessions = useMemo(
    () => [...(bootstrap?.sessions ?? [])].sort((left, right) => right.sessionId.localeCompare(left.sessionId)),
    [bootstrap?.sessions],
  );
  const matchingSessions = useMemo(() => {
    const query = sessionSearch.trim().toLowerCase();
    if (!query) {
      return sortedSessions;
    }
    return sortedSessions.filter((session) => {
      const haystack = [
        session.sessionId,
        session.cwd,
        session.notes,
        personaNameById.get(session.personaId ?? "") ?? "",
        projectNameById.get(session.projectId ?? "") ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [sortedSessions, sessionSearch, personaNameById, projectNameById]);
  const visibleSessions = useMemo(
    () => (sessionShowAll ? matchingSessions : matchingSessions.slice(0, 12)),
    [matchingSessions, sessionShowAll],
  );
  const focusedSession =
    visibleSessions.find((session) => session.sessionId === focusedSessionId) ??
    matchingSessions.find((session) => session.sessionId === focusedSessionId) ??
    visibleSessions[0] ??
    matchingSessions[0] ??
    null;
  const focusedSessionEdit = focusedSession ? sessionEdits[focusedSession.sessionId] ?? {} : null;
  const hasFocusedSessionChanges = focusedSession
    ? (focusedSessionEdit?.projectId ?? focusedSession.projectId ?? "") !== (focusedSession.projectId ?? "") ||
      (focusedSessionEdit?.personaId ?? focusedSession.personaId ?? "") !== (focusedSession.personaId ?? "") ||
      (focusedSessionEdit?.notes ?? focusedSession.notes ?? "") !== (focusedSession.notes ?? "")
    : false;
  const personaDraftDirty = useMemo(() => hasPersonaDraftChanges(personaDraft, selectedPersona), [personaDraft, selectedPersona]);
  const projectDraftDirty = useMemo(() => hasProjectDraftChanges(projectDraft, selectedProject), [projectDraft, selectedProject]);
  const knowledgeDraftDirty = useMemo(
    () => hasKnowledgeDraftChanges(knowledgeDraft, selectedKnowledgeBase),
    [knowledgeDraft, selectedKnowledgeBase],
  );
  const channelDraftDirty = useMemo(() => hasChannelDraftChanges(channelDraft, selectedChannel), [channelDraft, selectedChannel]);

  useEffect(() => {
    if (selectedPersona) {
      setPersonaDraft(selectedPersona);
    }
  }, [selectedPersona]);

  useEffect(() => {
    if (selectedProject) {
      setProjectDraft(selectedProject);
    }
  }, [selectedProject]);

  useEffect(() => {
    if (!bootstrap?.knowledgeBases.length) {
      setKnowledgeDraft(blankKnowledgeBase());
      return;
    }
    setKnowledgeDraft((current) => {
      const matched = bootstrap.knowledgeBases.find((item) => item.id === current.id);
      return matched ?? (current.id ? current : bootstrap.knowledgeBases[0]);
    });
  }, [bootstrap?.knowledgeBases]);

  useEffect(() => {
    if (!bootstrap?.channels.length) {
      setChannelDraft(blankChannel());
      return;
    }
    setChannelDraft((current) => {
      const matched = bootstrap.channels.find((item) => item.id === (selectedChannelId || current.id));
      return matched ?? (current.id ? current : bootstrap.channels[0]);
    });
  }, [bootstrap?.channels, selectedChannelId]);

  useEffect(() => {
    setChannelActionReport(null);
    setChannelActionError("");
  }, [selectedChannelId]);

  useEffect(() => {
    if (!focusedSession) {
      if (focusedSessionId) {
        setFocusedSessionId("");
      }
      return;
    }
    if (focusedSession.sessionId !== focusedSessionId) {
      setFocusedSessionId(focusedSession.sessionId);
    }
  }, [focusedSession, focusedSessionId]);

  const totalCronJobs = Object.values(bootstrap?.cronJobs ?? {}).flat().length;
  const tabGuide = tabGuides[activeTab];
  const contextGuide = useMemo(
    () =>
      buildContextGuide({
        activeTab,
        selectedProject,
        selectedPersona,
        selectedChannel,
      }),
    [activeTab, selectedChannel, selectedPersona, selectedProject],
  );
  const recommendedGuide = useMemo(
    () =>
      bootstrap
        ? buildRecommendedActions({
            bootstrap,
            totalCronJobs,
            threadMessageCount: thread?.messages.length ?? 0,
          })
        : {
            eyebrow: "Next Moves",
            title: "正在读取系统状态",
            detail: "等 bootstrap 返回后，这里会根据真实状态生成下一步建议。",
            items: ["等待 Codex、Qdrant、项目和渠道状态加载完成。"],
          },
    [bootstrap, thread?.messages.length, totalCronJobs],
  );
  const personaDraftReady =
    Boolean(personaDraft.id.trim()) ||
    personaDraft.name.trim() !== "新角色" ||
    Boolean(personaDraft.description.trim()) ||
    Boolean(personaDraft.systemPrompt.trim()) ||
    Boolean(personaDraft.developerInstructions.trim());
  const projectDraftReady =
    Boolean(projectDraft.id.trim()) ||
    projectDraft.name.trim() !== "新项目" ||
    Boolean(projectDraft.path.trim()) ||
    Boolean(projectDraft.description.trim()) ||
    Boolean(projectDraft.managerPersonaId.trim());
  const knowledgeDraftReady =
    Boolean(knowledgeDraft.id.trim()) ||
    knowledgeDraft.name.trim() !== "新知识库" ||
    Boolean(knowledgeDraft.collectionName.trim()) ||
    Boolean(knowledgeDraft.description.trim());
  const channelDraftReady =
    Boolean(channelDraft.id.trim()) ||
    channelDraft.name.trim() !== "新渠道" ||
    Boolean(channelDraft.notes.trim()) ||
    channelDraft.identity.trim() !== "总经理" ||
    Boolean(channelDraft.config.slackChannel.trim()) ||
    Boolean(channelDraft.config.slackBotToken.trim()) ||
    Boolean(channelDraft.config.slackAppToken.trim()) ||
    Boolean(channelDraft.config.slackWebhookUrl.trim()) ||
    Boolean(channelDraft.config.slackSigningSecret.trim()) ||
    Boolean(channelDraft.config.telegramBotToken.trim()) ||
    Boolean(channelDraft.config.telegramChatId.trim());
  const hasSavedChannel = Boolean(channelDraft.id.trim());
  const personaDraftCanSave = personaDraftReady && personaDraftDirty;
  const projectDraftCanSave = projectDraftReady && projectDraftDirty;
  const knowledgeDraftCanSave = knowledgeDraftReady && knowledgeDraftDirty;
  const channelDraftCanSave = channelDraftReady && channelDraftDirty;

  async function refreshWithLabel(label: string, action: () => Promise<void>) {
    setBusyLabel(label);
    try {
      await action();
      startTransition(() => {
        void load();
      });
    } finally {
      setBusyLabel("");
    }
  }

  async function handleSavePersona() {
    await refreshWithLabel("正在保存角色...", async () => {
      const payload = { ...personaDraft };
      const saved = (await savePersona(payload, payload.id || undefined)) as PersonaDefinition;
      setSelectedPersonaId(saved.id);
      setPersonaDraft(saved);
    });
  }

  async function handleSaveProject() {
    await refreshWithLabel("正在保存项目...", async () => {
      const payload = { ...projectDraft };
      const saved = (await saveProject(payload, payload.id || undefined)) as ProjectDefinition;
      setSelectedProjectId(saved.id);
      setProjectDraft(saved);
    });
  }

  async function handleSaveKnowledgeBase() {
    await refreshWithLabel("正在保存知识库...", async () => {
      const payload = { ...knowledgeDraft };
      const saved = (await saveKnowledgeBase(payload, payload.id || undefined)) as KnowledgeBaseDefinition;
      setKnowledgeDraft(saved);
    });
  }

  async function handleSaveChannel() {
    await refreshWithLabel("正在保存渠道...", async () => {
      const payload = { ...channelDraft };
      const saved = (await saveChannel(payload, payload.id || undefined)) as ChannelDefinition;
      setSelectedChannelId(saved.id);
      setChannelDraft(saved);
    });
  }

  async function handleValidateCurrentChannel() {
    if (!channelDraft.id) {
      setChannelActionError("请先保存渠道，再执行校验。");
      return;
    }

    setBusyLabel("正在校验渠道...");
    setChannelActionError("");
    try {
      const report = await validateChannelConfig(channelDraft.id);
      setChannelActionReport(report);
      await load();
    } catch (error) {
      setChannelActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleTestCurrentChannel(mode: "dry-run" | "live") {
    if (!channelDraft.id) {
      setChannelActionError("请先保存渠道，再执行测试。");
      return;
    }
    if (!channelTestMessage.trim()) {
      setChannelActionError("测试消息不能为空。");
      return;
    }
    if (channelDraft.type === "slack") {
      if (channelDraft.config.slackMode === "socket" && (!channelDraft.config.slackBotToken || !channelDraft.config.slackAppToken)) {
        setChannelActionError("Slack socket mode 需要同时填写 Bot Token 和 App Token。");
        return;
      }
      if (channelDraft.config.slackMode === "webhook" && !channelDraft.config.slackWebhookUrl) {
        setChannelActionError("Slack webhook 模式需要填写 Webhook URL。");
        return;
      }
      if (channelDraft.config.slackMode === "http" && (!channelDraft.config.slackBotToken || !channelDraft.config.slackSigningSecret)) {
        setChannelActionError("Slack http 模式需要填写 Bot Token 和 Signing Secret。");
        return;
      }
    }
    if (channelDraft.type === "telegram" && (!channelDraft.config.telegramBotToken || !channelDraft.config.telegramChatId)) {
      setChannelActionError("Telegram 需要同时填写 Bot Token 和 Chat ID。");
      return;
    }

    setBusyLabel(mode === "dry-run" ? "正在执行 dry-run..." : "正在发送测试消息...");
    setChannelActionError("");
    try {
      const report = await testChannelDelivery(channelDraft.id, {
        message: channelTestMessage,
        mode,
      });
      setChannelActionReport(report);
      await load();
    } catch (error) {
      setChannelActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleConnectCurrentChannel() {
    if (!channelDraft.id || channelDraft.type !== "slack") {
      setChannelActionError("只有已保存的 Slack 渠道支持连接。");
      return;
    }
    if (channelDraft.config.slackMode !== "socket") {
      setChannelActionError("只有 Slack socket mode 需要 Connect Slack。");
      return;
    }
    if (!channelDraft.config.slackBotToken || !channelDraft.config.slackAppToken) {
      setChannelActionError("Connect Slack 前需要先填写 Bot Token 和 App Token。");
      return;
    }

    setBusyLabel("正在连接 Slack...");
    setChannelActionError("");
    try {
      const report = await connectChannel(channelDraft.id);
      setChannelActionReport(report);
      await load();
    } catch (error) {
      setChannelActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleDisconnectCurrentChannel() {
    if (!channelDraft.id || channelDraft.type !== "slack") {
      setChannelActionError("只有已保存的 Slack 渠道支持断开。");
      return;
    }

    setBusyLabel("正在断开 Slack...");
    setChannelActionError("");
    try {
      const report = await disconnectChannel(channelDraft.id);
      setChannelActionReport(report);
      await load();
    } catch (error) {
      setChannelActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleSendPrompt() {
    if (!chatPrompt.trim()) {
      setRunError("请输入一条明确的治理指令。");
      return;
    }
    setRunError("");
    setBusyLabel("正在启动总经理...");
    try {
      const response = await sendManagerPrompt({
        threadId: thread?.id,
        prompt: chatPrompt,
        personaId: selectedPersonaId,
        projectId: selectedProjectId,
        sessionId: selectedSessionId || undefined,
      });
      const run = await getRun(response.runId);
      setActiveRun(run);
      setChatPrompt("");
      const eventSource = new EventSource(`/api/runs/${response.runId}/events`);
      eventSource.onmessage = (event) => {
        const payload = JSON.parse(event.data) as ManagerRun["events"][number];
        setActiveRun((current) => {
          if (!current) {
            return current;
          }
          return {
            ...current,
            events: [...current.events, payload],
            sessionId: payload.sessionId ?? current.sessionId,
          };
        });
      };
      eventSource.addEventListener("done", () => {
        eventSource.close();
        void load();
        void getRun(response.runId).then((finalRun) => setActiveRun(finalRun));
      });
      eventSource.onerror = () => {
        eventSource.close();
      };
    } catch (error) {
      setRunError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleLinkSession(session: SessionSummary) {
    await refreshWithLabel("正在更新会话归属...", async () => {
      const draft = sessionEdits[session.sessionId] ?? {};
      await linkSession(session.sessionId, {
        projectId: draft.projectId ?? session.projectId,
        personaId: draft.personaId ?? session.personaId,
        notes: draft.notes ?? session.notes ?? "",
      });
    });
  }

  async function handleCronAction(job: CronJobSummary, action: CronActionName) {
    setBusyLabel(`正在执行 ${action}...`);
    try {
      const result = await runCronAction(job.projectId, job.job, action);
      setCronActionResult({
        job: job.job,
        action,
        ok: result.ok,
        output: result.output || `${action} completed`,
      });
      await load();
    } catch (error) {
      setCronActionResult({
        job: job.job,
        action,
        ok: false,
        output: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusyLabel("");
    }
  }

  if (!bootstrap && bootstrapError) {
    return (
      <div className="loading-shell">
        <article className="guide-panel warn error-shell-card">
          <span>Bootstrap Error</span>
          <h3>系统状态没有成功加载</h3>
          <p>页面不该一直停在“加载中”。这里直接告诉你当前失败原因，并给出重试入口。</p>
          <ul className="guide-list">
            <li>确认当前 review server 仍在目标端口提供 `/api/bootstrap`。</li>
            <li>如果刚改完后端或 registry，先重新构建并刷新页面。</li>
            <li>当问题持续出现时，优先看浏览器控制台和 `output/runtime/review-server.*.log`。</li>
          </ul>
          <pre className="output-box compact">{bootstrapError}</pre>
          <div className="editor-actions">
            <button type="button" onClick={() => void load()}>
              重新加载系统状态
            </button>
          </div>
        </article>
      </div>
    );
  }

  if (!bootstrap) {
    return <div className="loading-shell">正在加载 Codex Executive Officer...</div>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-kicker">CCEO</div>
          <h1>Codex Executive Officer</h1>
          <p>把本机 Codex 项目、人格、会话、知识库和 cron-loop 拉到同一张管理桌上。</p>
        </div>
        {activeTab === "dashboard" ? (
          <nav className="nav-stack">
            {tabNavigation.map(({ key, label, description, ariaLabel }) =>
              activeTab === key ? (
                <article key={key} className="nav-link active current" aria-current="page">
                  <span className="nav-link-label">{label}</span>
                  <small className="nav-link-detail">{description}</small>
                </article>
              ) : (
                <button
                  key={key}
                  type="button"
                  className="nav-link"
                  aria-label={ariaLabel}
                  data-testid={`nav-${key}`}
                  onClick={() => setActiveTab(key as TabKey)}
                >
                  <span className="nav-link-label">{label}</span>
                  <small className="nav-link-detail">{description}</small>
                </button>
              ),
            )}
          </nav>
        ) : (
          <div className="nav-stack nav-stack-compact">
            <label className="nav-picker">
              <span>切换工作面</span>
              <select value={activeTab} onChange={(event) => setActiveTab(event.target.value as TabKey)}>
                {tabNavigation.map(({ key, label }) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <article className="nav-current-card">
              <strong>{tabGuide.title}</strong>
              <small>{tabGuide.detail}</small>
            </article>
          </div>
        )}
        <div className="sidebar-footer">
          <Pill tone={bootstrap.qdrant.reachable ? "good" : "warn"}>
            {bootstrap.qdrant.reachable ? "Qdrant Online" : "Qdrant Offline"}
          </Pill>
          <Pill>{bootstrap.discovery.cliVersion || "codex unknown"}</Pill>
        </div>
      </aside>

      <main className="main-panel">
        {bootstrapError ? (
          <article className="guide-panel warn">
            <span>Refresh Warning</span>
            <h3>最近一次状态刷新失败</h3>
            <p>当前页面仍保留上一次成功加载的数据，但这条错误需要处理，否则后续判断会越来越不可靠。</p>
            <pre className="output-box compact">{bootstrapError}</pre>
            <div className="editor-actions">
              <button type="button" onClick={() => void load()}>
                重新拉取最新状态
              </button>
            </div>
          </article>
        ) : null}
        <header className="hero-panel">
          <div>
            <span className="hero-kicker">Unified Manager Interface</span>
            <h2>总经理当前把手</h2>
            <p>
              默认角色是 <strong>{selectedPersona?.name || "未选择"}</strong>，当前项目是{" "}
              <strong>{selectedProject?.name || "未选择"}</strong>。你可以切换角色、会话和项目，再把一条新指令发给总经理。
            </p>
          </div>
          <div className="hero-metrics">
            <article>
              <span>角色</span>
              <strong>{bootstrap.personas.length}</strong>
            </article>
            <article>
              <span>会话</span>
              <strong>{bootstrap.sessions.length}</strong>
            </article>
            <article>
              <span>Cron</span>
              <strong>{totalCronJobs}</strong>
            </article>
            <article>
              <span>MCP</span>
              <strong>{bootstrap.discovery.mcpServers.length}</strong>
            </article>
          </div>
        </header>

        {busyLabel ? <div className="busy-banner">{busyLabel}</div> : null}

        <section className="hero-guides">
          <GuidePanel {...tabGuide} />
          <GuidePanel {...contextGuide} />
          <GuidePanel {...recommendedGuide} />
        </section>

        {tabWorkflowGuides[activeTab]?.length ? (
          <section className="hero-guides detail-guides">
            {tabWorkflowGuides[activeTab]?.map((guide) => (
              <GuidePanel key={`${activeTab}:${guide.eyebrow}:${guide.title}`} {...guide} />
            ))}
          </section>
        ) : null}

        {activeTab === "dashboard" ? (
          <section className="content-grid">
            <div className="panel wide">
              <SectionHeader eyebrow="Executive Status" title="系统概况" detail="直接读取本机 Codex、Qdrant 和已注册项目，避免造一个脱离真实运行面的假后台。" />
              <div className="metric-grid">
                <article className="metric-card">
                  <span>默认模型</span>
                  <strong>{bootstrap.discovery.defaultModel || "未读取"}</strong>
                  <small>Reasoning: {bootstrap.discovery.defaultReasoningEffort || "n/a"}</small>
                </article>
                <article className="metric-card">
                  <span>已发现技能</span>
                  <strong>{bootstrap.discovery.skills.length}</strong>
                  <small>{bootstrap.discovery.skills.slice(0, 4).map((item) => item.name).join(", ") || "暂无"}</small>
                </article>
                <article className="metric-card">
                  <span>已发现 MCP</span>
                  <strong>{bootstrap.discovery.mcpServers.length}</strong>
                  <small>{bootstrap.discovery.mcpServers.map((item) => item.id).join(", ") || "暂无"}</small>
                </article>
                <article className="metric-card">
                  <span>Qdrant Collections</span>
                  <strong>{bootstrap.qdrant.collections.length}</strong>
                  <small>{bootstrap.qdrant.collections.join(", ") || "暂无"}</small>
                </article>
              </div>
            </div>

            <div className="panel">
              <SectionHeader eyebrow="Trusted Roots" title="Codex 信任项目" detail="来自 ~/.codex/config.toml 的 trusted project 列表，用于快速纳管现有工作目录。" />
              <div className="list-stack">
                {bootstrap.discovery.trustedProjects.map((project) => (
                  <article key={project.path} className="list-card">
                    <strong>{project.path}</strong>
                    <Pill tone={project.trustLevel === "trusted" ? "good" : "warn"}>{project.trustLevel}</Pill>
                  </article>
                ))}
              </div>
            </div>

            <div className="panel">
              <SectionHeader eyebrow="Knowledge" title="知识库健康" detail="term_1 先管理 Qdrant 连接和 collection 映射，term_2 再补自动同步与嵌入管线。" />
              <div className="list-stack">
                {bootstrap.knowledgeBases.map((kb) => (
                  <article key={kb.id} className="list-card">
                    <strong>{kb.name}</strong>
                    <span>{kb.url}</span>
                    <small>{kb.collectionName || "collection 未指定"}</small>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "manager" ? (
          <section className="content-grid manager-grid">
            <div className="panel chat-panel">
              <SectionHeader eyebrow="Manager Chat" title="总经理主线程" detail="通过真实 codex exec / exec resume 运行，把项目上下文和角色配置打进一次管理动作。" />
              <div className="chat-controls">
                <label>
                  <span>角色</span>
                  <select value={selectedPersonaId} onChange={(event) => setSelectedPersonaId(event.target.value)}>
                    {bootstrap.personas.map((persona) => (
                      <option key={persona.id} value={persona.id}>
                        {persona.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>项目</span>
                  <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
                    {bootstrap.projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>恢复会话</span>
                  <select value={selectedSessionId} onChange={(event) => setSelectedSessionId(event.target.value)}>
                    <option value="">新运行</option>
                    {bootstrap.sessions.map((session) => (
                      <option key={session.sessionId} value={session.sessionId}>
                        {session.sessionId.slice(0, 8)} · {session.cwd || "unknown"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="chat-stream">
                {(thread?.messages ?? []).slice(-8).map((message) => (
                  <article key={message.id} className={`chat-bubble ${message.role}`}>
                    <header>
                      <strong>{message.role === "user" ? "你" : message.role === "assistant" ? "总经理" : "系统"}</strong>
                      <span>{new Date(message.createdAt).toLocaleString()}</span>
                    </header>
                    <p>{message.content}</p>
                  </article>
                ))}
              </div>

              <div className="composer">
                <textarea
                  value={chatPrompt}
                  onChange={(event) => setChatPrompt(event.target.value)}
                  placeholder="例如：为 wx-loop 项目挑一个经理角色，并扫描它的 .cron-loop 任务。"
                  aria-label="给总经理的治理指令"
                />
                <div className="composer-bar">
                  <span className="hint">当前角色：{selectedPersona?.name}；当前项目：{selectedProject?.name}</span>
                  <button data-testid="manager-send" onClick={() => void handleSendPrompt()}>
                    发送给总经理
                  </button>
                </div>
                {runError ? <p className="error-text">{runError}</p> : null}
              </div>
            </div>

            <div className="panel run-panel">
              <SectionHeader eyebrow="Run Trace" title="本次运行时间线" detail="展示来自 codex exec --json 的实时事件，命令执行与最终回复都能在这里看到。" />
              {activeRun ? (
                <>
                  <div className="run-summary">
                    <Pill tone={activeRun.status === "completed" ? "good" : activeRun.status === "failed" ? "warn" : "neutral"}>
                      {activeRun.status}
                    </Pill>
                    <strong>{activeRun.prompt}</strong>
                    <small>Session: {activeRun.sessionId || "等待线程创建"}</small>
                  </div>
                  <div className="command-preview">
                    {activeRun.commandPreview.map((part, index) => (
                      <code key={`${part}-${index}`}>{part}</code>
                    ))}
                  </div>
                  <div className="event-log">
                    {activeRun.events.slice(-32).map((event) => (
                      <article key={event.id} className={`event-row ${event.type}`}>
                        <span>{new Date(event.ts).toLocaleTimeString()}</span>
                        <strong>{event.type}</strong>
                        <p>{event.text}</p>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-state">尚未发起总经理运行。</div>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "personas" ? (
          <section className="content-grid">
            <div className="panel">
              <SectionHeader eyebrow="Persona Registry" title="角色清单" detail="角色主要管理人格、指令、工具意图和渠道身份，不和历史会话绑死。" />
              <div className="list-stack">
                {bootstrap.personas.map((persona) => (
                  <label
                    key={persona.id}
                    className={selectedPersonaId === persona.id ? "selection-card active" : "selection-card"}
                    data-testid={`persona-card-${persona.id}`}
                  >
                    <input
                      type="radio"
                      name="selected-persona"
                      checked={selectedPersonaId === persona.id}
                      onChange={() => setSelectedPersonaId(persona.id)}
                    />
                    <div>
                      <strong>{persona.name}</strong>
                      <span>{persona.description || "无描述"}</span>
                      <small>{persona.scope} · {persona.model}</small>
                    </div>
                  </label>
                ))}
                <button className="ghost-button" data-testid="persona-new" onClick={() => setPersonaDraft(blankPersona())}>
                  新建角色
                </button>
              </div>
            </div>

            <div className="panel editor-panel">
              <SectionHeader eyebrow="Editor" title="角色编辑器" detail="term_1 会把角色配置物化成运行参数与 persona instructions 文件，供 Codex 桥接使用。" />
              <div className="form-grid">
                <label>
                  <span>名称</span>
                  <input value={personaDraft.name} onChange={(event) => setPersonaDraft({ ...personaDraft, name: event.target.value })} />
                </label>
                <label>
                  <span>模型</span>
                  <input value={personaDraft.model} onChange={(event) => setPersonaDraft({ ...personaDraft, model: event.target.value })} />
                </label>
                <label>
                  <span>Profile</span>
                  <input value={personaDraft.profile} onChange={(event) => setPersonaDraft({ ...personaDraft, profile: event.target.value })} />
                </label>
                <label>
                  <span>Personality</span>
                  <select
                    value={personaDraft.personality}
                    onChange={(event) => setPersonaDraft({ ...personaDraft, personality: event.target.value as PersonaDefinition["personality"] })}
                  >
                    <option value="none">none</option>
                    <option value="friendly">friendly</option>
                    <option value="pragmatic">pragmatic</option>
                  </select>
                </label>
                <label>
                  <span>Reasoning</span>
                  <select
                    value={personaDraft.reasoningEffort}
                    onChange={(event) => setPersonaDraft({ ...personaDraft, reasoningEffort: event.target.value as PersonaDefinition["reasoningEffort"] })}
                  >
                    {["none", "minimal", "low", "medium", "high", "xhigh"].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Verbosity</span>
                  <select
                    value={personaDraft.verbosity}
                    onChange={(event) => setPersonaDraft({ ...personaDraft, verbosity: event.target.value as PersonaDefinition["verbosity"] })}
                  >
                    {["low", "medium", "high"].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={personaDraft.useProjectDocs}
                    onChange={(event) => setPersonaDraft({ ...personaDraft, useProjectDocs: event.target.checked })}
                  />
                  <span>启用项目文档</span>
                </label>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={personaDraft.replaceBuiltInInstructions}
                    onChange={(event) => setPersonaDraft({ ...personaDraft, replaceBuiltInInstructions: event.target.checked })}
                  />
                  <span>替换内建指令</span>
                </label>
                <label className="wide">
                  <span>描述</span>
                  <textarea value={personaDraft.description} onChange={(event) => setPersonaDraft({ ...personaDraft, description: event.target.value })} />
                </label>
                <label className="wide">
                  <span>System Prompt</span>
                  <textarea value={personaDraft.systemPrompt} onChange={(event) => setPersonaDraft({ ...personaDraft, systemPrompt: event.target.value })} />
                </label>
                <label className="wide">
                  <span>Developer Instructions</span>
                  <textarea
                    value={personaDraft.developerInstructions}
                    onChange={(event) => setPersonaDraft({ ...personaDraft, developerInstructions: event.target.value })}
                  />
                </label>
                <label className="wide">
                  <span>技能</span>
                  <div className="chip-grid">
                    {bootstrap.discovery.skills.map((skill) => (
                      <label
                        key={skill.name}
                        className={personaDraft.skills.includes(skill.name) ? "choice-chip active" : "choice-chip"}
                        data-testid={`persona-skill-${skill.name}`}
                      >
                        <input
                          type="checkbox"
                          checked={personaDraft.skills.includes(skill.name)}
                          onChange={() => setPersonaDraft({ ...personaDraft, skills: toggleValue(personaDraft.skills, skill.name) })}
                        />
                        <span>{skill.name}</span>
                      </label>
                    ))}
                  </div>
                </label>
                <label className="wide">
                  <span>MCP</span>
                  <div className="chip-grid">
                    {bootstrap.discovery.mcpServers.map((mcp) => (
                      <label
                        key={mcp.id}
                        className={personaDraft.mcpServers.includes(mcp.id) ? "choice-chip active" : "choice-chip"}
                        data-testid={`persona-mcp-${mcp.id}`}
                      >
                        <input
                          type="checkbox"
                          checked={personaDraft.mcpServers.includes(mcp.id)}
                          onChange={() => setPersonaDraft({ ...personaDraft, mcpServers: toggleValue(personaDraft.mcpServers, mcp.id) })}
                        />
                        <span>{mcp.id}</span>
                      </label>
                    ))}
                  </div>
                </label>
              </div>
              <div className="editor-actions">
                {personaDraftCanSave ? (
                  <button data-testid="persona-save" onClick={() => void handleSavePersona()}>
                    保存角色
                  </button>
                ) : (
                  <span className="hint">先修改角色草稿，再保存角色。新建角色至少要补一段职责说明或指令，既有角色则只有在你真的改动后才会出现保存动作。</span>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "sessions" ? (
          <section className="content-grid">
            <div className="panel">
              <SectionHeader eyebrow="Session Memory" title="会话与记忆索引" detail="直接读取 ~/.codex/sessions 和 archived_sessions，并把高价值会话重新挂回项目与角色。" />
              <div className="toolbar">
                <label>
                  <span>搜索</span>
                  <input value={sessionSearch} onChange={(event) => setSessionSearch(event.target.value)} placeholder="按 session、cwd、备注、项目或角色搜索" />
                </label>
                <label>
                  <span>显示范围</span>
                  <select value={sessionShowAll ? "all" : "recent"} onChange={(event) => setSessionShowAll(event.target.value === "all")}>
                    <option value="recent">最近 12 条</option>
                    <option value="all">显示全部 {matchingSessions.length} 条</option>
                  </select>
                </label>
              </div>
              <div className="list-stack">
                <article className="list-card">
                  <strong>当前结果集</strong>
                  <span>总会话 {sortedSessions.length} 条，匹配 {matchingSessions.length} 条，当前显示 {visibleSessions.length} 条。</span>
                  <small>归档 {sortedSessions.filter((session) => session.archived).length} 条；活跃 {sortedSessions.filter((session) => !session.archived).length} 条。</small>
                </article>
                {visibleSessions.map((session) => (
                  <label
                    key={session.sessionId}
                    className={focusedSessionId === session.sessionId ? "session-choice active" : "session-choice"}
                    data-testid={`session-card-${session.sessionId}`}
                  >
                    <input
                      type="radio"
                      name="focused-session"
                      checked={focusedSessionId === session.sessionId}
                      onChange={() => setFocusedSessionId(session.sessionId)}
                    />
                    <div>
                      <strong>{session.sessionId}</strong>
                      <span>{session.cwd || "unknown cwd"}</span>
                      <small>
                        {session.archived ? "archived" : "active"} · {new Date(session.lastUpdatedAt).toLocaleString()} · 项目：
                        {projectNameById.get(session.projectId ?? "") || "未挂接"} · 角色：
                        {personaNameById.get(session.personaId ?? "") || "未挂接"}
                      </small>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="panel editor-panel">
              <SectionHeader eyebrow="Editor" title="会话归属编辑器" detail="一次只编辑当前选中的会话，减少参数墙和无意义滚动，让 resume 使用链更清晰。" />
              {focusedSession ? (
                <>
                  <div className="list-stack">
                    <article className="list-card">
                      <strong>{focusedSession.sessionId}</strong>
                      <span>{focusedSession.cwd || "unknown cwd"}</span>
                      <small>{focusedSession.archived ? "archived" : "active"} · {new Date(focusedSession.lastUpdatedAt).toLocaleString()}</small>
                    </article>
                  </div>
                  <div className="form-grid">
                    <label>
                      <span>挂接项目</span>
                      <select
                        value={sessionEdits[focusedSession.sessionId]?.projectId ?? focusedSession.projectId ?? ""}
                        onChange={(event) => {
                          setSessionEdits((current) => ({
                            ...current,
                            [focusedSession.sessionId]: {
                              ...current[focusedSession.sessionId],
                              projectId: event.target.value,
                            },
                          }));
                        }}
                      >
                        <option value="">未挂接项目</option>
                        {bootstrap.projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>挂接角色</span>
                      <select
                        value={sessionEdits[focusedSession.sessionId]?.personaId ?? focusedSession.personaId ?? ""}
                        onChange={(event) => {
                          setSessionEdits((current) => ({
                            ...current,
                            [focusedSession.sessionId]: {
                              ...current[focusedSession.sessionId],
                              personaId: event.target.value,
                            },
                          }));
                        }}
                      >
                        <option value="">未挂接角色</option>
                        {bootstrap.personas.map((persona) => (
                          <option key={persona.id} value={persona.id}>
                            {persona.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="wide">
                      <span>备注</span>
                      <input
                        placeholder="例如：已完成 Slack socket mode 字段设计，待真实 token 联调"
                        value={sessionEdits[focusedSession.sessionId]?.notes ?? focusedSession.notes ?? ""}
                        onChange={(event) =>
                          setSessionEdits((current) => ({
                            ...current,
                            [focusedSession.sessionId]: {
                              ...current[focusedSession.sessionId],
                              notes: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                  </div>
                  <div className="editor-actions">
                    {hasFocusedSessionChanges ? (
                      <button data-testid="session-save" onClick={() => void handleLinkSession(focusedSession)}>
                        保存归属
                      </button>
                    ) : (
                      <span className="hint">修改项目、角色或备注后才会出现保存动作。</span>
                    )}
                    <Pill tone={focusedSession.archived ? "warn" : "good"}>{focusedSession.archived ? "archived" : "active"}</Pill>
                  </div>
                </>
              ) : (
                <div className="empty-state">当前没有匹配的会话记录。</div>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "knowledge" ? (
          <section className="content-grid">
            <div className="panel">
              <SectionHeader eyebrow="Knowledge Base" title="知识库列表" detail="term_1 以 Qdrant collection 与项目映射为主，保证知识源可见、可绑定、可审计。" />
              <div className="list-stack">
                {bootstrap.knowledgeBases.map((kb) => (
                  <label
                    key={kb.id}
                    className={knowledgeDraft.id === kb.id ? "selection-card active" : "selection-card"}
                    data-testid={`knowledge-card-${kb.id}`}
                  >
                    <input type="radio" name="selected-knowledge-base" checked={knowledgeDraft.id === kb.id} onChange={() => setKnowledgeDraft(kb)} />
                    <div>
                      <strong>{kb.name}</strong>
                      <span>{kb.url}</span>
                      <small>{kb.collectionName || "未指定 collection"}</small>
                    </div>
                  </label>
                ))}
                <button className="ghost-button" data-testid="knowledge-new" onClick={() => setKnowledgeDraft(blankKnowledgeBase())}>
                  新建知识库
                </button>
              </div>
            </div>

            <div className="panel editor-panel">
              <SectionHeader eyebrow="Editor" title="知识库编辑器" detail="当前同时显示 Qdrant 实时状态，便于区分“配置已保存”和“服务实际可达”两件事。" />
              <div className="form-grid">
                <label>
                  <span>名称</span>
                  <input value={knowledgeDraft.name} onChange={(event) => setKnowledgeDraft({ ...knowledgeDraft, name: event.target.value })} />
                </label>
                <label>
                  <span>Qdrant URL</span>
                  <input value={knowledgeDraft.url} onChange={(event) => setKnowledgeDraft({ ...knowledgeDraft, url: event.target.value })} />
                </label>
                <label>
                  <span>Collection</span>
                  <input
                    value={knowledgeDraft.collectionName}
                    onChange={(event) => setKnowledgeDraft({ ...knowledgeDraft, collectionName: event.target.value })}
                  />
                </label>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={knowledgeDraft.readOnly}
                    onChange={(event) => setKnowledgeDraft({ ...knowledgeDraft, readOnly: event.target.checked })}
                  />
                  <span>只读</span>
                </label>
                <label className="wide">
                  <span>描述</span>
                  <textarea value={knowledgeDraft.description} onChange={(event) => setKnowledgeDraft({ ...knowledgeDraft, description: event.target.value })} />
                </label>
              </div>
              <div className="editor-actions">
                {knowledgeDraftCanSave ? (
                  <button data-testid="knowledge-save" onClick={() => void handleSaveKnowledgeBase()}>
                    保存知识库
                  </button>
                ) : (
                  <span className="hint">先修改名称、collection、URL 或用途说明，再保存知识库。没有实际改动时不会重复暴露保存动作。</span>
                )}
                <Pill tone={bootstrap.qdrant.reachable ? "good" : "warn"}>
                  {bootstrap.qdrant.reachable ? "Qdrant Reachable" : bootstrap.qdrant.error || "Qdrant Unreachable"}
                </Pill>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "projects" ? (
          <section className="content-grid">
            <div className="panel">
              <SectionHeader eyebrow="Project Control" title="项目清单" detail="项目是角色、知识库、会话和 cron-loop 的归属容器，也是总经理的主要调度边界。" />
              <div className="list-stack">
                {bootstrap.projects.map((project) => (
                  <label
                    key={project.id}
                    className={selectedProjectId === project.id ? "selection-card active" : "selection-card"}
                    data-testid={`project-card-${project.id}`}
                  >
                    <input
                      type="radio"
                      name="selected-project"
                      checked={selectedProjectId === project.id}
                      onChange={() => setSelectedProjectId(project.id)}
                    />
                    <div>
                      <strong>{project.name}</strong>
                      <span>{project.path}</span>
                      <small>Manager: {bootstrap.personas.find((item) => item.id === project.managerPersonaId)?.name || "未设置"}</small>
                    </div>
                  </label>
                ))}
                <button className="ghost-button" data-testid="project-new" onClick={() => setProjectDraft(blankProject())}>
                  新建项目
                </button>
              </div>
            </div>

            <div className="panel editor-panel">
              <SectionHeader eyebrow="Editor" title="项目编辑器" detail="term_1 可以给项目指定经理角色、参与角色、知识库权限和项目级工具清单。" />
              <div className="form-grid">
                <label>
                  <span>名称</span>
                  <input value={projectDraft.name} onChange={(event) => setProjectDraft({ ...projectDraft, name: event.target.value })} />
                </label>
                <label className="wide">
                  <span>路径</span>
                  <input value={projectDraft.path} onChange={(event) => setProjectDraft({ ...projectDraft, path: event.target.value })} />
                </label>
                <label>
                  <span>经理角色</span>
                  <select
                    value={projectDraft.managerPersonaId}
                    onChange={(event) => setProjectDraft({ ...projectDraft, managerPersonaId: event.target.value })}
                  >
                    <option value="">请选择</option>
                    {bootstrap.personas.map((persona) => (
                      <option key={persona.id} value={persona.id}>
                        {persona.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="wide">
                  <span>参与角色</span>
                  <div className="chip-grid">
                    {bootstrap.personas.map((persona) => (
                      <label
                        key={persona.id}
                        className={projectDraft.participantPersonaIds.includes(persona.id) ? "choice-chip active" : "choice-chip"}
                        data-testid={`project-participant-${persona.id}`}
                      >
                        <input
                          type="checkbox"
                          checked={projectDraft.participantPersonaIds.includes(persona.id)}
                          onChange={() =>
                            setProjectDraft({
                              ...projectDraft,
                              participantPersonaIds: toggleValue(projectDraft.participantPersonaIds, persona.id),
                            })
                          }
                        />
                        <span>{persona.name}</span>
                      </label>
                    ))}
                  </div>
                </label>
                <label className="wide">
                  <span>可读知识库</span>
                  <div className="chip-grid">
                    {bootstrap.knowledgeBases.map((kb) => (
                      <label
                        key={kb.id}
                        className={projectDraft.knowledgeBaseIds.includes(kb.id) ? "choice-chip active" : "choice-chip"}
                        data-testid={`project-readable-kb-${kb.id}`}
                      >
                        <input
                          type="checkbox"
                          checked={projectDraft.knowledgeBaseIds.includes(kb.id)}
                          onChange={() => setProjectDraft({ ...projectDraft, knowledgeBaseIds: toggleValue(projectDraft.knowledgeBaseIds, kb.id) })}
                        />
                        <span>{kb.name}</span>
                      </label>
                    ))}
                  </div>
                </label>
                <label className="wide">
                  <span>可写知识库</span>
                  <div className="chip-grid">
                    {bootstrap.knowledgeBases.map((kb) => (
                      <label
                        key={kb.id}
                        className={projectDraft.writableKnowledgeBaseIds.includes(kb.id) ? "choice-chip active" : "choice-chip"}
                        data-testid={`project-writable-kb-${kb.id}`}
                      >
                        <input
                          type="checkbox"
                          checked={projectDraft.writableKnowledgeBaseIds.includes(kb.id)}
                          onChange={() =>
                            setProjectDraft({
                              ...projectDraft,
                              writableKnowledgeBaseIds: toggleValue(projectDraft.writableKnowledgeBaseIds, kb.id),
                            })
                          }
                        />
                        <span>{kb.name}</span>
                      </label>
                    ))}
                  </div>
                </label>
                <div className="wide">
                  <span>渠道绑定</span>
                  <div className="chip-grid">
                    {bootstrap.channels.map((channel) => (
                      <label
                        key={channel.id}
                        className={projectDraft.channelBindings.some((binding) => binding.channelId === channel.id) ? "choice-chip active" : "choice-chip"}
                        data-testid={`project-channel-${channel.id}`}
                      >
                        <input
                          type="checkbox"
                          checked={projectDraft.channelBindings.some((binding) => binding.channelId === channel.id)}
                          onChange={() =>
                            setProjectDraft({
                              ...projectDraft,
                              channelBindings: toggleChannelBinding(projectDraft.channelBindings, channel.id),
                            })
                          }
                        />
                        <span>{channel.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {projectDraft.channelBindings.map((binding) => {
                  const channel = bootstrap.channels.find((item) => item.id === binding.channelId);
                  return (
                    <div key={binding.channelId} className="wide">
                      <span>{channel?.name || binding.channelId}</span>
                      <div className="form-grid">
                        <label>
                          <span>目标房间 / 频道</span>
                          <input
                            value={binding.room}
                            onChange={(event) =>
                              setProjectDraft({
                                ...projectDraft,
                                channelBindings: updateChannelBinding(projectDraft.channelBindings, binding.channelId, {
                                  room: event.target.value,
                                }),
                              })
                            }
                            placeholder={channel?.type === "slack" ? "#ops-room" : "-1001234567890"}
                          />
                        </label>
                        <label>
                          <span>项目别名</span>
                          <input
                            value={binding.alias}
                            onChange={(event) =>
                              setProjectDraft({
                                ...projectDraft,
                                channelBindings: updateChannelBinding(projectDraft.channelBindings, binding.channelId, {
                                  alias: event.target.value,
                                }),
                              })
                            }
                            placeholder="例如：主项目群"
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="editor-actions">
                {projectDraftCanSave ? (
                  <button data-testid="project-save" onClick={() => void handleSaveProject()}>
                    保存项目
                  </button>
                ) : (
                  <span className="hint">先补齐真实路径、经理角色或绑定关系，再保存项目。没有实际改动时不会把保存按钮当成“再点一次也行”的伪动作。</span>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "cron" ? (
          <section className="content-grid">
            <div className="panel wide">
              <SectionHeader eyebrow="Cron Control" title="cron-loop singleton loop" detail="直接读取项目内平铺 .cron-loop 文件，并通过 cron-loop 官方 manage_cron.mjs 执行动作。" />
              <div className="toolbar">
                <label>
                  <span>项目</span>
                  <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
                    {bootstrap.projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="list-stack">
                {currentCronJobs.length ? (
                  currentCronJobs.map((job) => (
                    <article key={job.id} className="cron-card">
                      <div>
                        <strong>{job.job}</strong>
                        <span>{job.schedule || "schedule unknown"}</span>
                        <small>{job.latestMessage || "暂无 latest.md 摘要"}</small>
                      </div>
                      <div className="cron-actions">
                        <Pill tone={job.status === "active" ? "good" : "neutral"}>{job.status}</Pill>
                        <button data-testid={`cron-${job.job}-validate`} onClick={() => void handleCronAction(job, "validate")}>validate</button>
                        <button data-testid={`cron-${job.job}-stop`} onClick={() => void handleCronAction(job, "stop")}>stop</button>
                        <button data-testid={`cron-${job.job}-start`} onClick={() => void handleCronAction(job, "start")}>start</button>
                        <button data-testid={`cron-${job.job}-destroy`} onClick={() => void handleCronAction(job, "destroy")}>destroy</button>
                        <button data-testid={`cron-${job.job}-paths`} onClick={() => void handleCronAction(job, "paths")}>paths</button>
                      </div>
                    </article>
                  ))
                ) : (
                  <article className="guide-panel warn">
                    <span>Cron Quickstart</span>
                    <h3>当前项目还没有可管理的 `.cron-loop` singleton loop</h3>
                    <p>要让“持续推进”变成真实能力，至少需要一个带 prompt、runner、state、latest 和 ledger 的 singleton loop。</p>
                    <ul className="guide-list">
                      <li>先在项目根目录建立 `.cron-loop/` 平铺文件。</li>
                      <li>优先安装一个能持续改进 CCEO 的 singleton loop，而不是只写报告的占位任务。</li>
                      <li>安装后回到本页，应能看到 schedule、latest.md 和 start/stop 控制。</li>
                    </ul>
                  </article>
                )}
              </div>
            </div>
            <div className="panel">
              <SectionHeader eyebrow="Action Output" title="动作解读" detail="先给人类可读结论，再保留原始命令输出，便于确认 cron-loop 兼容性与当前状态。" />
              <CronActionDetails result={cronActionResult} />
            </div>
          </section>
        ) : null}

        {activeTab === "channels" ? (
          <section className="content-grid">
            <div className="panel">
              <SectionHeader eyebrow="Channel Bridge" title="渠道清单" detail="这里统一管理 Slack / Telegram 渠道；Slack 已支持 socket mode 常驻接入、消息回流和连接状态管理。" />
              <div className="list-stack">
                {bootstrap.channels.map((channel) => (
                  <label
                    key={channel.id}
                    className={selectedChannelId === channel.id ? "selection-card active" : "selection-card"}
                    data-testid={`channel-card-${channel.id}`}
                  >
                    <input
                      type="radio"
                      name="selected-channel"
                      checked={selectedChannelId === channel.id}
                      onChange={() => setSelectedChannelId(channel.id)}
                    />
                    <div>
                      <strong>{channel.name}</strong>
                      <span>{channel.type}</span>
                      <small>
                        {channel.runtime.lastConnectionSummary ||
                          channel.runtime.lastDeliverySummary ||
                          channel.runtime.lastValidationSummary ||
                          channel.notes ||
                          "无备注"}
                      </small>
                      <div className="inline-pills">
                        <Pill tone={channel.enabled ? "good" : "warn"}>{channel.enabled ? "enabled" : "disabled"}</Pill>
                        <Pill>{channel.status}</Pill>
                        {channel.type === "slack" ? <Pill>{channel.runtime.connectionState || "disconnected"}</Pill> : null}
                      </div>
                    </div>
                  </label>
                ))}
                <button
                  className="ghost-button"
                  data-testid="channel-new"
                  onClick={() => {
                    setSelectedChannelId("");
                    setChannelDraft(blankChannel());
                  }}
                >
                  新建渠道
                </button>
              </div>
            </div>

            <div className="panel editor-panel">
              <SectionHeader eyebrow="Editor" title="渠道编辑器" detail="Slack 现在支持 socket mode 常驻接入；保存后可校验、connect/disconnect，并把 Slack 消息回流到总经理线程。" />
              <div className="form-grid">
                <label>
                  <span>名称</span>
                  <input value={channelDraft.name} onChange={(event) => setChannelDraft({ ...channelDraft, name: event.target.value })} />
                </label>
                <label>
                  <span>类型</span>
                  <select value={channelDraft.type} onChange={(event) => setChannelDraft({ ...channelDraft, type: event.target.value as ChannelDefinition["type"] })}>
                    <option value="slack">slack</option>
                    <option value="telegram">telegram</option>
                  </select>
                </label>
                <label>
                  <span>状态</span>
                  <select
                    value={channelDraft.status}
                    onChange={(event) => setChannelDraft({ ...channelDraft, status: event.target.value as ChannelDefinition["status"] })}
                  >
                    <option value="unconfigured">unconfigured</option>
                    <option value="configured">configured</option>
                    <option value="error">error</option>
                  </select>
                </label>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={channelDraft.enabled}
                    onChange={(event) => setChannelDraft({ ...channelDraft, enabled: event.target.checked })}
                  />
                  <span>启用渠道</span>
                </label>
                <label className="wide">
                  <span>渠道身份</span>
                  <input value={channelDraft.identity} onChange={(event) => setChannelDraft({ ...channelDraft, identity: event.target.value })} />
                </label>
                <label className="wide">
                  <span>备注</span>
                  <textarea value={channelDraft.notes} onChange={(event) => setChannelDraft({ ...channelDraft, notes: event.target.value })} />
                </label>
                {channelDraft.type === "slack" ? (
                  <>
                    <label>
                      <span>Slack Mode</span>
                      <select
                        value={channelDraft.config.slackMode}
                        onChange={(event) =>
                          setChannelDraft({
                            ...channelDraft,
                            config: {
                              ...channelDraft.config,
                              slackMode: event.target.value as ChannelDefinition["config"]["slackMode"],
                            },
                          })
                        }
                      >
                        <option value="socket">socket</option>
                        <option value="webhook">webhook</option>
                        <option value="http">http</option>
                      </select>
                    </label>
                    <label>
                      <span>默认项目</span>
                      <select
                        value={channelDraft.config.slackDefaultProjectId}
                        onChange={(event) =>
                          setChannelDraft({
                            ...channelDraft,
                            config: { ...channelDraft.config, slackDefaultProjectId: event.target.value },
                          })
                        }
                      >
                        <option value="">首个项目兜底</option>
                        {bootstrap.projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="wide">
                      <span>默认 Slack Target</span>
                      <input
                        value={channelDraft.config.slackChannel}
                        onChange={(event) =>
                          setChannelDraft({
                            ...channelDraft,
                            config: { ...channelDraft.config, slackChannel: event.target.value },
                          })
                        }
                        placeholder="C0123456789 / D0123456789 / #ops-room"
                      />
                    </label>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={channelDraft.config.slackRequireMention}
                        onChange={(event) =>
                          setChannelDraft({
                            ...channelDraft,
                            config: { ...channelDraft.config, slackRequireMention: event.target.checked },
                          })
                        }
                      />
                      <span>频道消息要求 @bot</span>
                    </label>
                    {channelDraft.config.slackMode === "socket" ? (
                      <>
                        <label className="wide">
                          <span>Slack Bot Token</span>
                          <input
                            type="password"
                            value={channelDraft.config.slackBotToken}
                            onChange={(event) =>
                              setChannelDraft({
                                ...channelDraft,
                                config: { ...channelDraft.config, slackBotToken: event.target.value },
                              })
                            }
                            placeholder="xoxb-..."
                          />
                        </label>
                        <label className="wide">
                          <span>Slack App Token</span>
                          <input
                            type="password"
                            value={channelDraft.config.slackAppToken}
                            onChange={(event) =>
                              setChannelDraft({
                                ...channelDraft,
                                config: { ...channelDraft.config, slackAppToken: event.target.value },
                              })
                            }
                            placeholder="xapp-..."
                          />
                        </label>
                      </>
                    ) : null}
                    {channelDraft.config.slackMode === "http" ? (
                      <>
                        <label className="wide">
                          <span>Slack Bot Token</span>
                          <input
                            type="password"
                            value={channelDraft.config.slackBotToken}
                            onChange={(event) =>
                              setChannelDraft({
                                ...channelDraft,
                                config: { ...channelDraft.config, slackBotToken: event.target.value },
                              })
                            }
                            placeholder="xoxb-..."
                          />
                        </label>
                        <label className="wide">
                          <span>Slack Signing Secret</span>
                          <input
                            type="password"
                            value={channelDraft.config.slackSigningSecret}
                            onChange={(event) =>
                              setChannelDraft({
                                ...channelDraft,
                                config: { ...channelDraft.config, slackSigningSecret: event.target.value },
                              })
                            }
                            placeholder="signing secret"
                          />
                        </label>
                        <label className="wide">
                          <span>Slack Webhook Path</span>
                          <input
                            value={channelDraft.config.slackWebhookPath}
                            onChange={(event) =>
                              setChannelDraft({
                                ...channelDraft,
                                config: { ...channelDraft.config, slackWebhookPath: event.target.value },
                              })
                            }
                            placeholder="/slack/events"
                          />
                        </label>
                      </>
                    ) : null}
                    {channelDraft.config.slackMode === "webhook" ? (
                      <label className="wide">
                        <span>Slack Webhook URL</span>
                        <input
                          type="password"
                          value={channelDraft.config.slackWebhookUrl}
                          onChange={(event) =>
                            setChannelDraft({
                              ...channelDraft,
                              config: { ...channelDraft.config, slackWebhookUrl: event.target.value },
                            })
                          }
                          placeholder="https://hooks.slack.com/services/..."
                        />
                      </label>
                    ) : null}
                  </>
                ) : (
                  <>
                    <label className="wide">
                      <span>Telegram Bot Token</span>
                      <input
                        type="password"
                        value={channelDraft.config.telegramBotToken}
                        onChange={(event) =>
                          setChannelDraft({
                            ...channelDraft,
                            config: { ...channelDraft.config, telegramBotToken: event.target.value },
                          })
                        }
                        placeholder="123456:ABC..."
                      />
                    </label>
                    <label>
                      <span>Telegram Chat ID</span>
                      <input
                        value={channelDraft.config.telegramChatId}
                        onChange={(event) =>
                          setChannelDraft({
                            ...channelDraft,
                            config: { ...channelDraft.config, telegramChatId: event.target.value },
                          })
                        }
                        placeholder="-1001234567890"
                      />
                    </label>
                    <label className="wide">
                      <span>Telegram API Base</span>
                      <input
                        value={channelDraft.config.telegramApiBaseUrl}
                        onChange={(event) =>
                          setChannelDraft({
                            ...channelDraft,
                            config: { ...channelDraft.config, telegramApiBaseUrl: event.target.value },
                          })
                        }
                        placeholder="https://api.telegram.org"
                      />
                    </label>
                  </>
                )}
                <label className="wide">
                  <span>测试消息</span>
                  <textarea value={channelTestMessage} onChange={(event) => setChannelTestMessage(event.target.value)} />
                </label>
              </div>
              <ChannelSetupGuide channel={channelDraft} />
              <div className="editor-actions">
                {channelDraftCanSave ? (
                  <button data-testid="channel-save" onClick={() => void handleSaveChannel()}>
                    保存渠道
                  </button>
                ) : (
                  <span className="hint">先补齐名称、目标或凭证中的任一真实字段，再保存渠道；既有渠道只有在你真的改动后才会重新出现保存动作。</span>
                )}
                {hasSavedChannel ? (
                  <>
                    <button data-testid="channel-validate" onClick={() => void handleValidateCurrentChannel()}>
                      校验配置
                    </button>
                    <button data-testid="channel-dry-run" onClick={() => void handleTestCurrentChannel("dry-run")}>
                      Dry Run
                    </button>
                    <button data-testid="channel-live-test" onClick={() => void handleTestCurrentChannel("live")}>
                      真实发送测试
                    </button>
                    {channelDraft.type === "slack" ? (
                      <button data-testid="channel-connect-slack" onClick={() => void handleConnectCurrentChannel()}>
                        Connect Slack
                      </button>
                    ) : null}
                    {channelDraft.type === "slack" ? (
                      <button data-testid="channel-disconnect-slack" onClick={() => void handleDisconnectCurrentChannel()}>
                        Disconnect Slack
                      </button>
                    ) : null}
                  </>
                ) : (
                  <span className="hint">渠道先保存成真实记录，下面才会出现校验、Dry Run、真实发送和 Slack 连接动作。</span>
                )}
              </div>
              {channelActionError ? <p className="error-text">{channelActionError}</p> : null}
              <div className="list-stack">
                <article className="list-card">
                  <strong>最近一次运行态</strong>
                  <span>
                    {channelDraft.runtime.lastConnectionSummary ||
                      channelDraft.runtime.lastDeliverySummary ||
                      channelDraft.runtime.lastValidationSummary ||
                      "暂无记录"}
                  </span>
                  <small>
                    连接：{channelDraft.runtime.connectionState || "未建立"}；校验：{formatDateTime(channelDraft.runtime.lastValidatedAt)}；投递：
                    {formatDateTime(channelDraft.runtime.lastDeliveryAt)}
                  </small>
                  {channelDraft.type === "slack" ? (
                    <small>
                      回流：{formatDateTime(channelDraft.runtime.lastInboundAt, "未收到")}；路由项目：{channelDraft.runtime.lastRoutedProjectId || "未命中"}；线程：
                      {channelDraft.runtime.lastThreadId || "暂无"}
                    </small>
                  ) : null}
                </article>
                {channelActionReport ? <ChannelActionDetails report={channelActionReport} /> : null}
                {channelDraft.type === "slack" ? (
                  <article className="list-card">
                    <strong>Slack 路由提示</strong>
                    <span>频道消息优先按项目里的 `channelBindings.room` 命中；DM 和未命中绑定的消息回落到默认项目或首个项目。</span>
                    <small>
                      频道内默认要求 `@bot` 才触发；关闭“频道消息要求 @bot”后，机器人所在频道的普通消息也会被转给总经理。
                    </small>
                  </article>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default App;
