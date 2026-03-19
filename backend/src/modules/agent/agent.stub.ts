import type { AgentAnalyzeRequest } from "../../schemas/agent.schema";
import { buildMissionSnapshot, getCurrentMissionSnapshot } from "../mission/mission.service";
import { getMissionState, setMissionState } from "../mission/mission.store";
import type { MissionState } from "../mission/mission.types";
import {
  createNutritionPreservationExecution,
} from "../planner/planner.service";
import type { PlannerAction, PlannerExecution } from "../planner/planner.types";
import type {
  AgentAnalysisResponse,
  AgentConfidenceLabel,
  AgentIncidentSeverity,
  AgentLogEntry,
  AgentNotificationPayload,
} from "./agent.types";

const WARNING_NUTRITION_SCORE_THRESHOLD = 70;
const WARNING_DAYS_SAFE_THRESHOLD = 180;

type AgentTriggerResult = {
  detected: boolean;
  severity: AgentIncidentSeverity;
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

function deriveIncidentId(state: MissionState, timestamp: string): string {
  const suffix = state.activeScenario?.scenarioId ?? state.status;
  const normalizedSuffix = suffix.replace(/[^a-z0-9-]/gi, "-").toLowerCase();

  return `incident-${state.missionDay}-${normalizedSuffix}-${Date.parse(timestamp)}`;
}

function detectAgentTrigger(state: MissionState): AgentTriggerResult {
  const hasCriticalZone = state.zones.some((zone) => {
    return zone.status === "critical" || zone.stress.severity === "critical";
  });
  const hasWarningZone = state.zones.some((zone) => {
    return zone.status === "stressed" || zone.stress.severity === "high";
  });

  if (
    state.status === "nutrition_preservation_mode" ||
    state.status === "critical" ||
    state.nutrition.nutritionalCoverageScore < 50 ||
    state.nutrition.daysSafe < 90 ||
    hasCriticalZone
  ) {
    return {
      detected: true,
      severity: "critical",
      triggerReason:
        state.activeScenario !== null
          ? `Active ${state.activeScenario.type} scenario is driving critical mission conditions.`
          : "Critical mission status or nutrition risk threshold breached.",
    };
  }

  if (
    state.activeScenario !== null ||
    state.status === "warning" ||
    state.nutrition.nutritionalCoverageScore < WARNING_NUTRITION_SCORE_THRESHOLD ||
    state.nutrition.daysSafe < WARNING_DAYS_SAFE_THRESHOLD ||
    hasWarningZone
  ) {
    return {
      detected: true,
      severity: "warning",
      triggerReason:
        state.activeScenario !== null
          ? `Active ${state.activeScenario.type} scenario requires review.`
          : "Warning-level mission status or elevated nutrition risk detected.",
    };
  }

  return {
    detected: false,
    severity: "info",
    triggerReason: "No abnormal mission conditions were detected.",
  };
}

function deriveConfidenceLabel(
  severity: AgentIncidentSeverity,
  execution: PlannerExecution,
): AgentConfidenceLabel {
  if (severity === "critical") {
    return "high";
  }

  if (execution.plan.mode === "nutrition_preservation" || severity === "warning") {
    return "medium";
  }

  return "high";
}

function buildHeadline(input: {
  detected: boolean;
  severity: AgentIncidentSeverity;
  autoApply: boolean;
  appliedActions: PlannerAction[];
  execution: PlannerExecution;
}): string {
  const { detected, severity, autoApply, appliedActions, execution } = input;

  if (!detected) {
    return "No abnormal mission conditions detected";
  }

  if (autoApply && appliedActions.length > 0) {
    return "Nutrition Preservation Mode auto-applied";
  }

  if (execution.plan.mode === "nutrition_preservation") {
    return severity === "critical"
      ? "Critical nutrition continuity risk detected"
      : "Nutrition preservation review recommended";
  }

  return severity === "critical"
    ? "Critical mission anomaly detected"
    : "Mission anomaly detected";
}

function buildSummary(input: {
  focus: NonNullable<AgentAnalyzeRequest["focus"]>;
  currentState: MissionState;
  trigger: AgentTriggerResult;
  execution: PlannerExecution;
  appliedActions: PlannerAction[];
}): string {
  const { focus, currentState, trigger, execution, appliedActions } = input;
  const scenarioLabel = currentState.activeScenario?.title ?? "No active scenario";

  if (!trigger.detected) {
    return "Mission remains nominal. No deterministic intervention is required at this time.";
  }

  if (focus === "nutrition_risk") {
    return `Nutrition score is ${currentState.nutrition.nutritionalCoverageScore} with ${currentState.nutrition.daysSafe} safe days remaining. ${appliedActions.length > 0 ? `Applied ${appliedActions.length} preservation action(s).` : execution.plan.recommendedActions.length > 0 ? `Prepared ${execution.plan.recommendedActions.length} preservation action(s).` : "No planner action was required yet."}`;
  }

  if (focus === "scenario_response") {
    return `${scenarioLabel} is the primary trigger. ${appliedActions.length > 0 ? "Planner-approved response was auto-applied." : execution.plan.recommendedActions.length > 0 ? "Planner-approved response is ready for operator review." : "No planner response was needed."}`;
  }

  return `Mission status is ${currentState.status}. ${trigger.triggerReason} ${appliedActions.length > 0 ? "Deterministic planner actions were auto-applied." : execution.plan.recommendedActions.length > 0 ? "Deterministic planner actions are recommended." : "No planner actions are currently required."}`;
}

function buildNotification(input: {
  includeNotification: boolean;
  detected: boolean;
  severity: AgentIncidentSeverity;
  headline: string;
  summary: string;
}): AgentNotificationPayload | null {
  const { includeNotification, detected, severity, headline, summary } = input;

  if (!detected && !includeNotification) {
    return null;
  }

  return {
    level: severity,
    title: headline,
    message: summary,
    requiresAttention: detected,
  };
}

function buildLogEntries(input: {
  incidentId: string;
  timestamp: string;
  severity: AgentIncidentSeverity;
  headline: string;
  summary: string;
  appliedActions: PlannerAction[];
}): AgentLogEntry[] {
  const {
    incidentId,
    timestamp,
    severity,
    headline,
    summary,
    appliedActions,
  } = input;

  const entries: AgentLogEntry[] = [
    {
      logId: `${incidentId}-analysis`,
      incidentId,
      timestamp,
      level: severity,
      category: "analysis",
      headline,
      detail: summary,
    },
  ];

  if (appliedActions.length > 0) {
    entries.push({
      logId: `${incidentId}-actions`,
      incidentId,
      timestamp,
      level: severity,
      category: "action",
      headline: "Planner actions auto-applied",
      detail: appliedActions.map((action) => action.description).join(" "),
    });
  }

  return entries;
}

function buildCommittedState(afterSnapshot: MissionState, timestamp: string): MissionState {
  const nextState = cloneMissionState(afterSnapshot);
  nextState.lastUpdated = timestamp;
  return buildMissionSnapshot(nextState);
}

export function createAgentAnalysis(
  sourceState: MissionState,
  request: AgentAnalyzeRequest = {},
): {
  response: AgentAnalysisResponse;
  nextState: MissionState | null;
} {
  const focus = request.focus ?? "mission_overview";
  const currentState = buildMissionSnapshot(sourceState);
  const execution = createNutritionPreservationExecution(currentState);
  const trigger = detectAgentTrigger(currentState);
  const timestamp = deriveAnalysisTimestamp(currentState);
  const incidentId = deriveIncidentId(currentState, timestamp);
  const shouldAutoApply =
    request.autoApply === true &&
    trigger.detected &&
    execution.plan.mode === "nutrition_preservation" &&
    execution.plan.recommendedActions.length > 0;
  const appliedActions = shouldAutoApply ? execution.plan.recommendedActions : [];
  const headline = buildHeadline({
    detected: trigger.detected,
    severity: trigger.severity,
    autoApply: shouldAutoApply,
    appliedActions,
    execution,
  });
  const summary = buildSummary({
    focus,
    currentState,
    trigger,
    execution,
    appliedActions,
  });
  const notification = buildNotification({
    includeNotification: request.includeNotification === true,
    detected: trigger.detected,
    severity: trigger.severity,
    headline,
    summary,
  });
  const logEntries = trigger.detected
    ? buildLogEntries({
        incidentId,
        timestamp,
        severity: trigger.severity,
        headline,
        summary,
        appliedActions,
      })
    : [];
  const nextState = shouldAutoApply
    ? buildCommittedState(execution.afterSnapshot, timestamp)
    : null;

  return {
    response: {
      incidentId,
      timestamp,
      detected: trigger.detected,
      severity: trigger.severity,
      headline,
      summary,
      triggerReason: trigger.triggerReason,
      mode: execution.plan.mode,
      recommendedActions: execution.plan.recommendedActions,
      appliedActions,
      requiresAttention: trigger.detected,
      notification,
      logEntries,
      beforeAfter: {
        beforeMissionStatus: execution.beforeSnapshot.status,
        afterMissionStatus: execution.afterSnapshot.status,
        nutritionBefore: execution.beforeSnapshot.nutrition,
        nutritionAfter: execution.afterSnapshot.nutrition,
      },
      confidenceLabel: deriveConfidenceLabel(trigger.severity, execution),
      explanation: execution.plan.explanation,
    },
    nextState,
  };
}

export function analyzeCurrentMissionWithStub(
  request: AgentAnalyzeRequest = {},
): AgentAnalysisResponse {
  const currentState = getCurrentMissionSnapshot();
  const analysis = createAgentAnalysis(currentState, request);

  if (analysis.nextState !== null) {
    setMissionState(analysis.nextState);
  }

  return analysis.response;
}

export function getCurrentAgentTrigger(): AgentTriggerResult {
  return detectAgentTrigger(getMissionState());
}
