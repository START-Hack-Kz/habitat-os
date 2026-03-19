import { MISSION_SEED } from "../../data/mission.seed";
import type { AgentAnalyzeRequest } from "../../schemas/agent.schema";
import { getCurrentMissionSnapshot } from "../mission/mission.service";
import { getMissionState, resetMissionState } from "../mission/mission.store";
import type { MissionState } from "../mission/mission.types";
import { injectScenario } from "../scenarios/scenario.service";
import {
  analyzeCurrentMissionWithStub,
  createAgentAnalysis,
} from "./agent.stub";

function cloneMissionState(state: MissionState): MissionState {
  return structuredClone(state);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function main(): void {
  const seedBefore = JSON.stringify(MISSION_SEED);

  resetMissionState();
  const baselineBefore = JSON.stringify(getMissionState());
  const baselineAnalysis = analyzeCurrentMissionWithStub();
  const baselineAfter = JSON.stringify(getMissionState());

  assert(baselineAnalysis.detected === false, "Baseline should not trigger agent analysis");
  assert(
    baselineAnalysis.notification === null,
    "Baseline should not emit a notification without includeNotification",
  );
  assert(
    baselineBefore === baselineAfter,
    "Baseline agent analysis should not mutate the mission store",
  );

  resetMissionState();
  injectScenario({
    scenarioType: "water_recycling_decline",
    severity: "critical",
  });
  const degradedBefore = cloneMissionState(getMissionState());
  const degradedAnalysis = createAgentAnalysis(degradedBefore, {
    includeNotification: true,
  });
  const degradedAfter = JSON.stringify(getMissionState());

  assert(degradedAnalysis.response.detected === true, "Degraded state should trigger analysis");
  assert(
    degradedAnalysis.response.notification !== null,
    "Degraded state should return a notification payload",
  );
  assert(
    degradedAnalysis.response.logEntries.length >= 1,
    "Degraded state should return one or more AI log entries",
  );
  assert(
    degradedAnalysis.response.appliedActions.length === 0,
    "Non-auto-apply analysis should not claim applied actions",
  );
  assert(
    JSON.stringify(degradedBefore) === degradedAfter,
    "Analysis without autoApply should not mutate the mission store",
  );

  resetMissionState();
  injectScenario({
    scenarioType: "water_recycling_decline",
    severity: "critical",
  });
  const autoApplyAnalysis = analyzeCurrentMissionWithStub({
    autoApply: true,
    includeNotification: true,
  } satisfies AgentAnalyzeRequest);
  const appliedState = getCurrentMissionSnapshot();

  assert(
    autoApplyAnalysis.appliedActions.length >= 1,
    "Auto-apply analysis should return applied actions",
  );
  assert(
    appliedState.status === "nutrition_preservation_mode",
    "Auto-apply should move the mission into nutrition preservation mode",
  );
  assert(
    appliedState.nutrition.nutritionalCoverageScore >
      autoApplyAnalysis.beforeAfter.nutritionBefore.nutritionalCoverageScore,
    "Auto-apply should improve the stored nutrition score",
  );
  assert(
    JSON.stringify(MISSION_SEED) === seedBefore,
    "Agent analysis should not mutate the baseline seed",
  );

  console.log(
    JSON.stringify(
      {
        baselineDetected: baselineAnalysis.detected,
        degradedDetected: degradedAnalysis.response.detected,
        degradedNotification: degradedAnalysis.response.notification,
        degradedLogEntryCount: degradedAnalysis.response.logEntries.length,
        autoApplyActionCount: autoApplyAnalysis.appliedActions.length,
        appliedMissionStatus: appliedState.status,
        appliedNutritionScore: appliedState.nutrition.nutritionalCoverageScore,
        baselineSeedUntouched: true,
      },
      null,
      2,
    ),
  );
}

main();
