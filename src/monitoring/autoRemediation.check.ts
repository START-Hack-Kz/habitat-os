import { createAutoRemediationPlan } from "./autoRemediation";
import { reconcileControlActions } from "./controlActions";
import type { BackendSimulationTweakRequest } from "../types";

const runtimeProcess = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

if (
  runtimeProcess.process?.env?.CONTROL_CHECK_API_BASE &&
  !runtimeProcess.process.env.VITE_API_BASE_URL
) {
  runtimeProcess.process.env.VITE_API_BASE_URL = runtimeProcess.process.env.CONTROL_CHECK_API_BASE;
}

async function loadApi() {
  return import("../data/api");
}

async function runCase(
  label: string,
  payload: BackendSimulationTweakRequest,
  match: (abnormalityKey: string) => boolean,
): Promise<Record<string, unknown>> {
  const { fetchMissionState, resetSimulation, tweakSimulation } = await loadApi();
  await resetSimulation();
  await tweakSimulation(payload);

  const before = await fetchMissionState();
  const firstDetection = reconcileControlActions(before, {}, "2026-03-19T12:00:00.000Z");
  const abnormalityKey = Object.keys(firstDetection.activeIssueRanks).find(match);

  if (!abnormalityKey) {
    throw new Error(`No abnormality key matched ${label}`);
  }

  const plan = createAutoRemediationPlan(
    before,
    firstDetection.activeActions.filter((action) => action.abnormalityKey === abnormalityKey),
    "2026-03-19T12:00:00.000Z",
  );

  if (!plan?.tweakRequest) {
    throw new Error(`No tweak request generated for ${label}`);
  }

  const after = await tweakSimulation(plan.tweakRequest);
  const secondDetection = reconcileControlActions(
    after,
    firstDetection.activeIssueRanks,
    "2026-03-19T12:01:00.000Z",
  );

  return {
    abnormalityKey,
    machineryLabel: plan.machineryLabel,
    beforeIssueRank: firstDetection.activeIssueRanks[abnormalityKey] ?? 0,
    afterIssueRank: secondDetection.activeIssueRanks[abnormalityKey] ?? 0,
    remainingNewEntries: secondDetection.newLogEntries.length,
    beforeMissionStatus: before.status,
    afterMissionStatus: after.status,
  };
}

async function main(): Promise<void> {
  const temperature = await runCase(
    "temperature",
    {
      zones: [{ zoneId: "zone-A", temperature: 32, humidity: 35 }],
    },
    (key) => key.startsWith("zone-A:temperature:"),
  );
  const moisture = await runCase(
    "soil moisture",
    {
      zones: [{ zoneId: "zone-B", soilMoisture: 15 }],
    },
    (key) => key === "zone-B:soilMoisture:low",
  );
  const humidity = await runCase(
    "humidity",
    {
      zones: [{ zoneId: "zone-C", humidity: 28 }],
    },
    (key) => key.startsWith("zone-C:humidity:"),
  );
  const nutrientPh = await runCase(
    "nutrient pH",
    {
      zones: [{ zoneId: "zone-D", nutrientPH: 7.4 }],
    },
    (key) => key.startsWith("zone-D:nutrientPH:"),
  );

  console.log(
    JSON.stringify(
      {
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
