import { MISSION_SEED } from "../../data/mission.seed";
import type { ScenarioInjectRequest } from "../../schemas/scenario.schema";
import { getMissionState, resetMissionState } from "../mission/mission.store";
import type { MissionState, NutritionStatus } from "../mission/mission.types";
import { injectScenario } from "../scenarios/scenario.service";
import { getCurrentNutritionPreservationPlan } from "./planner.service";

let passed = 0;
let failed = 0;
const seedSnapshotBefore = JSON.stringify(MISSION_SEED);

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

function runPlanner(input?: ScenarioInjectRequest) {
  resetMissionState();

  if (input) {
    injectScenario(input);
  }

  const storeBeforePlan = cloneMissionState(getMissionState());
  const plan = getCurrentNutritionPreservationPlan();
  const storeAfterPlan = getMissionState();

  return {
    plan,
    storeBeforePlan,
    storeAfterPlan,
  };
}

function forecastMeaningfullyChanged(input: {
  before: NutritionStatus;
  after: NutritionStatus;
}): boolean {
  const { before, after } = input;

  return (
    before.dailyCaloriesProduced !== after.dailyCaloriesProduced ||
    before.dailyProteinProducedG !== after.dailyProteinProducedG ||
    before.micronutrientAdequacyPercent !== after.micronutrientAdequacyPercent ||
    before.nutritionalCoverageScore !== after.nutritionalCoverageScore ||
    before.daysSafe !== after.daysSafe
  );
}

section("1. Healthy baseline");

const baseline = runPlanner();
assert(baseline.plan.mode === "normal", "baseline stays in normal mode");
assert(baseline.plan.recommendedActions.length === 0, "baseline returns no planner actions");
assert(
  JSON.stringify(baseline.plan.nutritionForecast.before) ===
    JSON.stringify(baseline.plan.nutritionForecast.after),
  "baseline forecast is unchanged in normal mode",
);
assert(
  JSON.stringify(baseline.storeBeforePlan) === JSON.stringify(baseline.storeAfterPlan),
  "baseline planning does not mutate the mission store",
);

section("2. Mild degradation");

const mildEnergy = runPlanner({
  scenarioType: "energy_budget_reduction",
  severity: "mild",
});
assert(mildEnergy.plan.mode === "normal", "mild energy degradation stays in normal mode");
assert(
  mildEnergy.plan.recommendedActions.length === 0,
  "mild energy degradation returns no planner actions",
);
assert(
  JSON.stringify(mildEnergy.plan.nutritionForecast.before) ===
    JSON.stringify(mildEnergy.plan.nutritionForecast.after),
  "mild energy degradation keeps forecast unchanged",
);

section("3. Preservation-mode actions are meaningful");

const degradedCases: Array<{
  label: string;
  input: ScenarioInjectRequest;
}> = [
  {
    label: "critical water decline",
    input: {
      scenarioType: "water_recycling_decline",
      severity: "critical",
    },
  },
  {
    label: "critical energy deficit",
    input: {
      scenarioType: "energy_budget_reduction",
      severity: "critical",
    },
  },
  {
    label: "critical temperature failure",
    input: {
      scenarioType: "temperature_control_failure",
      severity: "critical",
    },
  },
];

for (const degradedCase of degradedCases) {
  const result = runPlanner(degradedCase.input);
  const { before, after } = result.plan.nutritionForecast;

  assert(
    result.plan.mode === "nutrition_preservation",
    `${degradedCase.label} enters nutrition preservation mode`,
  );
  assert(
    result.plan.recommendedActions.length >= 1 &&
      result.plan.recommendedActions.length <= 3,
    `${degradedCase.label} returns 1-3 actions`,
    `got ${result.plan.recommendedActions.length}`,
  );
  assert(
    forecastMeaningfullyChanged({ before, after }),
    `${degradedCase.label} changes nutrition forecast in a meaningful way`,
    `before=${JSON.stringify(before)}, after=${JSON.stringify(after)}`,
  );
  assert(
    after.nutritionalCoverageScore > before.nutritionalCoverageScore,
    `${degradedCase.label} improves nutritional coverage score`,
    `before=${before.nutritionalCoverageScore}, after=${after.nutritionalCoverageScore}`,
  );
  assert(
    after.dailyCaloriesProduced > before.dailyCaloriesProduced,
    `${degradedCase.label} improves calorie output`,
    `before=${before.dailyCaloriesProduced}, after=${after.dailyCaloriesProduced}`,
  );
  assert(
    JSON.stringify(result.storeBeforePlan) === JSON.stringify(result.storeAfterPlan),
    `${degradedCase.label} planning does not mutate the mission store`,
  );
}

section("4. Seed safety");

assert(
  JSON.stringify(MISSION_SEED) === seedSnapshotBefore,
  "MISSION_SEED remains unchanged after planner tests",
);

console.log(`\n${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
