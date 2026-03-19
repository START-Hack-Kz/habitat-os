import { calculateNutrition } from "../nutrition/nutrition.calculator";
import { getMissionState } from "./mission.store";
import type {
  CropZone,
  EventLogEntry,
  MissionState,
  MissionStatus,
  NutritionStatus,
} from "./mission.types";

function cloneMissionState(state: MissionState): MissionState {
  return structuredClone(state);
}

function roundToSingleDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeZone(zone: CropZone): CropZone {
  const growthCycleDays = Math.max(1, zone.growthCycleDays);
  const growthProgressPercent = roundToSingleDecimal(
    Math.min(100, Math.max(0, (zone.growthDay / growthCycleDays) * 100)),
  );

  return {
    ...zone,
    growthProgressPercent,
  };
}

function normalizeEventLog(eventLog: EventLogEntry[]): EventLogEntry[] {
  return [...eventLog]
    .sort((left, right) => {
      return Date.parse(right.timestamp) - Date.parse(left.timestamp);
    })
    .slice(0, 20);
}

// Keep status derivation simple and explainable:
// - explicit Nutrition Preservation Mode wins if already set on the state
// - critical nutrition or any critically impacted zone => critical
// - active scenario or moderate degradation => warning
// - otherwise nominal
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
    hasCriticalZone ||
    nutrition.nutritionalCoverageScore < 50 ||
    nutrition.daysSafe < 90
  ) {
    return "critical";
  }

  if (
    activeScenario !== null ||
    hasWarningZone ||
    nutrition.nutritionalCoverageScore < 75 ||
    nutrition.daysSafe < 180
  ) {
    return "warning";
  }

  return "nominal";
}

export function buildMissionSnapshot(sourceState: MissionState): MissionState {
  const state = cloneMissionState(sourceState);
  const zones = state.zones.map(normalizeZone);
  const eventLog = normalizeEventLog(state.eventLog);
  const nutrition = calculateNutrition({
    zones,
    resources: state.resources,
    crewSize: state.crewSize,
    missionDurationDays: state.missionDurationDays,
    missionDay: state.missionDay,
    previousScore: state.nutrition.nutritionalCoverageScore,
  });

  const status = deriveMissionStatus({
    currentStatus: state.status,
    activeScenario: state.activeScenario,
    zones,
    nutrition,
  });

  return {
    ...state,
    zones,
    nutrition,
    status,
    eventLog,
  };
}

export function getCurrentMissionSnapshot(): MissionState {
  return buildMissionSnapshot(getMissionState());
}
