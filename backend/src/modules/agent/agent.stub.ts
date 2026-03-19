import { CROP_PROFILES } from "../../data/cropProfiles.data";
import type { AgentAnalyzeRequest } from "../../schemas/agent.schema";
import { buildMissionSnapshot, getCurrentMissionSnapshot } from "../mission/mission.service";
import { getMissionState, setMissionState } from "../mission/mission.store";
import type { MissionState } from "../mission/mission.types";
import { createNutritionPreservationExecution } from "../planner/planner.service";
import type { PlannerExecution } from "../planner/planner.types";
import type {
  AIDecision,
  BeforeAfterComparison,
  NutritionSnapshot,
  RiskLevel,
} from "./agent.types";

const WARNING_NUTRITION_SCORE_THRESHOLD = 70;
const WARNING_DAYS_SAFE_THRESHOLD = 90;

type AgentTriggerResult = {
  detected: boolean;
  riskLevel: RiskLevel;
  triggerReason: string;
};

function cloneMissionState(state: MissionState): MissionState {
  return structuredClone(state);
}

function deriveAnalysisTimestamp(state: MissionState): string {
  const parsed = Date.parse(state.lastUpdated);

  if (Number.isNaN(parsed)) {
    return "2026-03-19T10:00:00.000Z";
  }

  return new Date(parsed + 1000).toISOString();
}

function deriveDecisionId(state: MissionState, timestamp: string): string {
  const suffix = state.activeScenario?.scenarioId ?? state.status;
  const normalizedSuffix = suffix.replace(/[^a-z0-9-]/gi, "-").toLowerCase();

  return `dec-${state.missionDay}-${normalizedSuffix}-${Date.parse(timestamp)}`;
}

function describePrimaryZoneAnomaly(state: MissionState): string | null {
  const primaryZone = [...state.zones]
    .filter((zone) => zone.stress.active || zone.status === "critical" || zone.status === "offline")
    .sort((left, right) => {
      return (
        (right.stress.severity === "critical" ? 4 : right.stress.severity === "high" ? 3 : right.stress.severity === "moderate" ? 2 : right.stress.severity === "low" ? 1 : 0) -
        (left.stress.severity === "critical" ? 4 : left.stress.severity === "high" ? 3 : left.stress.severity === "moderate" ? 2 : left.stress.severity === "low" ? 1 : 0)
      );
    })[0];

  if (!primaryZone) {
    return null;
  }

  return `${primaryZone.zoneId} is under ${primaryZone.stress.severity} ${primaryZone.stress.type} stress`;
}

function detectAgentTrigger(state: MissionState): AgentTriggerResult {
  const hasCriticalZone = state.zones.some((zone) => {
    return zone.status === "critical" || zone.status === "offline" || zone.stress.severity === "critical";
  });
  const hasWarningZone = state.zones.some((zone) => {
    return zone.status === "stressed" || zone.stress.severity === "high";
  });

  if (
    state.status === "nutrition_preservation_mode" ||
    state.status === "critical" ||
    state.nutrition.nutritionalCoverageScore < 50 ||
    state.nutrition.daysSafe < 30 ||
    hasCriticalZone
  ) {
    const zoneSummary = describePrimaryZoneAnomaly(state);
    return {
      detected: true,
      riskLevel: "critical",
      triggerReason:
        state.activeScenario !== null
          ? `Scenario ${state.activeScenario.scenarioType} is driving critical greenhouse conditions.`
          : zoneSummary ?? "Critical nutrition continuity risk threshold breached.",
    };
  }

  if (
    state.activeScenario !== null ||
    state.status === "warning" ||
    state.nutrition.nutritionalCoverageScore < WARNING_NUTRITION_SCORE_THRESHOLD ||
    state.nutrition.daysSafe < WARNING_DAYS_SAFE_THRESHOLD ||
    hasWarningZone
  ) {
    const zoneSummary = describePrimaryZoneAnomaly(state);
    return {
      detected: true,
      riskLevel: "high",
      triggerReason:
        state.activeScenario !== null
          ? `Scenario ${state.activeScenario.scenarioType} requires deterministic response review.`
          : zoneSummary ?? "Warning-level mission degradation detected.",
    };
  }

  return {
    detected: false,
    riskLevel: "low",
    triggerReason: "Mission remains nominal. No abnormal greenhouse condition is present.",
  };
}

function extractNutritionSnapshot(state: MissionState): NutritionSnapshot {
  return {
    caloricCoveragePercent: state.nutrition.caloricCoveragePercent,
    proteinCoveragePercent: state.nutrition.proteinCoveragePercent,
    nutritionalCoverageScore: state.nutrition.nutritionalCoverageScore,
    daysSafe: state.nutrition.daysSafe,
  };
}

function buildComparison(before: MissionState, after: MissionState): BeforeAfterComparison {
  const beforeSnapshot = extractNutritionSnapshot(before);
  const afterSnapshot = extractNutritionSnapshot(after);

  return {
    before: beforeSnapshot,
    after: afterSnapshot,
    delta: {
      caloricCoverageDelta: afterSnapshot.caloricCoveragePercent - beforeSnapshot.caloricCoveragePercent,
      proteinCoverageDelta: afterSnapshot.proteinCoveragePercent - beforeSnapshot.proteinCoveragePercent,
      scoreDelta: afterSnapshot.nutritionalCoverageScore - beforeSnapshot.nutritionalCoverageScore,
      daysSafeDelta: afterSnapshot.daysSafe - beforeSnapshot.daysSafe,
    },
    summary:
      beforeSnapshot.nutritionalCoverageScore === afterSnapshot.nutritionalCoverageScore &&
      beforeSnapshot.daysSafe === afterSnapshot.daysSafe
        ? "No deterministic intervention was required, so the nutrition forecast remains unchanged."
        : `Applying the recommended actions moves the nutrition score from ${beforeSnapshot.nutritionalCoverageScore} to ${afterSnapshot.nutritionalCoverageScore} and shifts daysSafe from ${beforeSnapshot.daysSafe} to ${afterSnapshot.daysSafe}.`,
  };
}

function buildZoneContributions(state: MissionState) {
  return state.zones
    .filter((zone) => zone.status !== "offline")
    .map((zone) => {
      const profile = CROP_PROFILES[zone.cropType];
      const dailyOutputKg = zone.projectedYieldKg / Math.max(1, zone.growthCycleTotal);
      const effectiveHundredGrams = dailyOutputKg * 10;
      const calories = effectiveHundredGrams * profile.kcalPer100g;
      const protein = effectiveHundredGrams * profile.proteinPer100g;

      return {
        zoneId: zone.zoneId,
        cropType: zone.cropType,
        role: profile.missionRole,
        calories,
        protein,
      };
    });
}

function buildCriticalNutrientDependencies(state: MissionState): string[] {
  const contributions = buildZoneContributions(state);
  const totalCalories = contributions.reduce((sum, entry) => sum + entry.calories, 0);
  const totalProtein = contributions.reduce((sum, entry) => sum + entry.protein, 0);
  const dependencies: string[] = [];

  for (const entry of contributions) {
    if (entry.cropType === "potato" && totalCalories > 0) {
      dependencies.push(
        `${entry.zoneId} (potato) provides ~${Math.round((entry.calories / totalCalories) * 100)}% of daily caloric output — caloric backbone`,
      );
    } else if (entry.cropType === "beans" && totalProtein > 0) {
      dependencies.push(
        `${entry.zoneId} (beans) provides ~${Math.round((entry.protein / totalProtein) * 100)}% of plant protein output — protein security`,
      );
    } else if (entry.cropType === "lettuce") {
      dependencies.push(
        `${entry.zoneId} (lettuce) stabilizes Vitamin A, Vitamin K, and folate output — micronutrient buffer`,
      );
    }
  }

  return dependencies;
}

function buildRiskSummary(input: {
  focus: NonNullable<AgentAnalyzeRequest["focus"]>;
  state: MissionState;
  trigger: AgentTriggerResult;
  execution: PlannerExecution;
  autoApply: boolean;
}): string {
  const { focus, state, trigger, execution, autoApply } = input;
  const primaryScenario = state.activeScenario?.scenarioType ?? "no active scenario";

  if (!trigger.detected) {
    return "Greenhouse operations remain nominal. Current nutrition production is stable and no intervention is required.";
  }

  if (focus === "nutrition_risk") {
    return `Nutrition score is ${state.nutrition.nutritionalCoverageScore} with ${state.nutrition.daysSafe} safe days remaining. ${autoApply ? "Planner actions were auto-applied." : execution.recommendedActions.length > 0 ? "Planner actions are ready for review." : "No planner action was generated."}`;
  }

  if (focus === "scenario_response") {
    return `${primaryScenario} is the current trigger. ${trigger.triggerReason}`;
  }

  return `Mission status is ${state.status}. ${trigger.triggerReason}`;
}

function buildExplanation(input: {
  state: MissionState;
  execution: PlannerExecution;
  autoApply: boolean;
  trigger: AgentTriggerResult;
}): string {
  const { state, execution, autoApply, trigger } = input;

  if (execution.recommendedActions.length === 0) {
    if (trigger.detected) {
      return `${trigger.triggerReason}. The deterministic planner did not enter Nutrition Preservation Mode because projected calories and protein remain above the automatic intervention thresholds.`;
    }

    return "The deterministic planner found no need to enter Nutrition Preservation Mode. The greenhouse remains within acceptable nutrition continuity thresholds.";
  }

  if (state.activeScenario?.scenarioType === "single_zone_control_failure") {
    return `${state.activeScenario.affectedZones[0] ?? "The failed bay"} has lost local control support. The planner isolates that zone, then redistributes shared water and lighting capacity toward the remaining calorie and protein crops. ${autoApply ? "Those redistribution actions were auto-applied." : "Those redistribution actions are ready for operator approval."} ${execution.explanation}`;
  }

  return `${state.activeScenario ? `${state.activeScenario.scenarioType} is the active trigger.` : "The greenhouse is under abnormal stress."} The planner protects potatoes first for calories and beans second for protein, then accepts controlled cuts to lower-priority crops. ${autoApply ? "Those actions were auto-applied to the mission state." : "Those actions are prepared for operator approval."} ${execution.explanation}`;
}

function appendAiActionEvent(state: MissionState, timestamp: string, message: string): MissionState {
  const nextState = cloneMissionState(state);
  nextState.eventLog.push({
    eventId: `evt-${String(nextState.eventLog.length + 1).padStart(3, "0")}`,
    missionDay: nextState.missionDay,
    timestamp,
    type: "ai_action",
    message,
  });
  nextState.lastUpdated = timestamp;
  return buildMissionSnapshot(nextState);
}

export function createAgentAnalysis(
  sourceState: MissionState,
  request: AgentAnalyzeRequest = {},
): {
  response: AIDecision;
  nextState: MissionState | null;
} {
  const focus = request.focus ?? "mission_overview";
  const currentState = buildMissionSnapshot(sourceState);
  const execution = createNutritionPreservationExecution(currentState);
  const trigger = detectAgentTrigger(currentState);
  const timestamp = deriveAnalysisTimestamp(currentState);
  const decisionId = deriveDecisionId(currentState, timestamp);
  const shouldAutoApply =
    request.autoApply === true &&
    trigger.detected &&
    execution.mode === "nutrition_preservation" &&
    execution.recommendedActions.length > 0;
  const appliedState = shouldAutoApply
    ? appendAiActionEvent(
        execution.afterSnapshot,
        timestamp,
        `AI analysis auto-applied ${execution.recommendedActions.length} nutrition preservation action(s).`,
      )
    : null;
  const comparison = buildComparison(
    execution.beforeSnapshot,
    shouldAutoApply && appliedState ? appliedState : execution.afterSnapshot,
  );

  return {
    response: {
      decisionId,
      missionDay: currentState.missionDay,
      timestamp,
      riskLevel: trigger.riskLevel,
      riskSummary: buildRiskSummary({
        focus,
        state: currentState,
        trigger,
        execution,
        autoApply: shouldAutoApply,
      }),
      criticalNutrientDependencies: buildCriticalNutrientDependencies(currentState),
      nutritionPreservationMode: execution.mode === "nutrition_preservation",
      recommendedActions: execution.recommendedActions,
      comparison,
      explanation: buildExplanation({
        state: currentState,
        execution,
        autoApply: shouldAutoApply,
        trigger,
      }),
      triggeredByScenario: currentState.activeScenario?.scenarioId ?? null,
      kbContextUsed: true,
    },
    nextState: appliedState,
  };
}

export function analyzeCurrentMissionWithStub(
  request: AgentAnalyzeRequest = {},
): AIDecision {
  const currentState = getCurrentMissionSnapshot();
  const analysis = createAgentAnalysis(currentState, request);

  if (analysis.nextState !== null) {
    setMissionState(analysis.nextState);
  }

  return analysis.response;
}

export function getCurrentAgentTrigger(): AgentTriggerResult {
  return detectAgentTrigger(getCurrentMissionSnapshot());
}

export function getCurrentMissionStateForAgent(): MissionState {
  return buildMissionSnapshot(getMissionState());
}
