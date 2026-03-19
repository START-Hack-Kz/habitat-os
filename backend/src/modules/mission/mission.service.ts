import { CROP_PROFILES } from "../../data/cropProfiles.data";
import { calculateNutrition } from "../nutrition/nutrition.calculator";
import { reconcilePlantHealthChecks, reconcilePlants } from "../plants/plant.service";
import { getMissionState } from "./mission.store";
import type {
  CropType,
  CropZone,
  EventLogEntry,
  MissionState,
  MissionStatus,
  NutritionStatus,
  ResourceState,
  StressSeverity,
  StressType,
  ZoneSensors,
  ZoneStress,
} from "./mission.types";

type StressCandidate = {
  type: StressType;
  severity: StressSeverity;
  source: "explicit" | "sensor";
};

const STRESS_LEVELS: StressSeverity[] = [
  "none",
  "low",
  "moderate",
  "high",
  "critical",
] as const;

const STRESS_YIELD_FACTORS: Record<StressType, Record<StressSeverity, number>> = {
  none: {
    none: 1,
    low: 1,
    moderate: 1,
    high: 1,
    critical: 1,
  },
  heat: {
    none: 1,
    low: 0.96,
    moderate: 0.85,
    high: 0.7,
    critical: 0.5,
  },
  cold: {
    none: 1,
    low: 0.97,
    moderate: 0.88,
    high: 0.74,
    critical: 0.56,
  },
  water_deficit: {
    none: 1,
    low: 0.97,
    moderate: 0.86,
    high: 0.72,
    critical: 0.55,
  },
  nitrogen_deficiency: {
    none: 1,
    low: 0.97,
    moderate: 0.9,
    high: 0.78,
    critical: 0.62,
  },
  light_deficit: {
    none: 1,
    low: 0.96,
    moderate: 0.86,
    high: 0.72,
    critical: 0.58,
  },
  energy_shortage: {
    none: 1,
    low: 0.97,
    moderate: 0.88,
    high: 0.76,
    critical: 0.62,
  },
  salinity: {
    none: 1,
    low: 0.98,
    moderate: 0.92,
    high: 0.8,
    critical: 0.66,
  },
};

function cloneMissionState(state: MissionState): MissionState {
  return structuredClone(state);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToSingleDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function severityRank(severity: StressSeverity): number {
  return STRESS_LEVELS.indexOf(severity);
}

function maxSeverity(left: StressSeverity, right: StressSeverity): StressSeverity {
  return severityRank(left) >= severityRank(right) ? left : right;
}

function bumpSeverity(severity: StressSeverity, steps = 1): StressSeverity {
  const nextIndex = Math.min(
    STRESS_LEVELS.length - 1,
    Math.max(0, severityRank(severity) + steps),
  );
  return STRESS_LEVELS[nextIndex];
}

function severityFromThresholds(
  value: number,
  thresholds: readonly [number, number, number, number],
): StressSeverity {
  if (value >= thresholds[3]) {
    return "critical";
  }

  if (value >= thresholds[2]) {
    return "high";
  }

  if (value >= thresholds[1]) {
    return "moderate";
  }

  if (value >= thresholds[0]) {
    return "low";
  }

  return "none";
}

function normalizeSensors(sensors: ZoneSensors): ZoneSensors {
  return {
    temperature: roundToSingleDecimal(clamp(sensors.temperature, -10, 45)),
    humidity: roundToSingleDecimal(clamp(sensors.humidity, 0, 100)),
    co2Ppm: Math.round(clamp(sensors.co2Ppm, 200, 5000)),
    lightPAR: roundToSingleDecimal(clamp(sensors.lightPAR, 0, 1200)),
    photoperiodHours: roundToSingleDecimal(clamp(sensors.photoperiodHours, 0, 24)),
    nutrientPH: roundToSingleDecimal(clamp(sensors.nutrientPH, 3, 9)),
    electricalConductivity: roundToSingleDecimal(
      clamp(sensors.electricalConductivity, 0.1, 6),
    ),
    soilMoisture: roundToSingleDecimal(clamp(sensors.soilMoisture, 0, 100)),
  };
}

function getNominalProjectedYieldKg(zone: CropZone): number {
  const profile = CROP_PROFILES[zone.cropType];
  const midpointYieldPerM2 = (profile.yieldMin + profile.yieldMax) / 2;
  return roundToSingleDecimal(zone.areaM2 * midpointYieldPerM2);
}

function getSoilMoistureTarget(cropType: CropType): number {
  const waterDemand = CROP_PROFILES[cropType].waterDemand;

  if (waterDemand === "high") {
    return 68;
  }

  if (waterDemand === "low") {
    return 58;
  }

  return 62;
}

function deriveHeatStress(
  zone: CropZone,
  sensors: ZoneSensors,
): StressCandidate | null {
  const profile = CROP_PROFILES[zone.cropType];
  const temperatureDelta = sensors.temperature - profile.tempHeatStressThreshold;
  let severity = severityFromThresholds(temperatureDelta, [1, 2.5, 4.5, 6.5]);

  if (severity !== "none" && sensors.humidity < profile.humidityOptimalMin) {
    severity = bumpSeverity(severity);
  }

  return severity === "none"
    ? null
    : {
        type: "heat",
        severity,
        source: "sensor",
      };
}

function deriveColdStress(
  zone: CropZone,
  sensors: ZoneSensors,
): StressCandidate | null {
  const profile = CROP_PROFILES[zone.cropType];
  const temperatureGap = profile.tempOptimalMin - sensors.temperature;
  const severity = severityFromThresholds(temperatureGap, [2, 4, 6, 8]);

  return severity === "none"
    ? null
    : {
        type: "cold",
        severity,
        source: "sensor",
      };
}

function deriveWaterStress(
  zone: CropZone,
  sensors: ZoneSensors,
  resources: ResourceState,
): StressCandidate | null {
  const soilDeficit = getSoilMoistureTarget(zone.cropType) - sensors.soilMoisture;
  const soilSeverity = severityFromThresholds(soilDeficit, [6, 12, 20, 28]);
  let severity = soilSeverity;

  if (resources.waterRecyclingEfficiency < 70) {
    if (severity !== "none") {
      severity = bumpSeverity(severity);
    } else if (resources.waterRecyclingEfficiency < 55) {
      severity = "low";
    }
  }

  return severity === "none"
    ? null
    : {
        type: "water_deficit",
        severity,
        source: "sensor",
      };
}

function deriveLightStress(
  zone: CropZone,
  sensors: ZoneSensors,
): StressCandidate | null {
  const profile = CROP_PROFILES[zone.cropType];
  const parDeficitRatio = Math.max(0, (profile.lightPARMin - sensors.lightPAR) / profile.lightPARMin);
  const photoperiodDeficit = Math.max(0, 14 - sensors.photoperiodHours);
  const parSeverity = severityFromThresholds(parDeficitRatio, [0.08, 0.18, 0.3, 0.45]);
  const photoperiodSeverity = severityFromThresholds(photoperiodDeficit, [1, 2, 4, 6]);
  const severity = maxSeverity(parSeverity, photoperiodSeverity);

  return severity === "none"
    ? null
    : {
        type: "light_deficit",
        severity,
        source: "sensor",
      };
}

function deriveNitrogenStress(
  zone: CropZone,
  sensors: ZoneSensors,
  resources: ResourceState,
): StressCandidate | null {
  const sensitivity = CROP_PROFILES[zone.cropType].nitrogenSensitivity;
  const targetN =
    sensitivity === "high" ? 170 : sensitivity === "moderate" ? 150 : 130;
  let severity = severityFromThresholds(targetN - resources.nutrientN, [10, 25, 40, 60]);
  const phLowGap = CROP_PROFILES[zone.cropType].nutrientPhMin - sensors.nutrientPH;
  const phHighGap = sensors.nutrientPH - CROP_PROFILES[zone.cropType].nutrientPhMax;

  if (Math.max(phLowGap, phHighGap, 0) >= 0.25) {
    severity = severity === "none" ? "low" : bumpSeverity(severity);
  }

  return severity === "none"
    ? null
    : {
        type: "nitrogen_deficiency",
        severity,
        source: "sensor",
      };
}

function deriveSalinityStress(
  zone: CropZone,
  sensors: ZoneSensors,
): StressCandidate | null {
  const salinitySensitivity = CROP_PROFILES[zone.cropType].stressSensitivities.salinity;
  const baseThreshold =
    salinitySensitivity === "high" ? 2.2 : salinitySensitivity === "moderate" ? 2.6 : 3.1;
  const severity = severityFromThresholds(
    sensors.electricalConductivity - baseThreshold,
    [0.2, 0.5, 0.9, 1.4],
  );

  return severity === "none"
    ? null
    : {
        type: "salinity",
        severity,
        source: "sensor",
      };
}

function collectStressCandidates(
  zone: CropZone,
  sensors: ZoneSensors,
  resources: ResourceState,
): StressCandidate[] {
  const candidates: StressCandidate[] = [];

  if (zone.stress.active && zone.stress.type !== "none" && zone.stress.severity !== "none") {
    candidates.push({
      type: zone.stress.type,
      severity: zone.stress.severity,
      source: "explicit",
    });
  }

  const sensorCandidates = [
    deriveHeatStress(zone, sensors),
    deriveColdStress(zone, sensors),
    deriveWaterStress(zone, sensors, resources),
    deriveLightStress(zone, sensors),
    deriveNitrogenStress(zone, sensors, resources),
    deriveSalinityStress(zone, sensors),
  ].filter((candidate): candidate is StressCandidate => candidate !== null);

  candidates.push(...sensorCandidates);

  return candidates;
}

function coalesceStressCandidates(candidates: StressCandidate[]): StressCandidate[] {
  const byType = new Map<StressType, StressCandidate>();

  for (const candidate of candidates) {
    const existing = byType.get(candidate.type);

    if (
      !existing ||
      severityRank(candidate.severity) > severityRank(existing.severity) ||
      (severityRank(candidate.severity) === severityRank(existing.severity) &&
        candidate.source === "explicit" &&
        existing.source === "sensor")
    ) {
      byType.set(candidate.type, candidate);
    }
  }

  return [...byType.values()];
}

function getDominantStress(candidates: StressCandidate[]): StressCandidate | null {
  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((left, right) => {
    const severityDelta = severityRank(right.severity) - severityRank(left.severity);
    if (severityDelta !== 0) {
      return severityDelta;
    }

    if (left.source === right.source) {
      return 0;
    }

    return left.source === "explicit" ? -1 : 1;
  })[0];
}

function deriveSymptoms(input: {
  cropType: CropType;
  stress: ZoneStress;
  sensors: ZoneSensors;
}): string[] {
  const { cropType, stress, sensors } = input;

  if (!stress.active || stress.severity === "none") {
    return [];
  }

  if (stress.type === "heat") {
    const symptoms = ["slowed_growth", "leaf_tip_burn"];
    if (cropType === "lettuce") {
      symptoms.push("accelerated_growth_cycle");
    }
    if (cropType === "lettuce" && sensors.temperature >= CROP_PROFILES[cropType].tempHeatStressThreshold) {
      symptoms.push("premature_bolting");
    }
    return symptoms.slice(0, severityRank(stress.severity) >= 3 ? 4 : 3);
  }

  if (stress.type === "water_deficit") {
    return severityRank(stress.severity) >= 3
      ? ["leaf_wilting", "reduced_turgor", "slowed_growth"]
      : ["slowed_growth", "reduced_turgor"];
  }

  if (stress.type === "light_deficit" || stress.type === "energy_shortage") {
    return severityRank(stress.severity) >= 3
      ? ["reduced_photosynthesis", "elongated_stems", "slowed_growth"]
      : ["reduced_photosynthesis", "slowed_growth"];
  }

  if (stress.type === "nitrogen_deficiency") {
    return ["leaf_chlorosis", "stunted_growth"];
  }

  if (stress.type === "salinity") {
    return ["leaf_margin_burn", "reduced_water_uptake"];
  }

  if (stress.type === "cold") {
    return ["slowed_growth", "darkened_foliage"];
  }

  return [];
}

function deriveZoneStatus(
  zone: CropZone,
  stress: ZoneStress,
): CropZone["status"] {
  if (zone.status === "offline" || zone.status === "harvesting" || zone.status === "replanting") {
    return zone.status;
  }

  if (stress.severity === "critical") {
    return "critical";
  }

  if (stress.severity === "none") {
    return "healthy";
  }

  return "stressed";
}

function deriveProjectedYieldKg(
  zone: CropZone,
  candidates: StressCandidate[],
  status: CropZone["status"],
): number {
  const nominalYieldKg = getNominalProjectedYieldKg(zone);

  if (status === "offline") {
    return 0;
  }

  const lifecycleFactor =
    status === "replanting" ? 0.3 : status === "harvesting" ? 1 : 1;
  const stressFactor = candidates.reduce((factor, candidate) => {
    return factor * STRESS_YIELD_FACTORS[candidate.type][candidate.severity];
  }, lifecycleFactor);

  return roundToSingleDecimal(
    clamp(nominalYieldKg * Math.max(0.12, stressFactor), 0, nominalYieldKg),
  );
}

function normalizeZone(
  zone: CropZone,
  resources: ResourceState,
): CropZone {
  const growthCycleTotal = Math.max(1, zone.growthCycleTotal);
  const growthProgressPercent = roundToSingleDecimal(
    Math.min(100, Math.max(0, (zone.growthDay / growthCycleTotal) * 100)),
  );
  const sensors = normalizeSensors(zone.sensors);
  const candidates = coalesceStressCandidates(
    collectStressCandidates(zone, sensors, resources),
  );
  const dominant = getDominantStress(candidates);
  const boltingRisk =
    zone.cropType === "lettuce" &&
    (sensors.temperature >= CROP_PROFILES[zone.cropType].tempHeatStressThreshold ||
      dominant?.type === "heat");
  const stress: ZoneStress = {
    active: dominant !== null,
    type: dominant?.type ?? "none",
    severity: dominant?.severity ?? "none",
    boltingRisk,
    symptoms: [],
  };
  stress.symptoms = deriveSymptoms({
    cropType: zone.cropType,
    stress,
    sensors,
  });
  const status = deriveZoneStatus(zone, stress);
  const projectedYieldKg = deriveProjectedYieldKg(zone, candidates, status);

  return {
    ...zone,
    growthCycleTotal,
    growthProgressPercent,
    status,
    sensors,
    stress,
    projectedYieldKg,
    allocationPercent: roundToSingleDecimal(clamp(zone.allocationPercent, 0, 100)),
  };
}

function normalizeResources(resources: ResourceState): ResourceState {
  const waterReservoirL = roundToSingleDecimal(Math.max(0, resources.waterReservoirL));
  const waterDailyConsumptionL = roundToSingleDecimal(
    Math.max(1, resources.waterDailyConsumptionL),
  );
  const waterRecyclingEfficiency = roundToSingleDecimal(
    clamp(resources.waterRecyclingEfficiency, 0, 100),
  );
  const netDailyWaterLoss = Math.max(
    1,
    waterDailyConsumptionL * (1 - waterRecyclingEfficiency / 100),
  );
  const waterDaysRemaining = roundToSingleDecimal(waterReservoirL / netDailyWaterLoss);
  const energyAvailableKwh = roundToSingleDecimal(Math.max(0, resources.energyAvailableKwh));
  const energyConsumptionKwhPerDay = roundToSingleDecimal(
    Math.max(1, resources.energyConsumptionKwhPerDay),
  );
  const solarGenerationKwhPerDay = roundToSingleDecimal(
    Math.max(0, resources.solarGenerationKwhPerDay),
  );
  const netDailyEnergyDraw = Math.max(
    1,
    energyConsumptionKwhPerDay - solarGenerationKwhPerDay,
  );
  const energyDaysRemaining = roundToSingleDecimal(energyAvailableKwh / netDailyEnergyDraw);

  return {
    waterReservoirL,
    waterRecyclingEfficiency,
    waterDailyConsumptionL,
    waterDaysRemaining,
    energyAvailableKwh,
    energyConsumptionKwhPerDay,
    solarGenerationKwhPerDay,
    energyDaysRemaining,
    nutrientN: roundToSingleDecimal(Math.max(0, resources.nutrientN)),
    nutrientP: roundToSingleDecimal(Math.max(0, resources.nutrientP)),
    nutrientK: roundToSingleDecimal(Math.max(0, resources.nutrientK)),
  };
}

function normalizeEventLog(eventLog: EventLogEntry[]): EventLogEntry[] {
  return [...eventLog]
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .slice(0, 20);
}

export function deriveMissionStatus(input: {
  currentStatus: MissionStatus;
  activeScenario: MissionState["activeScenario"];
  zones: CropZone[];
  nutrition: NutritionStatus;
}): MissionStatus {
  const { currentStatus, activeScenario, zones, nutrition } = input;

  if (currentStatus === "nutrition_preservation_mode") {
    return "nutrition_preservation_mode";
  }

  const hasCriticalZone = zones.some((zone) => {
    return (
      zone.status === "critical" ||
      zone.status === "offline" ||
      zone.stress.severity === "critical"
    );
  });

  const hasWarningZone = zones.some((zone) => {
    return (
      zone.status === "stressed" ||
      zone.stress.severity === "moderate" ||
      zone.stress.severity === "high"
    );
  });

  if (
    activeScenario?.severity === "critical" ||
    hasCriticalZone ||
    nutrition.nutritionalCoverageScore < 50 ||
    nutrition.daysSafe < 30
  ) {
    return "critical";
  }

  if (
    activeScenario !== null ||
    hasWarningZone ||
    nutrition.nutritionalCoverageScore < 75 ||
    nutrition.daysSafe < 90
  ) {
    return "warning";
  }

  return "nominal";
}

export function buildMissionSnapshot(sourceState: MissionState): MissionState {
  const state = cloneMissionState(sourceState);
  const resources = normalizeResources(state.resources);
  const zones = state.zones.map((zone) => normalizeZone(zone, resources));
  const plants = reconcilePlants({
    currentPlants: state.plants,
    zones,
    referenceTimestamp: state.lastUpdated,
  });
  const plantHealthChecks = reconcilePlantHealthChecks({
    currentChecks: state.plantHealthChecks,
    plants,
    referenceTimestamp: state.lastUpdated,
  });
  const nutrition = calculateNutrition({
    zones,
    resources,
    crewSize: state.crewSize,
    missionDurationTotal: state.missionDurationTotal,
    missionDay: state.missionDay,
    previousScore: state.nutrition.nutritionalCoverageScore,
  });
  const eventLog = normalizeEventLog(state.eventLog);
  const status = deriveMissionStatus({
    currentStatus: state.status,
    activeScenario: state.activeScenario,
    zones,
    nutrition,
  });

  return {
    ...state,
    missionDurationTotal: Math.max(1, state.missionDurationTotal),
    zones,
    plants,
    plantHealthChecks,
    resources,
    nutrition,
    eventLog,
    status,
  };
}

export function getCurrentMissionSnapshot(): MissionState {
  return buildMissionSnapshot(getMissionState());
}
