import type { BootstrapPayload, ManagerRun } from "../shared/models";

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
