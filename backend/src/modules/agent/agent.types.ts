import type { MissionState, NutritionStatus } from "../mission/mission.types";
import type { PlannerAction, PlannerMode } from "../planner/planner.types";

export const agentIncidentSeverityValues = [
  "info",
  "warning",
  "critical",
] as const;

export const agentConfidenceLabelValues = [
  "low",
  "medium",
  "high",
] as const;

export const agentLogCategoryValues = [
  "analysis",
  "action",
] as const;

export type AgentIncidentSeverity = (typeof agentIncidentSeverityValues)[number];
export type AgentConfidenceLabel = (typeof agentConfidenceLabelValues)[number];
export type AgentLogCategory = (typeof agentLogCategoryValues)[number];

export interface AgentNotificationPayload {
  level: AgentIncidentSeverity;
  title: string;
  message: string;
  requiresAttention: boolean;
}

export interface AgentLogEntry {
  logId: string;
  incidentId: string;
  timestamp: string;
  level: AgentIncidentSeverity;
  category: AgentLogCategory;
  headline: string;
  detail: string;
}

export interface AgentBeforeAfterPayload {
  beforeMissionStatus: MissionState["status"];
  afterMissionStatus: MissionState["status"];
  nutritionBefore: NutritionStatus;
  nutritionAfter: NutritionStatus;
}

export interface AgentAnalysisResponse {
  incidentId: string;
  timestamp: string;
  detected: boolean;
  severity: AgentIncidentSeverity;
  headline: string;
  summary: string;
  triggerReason: string;
  mode: PlannerMode;
  recommendedActions: PlannerAction[];
  appliedActions: PlannerAction[];
  requiresAttention: boolean;
  notification: AgentNotificationPayload | null;
  logEntries: AgentLogEntry[];
  beforeAfter: AgentBeforeAfterPayload;
  confidenceLabel: AgentConfidenceLabel;
  explanation: string;
}
