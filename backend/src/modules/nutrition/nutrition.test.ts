import { MISSION_SEED } from "../../data/mission.seed";
import { buildMissionSnapshot } from "../mission/mission.service";
import type {
  MissionState,
  NutritionStatus,
} from "../mission/mission.types";
import { calculateNutrition, type NutritionCalcInput } from "./nutrition.calculator";

let passed = 0;
let failed = 0;

const MICRONUTRIENT_KEYS = [
  "vitaminA",
  "vitaminC",
  "vitaminK",
  "folate",
  "iron",
  "potassium",
  "magnesium",
] as const;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function section(name: string): void {
  console.log(`\n── ${name} ──`);
}

function cloneMissionState(state: MissionState): MissionState {
  return structuredClone(state);
}

function seedInput(): NutritionCalcInput {
  return {
    zones: structuredClone(MISSION_SEED.zones),
    resources: structuredClone(MISSION_SEED.resources),
    crewSize: MISSION_SEED.crewSize,
    missionDurationTotal: MISSION_SEED.missionDurationTotal,
    missionDay: MISSION_SEED.missionDay,
  };
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

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

const VALID_TRENDS = new Set(["improving", "stable", "declining"]);

section("1. Seed-state calculation");

const nominal = calculateNutrition(seedInput());
const seedNutritionMatchesCalculator =
  JSON.stringify(nominal) === JSON.stringify(MISSION_SEED.nutrition);

assert(isFiniteNumber(nominal.dailyCaloriesProduced), "dailyCaloriesProduced is finite number");
assert(isFiniteNumber(nominal.dailyCaloriesTarget), "dailyCaloriesTarget is finite number");
assert(isFiniteNumber(nominal.caloricCoveragePercent), "caloricCoveragePercent is finite number");
assert(isFiniteNumber(nominal.dailyProteinG), "dailyProteinG is finite number");
assert(isFiniteNumber(nominal.dailyProteinTarget), "dailyProteinTarget is finite number");
assert(isFiniteNumber(nominal.proteinCoveragePercent), "proteinCoveragePercent is finite number");
assert(isFiniteNumber(nominal.nutritionalCoverageScore), "nutritionalCoverageScore is finite number");
assert(isFiniteNumber(nominal.daysSafe), "daysSafe is finite number");
assert(VALID_TRENDS.has(nominal.trend), "trend is a valid enum value", `got ${nominal.trend}`);

for (const key of MICRONUTRIENT_KEYS) {
  assert(isFiniteNumber(nominal[key].produced), `${key}.produced is finite`);
  assert(isFiniteNumber(nominal[key].target), `${key}.target is finite`);
  assert(isFiniteNumber(nominal[key].coveragePercent), `${key}.coveragePercent is finite`);
}

assert(
  nominal.dailyCaloriesTarget === MISSION_SEED.crewSize * 3000,
  "dailyCaloriesTarget = crewSize × 3000",
  `expected ${MISSION_SEED.crewSize * 3000}, got ${nominal.dailyCaloriesTarget}`,
);
assert(
  nominal.dailyProteinTarget === MISSION_SEED.crewSize * 112.5,
  "dailyProteinTarget = crewSize × 112.5",
  `expected ${MISSION_SEED.crewSize * 112.5}, got ${nominal.dailyProteinTarget}`,
);
assert(
  seedNutritionMatchesCalculator,
  "MISSION_SEED.nutrition matches calculator output for the seed state",
  `seed=${JSON.stringify(MISSION_SEED.nutrition)}, calculated=${JSON.stringify(nominal)}`,
);

section("2. Output coherence");

assert(nominal.dailyCaloriesProduced >= 0, "dailyCaloriesProduced >= 0");
assert(nominal.dailyProteinG >= 0, "dailyProteinG >= 0");
assert(
  nominal.caloricCoveragePercent >= 0 && nominal.caloricCoveragePercent <= 100,
  "caloricCoveragePercent in [0, 100]",
  `got ${nominal.caloricCoveragePercent}`,
);
assert(
  nominal.proteinCoveragePercent >= 0 && nominal.proteinCoveragePercent <= 100,
  "proteinCoveragePercent in [0, 100]",
  `got ${nominal.proteinCoveragePercent}`,
);
assert(
  nominal.nutritionalCoverageScore >= 0 && nominal.nutritionalCoverageScore <= 100,
  "nutritionalCoverageScore in [0, 100]",
  `got ${nominal.nutritionalCoverageScore}`,
);
assert(nominal.daysSafe >= 0, "daysSafe >= 0");
assert(nominal.dailyCaloriesProduced > 0, "nominal seed produces > 0 calories");
assert(nominal.nutritionalCoverageScore > 0, "nominal seed coverage score > 0");

for (const key of MICRONUTRIENT_KEYS) {
  assert(
    nominal[key].coveragePercent >= 0 && nominal[key].coveragePercent <= 100,
    `${key}.coveragePercent in [0, 100]`,
    `got ${nominal[key].coveragePercent}`,
  );
}

section("3. Determinism");

const run1 = calculateNutrition(seedInput());
const run2 = calculateNutrition(seedInput());

assert(
  JSON.stringify(run1) === JSON.stringify(run2),
  "nutrition calculation is deterministic on identical input",
);

section("4. Input immutability");

const originalSeedSnapshot = JSON.stringify(MISSION_SEED);
calculateNutrition({
  zones: MISSION_SEED.zones,
  resources: MISSION_SEED.resources,
  crewSize: MISSION_SEED.crewSize,
  missionDurationTotal: MISSION_SEED.missionDurationTotal,
  missionDay: MISSION_SEED.missionDay,
});
assert(
  JSON.stringify(MISSION_SEED) === originalSeedSnapshot,
  "MISSION_SEED is not mutated by calculator",
);

section("5. Behavior sanity");

const heatLettuceState = cloneMissionState(MISSION_SEED);
heatLettuceState.zones = heatLettuceState.zones.map((zone) =>
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
const heatLettuceSnapshot = buildMissionSnapshot(heatLettuceState);
const heatLettuceResult = calculateFromMissionState(heatLettuceState);
assert(
  heatLettuceSnapshot.zones[0].stress.type === "heat",
  "high lettuce temperature derives heat stress",
);
assert(
  heatLettuceSnapshot.zones[0].stress.boltingRisk,
  "high lettuce temperature derives bolting risk",
);
assert(
  heatLettuceResult.vitaminA.coveragePercent <= nominal.vitaminA.coveragePercent,
  "heat-stressed lettuce does not improve vitamin A coverage",
  `nominal=${nominal.vitaminA.coveragePercent}, stressed=${heatLettuceResult.vitaminA.coveragePercent}`,
);

const dryPotatoState = cloneMissionState(MISSION_SEED);
dryPotatoState.zones = dryPotatoState.zones.map((zone) =>
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
const dryPotatoSnapshot = buildMissionSnapshot(dryPotatoState);
const dryPotatoResult = calculateFromMissionState(dryPotatoState);
assert(
  dryPotatoSnapshot.zones[1].stress.type === "water_deficit",
  "low soil moisture derives potato water-deficit stress",
);
assert(
  dryPotatoResult.dailyCaloriesProduced < nominal.dailyCaloriesProduced,
  "dry potato case reduces calories",
  `nominal=${nominal.dailyCaloriesProduced}, dry=${dryPotatoResult.dailyCaloriesProduced}`,
);
assert(
  dryPotatoResult.potassium.coveragePercent <= nominal.potassium.coveragePercent,
  "dry potato case does not improve potassium coverage",
  `nominal=${nominal.potassium.coveragePercent}, dry=${dryPotatoResult.potassium.coveragePercent}`,
);

const offlinePotato = seedInput();
offlinePotato.zones = offlinePotato.zones.map((zone) =>
  zone.cropType === "potato" ? { ...zone, status: "offline" } : zone,
);
const offlineResult = calculateNutrition(offlinePotato);
assert(
  offlineResult.dailyCaloriesProduced < nominal.dailyCaloriesProduced,
  "offline potato zone reduces calories",
  `nominal=${nominal.dailyCaloriesProduced}, offline=${offlineResult.dailyCaloriesProduced}`,
);

const halfYield = seedInput();
halfYield.zones = halfYield.zones.map((zone) => ({
  ...zone,
  projectedYieldKg: zone.projectedYieldKg / 2,
}));
const halfYieldResult = calculateNutrition(halfYield);
assert(
  halfYieldResult.dailyCaloriesProduced < nominal.dailyCaloriesProduced,
  "halving projectedYieldKg reduces calories",
  `nominal=${nominal.dailyCaloriesProduced}, half=${halfYieldResult.dailyCaloriesProduced}`,
);

const zeroPotatoAllocation = seedInput();
zeroPotatoAllocation.zones = zeroPotatoAllocation.zones.map((zone) =>
  zone.cropType === "potato" ? { ...zone, allocationPercent: 0 } : zone,
);
const zeroPotatoAllocationResult = calculateNutrition(zeroPotatoAllocation);
assert(
  zeroPotatoAllocationResult.dailyCaloriesProduced === nominal.dailyCaloriesProduced,
  "allocationPercent alone does not change output",
  `nominal=${nominal.dailyCaloriesProduced}, zeroAlloc=${zeroPotatoAllocationResult.dailyCaloriesProduced}`,
);

const degradedWaterResourceOnly = seedInput();
degradedWaterResourceOnly.resources = {
  ...degradedWaterResourceOnly.resources,
  waterRecyclingEfficiency: 40,
};
const degradedWaterResourceOnlyResult = calculateNutrition(degradedWaterResourceOnly);
assert(
  degradedWaterResourceOnlyResult.dailyCaloriesProduced === nominal.dailyCaloriesProduced,
  "resource-only change does not affect raw calculator without projected-yield updates",
  `nominal=${nominal.dailyCaloriesProduced}, degraded=${degradedWaterResourceOnlyResult.dailyCaloriesProduced}`,
);

const decliningResult = calculateNutrition({
  ...seedInput(),
  previousScore: nominal.nutritionalCoverageScore + 10,
});
assert(
  decliningResult.trend === "declining",
  "trend = declining when previousScore is 10 points higher",
  `got ${decliningResult.trend}`,
);

const improvingResult = calculateNutrition({
  ...seedInput(),
  previousScore: nominal.nutritionalCoverageScore - 10,
});
assert(
  improvingResult.trend === "improving",
  "trend = improving when previousScore is 10 points lower",
  `got ${improvingResult.trend}`,
);

const stableResult = calculateNutrition(seedInput());
assert(
  stableResult.trend === "stable",
  "trend = stable when no previousScore is provided",
  `got ${stableResult.trend}`,
);

section("6. NutritionStatus shape completeness");

const requiredKeys: Array<keyof NutritionStatus> = [
  "dailyCaloriesProduced",
  "dailyCaloriesTarget",
  "caloricCoveragePercent",
  "dailyProteinG",
  "dailyProteinTarget",
  "proteinCoveragePercent",
  "vitaminA",
  "vitaminC",
  "vitaminK",
  "folate",
  "iron",
  "potassium",
  "magnesium",
  "nutritionalCoverageScore",
  "daysSafe",
  "trend",
];

for (const key of requiredKeys) {
  assert(key in nominal, `output contains required key: ${key}`);
}

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`\nNominal seed output:`);
console.log(JSON.stringify(nominal, null, 2));

if (failed > 0) {
  process.exit(1);
}
