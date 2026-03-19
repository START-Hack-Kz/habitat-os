import { MISSION_SEED } from "../../data/mission.seed";
import { calculateNutrition } from "../nutrition/nutrition.calculator";
import {
  getMissionState,
  resetMissionState,
  setMissionState,
} from "./mission.store";
import {
  getCurrentMissionSnapshot,
} from "./mission.service";
import type { MissionState, MissionStatus } from "./mission.types";

const REQUIRED_KEYS: Array<keyof MissionState> = [
  "missionId",
  "missionDay",
  "missionDurationDays",
  "crewSize",
  "status",
  "zones",
  "resources",
  "nutrition",
  "activeScenario",
  "eventLog",
  "lastUpdated",
];

function cloneMissionState(state: MissionState): MissionState {
  return structuredClone(state);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function expectStatus(snapshot: MissionState, expected: MissionStatus): void {
  assert(
    snapshot.status === expected,
    `Expected mission status ${expected}, received ${snapshot.status}`,
  );
}

function main(): void {
  const seedBefore = cloneMissionState(MISSION_SEED);

  resetMissionState();
  const baseline = getCurrentMissionSnapshot();
  const baselineTyped: MissionState = baseline;
  void baselineTyped;

  for (const key of REQUIRED_KEYS) {
    assert(key in baseline, `Mission snapshot is missing key: ${key}`);
  }

  const expectedBaselineNutrition = calculateNutrition({
    zones: baseline.zones,
    resources: baseline.resources,
    crewSize: baseline.crewSize,
    missionDurationDays: baseline.missionDurationDays,
    missionDay: baseline.missionDay,
    previousScore: MISSION_SEED.nutrition.nutritionalCoverageScore,
  });

  assert(
    JSON.stringify(baseline.nutrition) === JSON.stringify(expectedBaselineNutrition),
    "Mission snapshot nutrition was not refreshed from the calculator",
  );
  expectStatus(baseline, "nominal");

  const staleNutritionState = cloneMissionState(MISSION_SEED);
  staleNutritionState.nutrition = {
    dailyCaloriesProduced: 0,
    dailyCaloriesTarget: staleNutritionState.crewSize * 3000,
    caloricCoveragePercent: 0,
    dailyProteinProducedG: 0,
    dailyProteinTargetG: staleNutritionState.crewSize * 112.5,
    proteinCoveragePercent: 0,
    micronutrientAdequacyPercent: 0,
    nutritionalCoverageScore: 0,
    daysSafe: 0,
    trend: "stable",
  };

  setMissionState(staleNutritionState);
  const refreshedNutrition = getCurrentMissionSnapshot();
  const expectedRefreshedNutrition = calculateNutrition({
    zones: refreshedNutrition.zones,
    resources: refreshedNutrition.resources,
    crewSize: refreshedNutrition.crewSize,
    missionDurationDays: refreshedNutrition.missionDurationDays,
    missionDay: refreshedNutrition.missionDay,
    previousScore: 0,
  });

  assert(
    JSON.stringify(refreshedNutrition.nutrition) ===
      JSON.stringify(expectedRefreshedNutrition),
    "Mission service did not replace stale nutrition with a fresh calculation",
  );

  const warningState = cloneMissionState(MISSION_SEED);
  warningState.activeScenario = {
    scenarioId: "scenario-warning-001",
    type: "water_recycling_decline",
    severity: "mild",
    title: "Water Recycling Drift",
    description: "Validation scenario for warning status.",
    injectedAt: "2026-03-19T12:00:00.000Z",
    affectedZoneIds: ["zone-a"],
    parameterOverrides: {
      waterRecyclingEfficiencyPercent: 78,
    },
  };

  setMissionState(warningState);
  const warningSnapshot = getCurrentMissionSnapshot();
  expectStatus(warningSnapshot, "warning");

  const criticalState = cloneMissionState(MISSION_SEED);
  criticalState.zones = criticalState.zones.map((zone) =>
    zone.zoneId === "zone-b"
      ? {
          ...zone,
          status: "critical",
          stress: {
            ...zone.stress,
            active: true,
            type: "water_stress",
            severity: "critical",
            summary: "Critical validation stress.",
          },
        }
      : zone,
  );

  setMissionState(criticalState);
  const criticalSnapshot = getCurrentMissionSnapshot();
  expectStatus(criticalSnapshot, "critical");

  const preservationModeState = cloneMissionState(MISSION_SEED);
  preservationModeState.status = "nutrition_preservation_mode";

  setMissionState(preservationModeState);
  const preservationSnapshot = getCurrentMissionSnapshot();
  expectStatus(preservationSnapshot, "nutrition_preservation_mode");

  const deterministicState = cloneMissionState(MISSION_SEED);
  deterministicState.zones[0].growthProgressPercent = 3;
  deterministicState.eventLog = [...deterministicState.eventLog].reverse();
  setMissionState(deterministicState);

  const snapshotA = getCurrentMissionSnapshot();
  const snapshotB = getCurrentMissionSnapshot();

  assert(
    JSON.stringify(snapshotA) === JSON.stringify(snapshotB),
    "Mission service is not deterministic for unchanged store state",
  );
  assert(
    snapshotA.zones[0].growthProgressPercent === 54.3,
    "Mission service did not normalize zone growth progress for dashboard consumption",
  );

  const rawStoreAfterBuild = getMissionState();
  assert(
    rawStoreAfterBuild.zones[0].growthProgressPercent === 3,
    "Mission service unexpectedly mutated the mission store state",
  );
  assert(
    JSON.stringify(MISSION_SEED) === JSON.stringify(seedBefore),
    "Mission service mutated the baseline seed state",
  );

  console.log(
    JSON.stringify(
      {
        baselineStatus: baseline.status,
        refreshedNutritionStatus: refreshedNutrition.status,
        warningStatus: warningSnapshot.status,
        criticalStatus: criticalSnapshot.status,
        preservationModeStatus: preservationSnapshot.status,
        deterministic: true,
        storeStateUntouchedByBuilder: true,
        seedStateUntouched: true,
        normalizedGrowthProgressPercent: snapshotA.zones[0].growthProgressPercent,
        normalizedEventLogOrder: snapshotA.eventLog.map((entry) => entry.eventId),
      },
      null,
      2,
    ),
  );
}

main();
