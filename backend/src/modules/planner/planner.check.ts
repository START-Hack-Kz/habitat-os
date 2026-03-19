import { MISSION_SEED } from "../../data/mission.seed";
import type { ScenarioInjectRequest } from "../../schemas/scenario.schema";
import {
  getCurrentMissionSnapshot,
} from "../mission/mission.service";
import { getMissionState, resetMissionState, setMissionState } from "../mission/mission.store";
import type { MissionState } from "../mission/mission.types";
import { applyScenarioInjection, injectScenario } from "../scenarios/scenario.service";
import {
  createNutritionPreservationExecution,
  getCurrentNutritionPreservationExecution,
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
): ReturnType<typeof injectScenario> {
  const firstRun = injectFromBaseline(input);
  const secondRun = injectFromBaseline(input);

  assert(
    JSON.stringify(firstRun) === JSON.stringify(secondRun),
    `${label} scenario injection is not deterministic`,
  );
  assert(
    firstRun.missionState.eventLog.length === MISSION_SEED.eventLog.length + 1,
    `${label} scenario did not append exactly one event log entry`,
  );

  return firstRun;
}

function main(): void {
  const seedBefore = cloneMissionState(MISSION_SEED);

  const waterA = assertScenarioDeterminism(
    {
      scenarioType: "water_recycling_decline",
      severity: "critical",
    },
    "Water recycling",
  );

  assert(
    waterA.missionState.resources.waterRecyclingEfficiency === 45,
    "Water recycling scenario did not set efficiency to 45%",
  );
  const lettuceAfterWater = waterA.missionState.zones.find((zone) => zone.cropType === "lettuce");
  assert(
    lettuceAfterWater?.stress.type === "water_deficit",
    "Water recycling scenario did not apply water-deficit stress to lettuce",
  );
  assert(
    lettuceAfterWater !== undefined && lettuceAfterWater.projectedYieldKg < 160,
    "Water recycling scenario did not reduce lettuce projected yield",
  );
  assert(
    waterA.missionState.eventLog[0]?.message ===
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
  const potatoAfterEnergy = energy.missionState.zones.find((zone) => zone.cropType === "potato");
  assert(
    energy.missionState.resources.energyAvailableKwh === 180,
    "Energy scenario did not set energyAvailableKwh to 180",
  );
  assert(
    potatoAfterEnergy !== undefined &&
      potatoAfterEnergy.stress.active &&
      (potatoAfterEnergy.stress.type === "energy_shortage" ||
        potatoAfterEnergy.stress.type === "light_deficit"),
    "Energy scenario did not apply stress to the potato zone",
  );
  assert(
    energy.missionState.eventLog[0]?.message ===
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
  const lettuceAfterTemperature = temperature.missionState.zones.find(
    (zone) => zone.cropType === "lettuce",
  );
  const beansAfterTemperature = temperature.missionState.zones.find(
    (zone) => zone.cropType === "beans",
  );
  assert(
    lettuceAfterTemperature?.stress.type === "heat",
    "Temperature scenario did not set the expected heat stress type",
  );
  assert(
    lettuceAfterTemperature?.stress.severity === "critical" &&
      beansAfterTemperature !== undefined &&
      beansAfterTemperature.stress.severity !== "none",
    "Temperature scenario did not apply the expected crop-specific stress levels",
  );
  assert(
    temperature.missionState.eventLog[0]?.message ===
      "CRITICAL: Temperature at 32°C. Lettuce and potato critically stressed. Redirect resources to beans.",
    "Temperature scenario did not append the expected event log entry",
  );
  assert(
    lettuceAfterTemperature !== undefined && lettuceAfterTemperature.projectedYieldKg < 160,
    "Temperature scenario did not reduce lettuce projected yield",
  );

  const singleZoneFailure = assertScenarioDeterminism(
    {
      scenarioType: "single_zone_control_failure",
      severity: "critical",
      affectedZones: ["zone-C"],
    },
    "Single-zone control failure",
  );
  const failedZone = singleZoneFailure.missionState.zones.find((zone) => zone.zoneId === "zone-C");
  assert(
    failedZone?.status === "offline",
    "Single-zone control failure did not isolate the affected zone",
  );
  assert(
    singleZoneFailure.missionState.eventLog[0]?.message ===
      "zone-C: CRITICAL: Single-zone control failure. Isolate the affected bay and immediately redirect water and energy to the surviving zones.",
    "Single-zone control failure did not append the expected event log entry",
  );

  const targetedWater = injectFromBaseline({
    scenarioType: "water_recycling_decline",
    severity: "moderate",
    affectedZones: ["zone-A", "zone-D"],
  });
  const targetedPotato = targetedWater.missionState.zones.find((zone) => zone.zoneId === "zone-B");
  assert(
    targetedPotato?.stress.severity === "none",
    "Targeted scenario injection unexpectedly changed an unaffected zone",
  );

  resetMissionState();
  const normalExecution = getCurrentNutritionPreservationExecution();
  assert(normalExecution.mode === "normal", "Healthy baseline should remain in normal mode");
  assert(
    normalExecution.recommendedActions.length === 0,
    "Healthy baseline should not return planner actions",
  );
  assert(
    normalExecution.plan.nutritionRiskDetected === false,
    "Healthy baseline should not raise a nutrition risk",
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
    pureScenarioOutput.resources.waterRecyclingEfficiency === 78,
    "Pure scenario helper did not apply the expected water override",
  );

  resetMissionState();
  injectScenario({
    scenarioType: "energy_budget_reduction",
    severity: "mild",
  });
  const mildEnergyExecution = getCurrentNutritionPreservationExecution();
  assert(
    mildEnergyExecution.mode === "normal",
    "Mild energy degradation should stay in normal mode with current thresholds",
  );

  resetMissionState();
  injectScenario({
    scenarioType: "water_recycling_decline",
    severity: "critical",
  });
  const degradedExecution = getCurrentNutritionPreservationExecution();
  assert(
    degradedExecution.mode === "nutrition_preservation",
    "Critical degraded state should enter nutrition preservation mode",
  );
  assert(
    degradedExecution.recommendedActions.length >= 1 &&
      degradedExecution.recommendedActions.length <= 3,
    "Planner must return between 1 and 3 actions in nutrition preservation mode",
  );
  assert(
    degradedExecution.plan.nutritionRiskDetected,
    "Degraded planner output should raise a nutrition risk",
  );
  assert(
    degradedExecution.afterSnapshot.nutrition.nutritionalCoverageScore >
      degradedExecution.beforeSnapshot.nutrition.nutritionalCoverageScore,
    "Planner execution did not improve the nutrition score",
  );

  resetMissionState();
  injectScenario({
    scenarioType: "single_zone_control_failure",
    severity: "critical",
    affectedZones: ["zone-C"],
  });
  const malfunctionExecution = getCurrentNutritionPreservationExecution();
  assert(
    malfunctionExecution.mode === "nutrition_preservation",
    "Single-zone control failure should enter nutrition preservation mode",
  );
  assert(
    malfunctionExecution.recommendedActions.some((action) => action.actionType === "reallocate_water"),
    "Single-zone control failure should recommend water redistribution",
  );
  assert(
    malfunctionExecution.recommendedActions.some(
      (action) => action.actionType === "prioritize_zone" || action.actionType === "pause_zone",
    ),
    "Single-zone control failure should recommend isolating or prioritizing zones",
  );
  assert(
    malfunctionExecution.afterSnapshot.zones.find((zone) => zone.zoneId === "zone-C")?.allocationPercent === 0,
    "Planner did not remove shared allocation from the failed zone",
  );

  const storeBeforePlan = cloneMissionState(getMissionState());
  const directExecution = createNutritionPreservationExecution(storeBeforePlan);
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
        waterScenarioStatus: waterA.missionState.status,
        energyScenarioStatus: energy.missionState.status,
        temperatureScenarioStatus: temperature.missionState.status,
        targetedWaterUnaffectedPotatoStress: targetedPotato?.stress.severity,
        waterEventLogHead: waterA.missionState.eventLog[0]?.message,
        normalPlannerMode: normalExecution.mode,
        mildEnergyPlannerMode: mildEnergyExecution.mode,
        degradedPlannerMode: degradedExecution.mode,
        degradedPlannerActions: degradedExecution.recommendedActions.map(
          (action) => action.actionType,
        ),
        degradedNutritionBefore: degradedExecution.beforeSnapshot.nutrition,
        degradedNutritionAfter: degradedExecution.afterSnapshot.nutrition,
        directPlanMode: directExecution.mode,
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
