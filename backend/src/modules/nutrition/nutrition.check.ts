import { MISSION_SEED } from "../../data/mission.seed";
import { buildMissionSnapshot } from "../mission/mission.service";
import type {
  MicronutrientStatus,
  MissionState,
  NutritionStatus,
} from "../mission/mission.types";
import { calculateNutrition } from "./nutrition.calculator";

const MICRONUTRIENT_KEYS = [
  "vitaminA",
  "vitaminC",
  "vitaminK",
  "folate",
  "iron",
  "potassium",
  "magnesium",
] as const;

function cloneMissionState(state: MissionState): MissionState {
  return structuredClone(state);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function calculateFromMissionState(
  missionState: MissionState,
  previousScore?: number,
): NutritionStatus {
  const snapshot = buildMissionSnapshot(missionState);

  return calculateNutrition({
    zones: snapshot.zones,
    resources: snapshot.resources,
    crewSize: snapshot.crewSize,
    missionDurationTotal: snapshot.missionDurationTotal,
    missionDay: snapshot.missionDay,
    previousScore,
  });
}

function assertMicronutrientShape(status: MicronutrientStatus, label: string): void {
  assert(Number.isFinite(status.produced), `${label}.produced must be finite`);
  assert(Number.isFinite(status.target), `${label}.target must be finite`);
  assert(
    status.unit === "mg" || status.unit === "µg",
    `${label}.unit must be mg or µg`,
  );
  assert(
    status.coveragePercent >= 0 && status.coveragePercent <= 100,
    `${label}.coveragePercent must stay within 0-100`,
  );
}

function assertNutritionShape(result: NutritionStatus): void {
  assert(
    Number.isFinite(result.dailyCaloriesProduced),
    "dailyCaloriesProduced must be finite",
  );
  assert(
    Number.isFinite(result.dailyCaloriesTarget),
    "dailyCaloriesTarget must be finite",
  );
  assert(
    Number.isFinite(result.caloricCoveragePercent),
    "caloricCoveragePercent must be finite",
  );
  assert(Number.isFinite(result.dailyProteinG), "dailyProteinG must be finite");
  assert(
    Number.isFinite(result.dailyProteinTarget),
    "dailyProteinTarget must be finite",
  );
  assert(
    Number.isFinite(result.proteinCoveragePercent),
    "proteinCoveragePercent must be finite",
  );
  assert(
    Number.isFinite(result.nutritionalCoverageScore),
    "nutritionalCoverageScore must be finite",
  );
  assert(Number.isFinite(result.daysSafe), "daysSafe must be finite");

  for (const key of MICRONUTRIENT_KEYS) {
    assertMicronutrientShape(result[key], key);
  }

  assert(
    result.trend === "improving" ||
      result.trend === "stable" ||
      result.trend === "declining",
    `Invalid trend value: ${result.trend}`,
  );
}

function main(): void {
  const seedBefore = cloneMissionState(MISSION_SEED);

  const baseline = calculateFromMissionState(MISSION_SEED);
  const baselineAgain = calculateFromMissionState(MISSION_SEED);

  assertNutritionShape(baseline);
  assert(
    JSON.stringify(baseline) === JSON.stringify(MISSION_SEED.nutrition),
    "Baseline calculator output does not match MISSION_SEED.nutrition",
  );
  assert(
    JSON.stringify(baseline) === JSON.stringify(baselineAgain),
    "Calculator is not deterministic for identical input",
  );
  assert(
    JSON.stringify(MISSION_SEED) === JSON.stringify(seedBefore),
    "Calculator mutated the mission seed state",
  );

  const baselineClone = cloneMissionState(MISSION_SEED);
  const cloneBefore = cloneMissionState(baselineClone);
  calculateFromMissionState(baselineClone);
  assert(
    JSON.stringify(baselineClone) === JSON.stringify(cloneBefore),
    "Calculator mutated a provided mission state object",
  );

  const reducedYieldState = cloneMissionState(MISSION_SEED);
  reducedYieldState.zones = reducedYieldState.zones.map((zone) =>
    zone.cropType === "potato"
      ? {
          ...zone,
          projectedYieldKg: zone.projectedYieldKg * 0.5,
        }
      : zone,
  );
  const reducedYield = calculateNutrition({
    zones: reducedYieldState.zones,
    resources: reducedYieldState.resources,
    crewSize: reducedYieldState.crewSize,
    missionDurationTotal: reducedYieldState.missionDurationTotal,
    missionDay: reducedYieldState.missionDay,
    previousScore: baseline.nutritionalCoverageScore,
  });
  assert(
    reducedYield.nutritionalCoverageScore < baseline.nutritionalCoverageScore,
    "Reducing projected yield did not lower the nutrition score",
  );
  assert(
    reducedYield.daysSafe < baseline.daysSafe,
    "Reducing projected yield did not lower daysSafe",
  );

  const heatStressState = cloneMissionState(MISSION_SEED);
  heatStressState.zones = heatStressState.zones.map((zone) =>
    zone.zoneId === "zone-A"
      ? {
          ...zone,
          sensors: {
            ...zone.sensors,
            temperature: 32,
            humidity: 35,
          },
        }
      : zone,
  );
  const heatStressSnapshot = buildMissionSnapshot(heatStressState);
  const heatStress = calculateFromMissionState(
    heatStressState,
    baseline.nutritionalCoverageScore,
  );

  assert(
    heatStressSnapshot.zones[0].stress.type === "heat" &&
      heatStressSnapshot.zones[0].stress.boltingRisk,
    "Heat case did not derive lettuce heat stress with bolting risk",
  );
  assert(
    heatStressSnapshot.zones[0].projectedYieldKg < baselineClone.zones[0].projectedYieldKg,
    "Heat case did not reduce projected lettuce yield",
  );
  assert(
    heatStress.vitaminA.coveragePercent <= baseline.vitaminA.coveragePercent,
    "Heat-stressed lettuce unexpectedly improved vitamin A coverage",
  );
  assert(
    heatStress.nutritionalCoverageScore <= baseline.nutritionalCoverageScore,
    "Heat-stressed lettuce unexpectedly improved nutrition score",
  );

  const waterDeficitState = cloneMissionState(MISSION_SEED);
  waterDeficitState.zones = waterDeficitState.zones.map((zone) =>
    zone.zoneId === "zone-B"
      ? {
          ...zone,
          sensors: {
            ...zone.sensors,
            soilMoisture: 15,
          },
        }
      : zone,
  );
  const waterDeficitSnapshot = buildMissionSnapshot(waterDeficitState);
  const waterDeficit = calculateFromMissionState(
    waterDeficitState,
    baseline.nutritionalCoverageScore,
  );

  assert(
    waterDeficitSnapshot.zones[1].stress.type === "water_deficit",
    "Low soil moisture did not derive water-deficit stress",
  );
  assert(
    waterDeficit.dailyCaloriesProduced < baseline.dailyCaloriesProduced,
    "Water-deficit potato case did not reduce calories",
  );
  assert(
    waterDeficit.potassium.coveragePercent <= baseline.potassium.coveragePercent,
    "Water-deficit potato case unexpectedly improved potassium coverage",
  );

  const resourceOnlyState = cloneMissionState(MISSION_SEED);
  resourceOnlyState.resources.waterRecyclingEfficiency = 40;
  const resourceOnly = calculateNutrition({
    zones: resourceOnlyState.zones,
    resources: resourceOnlyState.resources,
    crewSize: resourceOnlyState.crewSize,
    missionDurationTotal: resourceOnlyState.missionDurationTotal,
    missionDay: resourceOnlyState.missionDay,
  });
  assert(
    resourceOnly.dailyCaloriesProduced === MISSION_SEED.nutrition.dailyCaloriesProduced,
    "Raw nutrition calculation should depend on projectedYieldKg, not resource values alone",
  );

  console.log(
    JSON.stringify(
      {
        baseline,
        reducedYield,
        heatStress,
        waterDeficit,
        checks: {
          returnedNutritionStatusShape: true,
          baselineMatchesSeedNutrition: true,
          deterministic: true,
          seedInputImmutable: true,
          clonedInputImmutable: true,
          projectedYieldDrivesNutrition: true,
          heatStressDegradesLettuceOutput: true,
          lowSoilMoistureDegradesPotatoOutput: true,
          rawCalculatorDependsOnProjectedYieldOnly: true,
        },
      },
      null,
      2,
    ),
  );
}

main();
