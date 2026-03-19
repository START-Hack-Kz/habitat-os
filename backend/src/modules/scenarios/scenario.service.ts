import { SCENARIO_CATALOG } from "../../data/scenarios.data";
import type { ScenarioInjectRequest } from "../../schemas/scenario.schema";
import { buildMissionSnapshot } from "../mission/mission.service";
import { getMissionState, setMissionState } from "../mission/mission.store";
import type {
  CropType,
  EventLevel,
  FailureScenario,
  FailureScenarioSeverity,
  FailureScenarioType,
  MissionState,
  StressSeverity,
  StressType,
} from "../mission/mission.types";

type CropImpactRule = {
  stressSeverity: StressSeverity;
  stressType: StressType;
  yieldFactor: number;
};

type ScenarioSeverityRule = {
  cropImpacts: Record<CropType, CropImpactRule>;
  eventLevel: EventLevel;
  eventMessage: string;
};

const WATER_RULES: Record<FailureScenarioSeverity, ScenarioSeverityRule> = {
  mild: {
    cropImpacts: {
      lettuce: { stressSeverity: "low", stressType: "water_stress", yieldFactor: 0.95 },
      radish: { stressSeverity: "low", stressType: "water_stress", yieldFactor: 0.96 },
      potato: { stressSeverity: "low", stressType: "water_stress", yieldFactor: 0.98 },
      beans: { stressSeverity: "low", stressType: "water_stress", yieldFactor: 0.98 },
    },
    eventLevel: "info",
    eventMessage: "Water recycling efficiency dropped to 78%. Monitor reservoir trend.",
  },
  moderate: {
    cropImpacts: {
      lettuce: { stressSeverity: "high", stressType: "water_stress", yieldFactor: 0.8 },
      radish: { stressSeverity: "moderate", stressType: "water_stress", yieldFactor: 0.85 },
      potato: { stressSeverity: "moderate", stressType: "water_stress", yieldFactor: 0.9 },
      beans: { stressSeverity: "moderate", stressType: "water_stress", yieldFactor: 0.88 },
    },
    eventLevel: "warning",
    eventMessage:
      "Water recycling at 65%. Irrigation rationing active. Lettuce zone under water stress.",
  },
  critical: {
    cropImpacts: {
      lettuce: { stressSeverity: "critical", stressType: "water_stress", yieldFactor: 0.65 },
      radish: { stressSeverity: "high", stressType: "water_stress", yieldFactor: 0.72 },
      potato: { stressSeverity: "moderate", stressType: "water_stress", yieldFactor: 0.85 },
      beans: { stressSeverity: "moderate", stressType: "water_stress", yieldFactor: 0.82 },
    },
    eventLevel: "critical",
    eventMessage:
      "CRITICAL: Water recycling at 45%. Severe water loss. Nutrition Preservation Mode recommended.",
  },
};

const ENERGY_RULES: Record<FailureScenarioSeverity, ScenarioSeverityRule> = {
  mild: {
    cropImpacts: {
      lettuce: { stressSeverity: "none", stressType: "energy_pressure", yieldFactor: 1 },
      radish: { stressSeverity: "none", stressType: "energy_pressure", yieldFactor: 1 },
      potato: { stressSeverity: "none", stressType: "energy_pressure", yieldFactor: 1 },
      beans: { stressSeverity: "none", stressType: "energy_pressure", yieldFactor: 1 },
    },
    eventLevel: "info",
    eventMessage: "Energy reserve reduced. Lighting schedule optimisation recommended.",
  },
  moderate: {
    cropImpacts: {
      lettuce: { stressSeverity: "low", stressType: "energy_pressure", yieldFactor: 0.94 },
      radish: { stressSeverity: "low", stressType: "energy_pressure", yieldFactor: 0.92 },
      potato: { stressSeverity: "moderate", stressType: "energy_pressure", yieldFactor: 0.82 },
      beans: { stressSeverity: "low", stressType: "energy_pressure", yieldFactor: 0.88 },
    },
    eventLevel: "warning",
    eventMessage:
      "Energy deficit. LED intensity reduced. Potato zone entering moderate stress.",
  },
  critical: {
    cropImpacts: {
      lettuce: { stressSeverity: "moderate", stressType: "energy_pressure", yieldFactor: 0.85 },
      radish: { stressSeverity: "moderate", stressType: "energy_pressure", yieldFactor: 0.82 },
      potato: { stressSeverity: "high", stressType: "energy_pressure", yieldFactor: 0.7 },
      beans: { stressSeverity: "moderate", stressType: "energy_pressure", yieldFactor: 0.78 },
    },
    eventLevel: "critical",
    eventMessage:
      "CRITICAL: Severe energy deficit. All zones under stress. Nutrition Preservation Mode recommended.",
  },
};

const TEMPERATURE_RULES: Record<FailureScenarioSeverity, ScenarioSeverityRule> = {
  mild: {
    cropImpacts: {
      lettuce: { stressSeverity: "low", stressType: "temperature_drift", yieldFactor: 0.96 },
      radish: { stressSeverity: "none", stressType: "temperature_drift", yieldFactor: 1 },
      potato: { stressSeverity: "none", stressType: "temperature_drift", yieldFactor: 1 },
      beans: { stressSeverity: "none", stressType: "temperature_drift", yieldFactor: 1 },
    },
    eventLevel: "info",
    eventMessage: "Temperature at 24°C. Lettuce approaching heat stress threshold.",
  },
  moderate: {
    cropImpacts: {
      lettuce: { stressSeverity: "high", stressType: "temperature_drift", yieldFactor: 0.7 },
      radish: { stressSeverity: "moderate", stressType: "temperature_drift", yieldFactor: 0.88 },
      potato: { stressSeverity: "moderate", stressType: "temperature_drift", yieldFactor: 0.85 },
      beans: { stressSeverity: "low", stressType: "temperature_drift", yieldFactor: 0.95 },
    },
    eventLevel: "warning",
    eventMessage:
      "Temperature at 27°C. Lettuce bolting risk active. Potato yield reduction beginning.",
  },
  critical: {
    cropImpacts: {
      lettuce: { stressSeverity: "critical", stressType: "temperature_drift", yieldFactor: 0.45 },
      radish: { stressSeverity: "high", stressType: "temperature_drift", yieldFactor: 0.7 },
      potato: { stressSeverity: "critical", stressType: "temperature_drift", yieldFactor: 0.6 },
      beans: { stressSeverity: "moderate", stressType: "temperature_drift", yieldFactor: 0.85 },
    },
    eventLevel: "critical",
    eventMessage:
      "CRITICAL: Temperature at 32°C. Lettuce and potato critically stressed. Redirect resources to beans.",
  },
};

const SCENARIO_RULES: Record<
  FailureScenarioType,
  Record<FailureScenarioSeverity, ScenarioSeverityRule>
> = {
  water_recycling_decline: WATER_RULES,
  energy_budget_reduction: ENERGY_RULES,
  temperature_control_failure: TEMPERATURE_RULES,
};

const NUMERIC_RESOURCE_KEYS = [
  "waterReservoirL",
  "waterRecyclingEfficiencyPercent",
  "waterDailyConsumptionL",
  "nutrientSolutionLevelPercent",
  "energyAvailableKwh",
  "energyDailyConsumptionKwh",
  "energyReserveHours",
] as const satisfies ReadonlyArray<keyof MissionState["resources"]>;

type NumericResourceKey = (typeof NUMERIC_RESOURCE_KEYS)[number];

function cloneMissionState(state: MissionState): MissionState {
  return structuredClone(state);
}

function roundToSingleDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function deriveTimestamp(state: MissionState): string {
  const baseTime = Date.parse(state.lastUpdated);
  const safeBase = Number.isNaN(baseTime)
    ? Date.parse("2026-03-19T10:00:00.000Z")
    : baseTime;
  return new Date(safeBase + 1000).toISOString();
}

function deriveZoneStatus(stressSeverity: StressSeverity) {
  if (stressSeverity === "critical") {
    return "critical" as const;
  }

  if (stressSeverity === "none") {
    return "healthy" as const;
  }

  return "stressed" as const;
}

function applyResourceOverrides(state: MissionState, overrides: Record<string, number>): void {
  for (const [key, value] of Object.entries(overrides)) {
    if (!NUMERIC_RESOURCE_KEYS.includes(key as NumericResourceKey)) {
      continue;
    }

    const resourceKey = key as NumericResourceKey;
    state.resources[resourceKey] = value;
  }
}

function buildActiveScenario(
  state: MissionState,
  scenarioType: FailureScenarioType,
  severity: FailureScenarioSeverity,
  affectedZoneIds: string[],
  injectedAt: string,
): FailureScenario {
  const definition = SCENARIO_CATALOG[scenarioType];
  const parameterOverrides =
    definition.severityEffects[severity].parameterOverrides ?? {};

  return {
    scenarioId: `scenario-${state.missionDay}-${state.eventLog.length + 1}`,
    type: scenarioType,
    severity,
    title: definition.label,
    description: definition.description,
    injectedAt,
    affectedZoneIds,
    parameterOverrides,
  };
}

function appendScenarioEvent(
  state: MissionState,
  message: string,
  level: EventLevel,
  timestamp: string,
): void {
  state.eventLog.push({
    eventId: `evt-${String(state.eventLog.length + 1).padStart(3, "0")}`,
    timestamp,
    missionDay: state.missionDay,
    level,
    message,
  });
}

function applyScenarioEffects(
  state: MissionState,
  scenarioType: FailureScenarioType,
  severity: FailureScenarioSeverity,
  affectedZoneIds: Set<string>,
): ScenarioSeverityRule {
  const definition = SCENARIO_CATALOG[scenarioType];
  const severityRule = SCENARIO_RULES[scenarioType][severity];

  applyResourceOverrides(
    state,
    definition.severityEffects[severity].parameterOverrides,
  );

  state.zones = state.zones.map((zone) => {
    if (!affectedZoneIds.has(zone.zoneId)) {
      return zone;
    }

    const cropRule = severityRule.cropImpacts[zone.cropType];
    const projectedYieldKg = roundToSingleDecimal(
      Math.max(0, zone.projectedYieldKg * cropRule.yieldFactor),
    );

    return {
      ...zone,
      projectedYieldKg,
      status: deriveZoneStatus(cropRule.stressSeverity),
      stress: {
        ...zone.stress,
        active: cropRule.stressSeverity !== "none",
        type: cropRule.stressType,
        severity: cropRule.stressSeverity,
        summary: `${definition.label} applied at ${severity} severity.`,
      },
    };
  });

  return severityRule;
}

export function applyScenarioInjection(
  sourceState: MissionState,
  input: ScenarioInjectRequest,
): MissionState {
  const scenarioType = input.scenarioType;
  const severity = input.severity ?? "moderate";
  const state = cloneMissionState(sourceState);
  const affectedZoneIds = new Set(
    input.affectedZoneIds && input.affectedZoneIds.length > 0
      ? input.affectedZoneIds
      : state.zones.map((zone) => zone.zoneId),
  );
  const timestamp = deriveTimestamp(state);

  const severityRule = applyScenarioEffects(
    state,
    scenarioType,
    severity,
    affectedZoneIds,
  );

  state.activeScenario = buildActiveScenario(
    state,
    scenarioType,
    severity,
    [...affectedZoneIds],
    timestamp,
  );
  appendScenarioEvent(state, severityRule.eventMessage, severityRule.eventLevel, timestamp);
  state.lastUpdated = timestamp;

  return buildMissionSnapshot(state);
}

export function injectScenario(input: ScenarioInjectRequest): MissionState {
  const nextState = applyScenarioInjection(getMissionState(), input);
  return setMissionState(nextState);
}
