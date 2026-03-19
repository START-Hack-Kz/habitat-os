/**
 * nutrition.validate.ts
 * Quick validation script — run with: npx ts-node src/modules/nutrition/nutrition.validate.ts
 * Demonstrates the calculator against the seed state and a stressed state.
 */

import { MISSION_SEED } from "../../data/mission.seed";
import { calculateNutrition } from "./nutrition.calculator";

// ── Case 1: nominal seed state ────────────────────────────────────────────────
const nominal = calculateNutrition({
  zones: MISSION_SEED.zones,
  resources: MISSION_SEED.resources,
  crewSize: MISSION_SEED.crewSize,
  missionDurationDays: MISSION_SEED.missionDurationDays,
  missionDay: MISSION_SEED.missionDay,
});

console.log("=== CASE 1: Nominal seed state ===");
console.log(JSON.stringify(nominal, null, 2));

// ── Case 2: water recycling failure (efficiency 45%) + lettuce critically stressed ──
const failureZones = structuredClone(MISSION_SEED.zones).map((z: typeof MISSION_SEED.zones[number]) => {
  if (z.cropType === "lettuce") {
    return { ...z, stress: { ...z.stress, active: true, type: "water_stress" as const, severity: "critical" as const, summary: "Critical water stress" } };
  }
  if (z.cropType === "potato") {
    return { ...z, stress: { ...z.stress, active: true, type: "water_stress" as const, severity: "moderate" as const, summary: "Moderate water stress" } };
  }
  return z;
});

const failureResources = { ...MISSION_SEED.resources, waterRecyclingEfficiencyPercent: 45 };

const failure = calculateNutrition({
  zones: failureZones,
  resources: failureResources,
  crewSize: MISSION_SEED.crewSize,
  missionDurationDays: MISSION_SEED.missionDurationDays,
  missionDay: MISSION_SEED.missionDay,
  previousScore: nominal.nutritionalCoverageScore,
});

console.log("\n=== CASE 2: Water recycling failure (45%) + lettuce critical + potato moderate ===");
console.log(JSON.stringify(failure, null, 2));

console.log("\n=== DELTA ===");
console.log(`caloricCoverage:      ${nominal.caloricCoveragePercent}% → ${failure.caloricCoveragePercent}%`);
console.log(`proteinCoverage:      ${nominal.proteinCoveragePercent}% → ${failure.proteinCoveragePercent}%`);
console.log(`micronutrientAdequacy:${nominal.micronutrientAdequacyPercent}% → ${failure.micronutrientAdequacyPercent}%`);
console.log(`coverageScore:        ${nominal.nutritionalCoverageScore} → ${failure.nutritionalCoverageScore}`);
console.log(`daysSafe:             ${nominal.daysSafe} → ${failure.daysSafe}`);
console.log(`trend:                ${failure.trend}`);
