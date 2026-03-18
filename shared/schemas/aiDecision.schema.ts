// AIDecision — output from the single AI agent.
// The agent receives mission state + scenario context, then returns this object.
// The planner/simulation owns truth; the agent interprets and explains.

export type ActionType =
  | "reallocate_water"
  | "reduce_lighting"
  | "adjust_temperature_setpoint"
  | "reduce_zone_allocation"
  | "prioritize_zone"
  | "trigger_harvest_early"
  | "pause_zone"
  | "adjust_nutrient_mix";

export type UrgencyLevel = "immediate" | "within_24h" | "strategic";
export type RiskLevel = "low" | "moderate" | "high" | "critical";

// ─── A single recommended action ─────────────────────────────────────────────

export interface RecommendedAction {
  actionId: string;                     // e.g. "act-001"
  actionType: ActionType;
  urgency: UrgencyLevel;
  targetZoneId?: string;                // which zone this applies to (if zone-specific)
  description: string;                  // human-readable: "Reduce water allocation to zone-C by 30%"
  parameterChanges: Record<string, number>; // e.g. { allocationPercent: 15 }
  nutritionImpact: string;              // e.g. "Preserves potato zone — protects 60% of caloric output"
  tradeoff: string;                     // e.g. "Lettuce zone will experience mild water stress"
}

// ─── Before/after nutrition snapshot ─────────────────────────────────────────

export interface NutritionSnapshot {
  caloricCoveragePercent: number;
  proteinCoveragePercent: number;
  nutritionalCoverageScore: number;
  daysSafe: number;
}

export interface BeforeAfterComparison {
  before: NutritionSnapshot;            // state before scenario / before agent actions
  after: NutritionSnapshot;            // projected state after applying recommendations
  delta: {
    caloricCoverageDelta: number;       // after - before (can be negative)
    proteinCoverageDelta: number;
    scoreDelta: number;
    daysSafeDelta: number;
  };
  summary: string;                      // e.g. "Applying these actions preserves 74% nutrition vs 41% without intervention"
}

// ─── Full AI decision object ──────────────────────────────────────────────────

export interface AIDecision {
  decisionId: string;
  missionDay: number;
  timestamp: string;                    // ISO date-time

  // Risk assessment
  riskLevel: RiskLevel;
  riskSummary: string;                  // 1–2 sentences: what is at risk and why

  // Nutrition-specific analysis
  criticalNutrientDependencies: string[]; // e.g. ["potato zone provides 60% of calories", "beans provide all protein"]
  nutritionPreservationMode: boolean;   // true when agent activates NPM

  // Recommended actions (ordered by priority)
  recommendedActions: RecommendedAction[];

  // Before/after comparison
  comparison: BeforeAfterComparison;

  // Plain-language explanation for the dashboard
  explanation: string;                  // 2–4 sentences a judge can read in 10 seconds

  // Which scenario triggered this decision
  triggeredByScenario: string | null;   // scenarioId or null if manually triggered

  // Whether KB context was used
  kbContextUsed: boolean;
}
