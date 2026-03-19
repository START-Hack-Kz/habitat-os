import type {
  BackendMissionState,
  BackendPlannerOutput,
  BackendScenarioCatalogItem,
  BackendScenarioInjectRequest,
} from "../types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export function fetchMissionState(): Promise<BackendMissionState> {
  return requestJson<BackendMissionState>("/api/mission/state");
}

export function fetchScenarioCatalog(): Promise<BackendScenarioCatalogItem[]> {
  return requestJson<BackendScenarioCatalogItem[]>("/api/scenarios");
}

export function fetchPlannerAnalysis(): Promise<BackendPlannerOutput> {
  return requestJson<BackendPlannerOutput>("/api/planner/analyze", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function injectScenario(payload: BackendScenarioInjectRequest): Promise<BackendMissionState> {
  return requestJson<BackendMissionState>("/api/simulation/scenario/inject", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function resetSimulation(): Promise<BackendMissionState> {
  return requestJson<BackendMissionState>("/api/simulation/reset", {
    method: "POST",
    body: JSON.stringify({}),
  });
}
