import { startTransition, useEffect, useMemo, useState } from "react";
import {
  getBootstrap,
  getRun,
  linkSession,
  runCronAction,
  saveChannel,
  saveKnowledgeBase,
  savePersona,
  saveProject,
  sendManagerPrompt,
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

type TabKey = "dashboard" | "manager" | "personas" | "sessions" | "knowledge" | "projects" | "cron" | "channels";

function blankPersona(): PersonaDefinition {
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

function blankProject(): ProjectDefinition {
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

function blankKnowledgeBase(): KnowledgeBaseDefinition {
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

function blankChannel(): ChannelDefinition {
  const now = new Date().toISOString();
  return {
    id: "",
    type: "slack",
    name: "新渠道",
    enabled: false,
    status: "unconfigured",
    identity: "总经理",
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function SectionHeader(props: { eyebrow: string; title: string; detail: string }) {
  return (
    <header className="section-header">
      <span>{props.eyebrow}</span>
      <h2>{props.title}</h2>
      <p>{props.detail}</p>
    </header>
  );
}

function Pill(props: { children: string; tone?: "good" | "warn" | "neutral" }) {
  return <span className={`pill ${props.tone ?? "neutral"}`}>{props.children}</span>;
}

function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [busyLabel, setBusyLabel] = useState("");
  const [selectedPersonaId, setSelectedPersonaId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [personaDraft, setPersonaDraft] = useState<PersonaDefinition>(blankPersona());
  const [projectDraft, setProjectDraft] = useState<ProjectDefinition>(blankProject());
  const [knowledgeDraft, setKnowledgeDraft] = useState<KnowledgeBaseDefinition>(blankKnowledgeBase());
  const [channelDraft, setChannelDraft] = useState<ChannelDefinition>(blankChannel());
  const [chatPrompt, setChatPrompt] = useState("");
  const [activeRun, setActiveRun] = useState<ManagerRun | null>(null);
  const [runError, setRunError] = useState("");
  const [cronOutput, setCronOutput] = useState("");
  const [sessionEdits, setSessionEdits] = useState<Record<string, { projectId?: string; personaId?: string; notes?: string }>>({});

  const load = async () => {
    const payload = await getBootstrap();
    setBootstrap(payload);
    setSelectedPersonaId((current) => current || payload.personas[0]?.id || "");
    setSelectedProjectId((current) => current || payload.projects[0]?.id || "");
    setSelectedChannelId((current) => current || payload.channels[0]?.id || "");
  };

  useEffect(() => {
    void load();
  }, []);

  const selectedPersona = useMemo(
    () => bootstrap?.personas.find((item) => item.id === selectedPersonaId) ?? bootstrap?.personas[0] ?? null,
    [bootstrap, selectedPersonaId],
  );
  const selectedProject = useMemo(
    () => bootstrap?.projects.find((item) => item.id === selectedProjectId) ?? bootstrap?.projects[0] ?? null,
    [bootstrap, selectedProjectId],
  );
  const thread = bootstrap?.managerThreads[0];
  const currentCronJobs: CronJobSummary[] =
    (selectedProjectId && bootstrap?.cronJobs[selectedProjectId]) || (selectedProject?.id ? bootstrap?.cronJobs[selectedProject.id] : []) || [];

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

  const totalCronJobs = Object.values(bootstrap?.cronJobs ?? {}).flat().length;

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
      await savePersona(payload, payload.id || undefined);
    });
  }

  async function handleSaveProject() {
    await refreshWithLabel("正在保存项目...", async () => {
      const payload = { ...projectDraft };
      await saveProject(payload, payload.id || undefined);
    });
  }

  async function handleSaveKnowledgeBase() {
    await refreshWithLabel("正在保存知识库...", async () => {
      const payload = { ...knowledgeDraft };
      await saveKnowledgeBase(payload, payload.id || undefined);
    });
  }

  async function handleSaveChannel() {
    await refreshWithLabel("正在保存渠道...", async () => {
      const payload = { ...channelDraft };
      await saveChannel(payload, payload.id || undefined);
    });
  }

  async function handleSendPrompt() {
    if (!chatPrompt.trim()) {
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

  async function handleCronAction(job: CronJobSummary, action: "pause" | "resume" | "validate" | "paths" | "uninstall") {
    setBusyLabel(`正在执行 ${action}...`);
    try {
      const result = await runCronAction(job.projectId, job.job, action);
      setCronOutput(result.output || `${action} completed`);
      await load();
    } catch (error) {
      setCronOutput(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyLabel("");
    }
  }

  if (!bootstrap) {
    return <div className="loading-shell">正在加载 Codex Governor...</div>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-kicker">OpenClaw Mode</div>
          <h1>Codex Governor</h1>
          <p>把本机 Codex 项目、人格、会话、知识库和 cron-loop 拉到同一张管理桌上。</p>
        </div>
        <nav className="nav-stack">
          {[
            ["dashboard", "总览"],
            ["manager", "总经理"],
            ["personas", "角色"],
            ["sessions", "会话"],
            ["knowledge", "知识库"],
            ["projects", "项目"],
            ["cron", "Cron"],
            ["channels", "渠道"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={activeTab === key ? "nav-link active" : "nav-link"}
              onClick={() => setActiveTab(key as TabKey)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <Pill tone={bootstrap.qdrant.reachable ? "good" : "warn"}>
            {bootstrap.qdrant.reachable ? "Qdrant Online" : "Qdrant Offline"}
          </Pill>
          <Pill>{bootstrap.discovery.cliVersion || "codex unknown"}</Pill>
        </div>
      </aside>

      <main className="main-panel">
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

        {activeTab === "dashboard" ? (
          <section className="content-grid">
            <div className="panel wide">
              <SectionHeader eyebrow="Governor Status" title="系统概况" detail="直接读取本机 Codex、Qdrant 和已注册项目，避免造一个脱离真实运行面的假后台。" />
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
                {(thread?.messages ?? []).slice(-14).map((message) => (
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
                />
                <div className="composer-bar">
                  <span className="hint">当前角色：{selectedPersona?.name}；当前项目：{selectedProject?.name}</span>
                  <button onClick={() => void handleSendPrompt()}>发送给总经理</button>
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
                  <button key={persona.id} className="list-card selectable" onClick={() => setSelectedPersonaId(persona.id)}>
                    <strong>{persona.name}</strong>
                    <span>{persona.description || "无描述"}</span>
                    <small>{persona.scope} · {persona.model}</small>
                  </button>
                ))}
                <button className="ghost-button" onClick={() => setPersonaDraft(blankPersona())}>
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
                      <button
                        key={skill.name}
                        className={personaDraft.skills.includes(skill.name) ? "chip active" : "chip"}
                        onClick={() => setPersonaDraft({ ...personaDraft, skills: toggleValue(personaDraft.skills, skill.name) })}
                        type="button"
                      >
                        {skill.name}
                      </button>
                    ))}
                  </div>
                </label>
                <label className="wide">
                  <span>MCP</span>
                  <div className="chip-grid">
                    {bootstrap.discovery.mcpServers.map((mcp) => (
                      <button
                        key={mcp.id}
                        className={personaDraft.mcpServers.includes(mcp.id) ? "chip active" : "chip"}
                        onClick={() => setPersonaDraft({ ...personaDraft, mcpServers: toggleValue(personaDraft.mcpServers, mcp.id) })}
                        type="button"
                      >
                        {mcp.id}
                      </button>
                    ))}
                  </div>
                </label>
              </div>
              <div className="editor-actions">
                <button onClick={() => void handleSavePersona()}>保存角色</button>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "sessions" ? (
          <section className="panel">
            <SectionHeader eyebrow="Session Memory" title="会话与记忆索引" detail="直接读取 ~/.codex/sessions 和 archived_sessions，并允许把会话挂接到项目与角色。" />
            <div className="session-table">
              {bootstrap.sessions.map((session) => (
                <article key={session.sessionId} className="session-row">
                  <div>
                    <strong>{session.sessionId}</strong>
                    <span>{session.cwd || "unknown cwd"}</span>
                    <small>{session.archived ? "archived" : "active"} · {new Date(session.lastUpdatedAt).toLocaleString()}</small>
                  </div>
                  <div className="session-controls">
                    <select
                      value={sessionEdits[session.sessionId]?.projectId ?? session.projectId ?? ""}
                      onChange={(event) => {
                        setSessionEdits((current) => ({
                          ...current,
                          [session.sessionId]: {
                            ...current[session.sessionId],
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
                    <select
                      value={sessionEdits[session.sessionId]?.personaId ?? session.personaId ?? ""}
                      onChange={(event) => {
                        setSessionEdits((current) => ({
                          ...current,
                          [session.sessionId]: {
                            ...current[session.sessionId],
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
                    <input
                      placeholder="备注"
                      value={sessionEdits[session.sessionId]?.notes ?? session.notes ?? ""}
                      onChange={(event) =>
                        setSessionEdits((current) => ({
                          ...current,
                          [session.sessionId]: {
                            ...current[session.sessionId],
                            notes: event.target.value,
                          },
                        }))
                      }
                    />
                    <button onClick={() => void handleLinkSession(session)}>保存</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === "knowledge" ? (
          <section className="content-grid">
            <div className="panel">
              <SectionHeader eyebrow="Knowledge Base" title="知识库列表" detail="term_1 以 Qdrant collection 与项目映射为主，保证知识源可见、可绑定、可审计。" />
              <div className="list-stack">
                {bootstrap.knowledgeBases.map((kb) => (
                  <button key={kb.id} className="list-card selectable" onClick={() => setKnowledgeDraft(kb)}>
                    <strong>{kb.name}</strong>
                    <span>{kb.url}</span>
                    <small>{kb.collectionName || "未指定 collection"}</small>
                  </button>
                ))}
                <button className="ghost-button" onClick={() => setKnowledgeDraft(blankKnowledgeBase())}>
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
                <button onClick={() => void handleSaveKnowledgeBase()}>保存知识库</button>
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
              <SectionHeader eyebrow="Project Governor" title="项目清单" detail="项目是角色、知识库、会话和 cron-loop 的归属容器，也是总经理的主要调度边界。" />
              <div className="list-stack">
                {bootstrap.projects.map((project) => (
                  <button key={project.id} className="list-card selectable" onClick={() => setSelectedProjectId(project.id)}>
                    <strong>{project.name}</strong>
                    <span>{project.path}</span>
                    <small>Manager: {bootstrap.personas.find((item) => item.id === project.managerPersonaId)?.name || "未设置"}</small>
                  </button>
                ))}
                <button className="ghost-button" onClick={() => setProjectDraft(blankProject())}>
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
                      <button
                        key={persona.id}
                        type="button"
                        className={projectDraft.participantPersonaIds.includes(persona.id) ? "chip active" : "chip"}
                        onClick={() =>
                          setProjectDraft({
                            ...projectDraft,
                            participantPersonaIds: toggleValue(projectDraft.participantPersonaIds, persona.id),
                          })
                        }
                      >
                        {persona.name}
                      </button>
                    ))}
                  </div>
                </label>
                <label className="wide">
                  <span>可读知识库</span>
                  <div className="chip-grid">
                    {bootstrap.knowledgeBases.map((kb) => (
                      <button
                        key={kb.id}
                        type="button"
                        className={projectDraft.knowledgeBaseIds.includes(kb.id) ? "chip active" : "chip"}
                        onClick={() => setProjectDraft({ ...projectDraft, knowledgeBaseIds: toggleValue(projectDraft.knowledgeBaseIds, kb.id) })}
                      >
                        {kb.name}
                      </button>
                    ))}
                  </div>
                </label>
                <label className="wide">
                  <span>可写知识库</span>
                  <div className="chip-grid">
                    {bootstrap.knowledgeBases.map((kb) => (
                      <button
                        key={kb.id}
                        type="button"
                        className={projectDraft.writableKnowledgeBaseIds.includes(kb.id) ? "chip active" : "chip"}
                        onClick={() =>
                          setProjectDraft({
                            ...projectDraft,
                            writableKnowledgeBaseIds: toggleValue(projectDraft.writableKnowledgeBaseIds, kb.id),
                          })
                        }
                      >
                        {kb.name}
                      </button>
                    ))}
                  </div>
                </label>
              </div>
              <div className="editor-actions">
                <button onClick={() => void handleSaveProject()}>保存项目</button>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "cron" ? (
          <section className="content-grid">
            <div className="panel wide">
              <SectionHeader eyebrow="Cron Loop Governor" title="cron-loop 任务" detail="直接读取项目内平铺 .cron-loop 文件，并通过 cron-loop 官方 manage_cron.py 执行动作。" />
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
                        <button onClick={() => void handleCronAction(job, "validate")}>validate</button>
                        <button onClick={() => void handleCronAction(job, "pause")}>pause</button>
                        <button onClick={() => void handleCronAction(job, "resume")}>resume</button>
                        <button onClick={() => void handleCronAction(job, "paths")}>paths</button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty-state">当前项目未发现 .cron-loop 任务。</div>
                )}
              </div>
            </div>
            <div className="panel">
              <SectionHeader eyebrow="Action Output" title="动作回显" detail="用于显示 pause / resume / validate / paths 的原始命令输出，便于核对 cron-loop 兼容性。" />
              <pre className="output-box">{cronOutput || "尚未执行动作。"}</pre>
            </div>
          </section>
        ) : null}

        {activeTab === "channels" ? (
          <section className="content-grid">
            <div className="panel">
              <SectionHeader eyebrow="Channel Bridge" title="渠道清单" detail="term_1 先把 Slack / Telegram 纳入统一对象模型并允许前端编辑，真实投递与回流放到 term_2。" />
              <div className="list-stack">
                {bootstrap.channels.map((channel) => (
                  <button key={channel.id} className="list-card selectable" onClick={() => setSelectedChannelId(channel.id)}>
                    <strong>{channel.name}</strong>
                    <span>{channel.type}</span>
                    <small>{channel.notes || "无备注"}</small>
                    <div className="inline-pills">
                      <Pill tone={channel.enabled ? "good" : "warn"}>{channel.enabled ? "enabled" : "disabled"}</Pill>
                      <Pill>{channel.status}</Pill>
                    </div>
                  </button>
                ))}
                <button className="ghost-button" onClick={() => setChannelDraft(blankChannel())}>
                  新建渠道
                </button>
              </div>
            </div>

            <div className="panel editor-panel">
              <SectionHeader eyebrow="Editor" title="渠道编辑器" detail="先管理渠道身份、启停与状态记录，为后续 Slack / Telegram 真桥接保留稳定数据模型。" />
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
              </div>
              <div className="editor-actions">
                <button onClick={() => void handleSaveChannel()}>保存渠道</button>
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default App;
