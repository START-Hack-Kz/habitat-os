import type {
  AIDecision as SharedAIDecision,
  BeforeAfterComparison as SharedBeforeAfterComparison,
  NutritionSnapshot as SharedNutritionSnapshot,
  RecommendedAction as SharedRecommendedAction,
  RiskLevel as SharedRiskLevel,
} from "../../../../shared/schemas/aiDecision.schema";

export type AIDecision = SharedAIDecision;
export type RiskLevel = SharedRiskLevel;
export type RecommendedAction = SharedRecommendedAction;
export type NutritionSnapshot = SharedNutritionSnapshot;
export type BeforeAfterComparison = SharedBeforeAfterComparison;
