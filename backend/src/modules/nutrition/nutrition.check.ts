import { MISSION_SEED } from "../../data/mission.seed";
import type {
  MissionState,
  NutritionStatus,
  StressSeverity,
} from "../mission/mission.types";
import { calculateNutrition } from "./nutrition.calculator";

const REQUIRED_NUMERIC_FIELDS: Array<keyof NutritionStatus> = [
  "dailyCaloriesProduced",
  "dailyCaloriesTarget",
  "caloricCoveragePercent",
  "dailyProteinProducedG",
  "dailyProteinTargetG",
  "proteinCoveragePercent",
  "micronutrientAdequacyPercent",
  "nutritionalCoverageScore",
  "daysSafe",
];

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
  return calculateNutrition({
    zones: missionState.zones,
    resources: missionState.resources,
    crewSize: missionState.crewSize,
    missionDurationDays: missionState.missionDurationDays,
    missionDay: missionState.missionDay,
    previousScore,
  });
}

function assertNutritionShape(result: NutritionStatus): void {
  for (const field of REQUIRED_NUMERIC_FIELDS) {
    assert(
      typeof result[field] === "number" && Number.isFinite(result[field]),
      `Expected numeric finite nutrition field: ${field}`,
    );
  }

  assert(
    result.trend === "improving" ||
      result.trend === "stable" ||
      result.trend === "declining",
    `Invalid trend value: ${result.trend}`,
  );
}

function assertOutputCoherence(result: NutritionStatus): void {
  assert(result.dailyCaloriesProduced >= 0, "Calories must not be negative");
  assert(result.dailyProteinProducedG >= 0, "Protein must not be negative");
  assert(result.caloricCoveragePercent >= 0, "Caloric coverage must not be negative");
  assert(result.proteinCoveragePercent >= 0, "Protein coverage must not be negative");
  assert(
    result.micronutrientAdequacyPercent >= 0 && result.micronutrientAdequacyPercent <= 100,
    "Micronutrient adequacy must stay within 0-100",
  );
  assert(
    result.nutritionalCoverageScore >= 0 && result.nutritionalCoverageScore <= 100,
    "Nutrition score must stay within 0-100",
  );
  assert(result.daysSafe >= 0, "daysSafe must not be negative");
}

function setAllZoneStress(missionState: MissionState, severity: StressSeverity): MissionState {
  const next = cloneMissionState(missionState);
  next.zones = next.zones.map((zone) => ({
    ...zone,
    status: severity === "none" ? "healthy" : "critical",
    stress: {
      ...zone.stress,
      active: severity !== "none",
      type: severity === "none" ? "none" : "water_stress",
      severity,
      summary:
        severity === "none"
          ? "Stress cleared for validation case."
          : `Validation case with ${severity} stress.`,
    },
  }));
  return next;
}

function main(): void {
  const seedBefore = cloneMissionState(MISSION_SEED);

  const baseline = calculateFromMissionState(MISSION_SEED);
  const baselineAgain = calculateFromMissionState(MISSION_SEED);
  const baselineTyped: NutritionStatus = baseline;
  const baselineMatchesSeedNutrition =
    JSON.stringify(baseline) === JSON.stringify(MISSION_SEED.nutrition);

  assertNutritionShape(baselineTyped);
  assertOutputCoherence(baselineTyped);
  assert(
    baselineMatchesSeedNutrition,
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
          allocationPercent: Math.max(0, zone.allocationPercent - 10),
        }
      : zone,
  );
  const reducedYield = calculateFromMissionState(reducedYieldState);
  assert(
    reducedYield.nutritionalCoverageScore <= baseline.nutritionalCoverageScore,
    "Reducing important zone yield/allocation unexpectedly improved nutrition score",
  );
  assert(
    reducedYield.daysSafe <= baseline.daysSafe,
    "Reducing important zone yield/allocation unexpectedly improved daysSafe",
  );

  const worsenedStressState = setAllZoneStress(MISSION_SEED, "high");
  const worsenedStress = calculateFromMissionState(
    worsenedStressState,
    baseline.nutritionalCoverageScore,
  );
  assert(
    worsenedStress.nutritionalCoverageScore <= baseline.nutritionalCoverageScore,
    "Worsening zone stress unexpectedly improved nutrition score",
  );
  assert(
    worsenedStress.daysSafe <= baseline.daysSafe,
    "Worsening zone stress unexpectedly improved daysSafe",
  );

  const improvedHealthState = setAllZoneStress(MISSION_SEED, "none");
  improvedHealthState.resources.waterRecyclingEfficiencyPercent = 95;
  const improvedHealth = calculateFromMissionState(improvedHealthState);
  assert(
    improvedHealth.nutritionalCoverageScore >= baseline.nutritionalCoverageScore,
    "Improving zone health/resources unexpectedly worsened nutrition score",
  );
  assert(
    improvedHealth.daysSafe >= baseline.daysSafe,
    "Improving zone health/resources unexpectedly worsened daysSafe",
  );

  const extremeDegradationState = setAllZoneStress(MISSION_SEED, "critical");
  extremeDegradationState.resources.waterRecyclingEfficiencyPercent = 10;
  extremeDegradationState.zones = extremeDegradationState.zones.map((zone) => ({
    ...zone,
    status: "critical",
    projectedYieldKg: zone.projectedYieldKg * 0.1,
    allocationPercent: Math.max(1, Math.round(zone.allocationPercent * 0.25)),
  }));
  const extremeDegradation = calculateFromMissionState(
    extremeDegradationState,
    baseline.nutritionalCoverageScore,
  );
  assert(
    extremeDegradation.nutritionalCoverageScore < baseline.nutritionalCoverageScore,
    "Extreme degradation did not materially worsen the nutrition score",
  );
  assert(
    extremeDegradation.daysSafe < baseline.daysSafe,
    "Extreme degradation did not materially worsen daysSafe",
  );

  console.log(
    JSON.stringify(
      {
        baseline,
        reducedYield,
        worsenedStress,
        improvedHealth,
        extremeDegradation,
        checks: {
          returnedNutritionStatusShape: true,
          baselineReturnedCompleteResult: true,
          baselineMatchesSeedNutrition: true,
          deterministic: true,
          seedInputImmutable: true,
          clonedInputImmutable: true,
          reducedYieldDidNotImprove: true,
          worsenedStressDidNotImprove: true,
          improvedHealthDidNotWorsen: true,
          extremeDegradationWorsenedBaseline: true,
        },
      },
      null,
      2,
    ),
  );
}

main();
