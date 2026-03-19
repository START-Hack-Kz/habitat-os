import { MISSION_SEED } from "../../data/mission.seed";
import { calculateNutrition } from "../nutrition/nutrition.calculator";
import {
  getMissionState,
  resetMissionState,
  setMissionState,
} from "./mission.store";
import { getCurrentMissionSnapshot } from "./mission.service";
import type {
  MicronutrientStatus,
  MissionState,
  MissionStatus,
  NutritionStatus,
} from "./mission.types";

const REQUIRED_KEYS: Array<keyof MissionState> = [
  "missionId",
  "missionDay",
  "missionDurationTotal",
  "crewSize",
  "status",
  "zones",
  "plants",
  "plantHealthChecks",
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

function buildZeroMicronutrientStatus(target: number, unit: string): MicronutrientStatus {
  return {
    produced: 0,
    target,
    unit,
    coveragePercent: 0,
  };
}

function buildZeroNutritionStatus(crewSize: number): NutritionStatus {
  return {
    dailyCaloriesProduced: 0,
    dailyCaloriesTarget: crewSize * 3000,
    caloricCoveragePercent: 0,
    dailyProteinG: 0,
    dailyProteinTarget: crewSize * 112.5,
    proteinCoveragePercent: 0,
    vitaminA: buildZeroMicronutrientStatus(3600, "µg"),
    vitaminC: buildZeroMicronutrientStatus(360, "mg"),
    vitaminK: buildZeroMicronutrientStatus(480, "µg"),
    folate: buildZeroMicronutrientStatus(1600, "µg"),
    iron: buildZeroMicronutrientStatus(32, "mg"),
    potassium: buildZeroMicronutrientStatus(14000, "mg"),
    magnesium: buildZeroMicronutrientStatus(1600, "mg"),
    nutritionalCoverageScore: 0,
    daysSafe: 0,
    trend: "stable",
  };
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
    missionDurationTotal: baseline.missionDurationTotal,
    missionDay: baseline.missionDay,
    previousScore: MISSION_SEED.nutrition.nutritionalCoverageScore,
  });

  assert(
    JSON.stringify(baseline.nutrition) === JSON.stringify(expectedBaselineNutrition),
    "Mission snapshot nutrition was not refreshed from the calculator",
  );
  assert(baseline.plants.length === 80, `Expected 80 plants in baseline snapshot, received ${baseline.plants.length}`);
  assert(
    baseline.plantHealthChecks.length === baseline.plants.length,
    `Expected one plant health check per plant, received ${baseline.plantHealthChecks.length} for ${baseline.plants.length} plants`,
  );
  expectStatus(baseline, "nominal");

  const staleNutritionState = cloneMissionState(MISSION_SEED);
  staleNutritionState.nutrition = buildZeroNutritionStatus(staleNutritionState.crewSize);

  setMissionState(staleNutritionState);
  const refreshedNutritionSnapshot = getCurrentMissionSnapshot();
  const expectedRefreshedNutrition = calculateNutrition({
    zones: refreshedNutritionSnapshot.zones,
    resources: refreshedNutritionSnapshot.resources,
    crewSize: refreshedNutritionSnapshot.crewSize,
    missionDurationTotal: refreshedNutritionSnapshot.missionDurationTotal,
    missionDay: refreshedNutritionSnapshot.missionDay,
    previousScore: 0,
  });

  assert(
    JSON.stringify(refreshedNutritionSnapshot.nutrition) ===
      JSON.stringify(expectedRefreshedNutrition),
    "Mission service did not replace stale nutrition with a fresh calculation",
  );

  const warningState = cloneMissionState(MISSION_SEED);
  warningState.activeScenario = {
    scenarioId: "scenario-warning-001",
    scenarioType: "water_recycling_decline",
    severity: "mild",
    description: "Validation scenario for warning status.",
    injectedAt: "2026-03-19T12:00:00.000Z",
    affectedZones: ["zone-A"],
    parameterOverrides: {
      waterRecyclingEfficiency: 78,
    },
  };

  setMissionState(warningState);
  const warningSnapshot = getCurrentMissionSnapshot();
  expectStatus(warningSnapshot, "warning");

  const criticalState = cloneMissionState(MISSION_SEED);
  criticalState.zones = criticalState.zones.map((zone) =>
    zone.zoneId === "zone-B"
      ? {
          ...zone,
          stress: {
            ...zone.stress,
            active: true,
            type: "water_deficit",
            severity: "critical",
          },
          sensors: {
            ...zone.sensors,
            soilMoisture: 12,
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
        refreshedNutritionStatus: refreshedNutritionSnapshot.status,
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
