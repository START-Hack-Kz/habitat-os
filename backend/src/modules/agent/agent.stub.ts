import { CROP_PROFILES } from "../../data/cropProfiles.data";
import { SCENARIO_CATALOG } from "../../data/scenarios.data";
import type { AgentAnalyzeRequest } from "../../schemas/agent.schema";
import { buildMissionSnapshot, getCurrentMissionSnapshot } from "../mission/mission.service";
import { getMissionState, persistMissionState, setMissionState } from "../mission/mission.store";
import type { MissionState } from "../mission/mission.types";
import { buildPlantInterventionEvents } from "../plants/plant.service";
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

function formatScenarioLabel(scenarioType: MissionState["activeScenario"] extends infer T
  ? T extends { scenarioType: infer S }
    ? S
    : never
  : never): string {
  return SCENARIO_CATALOG[scenarioType].label;
}

function formatStressType(type: MissionState["zones"][number]["stress"]["type"]): string {
  switch (type) {
    case "water_deficit":
      return "water stress";
    case "light_deficit":
      return "light deficit";
    case "energy_shortage":
      return "energy shortage";
    case "nitrogen_deficiency":
      return "nutrient deficiency";
    default:
      return type.replaceAll("_", " ");
  }
}

function formatZoneList(zoneIds: string[]): string {
  if (zoneIds.length === 0) {
    return "the crop bays";
  }

  if (zoneIds.length === 1) {
    return zoneIds[0];
  }

  if (zoneIds.length === 2) {
    return `${zoneIds[0]} and ${zoneIds[1]}`;
  }

  return `${zoneIds.slice(0, -1).join(", ")}, and ${zoneIds.at(-1)}`;
}

function describeScenarioHeadline(state: MissionState): string {
  const scenario = state.activeScenario;

  if (!scenario) {
    return "Greenhouse operations are under abnormal stress.";
  }

  switch (scenario.scenarioType) {
    case "energy_budget_reduction":
      return `Mission day ${state.missionDay} is operating under a critical energy shortfall.`;
    case "water_recycling_decline":
      return `Mission day ${state.missionDay} is operating under a critical water recovery decline.`;
    case "temperature_control_failure":
      return `Mission day ${state.missionDay} is dealing with a greenhouse-wide climate control failure.`;
    case "single_zone_control_failure":
      return `Mission day ${state.missionDay} is responding to a local control failure in ${scenario.affectedZones[0] ?? "one crop bay"}.`;
    default:
      return `${formatScenarioLabel(scenario.scenarioType)} is affecting greenhouse operations.`;
  }
}

function buildScenarioStateDetail(state: MissionState): string {
  const scenario = state.activeScenario;

  if (!scenario) {
    return "";
  }

  switch (scenario.scenarioType) {
    case "energy_budget_reduction":
      return `Available power is ${state.resources.energyAvailableKwh} kWh against a ${state.resources.energyConsumptionKwhPerDay} kWh/day draw, leaving ${state.resources.energyDaysRemaining} days of energy buffer.`;
    case "water_recycling_decline":
      return `Water recovery has fallen to ${state.resources.waterRecyclingEfficiency}%, leaving ${state.resources.waterDaysRemaining} days of water runway at the current loss rate.`;
    case "temperature_control_failure": {
      const hottestZone = [...state.zones].sort(
        (left, right) => right.sensors.temperature - left.sensors.temperature,
      )[0];
      return `${formatZoneList(state.zones.map((zone) => zone.zoneId))} are running hot, with ${hottestZone.zoneId} at ${hottestZone.sensors.temperature} C.`;
    }
    case "single_zone_control_failure": {
      const failedZoneId = scenario.affectedZones[0] ?? "the affected bay";
      return `${failedZoneId} has lost local irrigation, lighting, and environmental control support and must be isolated from the shared resource pool.`;
    }
    default:
      return scenario.description;
  }
}

function buildNutritionContext(state: MissionState): string {
  return `Current production is covering ${state.nutrition.caloricCoveragePercent}% of calories and ${state.nutrition.proteinCoveragePercent}% of protein, with ${state.nutrition.daysSafe} safe days remaining.`;
}

function buildZoneStressContext(state: MissionState): string {
  const affectedZones = state.zones.filter((zone) => zone.status !== "healthy" || zone.stress.active);

  if (affectedZones.length === 0) {
    return "The remaining crop bays are still holding nominal environmental conditions.";
  }

  return affectedZones
    .slice(0, 3)
    .map((zone) => `${zone.zoneId} is under ${zone.stress.severity} ${formatStressType(zone.stress.type)}`)
    .join("; ")
    .concat(".");
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
          ? `${formatScenarioLabel(state.activeScenario.scenarioType)} is driving critical greenhouse conditions.`
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
          ? `${formatScenarioLabel(state.activeScenario.scenarioType)} requires response review.`
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
    return `Nutrition score is ${state.nutrition.nutritionalCoverageScore} with ${state.nutrition.daysSafe} safe days remaining. ${execution.recommendedActions.length > 0 ? (autoApply ? "The current preservation plan has already been applied." : "The planner has prepared a preservation response.") : "The greenhouse is still staying above the automatic preservation threshold."}`;
  }

  if (focus === "scenario_response") {
    return trigger.triggerReason;
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
      return `${describeScenarioHeadline(state)} ${buildScenarioStateDetail(state)} ${buildNutritionContext(state)} The planner is keeping the greenhouse in normal mode for now because nutrition output remains above the automatic preservation threshold, but the incident still requires close monitoring.`;
    }

    return "The greenhouse remains within acceptable nutrition continuity thresholds, so no preservation intervention is being prepared.";
  }

  if (state.activeScenario?.scenarioType === "single_zone_control_failure") {
    const failedZoneId = state.activeScenario.affectedZones[0] ?? "the failed bay";
    return `${describeScenarioHeadline(state)} ${buildScenarioStateDetail(state)} The planner is isolating ${failedZoneId} and redistributing shared water and lighting toward the remaining calorie and protein crops, with potatoes protected first for calories and beans second for protein. ${buildNutritionContext(state)} ${buildZoneStressContext(state)} ${autoApply ? "Those resource shifts have already been applied to the live mission state." : "Those resource shifts are the current recommended response."}`;
  }

  return `${describeScenarioHeadline(state)} ${buildScenarioStateDetail(state)} The planner is protecting potatoes first for calories and beans second for protein while trimming lower-priority support where necessary. ${buildNutritionContext(state)} ${buildZoneStressContext(state)} ${autoApply ? "Those actions have already been applied to the live mission state." : "Those actions are the current recommended response."}`;
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
  const snapshot = buildMissionSnapshot(nextState);
  snapshot.eventLog.push(
    ...buildPlantInterventionEvents({
      beforeState: state,
      afterState: snapshot,
      timestamp,
    }),
  );
  return buildMissionSnapshot(snapshot);
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

export async function analyzeCurrentMissionWithPersistence(
  request: AgentAnalyzeRequest = {},
): Promise<AIDecision> {
  const currentState = getCurrentMissionSnapshot();
  const analysis = createAgentAnalysis(currentState, request);

  if (analysis.nextState !== null) {
    await persistMissionState(analysis.nextState);
  }

  return analysis.response;
}

export function getCurrentAgentTrigger(): AgentTriggerResult {
  return detectAgentTrigger(getCurrentMissionSnapshot());
}

export function getCurrentMissionStateForAgent(): MissionState {
  return buildMissionSnapshot(getMissionState());
}
