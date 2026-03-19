/**
 * nutrition.calculator.ts
 *
 * Deterministic nutrition calculator for Mars Greenhouse Mission Control.
 * Takes the current crop zones + resources and returns a NutritionStatus.
 *
 * Formula summary (plain English):
 *   1. For each zone, estimate daily edible output in kg/day:
 *        dailyOutputKg = projectedYieldKg / growthCycleDays
 *      projectedYieldKg is the planner's current harvest estimate for this zone.
 *      allocationPercent is NOT a direct output multiplier — at nominal allocation
 *      a zone produces at full capacity. Resource scarcity effects are captured
 *      via zone stress severity, which the planner updates when resources are cut.
 *   2. Apply a stress penalty factor (0.0–1.0) based on zone stress severity.
 *      MCP confirms stress reduces biomass/yield; exact % are [APPROX].
 *   3. Apply a resource penalty factor from water recycling efficiency.
 *      MCP: target >85%; below that, crop stress increases. [APPROX] scaling.
 *   4. Multiply effective daily kg by crop nutrition coefficients (kcal/100g,
 *      protein/100g) from MCP-grounded crop profiles.
 *   5. Sum across all zones → daily calories produced, daily protein produced.
 *   6. Compute micronutrient adequacy: score each of the 7 KB-critical nutrients
 *      based on which crops are healthy enough to supply them.
 *   7. Compute nutritional coverage score using MCP §5.10 weighting:
 *        score = 0.50 × caloricCoverage + 0.30 × proteinCoverage + 0.20 × micronutrientAdequacy
 *      MCP risk hierarchy: calories > protein > micronutrients.
 *   8. daysSafe = nutritionalCoverageScore / 100 × remainingMissionDays (capped, [APPROX])
 *   9. trend is passed in from the caller (requires previous state comparison).
 */

import type { CropZone, NutritionStatus, NutritionTrend, ResourceState } from "../mission/mission.types";
import { CROP_PROFILES } from "../../data/cropProfiles.data";

// ─── Stress penalty factors ───────────────────────────────────────────────────
// MCP confirms stress reduces biomass accumulation and yield.
// Exact percentages are [APPROX] — derived from MCP qualitative guidance:
//   - salinity can reduce biomass 20–50% (MCP §4.4, only concrete figure)
//   - "high" and "critical" stress are proportionally worse
const STRESS_OUTPUT_FACTOR: Record<string, number> = {
  none:     1.00,
  low:      0.90, // [APPROX] ~10% output reduction
  moderate: 0.75, // [APPROX] ~25% output reduction
  high:     0.55, // [APPROX] ~45% output reduction
  critical: 0.30, // [APPROX] ~70% output reduction — consistent with MCP 20–50% salinity floor
};

// ─── Water recycling penalty ──────────────────────────────────────────────────
// MCP: target efficiency >85–95%. Below 85%, crop stress increases.
// [APPROX] linear scale: at 85% → factor 1.0; at 0% → factor 0.5 (floor)
function waterRecyclingFactor(efficiencyPct: number): number {
  const TARGET = 85;
  if (efficiencyPct >= TARGET) return 1.0;
  // Linear interpolation from 1.0 at 85% down to 0.5 at 0%
  return 0.5 + (efficiencyPct / TARGET) * 0.5;
}

// ─── Micronutrient coverage ───────────────────────────────────────────────────
// MCP §5.2.4 lists 7 critical micronutrients.
// MCP §5.3.3 maps each to its primary crop source.
// A nutrient is "covered" if its primary supplier zone is not critically stressed.
// [APPROX] binary per-nutrient adequacy, averaged to a 0–100 score.
const MICRONUTRIENT_SUPPLIERS: Record<string, string[]> = {
  vitamin_k:  ["lettuce"],
  vitamin_a:  ["lettuce"],
  folate:     ["lettuce", "beans"],
  vitamin_c:  ["radish", "potato"],
  iron:       ["beans"],
  potassium:  ["potato"],
  magnesium:  ["beans"],
};

function micronutrientAdequacy(zones: CropZone[]): number {
  // Build a map of cropType → effective output factor for this tick
  const cropFactor: Record<string, number> = {};
  for (const zone of zones) {
    const sf = STRESS_OUTPUT_FACTOR[zone.stress.severity] ?? 1.0;
    // Use the best (highest) factor if a crop type appears in multiple zones
    cropFactor[zone.cropType] = Math.max(cropFactor[zone.cropType] ?? 0, sf);
  }

  const nutrients = Object.keys(MICRONUTRIENT_SUPPLIERS);
  let totalScore = 0;

  for (const nutrient of nutrients) {
    const suppliers = MICRONUTRIENT_SUPPLIERS[nutrient] ?? [];
    // Adequacy for this nutrient = best factor among its suppliers (0 if no zone)
    const best = suppliers.reduce((max, crop) => Math.max(max, cropFactor[crop] ?? 0), 0);
    totalScore += best;
  }

  return Math.round((totalScore / nutrients.length) * 100);
}

// ─── Main calculator ──────────────────────────────────────────────────────────

export interface NutritionCalcInput {
  zones: CropZone[];
  resources: ResourceState;
  crewSize: number;
  missionDurationDays: number;
  missionDay: number;
  previousScore?: number; // pass previous nutritionalCoverageScore to compute trend
}

export function calculateNutrition(input: NutritionCalcInput): NutritionStatus {
  const { zones, resources, crewSize, missionDurationDays, missionDay, previousScore } = input;

  // MCP-grounded crew targets
  const dailyCaloriesTarget = crewSize * 3000;   // MCP: ~3,000 kcal/day per astronaut
  const dailyProteinTargetG = crewSize * 112.5;  // MCP: ~90–135 g/day; using midpoint [APPROX]

  const waterFactor = waterRecyclingFactor(resources.waterRecyclingEfficiencyPercent);

  let totalDailyCalories = 0;
  let totalDailyProteinG = 0;

  for (const zone of zones) {
    if (zone.status === "offline") continue;

    const profile = CROP_PROFILES[zone.cropType];
    if (!profile) continue;

    // Step 1: daily edible output estimate.
    // projectedYieldKg = planner's current harvest estimate for this zone.
    // Divide by growthCycleDays to get a continuous daily production rate.
    // allocationPercent is NOT applied here — at nominal allocation a zone produces
    // at full capacity. Resource scarcity is already reflected in zone stress severity
    // (set by the planner/scenario engine). allocationPercent is used by the planner
    // when reallocating resources; its effect shows up as changed stress states.
    const dailyOutputKg = zone.projectedYieldKg / zone.growthCycleDays;

    // Step 2: stress penalty
    const stressFactor = STRESS_OUTPUT_FACTOR[zone.stress.severity] ?? 1.0;

    // Step 3: resource (water) penalty — applied globally
    const effectiveKg = dailyOutputKg * stressFactor * waterFactor;

    // Step 4: convert to nutrition using MCP-grounded coefficients (per 100g = per 0.1 kg)
    const effectiveHundredGrams = effectiveKg * 10; // kg → units of 100g
    totalDailyCalories += effectiveHundredGrams * profile.nutrition.kcalPer100g;
    totalDailyProteinG += effectiveHundredGrams * profile.nutrition.proteinPer100gG;
  }

  // Round to integers — simulation precision doesn't need decimals
  const dailyCaloriesProduced = Math.round(totalDailyCalories);
  const dailyProteinProducedG = Math.round(totalDailyProteinG);

  const caloricCoveragePercent = Math.min(
    100,
    Math.round((dailyCaloriesProduced / dailyCaloriesTarget) * 100)
  );
  const proteinCoveragePercent = Math.min(
    100,
    Math.round((dailyProteinProducedG / dailyProteinTargetG) * 100)
  );

  // Step 6: micronutrient adequacy (0–100)
  const micronutrientAdequacyPercent = micronutrientAdequacy(zones);

  // Step 7: nutritional coverage score
  // MCP §5.10 + §5.8 risk hierarchy: calories > protein > micronutrients
  // Weights: 0.50 / 0.30 / 0.20 [APPROX — MCP gives hierarchy, not exact weights]
  const nutritionalCoverageScore = Math.round(
    0.50 * caloricCoveragePercent +
    0.30 * proteinCoveragePercent +
    0.20 * micronutrientAdequacyPercent
  );

  // Step 8: daysSafe
  // How many days the crew stays adequately fed at the current coverage rate.
  // [APPROX] formula: remaining days × (score / 100), floored at 0
  const remainingDays = Math.max(0, missionDurationDays - missionDay);
  const daysSafe = Math.max(0, Math.round(remainingDays * (nutritionalCoverageScore / 100)));

  // Step 9: trend — compare to previous score if available
  let trend: NutritionTrend = "stable";
  if (previousScore !== undefined) {
    const delta = nutritionalCoverageScore - previousScore;
    if (delta >= 2) trend = "improving";
    else if (delta <= -2) trend = "declining";
  }

  return {
    dailyCaloriesProduced,
    dailyCaloriesTarget,
    caloricCoveragePercent,
    dailyProteinProducedG,
    dailyProteinTargetG,
    proteinCoveragePercent,
    micronutrientAdequacyPercent,
    nutritionalCoverageScore,
    daysSafe,
    trend,
  };
}
