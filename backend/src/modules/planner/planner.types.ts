import type { MissionState, NutritionStatus } from "../mission/mission.types";

export const plannerModeValues = ["normal", "nutrition_preservation"] as const;
export const plannerActionTypeValues = [
  "reallocate_water",
  "reduce_lighting",
  "adjust_temperature",
  "flag_zone_offline",
] as const;

export type PlannerMode = (typeof plannerModeValues)[number];
export type PlannerActionType = (typeof plannerActionTypeValues)[number];

export interface PlannerAction {
  type: PlannerActionType;
  targetZoneId?: string;
  description: string;
  reason: string;
}

export interface NutritionForecast {
  before: NutritionStatus;
  after: NutritionStatus;
}

export interface PlannerOutput {
  mode: PlannerMode;
  recommendedActions: PlannerAction[];
  nutritionForecast: NutritionForecast;
  explanation: string;
}

export interface PlannerExecution {
  plan: PlannerOutput;
  beforeSnapshot: MissionState;
  afterSnapshot: MissionState;
}
