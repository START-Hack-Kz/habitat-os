import { mapMissionState } from "../data/api";
import { reconcileControlActions } from "./controlActions";
import type { MissionState } from "../../shared/schemas/missionState.schema";

const runtimeProcess = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

const API_BASE = (
  runtimeProcess.process?.env?.CONTROL_CHECK_API_BASE ?? "http://127.0.0.1:3001"
).replace(/\/$/, "");

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? undefined);

  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers,
    ...init,
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
  }

  return (await response.json()) as T;
}

async function post(path: string, body: unknown): Promise<void> {
  await requestJson(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function fetchMission() {
  const mission = await requestJson<MissionState>("/api/mission/state");
  return mapMissionState(mission);
}

async function runCase(
  tweakPayload: Record<string, unknown> | null,
): Promise<{
  actions: string[];
  newEntries: number;
  duplicateEntries: number;
  headline: string | null;
}> {
  await post("/api/simulation/reset", {});

  if (tweakPayload) {
    await post("/api/simulation/tweak", tweakPayload);
  }

  const mission = await fetchMission();
  const firstPoll = reconcileControlActions(mission, {}, "2026-03-19T12:00:00.000Z");
  const secondPoll = reconcileControlActions(
    mission,
    firstPoll.activeIssueRanks,
    "2026-03-19T12:01:00.000Z",
  );

  return {
    actions: firstPoll.activeActions.map((action) => action.actionType),
    newEntries: firstPoll.newLogEntries.length,
    duplicateEntries: secondPoll.newLogEntries.length,
    headline: firstPoll.latestAlert?.title ?? null,
  };
}

async function main(): Promise<void> {
  const baseline = await runCase(null);
  const temperature = await runCase({
    zones: [{ zoneId: "zone-A", temperature: 32, humidity: 35 }],
  });
  const moisture = await runCase({
    zones: [{ zoneId: "zone-B", soilMoisture: 15 }],
  });
  const humidity = await runCase({
    zones: [{ zoneId: "zone-C", humidity: 28 }],
  });
  const nutrientPh = await runCase({
    zones: [{ zoneId: "zone-D", nutrientPH: 7.4 }],
  });

  console.log(
    JSON.stringify(
      {
        apiBase: API_BASE,
        baseline,
        temperature,
        moisture,
        humidity,
        nutrientPh,
      },
      null,
      2,
    ),
  );
}

void main();
