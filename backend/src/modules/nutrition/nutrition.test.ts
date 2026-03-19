/**
 * nutrition.test.ts
 * M4 nutrition calculator validation — covers:
 *   1. Type validity (compile-time, confirmed by tsc)
 *   2. Seed-state calculation — complete, non-crashing, finite values
 *   3. Determinism — same input → same output twice
 *   4. Input immutability — calculator must not mutate seed state
 *   5. Behavior sanity — worse inputs → worse or equal outputs
 *   6. Output coherence — no negatives, no impossible values, valid trend
 *
 * Run: npx tsx --tsconfig backend/tsconfig.json backend/src/modules/nutrition/nutrition.test.ts
 */

import { MISSION_SEED } from "../../data/mission.seed";
import { calculateNutrition, type NutritionCalcInput } from "./nutrition.calculator";
import type { NutritionStatus } from "../mission/mission.types";

// ─── Minimal assertion helpers ────────────────────────────────────────────────

let passed = 0;
let failed = 0;

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function seedInput(): NutritionCalcInput {
  return {
    zones: structuredClone(MISSION_SEED.zones),
    resources: structuredClone(MISSION_SEED.resources),
    crewSize: MISSION_SEED.crewSize,
    missionDurationDays: MISSION_SEED.missionDurationDays,
    missionDay: MISSION_SEED.missionDay,
  };
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && isFinite(v) && !isNaN(v);
}

const VALID_TRENDS = new Set(["improving", "stable", "declining"]);

// ─── 1. Seed-state calculation ────────────────────────────────────────────────

section("1. Seed-state calculation");

const nominal = calculateNutrition(seedInput());
const seedNutritionMatchesCalculator =
  JSON.stringify(nominal) === JSON.stringify(MISSION_SEED.nutrition);

assert(isFiniteNumber(nominal.dailyCaloriesProduced),   "dailyCaloriesProduced is finite number");
assert(isFiniteNumber(nominal.dailyCaloriesTarget),     "dailyCaloriesTarget is finite number");
assert(isFiniteNumber(nominal.caloricCoveragePercent),  "caloricCoveragePercent is finite number");
assert(isFiniteNumber(nominal.dailyProteinProducedG),   "dailyProteinProducedG is finite number");
assert(isFiniteNumber(nominal.dailyProteinTargetG),     "dailyProteinTargetG is finite number");
assert(isFiniteNumber(nominal.proteinCoveragePercent),  "proteinCoveragePercent is finite number");
assert(isFiniteNumber(nominal.micronutrientAdequacyPercent), "micronutrientAdequacyPercent is finite number");
assert(isFiniteNumber(nominal.nutritionalCoverageScore),"nutritionalCoverageScore is finite number");
assert(isFiniteNumber(nominal.daysSafe),                "daysSafe is finite number");
assert(VALID_TRENDS.has(nominal.trend),                 "trend is valid enum value", `got: ${nominal.trend}`);

// Targets must match crew size × per-person targets
assert(nominal.dailyCaloriesTarget === MISSION_SEED.crewSize * 3000,
  "dailyCaloriesTarget = crewSize × 3000",
  `expected ${MISSION_SEED.crewSize * 3000}, got ${nominal.dailyCaloriesTarget}`);
assert(nominal.dailyProteinTargetG === MISSION_SEED.crewSize * 112.5,
  "dailyProteinTargetG = crewSize × 112.5",
  `expected ${MISSION_SEED.crewSize * 112.5}, got ${nominal.dailyProteinTargetG}`);
assert(
  seedNutritionMatchesCalculator,
  "MISSION_SEED.nutrition matches calculator output for the seed state",
  `seed=${JSON.stringify(MISSION_SEED.nutrition)}, calculated=${JSON.stringify(nominal)}`
);

// ─── 2. Output coherence ──────────────────────────────────────────────────────

section("2. Output coherence");

assert(nominal.dailyCaloriesProduced >= 0,              "dailyCaloriesProduced >= 0");
assert(nominal.dailyProteinProducedG >= 0,              "dailyProteinProducedG >= 0");
assert(nominal.caloricCoveragePercent >= 0 && nominal.caloricCoveragePercent <= 100,
  "caloricCoveragePercent in [0, 100]",
  `got ${nominal.caloricCoveragePercent}`);
assert(nominal.proteinCoveragePercent >= 0 && nominal.proteinCoveragePercent <= 100,
  "proteinCoveragePercent in [0, 100]",
  `got ${nominal.proteinCoveragePercent}`);
assert(nominal.micronutrientAdequacyPercent >= 0 && nominal.micronutrientAdequacyPercent <= 100,
  "micronutrientAdequacyPercent in [0, 100]",
  `got ${nominal.micronutrientAdequacyPercent}`);
assert(nominal.nutritionalCoverageScore >= 0 && nominal.nutritionalCoverageScore <= 100,
  "nutritionalCoverageScore in [0, 100]",
  `got ${nominal.nutritionalCoverageScore}`);
assert(nominal.daysSafe >= 0,                           "daysSafe >= 0");

// Nominal seed should produce a meaningful (non-zero) output
assert(nominal.dailyCaloriesProduced > 0,               "nominal seed produces > 0 calories");
assert(nominal.nutritionalCoverageScore > 0,            "nominal seed coverage score > 0");

// ─── 3. Determinism ───────────────────────────────────────────────────────────

section("3. Determinism");

const run1 = calculateNutrition(seedInput());
const run2 = calculateNutrition(seedInput());

assert(run1.dailyCaloriesProduced === run2.dailyCaloriesProduced,
  "dailyCaloriesProduced identical on two runs");
assert(run1.nutritionalCoverageScore === run2.nutritionalCoverageScore,
  "nutritionalCoverageScore identical on two runs");
assert(run1.daysSafe === run2.daysSafe,
  "daysSafe identical on two runs");
assert(run1.micronutrientAdequacyPercent === run2.micronutrientAdequacyPercent,
  "micronutrientAdequacyPercent identical on two runs");

// ─── 4. Input immutability ────────────────────────────────────────────────────

section("4. Input immutability");

const originalZonesSnapshot = JSON.stringify(MISSION_SEED.zones);
const originalResourcesSnapshot = JSON.stringify(MISSION_SEED.resources);

// Run calculator directly on the seed (not a clone) to test for mutation
calculateNutrition({
  zones: MISSION_SEED.zones,
  resources: MISSION_SEED.resources,
  crewSize: MISSION_SEED.crewSize,
  missionDurationDays: MISSION_SEED.missionDurationDays,
  missionDay: MISSION_SEED.missionDay,
});

assert(JSON.stringify(MISSION_SEED.zones) === originalZonesSnapshot,
  "MISSION_SEED.zones not mutated by calculator");
assert(JSON.stringify(MISSION_SEED.resources) === originalResourcesSnapshot,
  "MISSION_SEED.resources not mutated by calculator");

// ─── 5. Behavior sanity ───────────────────────────────────────────────────────

section("5. Behavior sanity");

// 5a. Worsening stress on potato (caloric backbone) → score should not improve
const worsePotato = seedInput();
worsePotato.zones = worsePotato.zones.map(z =>
  z.cropType === "potato"
    ? { ...z, stress: { ...z.stress, active: true, type: "water_stress" as const, severity: "high" as const, summary: "High water stress" } }
    : z
);
const worsePotato_result = calculateNutrition(worsePotato);
assert(
  worsePotato_result.nutritionalCoverageScore <= nominal.nutritionalCoverageScore,
  "high potato stress → coverage score ≤ nominal",
  `nominal=${nominal.nutritionalCoverageScore}, stressed=${worsePotato_result.nutritionalCoverageScore}`
);
assert(
  worsePotato_result.dailyCaloriesProduced <= nominal.dailyCaloriesProduced,
  "high potato stress → calories ≤ nominal",
  `nominal=${nominal.dailyCaloriesProduced}, stressed=${worsePotato_result.dailyCaloriesProduced}`
);

// 5b. Worsening stress on beans (protein security) → protein should not improve
const worseBeans = seedInput();
worseBeans.zones = worseBeans.zones.map(z =>
  z.cropType === "beans"
    ? { ...z, stress: { ...z.stress, active: true, type: "water_stress" as const, severity: "high" as const, summary: "High water stress" } }
    : z
);
const worseBeans_result = calculateNutrition(worseBeans);
assert(
  worseBeans_result.dailyProteinProducedG <= nominal.dailyProteinProducedG,
  "high beans stress → protein ≤ nominal",
  `nominal=${nominal.dailyProteinProducedG}, stressed=${worseBeans_result.dailyProteinProducedG}`
);

// 5c. Worsening stress on lettuce → micronutrient adequacy should not improve
const worseLettuce = seedInput();
worseLettuce.zones = worseLettuce.zones.map(z =>
  z.cropType === "lettuce"
    ? { ...z, stress: { ...z.stress, active: true, type: "temperature_drift" as const, severity: "critical" as const, summary: "Critical heat stress" } }
    : z
);
const worseLettuce_result = calculateNutrition(worseLettuce);
assert(
  worseLettuce_result.micronutrientAdequacyPercent <= nominal.micronutrientAdequacyPercent,
  "critical lettuce stress → micronutrient adequacy ≤ nominal",
  `nominal=${nominal.micronutrientAdequacyPercent}, stressed=${worseLettuce_result.micronutrientAdequacyPercent}`
);

// 5d. Offline zone → output should not exceed nominal
const offlineZone = seedInput();
offlineZone.zones = offlineZone.zones.map(z =>
  z.cropType === "potato" ? { ...z, status: "offline" as const } : z
);
const offline_result = calculateNutrition(offlineZone);
assert(
  offline_result.dailyCaloriesProduced < nominal.dailyCaloriesProduced,
  "offline potato zone → calories strictly less than nominal",
  `nominal=${nominal.dailyCaloriesProduced}, offline=${offline_result.dailyCaloriesProduced}`
);

// 5e. Degraded water recycling → output should not improve
const badWater = seedInput();
badWater.resources = { ...badWater.resources, waterRecyclingEfficiencyPercent: 40 };
const badWater_result = calculateNutrition(badWater);
assert(
  badWater_result.nutritionalCoverageScore <= nominal.nutritionalCoverageScore,
  "water recycling 40% → coverage score ≤ nominal",
  `nominal=${nominal.nutritionalCoverageScore}, degraded=${badWater_result.nutritionalCoverageScore}`
);

// 5f. Extreme degradation — all zones critical stress + water recycling 20%
const extreme = seedInput();
extreme.zones = extreme.zones.map(z => ({
  ...z,
  stress: { ...z.stress, active: true, type: "water_stress" as const, severity: "critical" as const, summary: "Critical" },
}));
extreme.resources = { ...extreme.resources, waterRecyclingEfficiencyPercent: 20 };
const extreme_result = calculateNutrition(extreme);
assert(
  extreme_result.nutritionalCoverageScore < nominal.nutritionalCoverageScore,
  "extreme degradation → coverage score strictly less than nominal",
  `nominal=${nominal.nutritionalCoverageScore}, extreme=${extreme_result.nutritionalCoverageScore}`
);
assert(
  extreme_result.daysSafe < nominal.daysSafe,
  "extreme degradation → daysSafe strictly less than nominal",
  `nominal=${nominal.daysSafe}, extreme=${extreme_result.daysSafe}`
);

// 5g. projectedYieldKg is used — halving it should reduce output
const halfYield = seedInput();
halfYield.zones = halfYield.zones.map(z => ({ ...z, projectedYieldKg: z.projectedYieldKg / 2 }));
const halfYield_result = calculateNutrition(halfYield);
assert(
  halfYield_result.dailyCaloriesProduced < nominal.dailyCaloriesProduced,
  "halving projectedYieldKg on all zones → calories strictly less than nominal",
  `nominal=${nominal.dailyCaloriesProduced}, half=${halfYield_result.dailyCaloriesProduced}`
);

// 5h. allocationPercent does NOT directly scale output — zeroing it should have no effect
// (resource scarcity effects flow through stress severity, set by the planner)
const zeroPotatoAlloc = seedInput();
zeroPotatoAlloc.zones = zeroPotatoAlloc.zones.map(z =>
  z.cropType === "potato" ? { ...z, allocationPercent: 0 } : z
);
const zeroPotatoAlloc_result = calculateNutrition(zeroPotatoAlloc);
assert(
  zeroPotatoAlloc_result.dailyCaloriesProduced === nominal.dailyCaloriesProduced,
  "allocationPercent alone does not change output (stress severity does)",
  `nominal=${nominal.dailyCaloriesProduced}, zeroAlloc=${zeroPotatoAlloc_result.dailyCaloriesProduced}`
);

// 5i. Trend: previousScore higher than current → should be "declining"
const decliningResult = calculateNutrition({
  ...seedInput(),
  previousScore: nominal.nutritionalCoverageScore + 10,
});
assert(decliningResult.trend === "declining",
  "trend = declining when previousScore is 10 points higher",
  `got: ${decliningResult.trend}`);

// 5h. Trend: previousScore lower than current → should be "improving"
const improvingResult = calculateNutrition({
  ...seedInput(),
  previousScore: nominal.nutritionalCoverageScore - 10,
});
assert(improvingResult.trend === "improving",
  "trend = improving when previousScore is 10 points lower",
  `got: ${improvingResult.trend}`);

// 5i. Trend: no previousScore → should be "stable"
const stableResult = calculateNutrition(seedInput());
assert(stableResult.trend === "stable",
  "trend = stable when no previousScore provided",
  `got: ${stableResult.trend}`);

// ─── 6. NutritionStatus shape completeness ────────────────────────────────────

section("6. NutritionStatus shape completeness");

const requiredKeys: (keyof NutritionStatus)[] = [
  "dailyCaloriesProduced",
  "dailyCaloriesTarget",
  "caloricCoveragePercent",
  "dailyProteinProducedG",
  "dailyProteinTargetG",
  "proteinCoveragePercent",
  "micronutrientAdequacyPercent",
  "nutritionalCoverageScore",
  "daysSafe",
  "trend",
];

for (const key of requiredKeys) {
  assert(key in nominal, `output contains required key: ${key}`);
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`\nNominal seed output:`);
console.log(JSON.stringify(nominal, null, 2));

if (failed > 0) {
  process.exit(1);
}
