import express from "express";
import path from "node:path";
import fs from "node:fs/promises";
import type {
  BootstrapPayload,
  ManagerMessage,
} from "../shared/models.js";
import { startCodexRun, getRun, subscribeRun } from "./lib/codex.js";
import { scanProjectCronJobs, runCronAction } from "./lib/cron-loop.js";
import { discoverCodexEnvironment } from "./lib/discovery.js";
import { nowIso, recordId } from "./lib/json-store.js";
import { ensureRegistry, upsertChannel, upsertKnowledgeBase, upsertPersona, upsertProject, upsertSessionLink, appendThreadMessage } from "./lib/registry.js";
import { ensureManagerDirs } from "./lib/paths.js";
import { readQdrantStatus } from "./lib/qdrant.js";
import { discoverSessions } from "./lib/sessions.js";

const app = express();
const port = Number(process.env.PORT || 3187);
const clientDistDir = path.join(process.cwd(), "dist", "client");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(clientDistDir));

async function loadBootstrap(): Promise<BootstrapPayload> {
  const registry = await ensureRegistry();
  const [discovery, qdrant, sessions] = await Promise.all([
    discoverCodexEnvironment(),
    readQdrantStatus(registry.knowledgeBases[0]?.url || "http://127.0.0.1:6333"),
    discoverSessions(registry.sessionLinks),
  ]);

  const cronJobs = Object.fromEntries(
    await Promise.all(
      registry.projects.map(async (project) => {
        return [project.id, await scanProjectCronJobs(project)];
      }),
    ),
  );

  return {
    personas: registry.personas,
    projects: registry.projects,
    knowledgeBases: registry.knowledgeBases,
    channels: registry.channels,
    sessions,
    managerThreads: registry.managerThreads,
    discovery,
    qdrant,
    cronJobs,
  };
}

app.get("/api/health", async (_req, res) => {
  const [discovery, qdrant] = await Promise.all([discoverCodexEnvironment(), readQdrantStatus()]);
  res.json({
    ok: true,
    codexCli: discovery.cliVersion,
    qdrant,
    now: nowIso(),
  });
});

app.get("/api/bootstrap", async (_req, res) => {
  res.json(await loadBootstrap());
});

app.post("/api/personas", async (req, res) => {
  const persona = await upsertPersona(req.body);
  res.json(persona);
});

app.put("/api/personas/:id", async (req, res) => {
  const persona = await upsertPersona({ ...req.body, id: req.params.id });
  res.json(persona);
});

app.post("/api/projects", async (req, res) => {
  const project = await upsertProject(req.body);
  res.json(project);
});

app.put("/api/projects/:id", async (req, res) => {
  const project = await upsertProject({ ...req.body, id: req.params.id });
  res.json(project);
});

app.post("/api/knowledge-bases", async (req, res) => {
  const kb = await upsertKnowledgeBase(req.body);
  res.json(kb);
});

app.put("/api/knowledge-bases/:id", async (req, res) => {
  const kb = await upsertKnowledgeBase({ ...req.body, id: req.params.id });
  res.json(kb);
});

app.post("/api/channels", async (req, res) => {
  const channel = await upsertChannel(req.body);
  res.json(channel);
});

app.put("/api/channels/:id", async (req, res) => {
  const channel = await upsertChannel({ ...req.body, id: req.params.id });
  res.json(channel);
});

app.put("/api/sessions/:sessionId/link", async (req, res) => {
  const link = await upsertSessionLink(req.params.sessionId, {
    projectId: req.body.projectId,
    personaId: req.body.personaId,
    notes: req.body.notes,
  });
  res.json(link);
});

app.get("/api/projects/:id/cron-jobs", async (req, res) => {
  const registry = await ensureRegistry();
  const project = registry.projects.find((entry) => entry.id === req.params.id);
  if (!project) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  res.json(await scanProjectCronJobs(project));
});

app.post("/api/projects/:id/cron-jobs/:job/action", async (req, res) => {
  const action = String(req.body.action ?? "");
  if (!["pause", "resume", "validate", "paths", "uninstall"].includes(action)) {
    res.status(400).json({ error: "unsupported action" });
    return;
  }
  const registry = await ensureRegistry();
  const project = registry.projects.find((entry) => entry.id === req.params.id);
  if (!project) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const result = await runCronAction(project.path, req.params.job, action as "pause" | "resume" | "validate" | "paths" | "uninstall");
  res.json(result);
});

app.post("/api/manager/chat", async (req, res) => {
  const prompt = String(req.body.prompt ?? "").trim();
  const threadId = String(req.body.threadId ?? "thread-cceo-main");
  if (!prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const registry = await ensureRegistry();
  const persona = registry.personas.find((entry) => entry.id === req.body.personaId) ?? registry.personas[0];
  const project = registry.projects.find((entry) => entry.id === req.body.projectId) ?? registry.projects[0];
  const userMessage: ManagerMessage = {
    id: recordId("msg"),
    role: "user",
    content: prompt,
    createdAt: nowIso(),
    personaId: persona?.id,
    projectId: project?.id,
    sessionId: String(req.body.sessionId || ""),
  };
  await appendThreadMessage(threadId, userMessage);

  const run = await startCodexRun({
    prompt,
    persona,
    project,
    sessionId: typeof req.body.sessionId === "string" && req.body.sessionId.trim() ? req.body.sessionId : undefined,
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
    await appendThreadMessage(threadId, message);
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

  res.json({
    runId: run.id,
    sessionId: run.sessionId,
  });
});

app.get("/api/runs/:runId", (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) {
    res.status(404).json({ error: "run not found" });
    return;
  }
  res.json(run);
});

app.get("/api/runs/:runId/events", (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) {
    res.status(404).json({ error: "run not found" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  for (const event of run.events) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  const unsubscribe = subscribeRun(req.params.runId, (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    const activeRun = getRun(req.params.runId);
    if (activeRun?.status !== "running") {
      res.write("event: done\ndata: {}\n\n");
      unsubscribe();
      res.end();
    }
  });

  req.on("close", () => {
    unsubscribe();
  });
});

app.use(async (_req, res, next) => {
  const clientIndex = path.join(clientDistDir, "index.html");
  try {
    const html = await fs.readFile(clientIndex, "utf8");
    res.type("html").send(html);
  } catch {
    next();
  }
});

await ensureManagerDirs();
app.listen(port, () => {
  console.log(`Codex Executive Officer API listening on http://127.0.0.1:${port}`);
});
