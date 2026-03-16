import express from "express";
import path from "node:path";
import fs from "node:fs/promises";
import type {
  BootstrapPayload,
} from "../shared/models.js";
import { getRun, subscribeRun } from "./lib/codex.js";
import { deliverChannelTest, deriveChannelDeliveryRuntimePatch, deriveChannelRuntimePatch, validateChannel } from "./lib/channels.js";
import { scanProjectCronJobs, runCronAction } from "./lib/cron-loop.js";
import { discoverCodexEnvironment } from "./lib/discovery.js";
import { nowIso } from "./lib/json-store.js";
import { dispatchManagerPrompt } from "./lib/manager.js";
import { ensureRegistry, upsertChannel, upsertKnowledgeBase, upsertPersona, upsertProject, upsertSessionLink, updateChannelRuntime } from "./lib/registry.js";
import { ensureManagerDirs } from "./lib/paths.js";
import { readQdrantStatus } from "./lib/qdrant.js";
import { discoverSessions } from "./lib/sessions.js";
import { connectSlackChannel, disconnectSlackChannel, syncSlackChannels } from "./lib/slack-bridge.js";

const app = express();
const port = Number(process.env.PORT || 3187);
const clientDistDir = path.join(process.cwd(), "dist", "client");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(clientDistDir, { index: false }));

function serializeBootstrapForHtml(payload: BootstrapPayload): string {
  return JSON.stringify(payload)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

async function renderClientIndex() {
  const clientIndex = path.join(clientDistDir, "index.html");
  const html = await fs.readFile(clientIndex, "utf8");
  try {
    const bootstrap = await loadBootstrap();
    const preloadTag = `<script id="cceo-bootstrap" type="application/json">${serializeBootstrapForHtml(bootstrap)}</script>`;
    if (html.includes("<div id=\"root\"></div>")) {
      return html.replace("<div id=\"root\"></div>", `${preloadTag}\n    <div id="root"></div>`);
    }
  } catch (error) {
    console.error("Failed to inline bootstrap payload:", error);
  }
  return html;
}

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
  await syncSlackChannels();
  res.json(channel);
});

app.put("/api/channels/:id", async (req, res) => {
  const channel = await upsertChannel({ ...req.body, id: req.params.id });
  await syncSlackChannels();
  res.json(channel);
});

app.post("/api/channels/:id/validate", async (req, res) => {
  const registry = await ensureRegistry();
  const channel = registry.channels.find((entry) => entry.id === req.params.id);
  if (!channel) {
    res.status(404).json({ error: "channel not found" });
    return;
  }

  const report = validateChannel(channel);
  await updateChannelRuntime(channel.id, deriveChannelRuntimePatch(report));
  res.json(report);
});

app.post("/api/channels/:id/test", async (req, res) => {
  const registry = await ensureRegistry();
  const channel = registry.channels.find((entry) => entry.id === req.params.id);
  if (!channel) {
    res.status(404).json({ error: "channel not found" });
    return;
  }

  const message = String(req.body.message ?? "").trim();
  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const mode = req.body.mode === "live" ? "live" : "dry-run";
  const report = await deliverChannelTest({ channel, message, mode });
  await updateChannelRuntime(channel.id, deriveChannelDeliveryRuntimePatch(report));

  if (mode === "dry-run") {
    res.json(report);
    return;
  }

  if (!report.liveReady) {
    res.status(422).json(report);
    return;
  }

  res.status(report.delivered ? 200 : 502).json(report);
});

app.post("/api/channels/:id/connect", async (req, res) => {
  const registry = await ensureRegistry();
  const channel = registry.channels.find((entry) => entry.id === req.params.id);
  if (!channel) {
    res.status(404).json({ error: "channel not found" });
    return;
  }
  if (channel.type !== "slack") {
    res.status(422).json({ error: "only slack channels support connect/disconnect" });
    return;
  }

  const report = await connectSlackChannel(channel.id);
  res.status(report.connected ? 200 : 422).json(report);
});

app.post("/api/channels/:id/disconnect", async (req, res) => {
  const registry = await ensureRegistry();
  const channel = registry.channels.find((entry) => entry.id === req.params.id);
  if (!channel) {
    res.status(404).json({ error: "channel not found" });
    return;
  }
  if (channel.type !== "slack") {
    res.status(422).json({ error: "only slack channels support connect/disconnect" });
    return;
  }

  const report = await disconnectSlackChannel(channel.id);
  res.json(report);
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
  if (!["stop", "start", "validate", "paths", "destroy"].includes(action)) {
    res.status(400).json({ error: "unsupported action" });
    return;
  }
  const registry = await ensureRegistry();
  const project = registry.projects.find((entry) => entry.id === req.params.id);
  if (!project) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const result = await runCronAction(project.path, req.params.job, action as "stop" | "start" | "validate" | "paths" | "destroy");
  res.json(result);
});

app.post("/api/manager/chat", async (req, res) => {
  const prompt = String(req.body.prompt ?? "").trim();
  const threadId = String(req.body.threadId ?? "thread-cceo-main");
  if (!prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const dispatch = await dispatchManagerPrompt({
    prompt,
    threadId,
    personaId: typeof req.body.personaId === "string" ? req.body.personaId : undefined,
    projectId: typeof req.body.projectId === "string" ? req.body.projectId : undefined,
    sessionId: typeof req.body.sessionId === "string" && req.body.sessionId.trim() ? req.body.sessionId : undefined,
  });

  res.json({
    runId: dispatch.runId,
    sessionId: dispatch.sessionId,
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

app.use(async (req, res, next) => {
  if (req.path.startsWith("/api/") || /\.[a-zA-Z0-9]+$/.test(req.path)) {
    next();
    return;
  }
  try {
    const html = await renderClientIndex();
    res.type("html").send(html);
  } catch {
    next();
  }
});

await ensureManagerDirs();
await syncSlackChannels().catch((error) => {
  console.error("Slack channel sync failed during startup:", error);
});
app.listen(port, () => {
  console.log(`Codex Executive Officer API listening on http://127.0.0.1:${port}`);
});
