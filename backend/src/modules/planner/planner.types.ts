import type {
  RecommendedAction,
} from "../../../../shared/schemas/aiDecision.schema";
import type { PlannerOutput as SharedPlannerOutput } from "../../../../shared/schemas/plannerOutput.schema";
import type { MissionState } from "../mission/mission.types";

export const plannerModeValues = ["normal", "nutrition_preservation"] as const;

export type PlannerMode = (typeof plannerModeValues)[number];
export type PlannerOutput = SharedPlannerOutput;
export type PlannerAction = RecommendedAction;

export interface PlannerExecution {
  plan: PlannerOutput;
  mode: PlannerMode;
  recommendedActions: PlannerAction[];
  explanation: string;
  beforeSnapshot: MissionState;
  afterSnapshot: MissionState;
}
