import type {
  AlertLevel,
  BackendCropZone,
  BackendMissionState,
  ControlActionItem,
  ControlActionPriority,
  ControlActionType,
  ControlAlert,
  ControlLogEntry,
  ControlRelatedSensor,
  StatusTone,
  TabId,
} from "../types";

type SensorKey = keyof BackendCropZone["sensors"];

export type SensorThreshold = {
  low: number;
  high: number;
  criticalLow: number;
  criticalHigh: number;
};

export interface SensorEvaluation {
  tone: StatusTone;
  state: string;
  severityRank: number;
  direction: "low" | "high" | "nominal";
}

interface ControlSignal {
  key: string;
  priority: ControlActionPriority;
  severityRank: number;
  targetLabel: string;
  targetZoneId?: string;
  systemArea: string;
  triggerReason: string;
  relatedSensors: ControlRelatedSensor[];
  actionTypes: ControlActionType[];
  headline: string;
  summary: string;
}

export interface ControlDetectionResult {
  activeActions: ControlActionItem[];
  newLogEntries: ControlLogEntry[];
  latestAlert: ControlAlert | null;
  activeIssueRanks: Record<string, number>;
  shouldRefreshPlanner: boolean;
}

type ThresholdCatalog = Record<
  BackendCropZone["cropType"],
  Record<SensorKey, SensorThreshold>
>;

const ACTION_DEFINITIONS: Record<
  ControlActionType,
  {
    label: string;
    recommendedSection: TabId;
    autoTriggered: boolean;
    advisoryOnly: boolean;
  }
> = {
  increase_irrigation: {
    label: "Increase irrigation",
    recommendedSection: "resources",
    autoTriggered: true,
    advisoryOnly: false,
  },
  reduce_irrigation: {
    label: "Reduce irrigation",
    recommendedSection: "resources",
    autoTriggered: true,
    advisoryOnly: false,
  },
  adjust_humidity: {
    label: "Adjust humidity",
    recommendedSection: "crops",
    autoTriggered: true,
    advisoryOnly: false,
  },
  adjust_temperature: {
    label: "Adjust temperature",
    recommendedSection: "crops",
    autoTriggered: true,
    advisoryOnly: false,
  },
  increase_lighting: {
    label: "Increase lighting",
    recommendedSection: "crops",
    autoTriggered: true,
    advisoryOnly: false,
  },
  reduce_lighting: {
    label: "Reduce lighting",
    recommendedSection: "resources",
    autoTriggered: true,
    advisoryOnly: false,
  },
  rebalance_lighting: {
    label: "Rebalance lighting",
    recommendedSection: "resources",
    autoTriggered: true,
    advisoryOnly: false,
  },
  adjust_nutrient_ph: {
    label: "Adjust nutrient pH",
    recommendedSection: "resources",
    autoTriggered: true,
    advisoryOnly: false,
  },
  adjust_nutrient_dose: {
    label: "Adjust nutrient dose",
    recommendedSection: "resources",
    autoTriggered: true,
    advisoryOnly: false,
  },
  flush_solution: {
    label: "Flush solution",
    recommendedSection: "resources",
    autoTriggered: false,
    advisoryOnly: true,
  },
  reallocate_water: {
    label: "Reallocate water",
    recommendedSection: "resources",
    autoTriggered: true,
    advisoryOnly: false,
  },
  rebalance_energy: {
    label: "Rebalance energy",
    recommendedSection: "resources",
    autoTriggered: true,
    advisoryOnly: false,
  },
  flag_manual_attention: {
    label: "Flag manual attention",
    recommendedSection: "agent",
    autoTriggered: false,
    advisoryOnly: true,
  },
};

export const SENSOR_THRESHOLDS: ThresholdCatalog = {
  lettuce: {
    temperature: { low: 18, high: 24, criticalLow: 14, criticalHigh: 30 },
    humidity: { low: 50, high: 70, criticalLow: 35, criticalHigh: 85 },
    co2Ppm: { low: 700, high: 1100, criticalLow: 450, criticalHigh: 1600 },
    lightPAR: { low: 180, high: 280, criticalLow: 140, criticalHigh: 360 },
    photoperiodHours: { low: 13, high: 18, criticalLow: 11, criticalHigh: 20 },
    soilMoisture: { low: 65, high: 80, criticalLow: 40, criticalHigh: 92 },
    nutrientPH: { low: 5.8, high: 6.4, criticalLow: 5.2, criticalHigh: 7 },
    electricalConductivity: { low: 1.4, high: 2.2, criticalLow: 0.8, criticalHigh: 3 },
  },
  potato: {
    temperature: { low: 17, high: 22, criticalLow: 12, criticalHigh: 29 },
    humidity: { low: 55, high: 75, criticalLow: 35, criticalHigh: 88 },
    co2Ppm: { low: 700, high: 1100, criticalLow: 450, criticalHigh: 1600 },
    lightPAR: { low: 250, high: 380, criticalLow: 180, criticalHigh: 460 },
    photoperiodHours: { low: 12, high: 16, criticalLow: 10, criticalHigh: 18 },
    soilMoisture: { low: 60, high: 82, criticalLow: 35, criticalHigh: 95 },
    nutrientPH: { low: 5.5, high: 6.2, criticalLow: 5, criticalHigh: 6.8 },
    electricalConductivity: { low: 1.6, high: 2.4, criticalLow: 1, criticalHigh: 3.3 },
  },
  beans: {
    temperature: { low: 20, high: 26, criticalLow: 14, criticalHigh: 33 },
    humidity: { low: 50, high: 72, criticalLow: 35, criticalHigh: 88 },
    co2Ppm: { low: 700, high: 1100, criticalLow: 450, criticalHigh: 1600 },
    lightPAR: { low: 210, high: 320, criticalLow: 160, criticalHigh: 420 },
    photoperiodHours: { low: 12, high: 16, criticalLow: 10, criticalHigh: 18 },
    soilMoisture: { low: 58, high: 78, criticalLow: 35, criticalHigh: 90 },
    nutrientPH: { low: 5.9, high: 6.5, criticalLow: 5.3, criticalHigh: 7.1 },
    electricalConductivity: { low: 1.5, high: 2.3, criticalLow: 1, criticalHigh: 3.2 },
  },
  radish: {
    temperature: { low: 18, high: 24, criticalLow: 14, criticalHigh: 31 },
    humidity: { low: 48, high: 72, criticalLow: 35, criticalHigh: 88 },
    co2Ppm: { low: 700, high: 1100, criticalLow: 450, criticalHigh: 1600 },
    lightPAR: { low: 150, high: 240, criticalLow: 110, criticalHigh: 320 },
    photoperiodHours: { low: 12, high: 16, criticalLow: 10, criticalHigh: 18 },
    soilMoisture: { low: 55, high: 76, criticalLow: 30, criticalHigh: 90 },
    nutrientPH: { low: 5.7, high: 6.3, criticalLow: 5.1, criticalHigh: 6.9 },
    electricalConductivity: { low: 1.3, high: 2.1, criticalLow: 0.8, criticalHigh: 2.9 },
  },
};

function priorityFromRank(severityRank: number): ControlActionPriority {
  if (severityRank >= 4) {
    return "critical";
  }

  if (severityRank >= 2) {
    return "warning";
  }

  return "info";
}

function alertLevelFromPriority(priority: ControlActionPriority): AlertLevel {
  if (priority === "critical") {
    return "abt";
  }

  if (priority === "warning") {
    return "cau";
  }

  return "nom";
}

function stressSeverityRank(severity: BackendCropZone["stress"]["severity"]): number {
  switch (severity) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "moderate":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function hasClearedIssues(
  previousIssueRanks: Record<string, number>,
  activeIssueRanks: Record<string, number>,
): boolean {
  return Object.keys(previousIssueRanks).some((key) => !(key in activeIssueRanks));
}

function capitalize(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function toLabel(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatZoneLabel(zone: BackendCropZone): string {
  return `${zone.zoneId} · ${zone.name}`;
}

function severityState(direction: "low" | "high", critical: boolean): string {
  if (critical) {
    return `critical ${direction}`;
  }

  return direction;
}

export function evaluateSensorThreshold(
  value: number,
  threshold: SensorThreshold,
): SensorEvaluation {
  if (value <= threshold.criticalLow) {
    return {
      tone: "ABT",
      state: severityState("low", true),
      severityRank: 4,
      direction: "low",
    };
  }

  if (value >= threshold.criticalHigh) {
    return {
      tone: "ABT",
      state: severityState("high", true),
      severityRank: 4,
      direction: "high",
    };
  }

  if (value < threshold.low) {
    return {
      tone: "CAU",
      state: severityState("low", false),
      severityRank: 2,
      direction: "low",
    };
  }

  if (value > threshold.high) {
    return {
      tone: "CAU",
      state: severityState("high", false),
      severityRank: 2,
      direction: "high",
    };
  }

  return {
    tone: "NOM",
    state: "nominal",
    severityRank: 0,
    direction: "nominal",
  };
}

export function evaluateZoneSensor(
  zone: BackendCropZone,
  sensorKey: SensorKey,
): SensorEvaluation {
  return evaluateSensorThreshold(zone.sensors[sensorKey], SENSOR_THRESHOLDS[zone.cropType][sensorKey]);
}

function createSignal(
  signal: Omit<ControlSignal, "priority"> & { priority?: ControlActionPriority },
): ControlSignal {
  return {
    ...signal,
    priority: signal.priority ?? priorityFromRank(signal.severityRank),
  };
}

function detectTemperatureSignal(zone: BackendCropZone): ControlSignal | null {
  const temperature = evaluateZoneSensor(zone, "temperature");
  const stressRank =
    zone.stress.type === "temperature_drift" ? stressSeverityRank(zone.stress.severity) : 0;
  const severityRank = Math.max(temperature.severityRank, stressRank);

  if (severityRank === 0) {
    return null;
  }

  const isHeat = temperature.direction === "high" || zone.stress.boltingRisk;
  const actionTypes: ControlActionType[] = ["adjust_temperature"];

  if (evaluateZoneSensor(zone, "humidity").direction === "low") {
    actionTypes.push("adjust_humidity");
  }

  if (zone.stress.boltingRisk || severityRank >= 4) {
    actionTypes.push("flag_manual_attention");
  }

  return createSignal({
    key: `${zone.zoneId}:temperature:${isHeat ? "high" : "low"}`,
    severityRank,
    targetLabel: formatZoneLabel(zone),
    targetZoneId: zone.zoneId,
    systemArea: "zone climate loop",
    triggerReason: `${formatZoneLabel(zone)} temperature is ${temperature.state}.`,
    relatedSensors: ["temperature", "humidity"],
    actionTypes,
    headline: `${formatZoneLabel(zone)} temperature exceeded safe range`,
    summary: `${formatZoneLabel(zone)} is reporting ${temperature.state} temperature.${zone.stress.boltingRisk ? " Bolting risk is active." : ""}`,
  });
}

function detectHumiditySignal(zone: BackendCropZone): ControlSignal | null {
  const humidity = evaluateZoneSensor(zone, "humidity");

  if (humidity.direction === "nominal") {
    return null;
  }

  return createSignal({
    key: `${zone.zoneId}:humidity:${humidity.direction}`,
    severityRank: humidity.severityRank,
    targetLabel: formatZoneLabel(zone),
    targetZoneId: zone.zoneId,
    systemArea: "zone humidity loop",
    triggerReason: `${formatZoneLabel(zone)} humidity is ${humidity.state}.`,
    relatedSensors: ["humidity"],
    actionTypes: ["adjust_humidity"],
    headline: `${formatZoneLabel(zone)} humidity moved outside target range`,
    summary: `${formatZoneLabel(zone)} humidity is ${humidity.state} and should be corrected to protect canopy stability.`,
  });
}

function detectMoistureSignal(mission: BackendMissionState, zone: BackendCropZone): ControlSignal | null {
  const soilMoisture = evaluateZoneSensor(zone, "soilMoisture");
  const stressRank = zone.stress.type === "water_stress" ? stressSeverityRank(zone.stress.severity) : 0;
  const severityRank = Math.max(soilMoisture.severityRank, stressRank);

  if (severityRank === 0 || soilMoisture.direction === "high") {
    return null;
  }

  const actionTypes: ControlActionType[] = ["increase_irrigation"];

  if (
    mission.resources.waterRecyclingEfficiencyPercent < 85 ||
    mission.resources.waterDaysRemaining < 30
  ) {
    actionTypes.push("reallocate_water");
  }

  if (severityRank >= 4) {
    actionTypes.push("flag_manual_attention");
  }

  return createSignal({
    key: `${zone.zoneId}:soilMoisture:low`,
    severityRank,
    targetLabel: formatZoneLabel(zone),
    targetZoneId: zone.zoneId,
    systemArea: "zone irrigation loop",
    triggerReason: `${formatZoneLabel(zone)} soil moisture is ${soilMoisture.state}.`,
    relatedSensors: ["soilMoisture", "waterRecyclingEfficiencyPercent", "waterDaysRemaining"],
    actionTypes,
    headline: `${formatZoneLabel(zone)} root zone is dehydrating`,
    summary: `${formatZoneLabel(zone)} soil moisture is ${soilMoisture.state}, indicating active dehydration pressure.`,
  });
}

function detectLightSignal(mission: BackendMissionState, zone: BackendCropZone): ControlSignal | null {
  const light = evaluateZoneSensor(zone, "lightPAR");
  const photoperiod = evaluateZoneSensor(zone, "photoperiodHours");
  const lightDeficitRank = Math.max(
    light.direction === "low" ? light.severityRank : 0,
    photoperiod.direction === "low" ? photoperiod.severityRank : 0,
  );

  if (lightDeficitRank === 0) {
    return null;
  }

  const energyConstrained =
    mission.resources.energyDaysRemaining < 2 ||
    mission.resources.energyAvailableKwh < mission.resources.energyDailyConsumptionKwh;

  return createSignal({
    key: `${zone.zoneId}:light:low`,
    severityRank: lightDeficitRank,
    targetLabel: formatZoneLabel(zone),
    targetZoneId: zone.zoneId,
    systemArea: "lighting schedule",
    triggerReason: `${formatZoneLabel(zone)} PAR or photoperiod fell below crop targets.`,
    relatedSensors: ["lightPAR", "photoperiodHours", "energyAvailableKwh"],
    actionTypes: [energyConstrained ? "rebalance_lighting" : "increase_lighting"],
    headline: `${formatZoneLabel(zone)} is underlit`,
    summary: `${formatZoneLabel(zone)} is below the configured lighting band, so the frontend monitor is preparing an abstract lighting response.`,
  });
}

function detectPhSignal(zone: BackendCropZone): ControlSignal | null {
  const nutrientPh = evaluateZoneSensor(zone, "nutrientPH");

  if (nutrientPh.direction === "nominal") {
    return null;
  }

  return createSignal({
    key: `${zone.zoneId}:nutrientPH:${nutrientPh.direction}`,
    severityRank: nutrientPh.severityRank,
    targetLabel: formatZoneLabel(zone),
    targetZoneId: zone.zoneId,
    systemArea: "nutrient chemistry loop",
    triggerReason: `${formatZoneLabel(zone)} nutrient pH is ${nutrientPh.state}.`,
    relatedSensors: ["nutrientPH"],
    actionTypes: ["adjust_nutrient_ph"],
    headline: `${formatZoneLabel(zone)} nutrient pH drifted outside the operating band`,
    summary: `${formatZoneLabel(zone)} nutrient pH is ${nutrientPh.state}, so the monitor is flagging a chemistry adjustment.`,
  });
}

function detectEcSignal(zone: BackendCropZone): ControlSignal | null {
  const electricalConductivity = evaluateZoneSensor(zone, "electricalConductivity");

  if (electricalConductivity.direction === "nominal") {
    return null;
  }

  const highConductivity = electricalConductivity.direction === "high";

  return createSignal({
    key: `${zone.zoneId}:electricalConductivity:${electricalConductivity.direction}`,
    severityRank: electricalConductivity.severityRank,
    targetLabel: formatZoneLabel(zone),
    targetZoneId: zone.zoneId,
    systemArea: "nutrient chemistry loop",
    triggerReason: `${formatZoneLabel(zone)} electrical conductivity is ${electricalConductivity.state}.`,
    relatedSensors: ["electricalConductivity"],
    actionTypes: [highConductivity ? "flush_solution" : "adjust_nutrient_dose"],
    headline: `${formatZoneLabel(zone)} nutrient concentration is out of band`,
    summary: `${formatZoneLabel(zone)} electrical conductivity is ${electricalConductivity.state}, so the monitor is preparing a nutrient response.`,
  });
}

function detectFallbackStressSignal(zone: BackendCropZone): ControlSignal | null {
  if (!zone.stress.active || zone.stress.type === "none") {
    return null;
  }

  return createSignal({
    key: `${zone.zoneId}:stress:${zone.stress.type}`,
    severityRank: Math.max(stressSeverityRank(zone.stress.severity), zone.status === "offline" ? 4 : 0),
    targetLabel: formatZoneLabel(zone),
    targetZoneId: zone.zoneId,
    systemArea: "operator watch",
    triggerReason: zone.stress.summary,
    relatedSensors: ["missionStatus"],
    actionTypes: ["flag_manual_attention"],
    headline: `${formatZoneLabel(zone)} requires operator review`,
    summary: zone.stress.summary,
  });
}

function detectWaterSignal(mission: BackendMissionState): ControlSignal | null {
  const severityRank =
    mission.resources.waterRecyclingEfficiencyPercent < 60 || mission.resources.waterDaysRemaining < 14
      ? 4
      : mission.resources.waterRecyclingEfficiencyPercent < 85 || mission.resources.waterDaysRemaining < 45
        ? 2
        : 0;

  if (severityRank === 0) {
    return null;
  }

  return createSignal({
    key: "resource:water-loop",
    severityRank,
    targetLabel: "Water loop",
    systemArea: "shared water system",
    triggerReason: `Water recovery is ${mission.resources.waterRecyclingEfficiencyPercent}% with ${mission.resources.waterDaysRemaining.toFixed(1)} days remaining.`,
    relatedSensors: ["waterRecyclingEfficiencyPercent", "waterDaysRemaining"],
    actionTypes: ["reallocate_water"],
    headline: "Water loop performance degraded",
    summary: `Water recycling has fallen to ${mission.resources.waterRecyclingEfficiencyPercent}% and net runway is ${mission.resources.waterDaysRemaining.toFixed(1)} days.`,
  });
}

function detectEnergySignal(mission: BackendMissionState): ControlSignal | null {
  const severityRank =
    mission.resources.energyDaysRemaining < 1 || mission.resources.energyReserveHours < 6
      ? 4
      : mission.resources.energyDaysRemaining < 3 || mission.resources.energyReserveHours < 12
        ? 2
        : 0;

  if (severityRank === 0) {
    return null;
  }

  const actionTypes: ControlActionType[] = ["rebalance_energy"];

  if (severityRank >= 4) {
    actionTypes.push("reduce_lighting");
  }

  return createSignal({
    key: "resource:energy-loop",
    severityRank,
    targetLabel: "Energy loop",
    systemArea: "shared energy budget",
    triggerReason: `Energy reserve is ${mission.resources.energyReserveHours} h with ${mission.resources.energyDaysRemaining.toFixed(1)} days remaining.`,
    relatedSensors: ["energyAvailableKwh", "energyDaysRemaining"],
    actionTypes,
    headline: "Energy runway is tightening",
    summary: `Energy reserve is down to ${mission.resources.energyReserveHours} hours, so the frontend monitor is preparing a conservative energy response.`,
  });
}

function detectMissionSignal(mission: BackendMissionState): ControlSignal | null {
  if (mission.status === "nominal" && !mission.activeScenario) {
    return null;
  }

  const severityRank = mission.status === "critical" ? 4 : 2;

  return createSignal({
    key: `mission:${mission.status}:${mission.activeScenario?.type ?? "monitor"}`,
    severityRank,
    targetLabel: "Mission control",
    systemArea: "mission oversight",
    triggerReason: mission.activeScenario
      ? `${mission.activeScenario.title} remains active.`
      : `Mission status is ${mission.status}.`,
    relatedSensors: ["missionStatus", "activeScenario"],
    actionTypes: ["flag_manual_attention"],
    headline: "Mission state moved outside nominal operations",
    summary: mission.activeScenario
      ? `${mission.activeScenario.title} remains active and requires coordinated monitoring.`
      : `Mission status is ${mission.status}, so the frontend monitor is escalating visibility.`,
  });
}

function detectControlSignals(mission: BackendMissionState): ControlSignal[] {
  const signals: ControlSignal[] = [];

  for (const zone of mission.zones) {
    const zoneSignals = [
      detectTemperatureSignal(zone),
      detectMoistureSignal(mission, zone),
      detectLightSignal(mission, zone),
      detectPhSignal(zone),
      detectEcSignal(zone),
    ].filter((signal): signal is ControlSignal => signal !== null);

    const hasTemperatureSignal = zoneSignals.some((signal) => signal.key.startsWith(`${zone.zoneId}:temperature:`));
    const hasHumiditySignal = zoneSignals.some((signal) => signal.key.startsWith(`${zone.zoneId}:humidity:`));

    if (!hasTemperatureSignal && !hasHumiditySignal) {
      const humiditySignal = detectHumiditySignal(zone);

      if (humiditySignal) {
        zoneSignals.push(humiditySignal);
      }
    }

    if (zoneSignals.length === 0) {
      const fallbackStressSignal = detectFallbackStressSignal(zone);

      if (fallbackStressSignal) {
        zoneSignals.push(fallbackStressSignal);
      }
    }

    signals.push(...zoneSignals);
  }

  const globalSignals = [
    detectWaterSignal(mission),
    detectEnergySignal(mission),
  ].filter((signal): signal is ControlSignal => signal !== null);

  signals.push(...globalSignals);

  if (signals.length === 0) {
    const missionSignal = detectMissionSignal(mission);

    if (missionSignal) {
      signals.push(missionSignal);
    }
  }

  return signals.sort((left, right) => {
    if (right.severityRank !== left.severityRank) {
      return right.severityRank - left.severityRank;
    }

    return left.key.localeCompare(right.key);
  });
}

function buildActionItems(
  signals: ControlSignal[],
  detectedAt: string,
): ControlActionItem[] {
  return signals.flatMap((signal) =>
    unique(signal.actionTypes).map((actionType) => {
      const definition = ACTION_DEFINITIONS[actionType];

      return {
        id: `${signal.key}:${actionType}:${detectedAt}`,
        abnormalityKey: signal.key,
        actionType,
        label: definition.label,
        priority: signal.priority,
        targetLabel: signal.targetLabel,
        targetZoneId: signal.targetZoneId,
        systemArea: signal.systemArea,
        triggerReason: signal.triggerReason,
        relatedSensors: signal.relatedSensors,
        recommendedSection: definition.recommendedSection,
        autoTriggered: definition.autoTriggered,
        advisoryOnly: definition.advisoryOnly,
        severityRank: signal.severityRank,
        headline: signal.headline,
        summary: signal.summary,
        detectedAt,
      };
    }),
  );
}

function buildLogEntries(
  signals: ControlSignal[],
  detectedAt: string,
): ControlLogEntry[] {
  return signals.map((signal) => ({
    id: `${signal.key}:${detectedAt}`,
    abnormalityKey: signal.key,
    kind: "recommendation",
    timestamp: detectedAt,
    priority: signal.priority,
    headline: signal.headline,
    message: `${signal.summary} Recommended response: ${unique(signal.actionTypes)
      .map((actionType) => ACTION_DEFINITIONS[actionType].label.toLowerCase())
      .join(", ")}.`,
    targetLabel: signal.targetLabel,
    targetZoneId: signal.targetZoneId,
    actionLabels: unique(signal.actionTypes).map((actionType) => ACTION_DEFINITIONS[actionType].label),
    relatedSensors: signal.relatedSensors,
    recommendedSection: ACTION_DEFINITIONS[signal.actionTypes[0]].recommendedSection,
    autoTriggered: signal.actionTypes.some((actionType) => ACTION_DEFINITIONS[actionType].autoTriggered),
  }));
}

function buildAlert(
  signal: ControlSignal | null,
  detectedAt: string,
): ControlAlert | null {
  if (!signal) {
    return null;
  }

  const actionLabels = unique(signal.actionTypes).map(
    (actionType) => ACTION_DEFINITIONS[actionType].label,
  );

  return {
    id: `${signal.key}:alert:${detectedAt}`,
    abnormalityKey: signal.key,
    kind: "recommendation",
    level: alertLevelFromPriority(signal.priority),
    title: signal.headline,
    message: `${signal.summary} Recommended response: ${actionLabels.join(" and ")}.`,
    actionLabels,
    targetLabel: signal.targetLabel,
    timestamp: detectedAt,
  };
}

export function formatControlActionType(actionType: ControlActionType): string {
  return capitalize(toLabel(actionType));
}

export function reconcileControlActions(
  mission: BackendMissionState,
  previousIssueRanks: Record<string, number>,
  detectedAt = new Date().toISOString(),
): ControlDetectionResult {
  const signals = detectControlSignals(mission);
  const activeIssueRanks = Object.fromEntries(
    signals.map((signal) => [signal.key, signal.severityRank]),
  );

  const newSignals = signals.filter((signal) => {
    const previousRank = previousIssueRanks[signal.key] ?? 0;
    return previousRank === 0 || signal.severityRank > previousRank;
  });

  return {
    activeActions: buildActionItems(signals, detectedAt),
    newLogEntries: buildLogEntries(newSignals, detectedAt),
    latestAlert: buildAlert(newSignals[0] ?? null, detectedAt),
    activeIssueRanks,
    shouldRefreshPlanner:
      newSignals.length > 0 || hasClearedIssues(previousIssueRanks, activeIssueRanks),
  };
}
