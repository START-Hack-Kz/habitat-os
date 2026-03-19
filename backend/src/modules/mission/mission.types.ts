import type {
  CropType as SharedCropType,
  CropZone as SharedCropZone,
  EventLogEntry as SharedEventLogEntry,
  EventType as SharedEventType,
  FailureScenario as SharedFailureScenario,
  MissionState as SharedMissionState,
  MissionStatus as SharedMissionStatus,
  MicronutrientStatus as SharedMicronutrientStatus,
  NutritionStatus as SharedNutritionStatus,
  NutritionTrend as SharedNutritionTrend,
  ResourceState as SharedResourceState,
  ScenarioSeverity as SharedScenarioSeverity,
  ScenarioType as SharedScenarioType,
  StressSeverity as SharedStressSeverity,
  StressState as SharedStressState,
  StressType as SharedStressType,
  ZoneSensors as SharedZoneSensors,
  ZoneStatus as SharedZoneStatus,
} from "../../../../shared/schemas/missionState.schema";

export const missionStatusValues = [
  "nominal",
  "warning",
  "critical",
  "nutrition_preservation_mode",
] as const;

export const cropTypeValues = ["lettuce", "potato", "beans", "radish"] as const;

export const cropZoneStatusValues = [
  "healthy",
  "stressed",
  "critical",
  "harvesting",
  "replanting",
  "offline",
] as const;

export const stressTypeValues = [
  "none",
  "heat",
  "cold",
  "water_deficit",
  "nitrogen_deficiency",
  "light_deficit",
  "energy_shortage",
  "salinity",
] as const;

export const stressSeverityValues = [
  "none",
  "low",
  "moderate",
  "high",
  "critical",
] as const;

export const scenarioTypeValues = [
  "water_recycling_decline",
  "energy_budget_reduction",
  "temperature_control_failure",
] as const;

export const scenarioSeverityValues = ["mild", "moderate", "critical"] as const;

export const eventLevelValues = [
  "info",
  "warning",
  "critical",
  "ai_action",
  "scenario_injected",
  "harvest",
  "replant",
] as const;

export const nutritionTrendValues = ["improving", "stable", "declining"] as const;

export type MissionStatus = SharedMissionStatus;
export type CropType = SharedCropType;
export type CropZoneStatus = SharedZoneStatus;
export type StressType = SharedStressType;
export type StressSeverity = SharedStressSeverity;
export type FailureScenarioType = SharedScenarioType;
export type FailureScenarioSeverity = SharedScenarioSeverity;
export type EventLevel = SharedEventType;
export type NutritionTrend = SharedNutritionTrend;
export type ZoneSensors = SharedZoneSensors;
export type ZoneStress = SharedStressState;
export type CropZone = SharedCropZone;
export type ResourceState = SharedResourceState;
export type MicronutrientStatus = SharedMicronutrientStatus;
export type NutritionStatus = SharedNutritionStatus;
export type FailureScenario = SharedFailureScenario;
export type EventLogEntry = SharedEventLogEntry;
export type MissionState = SharedMissionState;
