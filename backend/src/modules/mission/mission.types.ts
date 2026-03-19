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
  "offline",
] as const;

export const stressTypeValues = [
  "none",
  "water_stress",
  "temperature_drift",
  "nutrient_imbalance",
  "energy_pressure",
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

export const eventLevelValues = ["info", "warning", "critical"] as const;

export const nutrientMixStatusValues = ["balanced", "watch", "critical"] as const;

export const nutritionTrendValues = ["improving", "stable", "declining"] as const;

export type MissionStatus = (typeof missionStatusValues)[number];
export type CropType = (typeof cropTypeValues)[number];
export type CropZoneStatus = (typeof cropZoneStatusValues)[number];
export type StressType = (typeof stressTypeValues)[number];
export type StressSeverity = (typeof stressSeverityValues)[number];
export type FailureScenarioType = (typeof scenarioTypeValues)[number];
export type FailureScenarioSeverity = (typeof scenarioSeverityValues)[number];
export type EventLevel = (typeof eventLevelValues)[number];
export type NutrientMixStatus = (typeof nutrientMixStatusValues)[number];
export type NutritionTrend = (typeof nutritionTrendValues)[number];

export interface ZoneStress {
  active: boolean;
  type: StressType;
  severity: StressSeverity;
  summary: string;
}

export interface CropZone {
  zoneId: string;
  name: string;
  cropType: CropType;
  areaM2: number;
  growthDay: number;
  growthCycleDays: number;
  growthProgressPercent: number;
  projectedYieldKg: number;
  allocationPercent: number;
  status: CropZoneStatus;
  stress: ZoneStress;
}

export interface ResourceState {
  waterReservoirL: number;
  waterRecyclingEfficiencyPercent: number;
  waterDailyConsumptionL: number;
  nutrientSolutionLevelPercent: number;
  nutrientMixStatus: NutrientMixStatus;
  energyAvailableKwh: number;
  energyDailyConsumptionKwh: number;
  energyReserveHours: number;
}

export interface NutritionStatus {
  dailyCaloriesProduced: number;
  dailyCaloriesTarget: number;
  caloricCoveragePercent: number;
  dailyProteinProducedG: number;
  dailyProteinTargetG: number;
  proteinCoveragePercent: number;
  micronutrientAdequacyPercent: number;
  nutritionalCoverageScore: number;
  daysSafe: number;
  trend: NutritionTrend;
}

export interface FailureScenario {
  scenarioId: string;
  type: FailureScenarioType;
  severity: FailureScenarioSeverity;
  title: string;
  description: string;
  injectedAt: string;
  affectedZoneIds: string[];
  parameterOverrides: Record<string, number>;
}

export interface EventLogEntry {
  eventId: string;
  timestamp: string;
  missionDay: number;
  level: EventLevel;
  message: string;
  zoneId?: string;
}

export interface MissionState {
  missionId: string;
  missionDay: number;
  missionDurationDays: number;
  crewSize: number;
  status: MissionStatus;
  zones: CropZone[];
  resources: ResourceState;
  nutrition: NutritionStatus;
  activeScenario: FailureScenario | null;
  eventLog: EventLogEntry[];
  lastUpdated: string;
}
