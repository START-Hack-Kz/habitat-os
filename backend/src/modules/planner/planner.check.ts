import { MISSION_SEED } from "../../data/mission.seed";
import type { ScenarioInjectRequest } from "../../schemas/scenario.schema";
import { resetMissionState, getMissionState, setMissionState } from "../mission/mission.store";
import type { MissionState } from "../mission/mission.types";
import { getCurrentMissionSnapshot } from "../mission/mission.service";
import {
  applyScenarioInjection,
  injectScenario,
} from "../scenarios/scenario.service";
import {
  createNutritionPreservationPlan,
  getCurrentNutritionPreservationPlan,
} from "./planner.service";

function cloneMissionState(state: MissionState): MissionState {
  return structuredClone(state);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function injectFromBaseline(input: ScenarioInjectRequest) {
  resetMissionState();
  return injectScenario(input);
}

function assertScenarioDeterminism(
  input: ScenarioInjectRequest,
  label: string,
): MissionState {
  const firstRun = injectFromBaseline(input);
  const secondRun = injectFromBaseline(input);

  assert(
    JSON.stringify(firstRun) === JSON.stringify(secondRun),
    `${label} scenario injection is not deterministic`,
  );
  assert(
    firstRun.eventLog.length === MISSION_SEED.eventLog.length + 1,
    `${label} scenario did not append exactly one event log entry`,
  );

  return firstRun;
}

function main(): void {
  const seedBefore = cloneMissionState(MISSION_SEED);

  const waterInput: ScenarioInjectRequest = {
    scenarioType: "water_recycling_decline",
    severity: "critical",
  };
  const waterA = assertScenarioDeterminism(waterInput, "Water recycling");

  assert(
    waterA.resources.waterRecyclingEfficiencyPercent === 45,
    "Water recycling scenario did not set efficiency to 45%",
  );
  const lettuceAfterWater = waterA.zones.find((zone) => zone.cropType === "lettuce");
  assert(
    lettuceAfterWater?.stress.type === "water_stress",
    "Water recycling scenario did not apply water stress to lettuce",
  );
  assert(
    lettuceAfterWater !== undefined && lettuceAfterWater.projectedYieldKg < 160,
    "Water recycling scenario did not reduce lettuce projected yield",
  );
  assert(
    waterA.eventLog[0]?.message ===
      "CRITICAL: Water recycling at 45%. Severe water loss. Nutrition Preservation Mode recommended.",
    "Water recycling scenario did not append the expected event log entry",
  );

  const energy = assertScenarioDeterminism(
    {
      scenarioType: "energy_budget_reduction",
      severity: "moderate",
    },
    "Energy budget reduction",
  );
  const potatoAfterEnergy = energy.zones.find((zone) => zone.cropType === "potato");
  assert(
    energy.resources.energyAvailableKwh === 180,
    "Energy scenario did not set energyAvailableKwh to 180",
  );
  assert(
    potatoAfterEnergy?.stress.severity === "moderate",
    "Energy scenario did not push the potato zone to moderate stress",
  );
  assert(
    energy.eventLog[0]?.message ===
      "Energy deficit. LED intensity reduced. Potato zone entering moderate stress.",
    "Energy scenario did not append the expected event log entry",
  );
  assert(
    potatoAfterEnergy !== undefined && potatoAfterEnergy.projectedYieldKg < 540,
    "Energy scenario did not reduce potato projected yield",
  );

  const temperature = assertScenarioDeterminism(
    {
      scenarioType: "temperature_control_failure",
      severity: "critical",
    },
    "Temperature control failure",
  );
  const lettuceAfterTemperature = temperature.zones.find(
    (zone) => zone.cropType === "lettuce",
  );
  const beansAfterTemperature = temperature.zones.find(
    (zone) => zone.cropType === "beans",
  );
  assert(
    lettuceAfterTemperature?.stress.type === "temperature_drift",
    "Temperature scenario did not set the expected stress type",
  );
  assert(
    lettuceAfterTemperature?.stress.severity === "critical" &&
      beansAfterTemperature?.stress.severity === "moderate",
    "Temperature scenario did not apply the expected crop-specific stress levels",
  );
  assert(
    temperature.eventLog[0]?.message ===
      "CRITICAL: Temperature at 32°C. Lettuce and potato critically stressed. Redirect resources to beans.",
    "Temperature scenario did not append the expected event log entry",
  );
  assert(
    lettuceAfterTemperature !== undefined && lettuceAfterTemperature.projectedYieldKg < 160,
    "Temperature scenario did not reduce lettuce projected yield",
  );

  const targetedWater = injectFromBaseline({
    scenarioType: "water_recycling_decline",
    severity: "moderate",
    affectedZoneIds: ["zone-a", "zone-d"],
  });
  const targetedPotato = targetedWater.zones.find((zone) => zone.zoneId === "zone-b");
  assert(
    targetedPotato?.stress.severity === "none",
    "Targeted scenario injection unexpectedly changed an unaffected zone",
  );

  resetMissionState();
  const normalPlan = getCurrentNutritionPreservationPlan();
  assert(normalPlan.mode === "normal", "Healthy baseline should remain in normal mode");
  assert(
    normalPlan.recommendedActions.length === 0,
    "Healthy baseline should not return planner actions",
  );

  const pureScenarioInput = cloneMissionState(MISSION_SEED);
  const pureScenarioInputBefore = JSON.stringify(pureScenarioInput);
  const pureScenarioOutput = applyScenarioInjection(pureScenarioInput, {
    scenarioType: "water_recycling_decline",
    severity: "mild",
  });
  assert(
    JSON.stringify(pureScenarioInput) === pureScenarioInputBefore,
    "applyScenarioInjection unexpectedly mutated its source input",
  );
  assert(
    pureScenarioOutput.resources.waterRecyclingEfficiencyPercent === 78,
    "Pure scenario helper did not apply the expected water override",
  );

  resetMissionState();
  injectScenario({
    scenarioType: "energy_budget_reduction",
    severity: "mild",
  });
  const mildEnergyPlan = getCurrentNutritionPreservationPlan();
  assert(
    mildEnergyPlan.mode === "normal",
    "Mild energy degradation should stay in normal mode with current thresholds",
  );

  resetMissionState();
  injectScenario({
    scenarioType: "water_recycling_decline",
    severity: "critical",
  });
  const degradedPlan = getCurrentNutritionPreservationPlan();
  assert(
    degradedPlan.mode === "nutrition_preservation",
    "Critical degraded state should enter nutrition preservation mode",
  );
  assert(
    degradedPlan.recommendedActions.length >= 1 &&
      degradedPlan.recommendedActions.length <= 3,
    "Planner must return between 1 and 3 actions in nutrition preservation mode",
  );
  assert(
    typeof degradedPlan.nutritionForecast.before.nutritionalCoverageScore === "number" &&
      typeof degradedPlan.nutritionForecast.after.nutritionalCoverageScore === "number",
    "Planner nutrition forecast is structurally invalid",
  );

  const storeBeforePlan = cloneMissionState(getMissionState());
  const directPlan = createNutritionPreservationPlan(storeBeforePlan);
  const storeAfterPlan = getMissionState();
  assert(
    JSON.stringify(storeBeforePlan) === JSON.stringify(storeAfterPlan),
    "Planner service unexpectedly mutated the mission store",
  );
  assert(
    JSON.stringify(MISSION_SEED) === JSON.stringify(seedBefore),
    "Scenario/planner services mutated the baseline seed state",
  );

  resetMissionState();
  setMissionState(cloneMissionState(MISSION_SEED));
  const baselineSnapshot = getCurrentMissionSnapshot();

  console.log(
    JSON.stringify(
      {
        waterScenarioStatus: waterA.status,
        energyScenarioStatus: energy.status,
        temperatureScenarioStatus: temperature.status,
        targetedWaterUnaffectedPotatoStress: targetedPotato?.stress.severity,
        waterEventLogHead: waterA.eventLog[0]?.message,
        normalPlannerMode: normalPlan.mode,
        mildEnergyPlannerMode: mildEnergyPlan.mode,
        degradedPlannerMode: degradedPlan.mode,
        degradedPlannerActions: degradedPlan.recommendedActions.map((action) => action.type),
        degradedNutritionBefore: degradedPlan.nutritionForecast.before,
        degradedNutritionAfter: degradedPlan.nutritionForecast.after,
        directPlanMode: directPlan.mode,
        baselineSnapshotStatus: baselineSnapshot.status,
        pureScenarioInputUntouched: true,
        seedStateUntouched: true,
        storeStateUntouchedByPlanner: true,
      },
      null,
      2,
    ),
  );
}

main();
