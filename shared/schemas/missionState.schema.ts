// MissionState — top-level snapshot of the greenhouse mission.
// This is the primary object rendered by the dashboard and passed to the AI agent.

export type MissionStatus = "nominal" | "warning" | "critical" | "nutrition_preservation_mode";
export type CropType = "lettuce" | "potato" | "beans" | "radish";
export type ZoneStatus = "healthy" | "stressed" | "critical" | "harvesting" | "replanting" | "offline";
export type PlantStatus = "healthy" | "watch" | "sick" | "critical" | "dead" | "replaced";
export type PlantSeverityLabel = "healthy" | "watch" | "sick" | "critical" | "dead";
export type PlantRecoverabilityLabel = "recoverable" | "unrecoverable";
export type PlantRecommendedAction = "monitor" | "treat" | "replace";
export type StressType = "none" | "heat" | "cold" | "water_deficit" | "nitrogen_deficiency" | "light_deficit" | "energy_shortage" | "salinity";
export type StressSeverity = "none" | "low" | "moderate" | "high" | "critical";
export type ScenarioType =
  | "water_recycling_decline"
  | "energy_budget_reduction"
  | "temperature_control_failure"
  | "single_zone_control_failure";
export type ScenarioSeverity = "mild" | "moderate" | "critical";
export type EventType = "info" | "warning" | "critical" | "ai_action" | "scenario_injected" | "harvest" | "replant";
export type NutritionTrend = "improving" | "stable" | "declining";

// ─── Sensor readings per zone ───────────────────────────────────────────────

export interface ZoneSensors {
  temperature: number;          // °C
  humidity: number;             // % relative humidity
  co2Ppm: number;               // ppm
  lightPAR: number;             // µmol/m²/s
  photoperiodHours: number;     // daily light hours
  nutrientPH: number;           // pH
  electricalConductivity: number; // mS/cm (salinity proxy)
  soilMoisture: number;         // % root zone moisture
}

// ─── Stress state per zone ───────────────────────────────────────────────────

export interface StressState {
  active: boolean;
  type: StressType;
  severity: StressSeverity;
  boltingRisk: boolean;         // lettuce-specific: premature flowering risk
  symptoms: string[];           // e.g. ["leaf_wilting", "slowed_growth"]
}

// ─── Crop zone ───────────────────────────────────────────────────────────────

export interface CropZone {
  zoneId: string;               // e.g. "zone-A"
  cropType: CropType;
  areaM2: number;               // m²
  growthDay: number;            // days since planting
  growthCycleTotal: number;     // expected days to harvest
  growthProgressPercent: number; // growthDay / growthCycleTotal * 100
  status: ZoneStatus;
  sensors: ZoneSensors;
  stress: StressState;
  projectedYieldKg: number;     // estimated yield at harvest given current conditions
  allocationPercent: number;    // % of shared resources allocated to this zone (0–100)
}

// ─── Individual plants ──────────────────────────────────────────────────────

export interface PlantRecord {
  plantId: string;
  zoneId: string;
  rowNo: number;
  plantNo: number;
  cropType: CropType;
  plantedAt: string;            // ISO date-time
  currentStatus: PlantStatus;
}

export interface PlantHealthCheck {
  checkId: string;
  plantId: string;
  capturedAt: string;           // ISO date-time
  imageUri: string;
  colorStressScore: number;
  wiltingScore: number;
  lesionScore: number;
  growthDeclineScore: number;
  severityLabel: PlantSeverityLabel;
  recoverabilityLabel: PlantRecoverabilityLabel;
  recommendedAction: PlantRecommendedAction;
}

// ─── Resource state ──────────────────────────────────────────────────────────

export interface ResourceState {
  waterReservoirL: number;              // liters in reservoir
  waterRecyclingEfficiency: number;     // % (target >85%)
  waterDailyConsumptionL: number;       // L/day
  waterDaysRemaining: number;           // derived: reservoir / net daily loss
  energyAvailableKwh: number;           // kWh available
  energyConsumptionKwhPerDay: number;   // kWh/day draw
  solarGenerationKwhPerDay: number;     // kWh/day generated
  energyDaysRemaining: number;          // derived: available / net daily deficit
  nutrientN: number;                    // Nitrogen mg/L
  nutrientP: number;                    // Phosphorus mg/L
  nutrientK: number;                    // Potassium mg/L
}

// ─── Nutrition status ────────────────────────────────────────────────────────

// Daily micronutrient intake for the full crew (produced vs target)
export interface MicronutrientStatus {
  produced: number;   // daily amount produced by all zones combined
  target: number;     // daily crew requirement
  unit: string;       // "mg" or "µg"
  coveragePercent: number; // produced / target * 100
}

export interface NutritionStatus {
  // ── Macros (crew totals per day) ────────────────────────────────────────
  dailyCaloriesProduced: number;        // kcal/day from all zones
  dailyCaloriesTarget: number;          // 12,000 kcal/day (4 crew × 3,000)
  caloricCoveragePercent: number;       // %

  dailyProteinG: number;                // g/day produced
  dailyProteinTarget: number;           // ~450 g/day (4 crew × ~112g)
  proteinCoveragePercent: number;       // %

  // ── Micronutrients (crew totals per day, KB-confirmed critical) ─────────
  vitaminA: MicronutrientStatus;        // µg/day — from lettuce; vision, immune function
  vitaminC: MicronutrientStatus;        // mg/day — from radish, potato; immune + cardiovascular
  vitaminK: MicronutrientStatus;        // µg/day — from lettuce; bone health, blood clotting
  folate: MicronutrientStatus;          // µg/day — from lettuce; cognitive performance, cell repair
  iron: MicronutrientStatus;            // mg/day — from leafy greens/beans; oxygen transport
  potassium: MicronutrientStatus;       // mg/day — from potato; cardiovascular stability
  magnesium: MicronutrientStatus;       // mg/day — from leafy greens/beans; bone + energy metabolism

  // ── Composite score & forecast ──────────────────────────────────────────
  nutritionalCoverageScore: number;     // 0–100 weighted composite across all above
  daysSafe: number;                     // KEY METRIC: days crew stays adequately fed at current rate
  trend: NutritionTrend;
}

// ─── Failure scenario ────────────────────────────────────────────────────────

export interface FailureScenario {
  scenarioId: string;
  scenarioType: ScenarioType;
  severity: ScenarioSeverity;
  injectedAt: string;                   // ISO date-time
  affectedZones: string[];              // zone IDs
  parameterOverrides: Record<string, number>; // e.g. { waterRecyclingEfficiency: 60 }
  description: string;                  // human-readable summary
}

// ─── Event log entry ─────────────────────────────────────────────────────────

export interface EventLogEntry {
  eventId: string;
  missionDay: number;
  timestamp: string;                    // ISO date-time
  type: EventType;
  message: string;
  zoneId?: string;                      // optional — zone this event relates to
}

// ─── Top-level mission state ─────────────────────────────────────────────────

export interface MissionState {
  missionId: string;
  missionDay: number;                   // current simulation day (1-indexed)
  missionDurationTotal: number;         // 450
  crewSize: number;                     // 4
  status: MissionStatus;
  zones: CropZone[];
  plants: PlantRecord[];
  plantHealthChecks: PlantHealthCheck[];
  resources: ResourceState;
  nutrition: NutritionStatus;
  activeScenario: FailureScenario | null;
  eventLog: EventLogEntry[];            // newest first, capped at 20
  lastUpdated: string;                  // ISO date-time
}
