// PlannerOutput — result of one simulation tick or scenario application.
// The planner is the source of truth. The AI agent reads this, it does not produce it.
// Returned by POST /simulation/tick and POST /simulation/scenario/inject

export interface PlannerOutput {
  missionState: import("./missionState.schema").MissionState;

  // What changed this tick (for event log and diff display)
  changes: SimulationChange[];

  // Whether the planner detected a nutrition risk that should trigger AI analysis
  nutritionRiskDetected: boolean;

  // Planner's own rule-based stress flags (before AI interprets them)
  stressFlags: StressFlag[];
}

export interface SimulationChange {
  field: string;                        // dot-path to changed field, e.g. "resources.waterRecyclingEfficiency"
  previousValue: number | string | boolean;
  newValue: number | string | boolean;
  reason: string;                       // e.g. "Scenario: water_recycling_decline applied"
}

export interface StressFlag {
  zoneId: string;
  stressType: string;
  severity: string;
  detectedAt: string;                   // ISO date-time
  rule: string;                         // e.g. "temperature > tempHeatStressThreshold"
}
