import type { PlannerOutput } from "../../../../shared/schemas/plannerOutput.schema";
import { SCENARIO_CATALOG } from "../../data/scenarios.data";
import type {
  ManualTweakParams,
  ScenarioInjectRequest,
} from "../../schemas/scenario.schema";
import {
  buildMissionSnapshot,
  getCurrentMissionSnapshot,
} from "../mission/mission.service";
import {
  createPlannerOutput,
  detectNutritionRisk,
} from "../mission/mission.monitoring";
import { persistMissionState, setMissionState } from "../mission/mission.store";
import { buildPlantInterventionEvents } from "../plants/plant.service";
import type {
  CropType,
  EventLevel,
  FailureScenario,
  FailureScenarioSeverity,
  FailureScenarioType,
  MissionState,
  StressSeverity,
  StressType,
  ZoneSensors,
  CropZoneStatus,
} from "../mission/mission.types";

type CropImpactRule = {
  stressSeverity: StressSeverity;
  stressType: StressType;
  yieldFactor: number;
};

type ScenarioSeverityRule = {
  cropImpacts: Record<CropType, CropImpactRule>;
  eventType: EventLevel;
  eventMessage: string;
  soilMoistureFactor?: number;
  humidityDelta?: number;
  lightParFactor?: number;
  photoperiodDelta?: number;
  temperatureDelta?: number;
  statusOverride?: CropZoneStatus;
};

const WATER_RULES: Record<FailureScenarioSeverity, ScenarioSeverityRule> = {
  mild: {
    cropImpacts: {
      lettuce: { stressSeverity: "low", stressType: "water_deficit", yieldFactor: 0.95 },
      radish: { stressSeverity: "low", stressType: "water_deficit", yieldFactor: 0.96 },
      potato: { stressSeverity: "low", stressType: "water_deficit", yieldFactor: 0.98 },
      beans: { stressSeverity: "low", stressType: "water_deficit", yieldFactor: 0.98 },
    },
    eventType: "info",
    eventMessage: "Water recycling efficiency dropped to 78%. Monitor reservoir trend.",
    soilMoistureFactor: 0.94,
    humidityDelta: -2,
  },
  moderate: {
    cropImpacts: {
      lettuce: { stressSeverity: "high", stressType: "water_deficit", yieldFactor: 0.8 },
      radish: { stressSeverity: "moderate", stressType: "water_deficit", yieldFactor: 0.85 },
      potato: { stressSeverity: "moderate", stressType: "water_deficit", yieldFactor: 0.9 },
      beans: { stressSeverity: "moderate", stressType: "water_deficit", yieldFactor: 0.88 },
    },
    eventType: "warning",
    eventMessage:
      "Water recycling at 65%. Irrigation rationing active. Lettuce zone under water stress.",
    soilMoistureFactor: 0.8,
    humidityDelta: -4,
  },
  critical: {
    cropImpacts: {
      lettuce: { stressSeverity: "critical", stressType: "water_deficit", yieldFactor: 0.65 },
      radish: { stressSeverity: "high", stressType: "water_deficit", yieldFactor: 0.72 },
      potato: { stressSeverity: "moderate", stressType: "water_deficit", yieldFactor: 0.85 },
      beans: { stressSeverity: "moderate", stressType: "water_deficit", yieldFactor: 0.82 },
    },
    eventType: "critical",
    eventMessage:
      "CRITICAL: Water recycling at 45%. Severe water loss. Nutrition Preservation Mode recommended.",
    soilMoistureFactor: 0.64,
    humidityDelta: -8,
  },
};

const ENERGY_RULES: Record<FailureScenarioSeverity, ScenarioSeverityRule> = {
  mild: {
    cropImpacts: {
      lettuce: { stressSeverity: "none", stressType: "none", yieldFactor: 1 },
      radish: { stressSeverity: "none", stressType: "none", yieldFactor: 1 },
      potato: { stressSeverity: "none", stressType: "none", yieldFactor: 1 },
      beans: { stressSeverity: "none", stressType: "none", yieldFactor: 1 },
    },
    eventType: "info",
    eventMessage: "Energy reserve reduced. Lighting schedule optimisation recommended.",
    lightParFactor: 0.95,
    photoperiodDelta: -0.5,
  },
  moderate: {
    cropImpacts: {
      lettuce: { stressSeverity: "low", stressType: "light_deficit", yieldFactor: 0.94 },
      radish: { stressSeverity: "low", stressType: "light_deficit", yieldFactor: 0.92 },
      potato: { stressSeverity: "moderate", stressType: "energy_shortage", yieldFactor: 0.82 },
      beans: { stressSeverity: "low", stressType: "light_deficit", yieldFactor: 0.88 },
    },
    eventType: "warning",
    eventMessage:
      "Energy deficit. LED intensity reduced. Potato zone entering moderate stress.",
    lightParFactor: 0.82,
    photoperiodDelta: -1,
  },
  critical: {
    cropImpacts: {
      lettuce: { stressSeverity: "moderate", stressType: "light_deficit", yieldFactor: 0.85 },
      radish: { stressSeverity: "moderate", stressType: "light_deficit", yieldFactor: 0.82 },
      potato: { stressSeverity: "high", stressType: "energy_shortage", yieldFactor: 0.7 },
      beans: { stressSeverity: "moderate", stressType: "light_deficit", yieldFactor: 0.78 },
    },
    eventType: "critical",
    eventMessage:
      "CRITICAL: Severe energy deficit. All zones under stress. Nutrition Preservation Mode recommended.",
    lightParFactor: 0.68,
    photoperiodDelta: -2,
    temperatureDelta: 1.5,
  },
};

const TEMPERATURE_RULES: Record<FailureScenarioSeverity, ScenarioSeverityRule> = {
  mild: {
    cropImpacts: {
      lettuce: { stressSeverity: "low", stressType: "heat", yieldFactor: 0.96 },
      radish: { stressSeverity: "none", stressType: "none", yieldFactor: 1 },
      potato: { stressSeverity: "none", stressType: "none", yieldFactor: 1 },
      beans: { stressSeverity: "none", stressType: "none", yieldFactor: 1 },
    },
    eventType: "info",
    eventMessage: "Temperature at 24°C. Lettuce approaching heat stress threshold.",
    humidityDelta: -2,
  },
  moderate: {
    cropImpacts: {
      lettuce: { stressSeverity: "high", stressType: "heat", yieldFactor: 0.7 },
      radish: { stressSeverity: "moderate", stressType: "heat", yieldFactor: 0.88 },
      potato: { stressSeverity: "moderate", stressType: "heat", yieldFactor: 0.85 },
      beans: { stressSeverity: "low", stressType: "heat", yieldFactor: 0.95 },
    },
    eventType: "warning",
    eventMessage:
      "Temperature at 27°C. Lettuce bolting risk active. Potato yield reduction beginning.",
    humidityDelta: -5,
  },
  critical: {
    cropImpacts: {
      lettuce: { stressSeverity: "critical", stressType: "heat", yieldFactor: 0.45 },
      radish: { stressSeverity: "high", stressType: "heat", yieldFactor: 0.7 },
      potato: { stressSeverity: "critical", stressType: "heat", yieldFactor: 0.6 },
      beans: { stressSeverity: "moderate", stressType: "heat", yieldFactor: 0.85 },
    },
    eventType: "critical",
    eventMessage:
      "CRITICAL: Temperature at 32°C. Lettuce and potato critically stressed. Redirect resources to beans.",
    humidityDelta: -10,
  },
};

const SINGLE_ZONE_CONTROL_RULES: Record<FailureScenarioSeverity, ScenarioSeverityRule> = {
  mild: {
    cropImpacts: {
      lettuce: { stressSeverity: "moderate", stressType: "energy_shortage", yieldFactor: 0.7 },
      radish: { stressSeverity: "moderate", stressType: "energy_shortage", yieldFactor: 0.72 },
      potato: { stressSeverity: "moderate", stressType: "energy_shortage", yieldFactor: 0.7 },
      beans: { stressSeverity: "moderate", stressType: "energy_shortage", yieldFactor: 0.72 },
    },
    eventType: "warning",
    eventMessage:
      "Zone control fault detected. Local irrigation and lighting are unstable. Prepare to redistribute shared support.",
    soilMoistureFactor: 0.78,
    humidityDelta: -6,
    lightParFactor: 0.62,
    photoperiodDelta: -3,
    temperatureDelta: 1.5,
  },
  moderate: {
    cropImpacts: {
      lettuce: { stressSeverity: "high", stressType: "energy_shortage", yieldFactor: 0.42 },
      radish: { stressSeverity: "high", stressType: "energy_shortage", yieldFactor: 0.44 },
      potato: { stressSeverity: "high", stressType: "energy_shortage", yieldFactor: 0.4 },
      beans: { stressSeverity: "high", stressType: "energy_shortage", yieldFactor: 0.44 },
    },
    eventType: "critical",
    eventMessage:
      "Single-zone control failure confirmed. Isolate the affected bay and redistribute water and energy to the remaining zones.",
    soilMoistureFactor: 0.52,
    humidityDelta: -10,
    lightParFactor: 0.28,
    photoperiodDelta: -7,
    temperatureDelta: 3,
    statusOverride: "critical",
  },
  critical: {
    cropImpacts: {
      lettuce: { stressSeverity: "critical", stressType: "energy_shortage", yieldFactor: 0 },
      radish: { stressSeverity: "critical", stressType: "energy_shortage", yieldFactor: 0 },
      potato: { stressSeverity: "critical", stressType: "energy_shortage", yieldFactor: 0 },
      beans: { stressSeverity: "critical", stressType: "energy_shortage", yieldFactor: 0 },
    },
    eventType: "critical",
    eventMessage:
      "CRITICAL: Single-zone control failure. Isolate the affected bay and immediately redirect water and energy to the surviving zones.",
    soilMoistureFactor: 0.3,
    humidityDelta: -14,
    lightParFactor: 0.06,
    photoperiodDelta: -12,
    temperatureDelta: 4.5,
    statusOverride: "offline",
  },
};

const SCENARIO_RULES: Record<
  FailureScenarioType,
  Record<FailureScenarioSeverity, ScenarioSeverityRule>
> = {
  water_recycling_decline: WATER_RULES,
  energy_budget_reduction: ENERGY_RULES,
  temperature_control_failure: TEMPERATURE_RULES,
  single_zone_control_failure: SINGLE_ZONE_CONTROL_RULES,
};

const RESOURCE_OVERRIDE_KEYS = [
  "waterRecyclingEfficiency",
  "waterDailyConsumptionL",
  "energyAvailableKwh",
  "energyConsumptionKwhPerDay",
] as const;

function cloneMissionState(state: MissionState): MissionState {
  return structuredClone(state);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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

function getTemperatureOverrideKey(zoneId: string): keyof ManualTweakParams | null {
  const suffix = zoneId.replace(/^zone-?/i, "").toUpperCase();

  if (suffix === "A") {
    return "temperatureZoneA";
  }

  if (suffix === "B") {
    return "temperatureZoneB";
  }

  if (suffix === "C") {
    return "temperatureZoneC";
  }

  if (suffix === "D") {
    return "temperatureZoneD";
  }

  return null;
}

function mergeOverrides(input: {
  scenarioType: FailureScenarioType;
  severity: FailureScenarioSeverity;
  customOverrides?: ScenarioInjectRequest["customOverrides"];
}): Partial<ManualTweakParams> {
  const definition = SCENARIO_CATALOG[input.scenarioType];
  const baseOverrides = definition.severityEffects[input.severity].parameterOverrides;

  return {
    ...baseOverrides,
    ...(input.customOverrides ?? {}),
  };
}

function applyResourceOverrides(
  state: MissionState,
  overrides: Partial<ManualTweakParams>,
): void {
  for (const key of RESOURCE_OVERRIDE_KEYS) {
    const overrideValue = overrides[key];
    if (overrideValue !== undefined) {
      state.resources[key] = overrideValue;
    }
  }
}

function applyDirectSensorOverrides(
  sensors: ZoneSensors,
  zoneId: string,
  overrides: Partial<ManualTweakParams>,
): ZoneSensors {
  const nextSensors = { ...sensors };
  const temperatureOverrideKey = getTemperatureOverrideKey(zoneId);

  if (temperatureOverrideKey && overrides[temperatureOverrideKey] !== undefined) {
    nextSensors.temperature = overrides[temperatureOverrideKey] as number;
  }

  if (overrides.lightPAROverride !== undefined) {
    nextSensors.lightPAR = overrides.lightPAROverride;
  }

  return nextSensors;
}

function applyScenarioSensorShift(input: {
  sensors: ZoneSensors;
  scenarioType: FailureScenarioType;
  severityRule: ScenarioSeverityRule;
  overrides: Partial<ManualTweakParams>;
  zoneId: string;
}): ZoneSensors {
  const { scenarioType, severityRule, overrides, zoneId } = input;
  const sensors = applyDirectSensorOverrides(input.sensors, zoneId, overrides);

  if (scenarioType === "water_recycling_decline") {
    return {
      ...sensors,
      soilMoisture: roundToSingleDecimal(
        clamp(
          sensors.soilMoisture * (severityRule.soilMoistureFactor ?? 1),
          5,
          100,
        ),
      ),
      humidity: roundToSingleDecimal(
        clamp(sensors.humidity + (severityRule.humidityDelta ?? 0), 10, 100),
      ),
      electricalConductivity: roundToSingleDecimal(
        clamp(sensors.electricalConductivity + 0.2, 0.1, 6),
      ),
    };
  }

  if (scenarioType === "energy_budget_reduction") {
    return {
      ...sensors,
      lightPAR: roundToSingleDecimal(
        clamp(sensors.lightPAR * (severityRule.lightParFactor ?? 1), 0, 1200),
      ),
      photoperiodHours: roundToSingleDecimal(
        clamp(sensors.photoperiodHours + (severityRule.photoperiodDelta ?? 0), 8, 24),
      ),
      temperature: roundToSingleDecimal(
        clamp(sensors.temperature + (severityRule.temperatureDelta ?? 0), -10, 45),
      ),
    };
  }

  if (scenarioType === "single_zone_control_failure") {
    return {
      ...sensors,
      soilMoisture: roundToSingleDecimal(
        clamp(sensors.soilMoisture * (severityRule.soilMoistureFactor ?? 1), 0, 100),
      ),
      humidity: roundToSingleDecimal(
        clamp(sensors.humidity + (severityRule.humidityDelta ?? 0), 10, 100),
      ),
      lightPAR: roundToSingleDecimal(
        clamp(sensors.lightPAR * (severityRule.lightParFactor ?? 1), 0, 1200),
      ),
      photoperiodHours: roundToSingleDecimal(
        clamp(sensors.photoperiodHours + (severityRule.photoperiodDelta ?? 0), 0, 24),
      ),
      temperature: roundToSingleDecimal(
        clamp(sensors.temperature + (severityRule.temperatureDelta ?? 0), -10, 45),
      ),
      co2Ppm: Math.round(clamp(sensors.co2Ppm - 140, 200, 5000)),
    };
  }

  return {
    ...sensors,
    humidity: roundToSingleDecimal(
      clamp(sensors.humidity + (severityRule.humidityDelta ?? 0), 10, 100),
    ),
  };
}

function buildActiveScenario(input: {
  state: MissionState;
  scenarioType: FailureScenarioType;
  severity: FailureScenarioSeverity;
  affectedZones: string[];
  injectedAt: string;
  parameterOverrides: Partial<ManualTweakParams>;
}): FailureScenario {
  const definition = SCENARIO_CATALOG[input.scenarioType];
  const severityEffect = definition.severityEffects[input.severity];

  return {
    scenarioId: `scen-${String(input.state.eventLog.length + 1).padStart(3, "0")}`,
    scenarioType: input.scenarioType,
    severity: input.severity,
    injectedAt: input.injectedAt,
    affectedZones: input.affectedZones,
    parameterOverrides: { ...input.parameterOverrides },
    description: severityEffect.effectSummary,
  };
}

function appendScenarioEvent(input: {
  state: MissionState;
  timestamp: string;
  eventType: EventLevel;
  message: string;
  scenarioType: FailureScenarioType;
  affectedZones: string[];
}): void {
  const zoneId = input.affectedZones.length === 1 ? input.affectedZones[0] : undefined;
  const message =
    input.scenarioType === "single_zone_control_failure" && zoneId
      ? `${zoneId}: ${input.message}`
      : input.message;

  input.state.eventLog.push({
    eventId: `evt-${String(input.state.eventLog.length + 1).padStart(3, "0")}`,
    timestamp: input.timestamp,
    missionDay: input.state.missionDay,
    type: input.eventType,
    message,
    zoneId,
  });
}

function applyScenarioEffects(input: {
  state: MissionState;
  scenarioType: FailureScenarioType;
  severity: FailureScenarioSeverity;
  affectedZones: Set<string>;
  parameterOverrides: Partial<ManualTweakParams>;
}): ScenarioSeverityRule {
  const { state, scenarioType, severity, affectedZones, parameterOverrides } = input;
  const severityRule = SCENARIO_RULES[scenarioType][severity];

  applyResourceOverrides(state, parameterOverrides);

  state.zones = state.zones.map((zone) => {
    if (!affectedZones.has(zone.zoneId)) {
      return zone;
    }

    const cropRule = severityRule.cropImpacts[zone.cropType];
    const sensors = applyScenarioSensorShift({
      sensors: zone.sensors,
      scenarioType,
      severityRule,
      overrides: parameterOverrides,
      zoneId: zone.zoneId,
    });

    return {
      ...zone,
      sensors,
      projectedYieldKg: roundToSingleDecimal(
        Math.max(0, zone.projectedYieldKg * cropRule.yieldFactor),
      ),
      status: severityRule.statusOverride ?? deriveZoneStatus(cropRule.stressSeverity),
      stress: {
        active: cropRule.stressSeverity !== "none",
        type: cropRule.stressType,
        severity: cropRule.stressSeverity,
        boltingRisk:
          zone.cropType === "lettuce" &&
          cropRule.stressType === "heat" &&
          cropRule.stressSeverity !== "none",
        symptoms: [],
      },
    };
  });

  return severityRule;
}

export function applyScenarioInjection(
  sourceState: MissionState,
  input: ScenarioInjectRequest,
): MissionState {
  const beforeSnapshot = buildMissionSnapshot(sourceState);
  const scenarioType = input.scenarioType;
  const severity = input.severity;
  const state = cloneMissionState(beforeSnapshot);
  const affectedZones = new Set(
    input.affectedZones && input.affectedZones.length > 0
      ? input.affectedZones
      : state.zones.map((zone) => zone.zoneId),
  );
  const timestamp = deriveTimestamp(state);
  const parameterOverrides = mergeOverrides({
    scenarioType,
    severity,
    customOverrides: input.customOverrides,
  });
  const severityRule = applyScenarioEffects({
    state,
    scenarioType,
    severity,
    affectedZones,
    parameterOverrides,
  });

  state.activeScenario = buildActiveScenario({
    state,
    scenarioType,
    severity,
    affectedZones: [...affectedZones],
    injectedAt: timestamp,
    parameterOverrides,
  });
  appendScenarioEvent({
    state,
    timestamp,
    eventType: severityRule.eventType,
    message: severityRule.eventMessage,
    scenarioType,
    affectedZones: [...affectedZones],
  });
  state.lastUpdated = timestamp;
  const nextState = buildMissionSnapshot(state);
  nextState.eventLog.push(
    ...buildPlantInterventionEvents({
      beforeState: beforeSnapshot,
      afterState: nextState,
      timestamp,
    }),
  );

  return buildMissionSnapshot(nextState);
}

export function createScenarioInjectionOutput(
  sourceState: MissionState,
  input: ScenarioInjectRequest,
): PlannerOutput {
  const beforeSnapshot = buildMissionSnapshot(sourceState);
  const missionState = applyScenarioInjection(beforeSnapshot, input);

  return createPlannerOutput({
    beforeState: beforeSnapshot,
    missionState,
    reason: `Scenario: ${input.scenarioType} applied`,
  });
}

export function injectScenario(input: ScenarioInjectRequest): PlannerOutput {
  const beforeState = getCurrentMissionSnapshot();
  const output = createScenarioInjectionOutput(beforeState, input);
  setMissionState(output.missionState);
  return output;
}

export async function injectScenarioPersisted(
  input: ScenarioInjectRequest,
): Promise<PlannerOutput> {
  const beforeState = getCurrentMissionSnapshot();
  const output = createScenarioInjectionOutput(beforeState, input);
  await persistMissionState(output.missionState);
  return output;
}

export function shouldTriggerAgentFromScenario(
  state: MissionState,
): boolean {
  return detectNutritionRisk(state) || state.status !== "nominal";
}
