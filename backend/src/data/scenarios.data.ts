/**
 * scenarios.data.ts
 * Predefined failure scenario catalog for the Mars Greenhouse MVP.
 * Scenario structure, detection signals, and response logic are grounded
 * in the Mars Greenhouse KB (MCP doc: 06_Greenhouse_Operational_Scenarios.md).
 * Parameter override values are [APPROX] — KB gives qualitative guidance only.
 */

import type { FailureScenarioType, FailureScenarioSeverity } from "../modules/mission/mission.types";

export interface ScenarioSeverityEffect {
  // Parameter overrides applied to ResourceState when this scenario+severity is injected.
  // Keys match ResourceState field names exactly.
  parameterOverrides: Record<string, number>;
  // Short label for the UI severity selector
  label: string;
  // What the operator should expect to see
  effectSummary: string;
}

export interface ScenarioDefinition {
  scenarioType: FailureScenarioType;
  label: string;
  // MCP-grounded description of the event
  description: string;
  // Which resource domains are affected — MCP-grounded
  affectedResources: string[];
  // Nutrition risk note — derived from MCP nutritional risk hierarchy
  nutritionRisk: string;
  // Severity tiers with concrete parameter overrides
  severityEffects: Record<FailureScenarioSeverity, ScenarioSeverityEffect>;
}

// ─────────────────────────────────────────────────────────────────────────────

export const SCENARIO_CATALOG: Record<FailureScenarioType, ScenarioDefinition> = {

  water_recycling_decline: {
    scenarioType: "water_recycling_decline",
    label: "Water Recycling Decline",
    // MCP: filter degradation / biofouling / mechanical malfunction reduces efficiency
    // Target efficiency >85–95% per MCP
    description:
      "Water recycling efficiency is declining due to filter degradation or biofouling. " +
      "Closed-loop systems require >85% efficiency. Below this threshold, net water loss " +
      "accelerates and irrigation availability drops, stressing all crop zones.",
    affectedResources: ["water"], // MCP-grounded
    // MCP nutritional risk hierarchy: water deficit is high-risk stress for lettuce (high),
    // potato (moderate-high), beans (moderate), radish (high)
    nutritionRisk:
      "High — sustained water deficit threatens lettuce (micronutrients) and potato (calories). " +
      "Protein supply from beans also at moderate risk.",
    severityEffects: {
      mild: {
        label: "Mild",
        // [APPROX] — MCP says >85% is target; mild = just below threshold
        parameterOverrides: { waterRecyclingEfficiencyPercent: 78 },
        effectSummary: "Efficiency at 78%. Minor increase in daily water loss. Monitor reservoir trend.",
      },
      moderate: {
        label: "Moderate",
        // [APPROX] — meaningful degradation, rationing required
        parameterOverrides: { waterRecyclingEfficiencyPercent: 65 },
        effectSummary: "Efficiency at 65%. Irrigation rationing required. Lettuce zone at risk within days.",
      },
      critical: {
        label: "Critical",
        // [APPROX] — severe failure, immediate reallocation needed
        parameterOverrides: { waterRecyclingEfficiencyPercent: 45 },
        effectSummary:
          "Efficiency at 45%. Severe water loss. Immediate reallocation to caloric crops required. " +
          "Nutrition Preservation Mode recommended.",
      },
    },
  },

  energy_budget_reduction: {
    scenarioType: "energy_budget_reduction",
    label: "Energy Budget Reduction",
    // MCP: solar generation limits / maintenance / unexpected demand
    // Greenhouse requires energy for lighting, climate control, pumps, monitoring
    description:
      "Available energy is reduced due to solar generation limits or system maintenance. " +
      "Lighting, climate control, and pumps all compete for the reduced budget. " +
      "Environmental parameters will drift if energy is not prioritised correctly.",
    affectedResources: ["energy", "lighting", "climate_control"], // MCP-grounded
    // MCP: energy constraints cause reduced growth rates and environmental drift
    // Lighting reduction directly reduces PAR → lower photosynthesis → lower yield
    nutritionRisk:
      "Moderate-High — reduced lighting lowers photosynthesis across all zones. " +
      "Potato caloric output most sensitive to photoperiod reduction. " +
      "Climate drift may trigger temperature stress in lettuce.",
    severityEffects: {
      mild: {
        label: "Mild",
        // [APPROX] — small reduction, manageable with schedule optimisation
        parameterOverrides: { energyAvailableKwh: 260, energyDailyConsumptionKwh: 210 },
        effectSummary: "Energy reserve reduced. Lighting schedule optimisation recommended.",
      },
      moderate: {
        label: "Moderate",
        // [APPROX] — significant reduction, non-essential systems must be cut
        parameterOverrides: { energyAvailableKwh: 180, energyDailyConsumptionKwh: 210 },
        effectSummary:
          "Energy deficit. Non-essential systems must be cut. Reduce LED intensity in low-priority zones.",
      },
      critical: {
        label: "Critical",
        // [APPROX] — severe deficit, life-critical systems only
        parameterOverrides: { energyAvailableKwh: 90, energyDailyConsumptionKwh: 210 },
        effectSummary:
          "Severe energy deficit. Only life-critical systems can be maintained. " +
          "Significant crop growth slowdown expected. Nutrition Preservation Mode recommended.",
      },
    },
  },

  temperature_control_failure: {
    scenarioType: "temperature_control_failure",
    label: "Temperature Control Failure",
    // MCP: HVAC malfunction / sensor error / external environmental factors
    // Heat stress: bolting in lettuce, reduced yield; Cold stress: slower metabolism, growth delays
    description:
      "HVAC system is malfunctioning, causing temperature to drift above optimal ranges. " +
      "Heat stress triggers bolting in lettuce and reduces tuber size in potatoes. " +
      "Gradual return to optimal range is required to prevent shock responses.",
    affectedResources: ["climate_control", "energy"], // MCP-grounded
    // MCP heat stress thresholds: lettuce >25°C, radish >26°C, potato >25–28°C, beans >30°C
    // Lettuce most vulnerable — bolting destroys the harvest
    nutritionRisk:
      "High for micronutrients — lettuce bolts above 25°C, destroying the micronutrient supply. " +
      "Moderate for calories — potato yield reduces above 26°C. " +
      "Beans most tolerant (threshold 30°C).",
    severityEffects: {
      mild: {
        label: "Mild",
        // [APPROX] — just above lettuce optimal max (22°C), below stress threshold (25°C)
        parameterOverrides: { temperatureOverrideAllZonesC: 24 },
        effectSummary: "Temperature at 24°C. Within tolerance for most crops. Lettuce approaching stress threshold.",
      },
      moderate: {
        label: "Moderate",
        // [APPROX] — above lettuce stress threshold, potato approaching limit
        parameterOverrides: { temperatureOverrideAllZonesC: 27 },
        effectSummary:
          "Temperature at 27°C. Lettuce bolting risk active. Potato yield reduction beginning. " +
          "Reduce LED intensity to lower heat load.",
      },
      critical: {
        label: "Critical",
        // [APPROX] — above all crop stress thresholds except beans
        parameterOverrides: { temperatureOverrideAllZonesC: 32 },
        effectSummary:
          "Temperature at 32°C. Lettuce and potato zones critically stressed. " +
          "Immediate ventilation and light reduction required. " +
          "Nutrition Preservation Mode recommended — redirect resources to beans.",
      },
    },
  },
};
