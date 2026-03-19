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

  assert(baselineAnalysis.riskLevel === "low", "Baseline should remain low risk");
  assert(
    baselineAnalysis.nutritionPreservationMode === false,
    "Baseline should not enter nutrition preservation mode",
  );
  assert(
    baselineAnalysis.recommendedActions.length === 0,
    "Baseline should not produce recommended actions",
  );
  assert(
    baselineAnalysis.comparison.delta.scoreDelta === 0 &&
      baselineAnalysis.comparison.delta.daysSafeDelta === 0,
    "Baseline comparison should remain unchanged",
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
  const degradedStoreAfter = JSON.stringify(getMissionState());

  assert(
    degradedAnalysis.response.riskLevel === "critical",
    "Degraded state should return critical AI risk level",
  );
  assert(
    degradedAnalysis.response.recommendedActions.length >= 1,
    "Degraded state should return one or more recommended actions",
  );
  assert(
    degradedAnalysis.response.triggeredByScenario !== null,
    "Degraded state should report the triggering scenario",
  );
  assert(
    degradedAnalysis.response.comparison.delta.scoreDelta > 0,
    "Degraded analysis should project a positive nutrition score delta",
  );
  assert(
    degradedAnalysis.response.kbContextUsed === true,
    "Stub response should report KB context usage",
  );
  assert(
    JSON.stringify(degradedBefore) === degradedStoreAfter,
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
    autoApplyAnalysis.recommendedActions.length >= 1,
    "Auto-apply analysis should still surface recommended actions",
  );
  assert(
    appliedState.status === "nutrition_preservation_mode",
    "Auto-apply should move the mission into nutrition preservation mode",
  );
  assert(
    appliedState.nutrition.nutritionalCoverageScore >
      autoApplyAnalysis.comparison.before.nutritionalCoverageScore,
    "Auto-apply should improve the stored nutrition score",
  );
  assert(
    appliedState.eventLog[0]?.type === "ai_action",
    "Auto-apply should append an ai_action event",
  );
  assert(
    JSON.stringify(MISSION_SEED) === seedBefore,
    "Agent analysis should not mutate the baseline seed",
  );

  console.log(
    JSON.stringify(
      {
        baselineRiskLevel: baselineAnalysis.riskLevel,
        baselineActionCount: baselineAnalysis.recommendedActions.length,
        degradedRiskLevel: degradedAnalysis.response.riskLevel,
        degradedActionCount: degradedAnalysis.response.recommendedActions.length,
        degradedComparison: degradedAnalysis.response.comparison.delta,
        autoApplyActionCount: autoApplyAnalysis.recommendedActions.length,
        appliedMissionStatus: appliedState.status,
        appliedNutritionScore: appliedState.nutrition.nutritionalCoverageScore,
        appliedEventType: appliedState.eventLog[0]?.type ?? null,
        baselineSeedUntouched: true,
      },
      null,
      2,
    ),
  );
}

main();
