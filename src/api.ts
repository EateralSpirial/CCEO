import type { BootstrapPayload, ChannelConnectionReport, ChannelDeliveryReport, ChannelValidationReport, ManagerRun } from "../shared/models";

async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || `Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export function readEmbeddedBootstrap(): BootstrapPayload | null {
  if (typeof document === "undefined") {
    return null;
  }

  const node = document.getElementById("cceo-bootstrap");
  const raw = node?.textContent?.trim();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as BootstrapPayload;
  } catch {
    return null;
  }
}

export function getBootstrap() {
  return apiFetch<BootstrapPayload>("/api/bootstrap");
}

export function savePersona(payload: unknown, id?: string) {
  return apiFetch(`/api/personas${id ? `/${id}` : ""}`, {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(payload),
  });
}

export function saveProject(payload: unknown, id?: string) {
  return apiFetch(`/api/projects${id ? `/${id}` : ""}`, {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(payload),
  });
}

export function saveKnowledgeBase(payload: unknown, id?: string) {
  return apiFetch(`/api/knowledge-bases${id ? `/${id}` : ""}`, {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(payload),
  });
}

export function saveChannel(payload: unknown, id?: string) {
  return apiFetch(`/api/channels${id ? `/${id}` : ""}`, {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(payload),
  });
}

async function channelActionFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const text = await response.text();
  if (!text) {
    throw new Error(`Request failed: ${response.status}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text || `Request failed: ${response.status}`);
  }
}

export function validateChannelConfig(channelId: string) {
  return channelActionFetch<ChannelValidationReport>(`/api/channels/${channelId}/validate`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function testChannelDelivery(channelId: string, payload: { message: string; mode: "dry-run" | "live" }) {
  return channelActionFetch<ChannelDeliveryReport>(`/api/channels/${channelId}/test`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function connectChannel(channelId: string) {
  return channelActionFetch<ChannelConnectionReport>(`/api/channels/${channelId}/connect`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function disconnectChannel(channelId: string) {
  return channelActionFetch<ChannelConnectionReport>(`/api/channels/${channelId}/disconnect`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function linkSession(sessionId: string, payload: unknown) {
  return apiFetch(`/api/sessions/${sessionId}/link`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function sendManagerPrompt(payload: unknown) {
  return apiFetch<{ runId: string; sessionId?: string }>("/api/manager/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getRun(runId: string) {
  return apiFetch<ManagerRun>(`/api/runs/${runId}`);
}

export function runCronAction(projectId: string, job: string, action: string) {
  return apiFetch<{ ok: boolean; output: string }>(`/api/projects/${projectId}/cron-jobs/${job}/action`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}
