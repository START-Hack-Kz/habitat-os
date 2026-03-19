import type {
  BackendAgentAction,
  BackendAgentAnalysis,
  BackendMissionState,
  BackendPlannerOutput,
  BackendScenarioCatalogItem,
  BackendScenarioInjectRequest,
  BackendScenarioSeverityOption,
  BackendSimulationTweakRequest,
  BackendNutritionStatus,
  BackendPlannerChange,
  BackendPlannerStressFlag,
} from "../types";
import type { AIDecision } from "../../shared/schemas/aiDecision.schema";
import type {
  EventType,
  FailureScenario,
  MissionState,
  NutritionStatus,
  StressType,
} from "../../shared/schemas/missionState.schema";
import type { PlannerOutput } from "../../shared/schemas/plannerOutput.schema";
import type {
  ScenarioCatalogEntry,
  ScenarioInjectRequest,
} from "../../shared/schemas/scenarioInput.schema";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? undefined);
  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    headers,
    ...init,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value);
}

function toLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function deriveZoneName(zone: MissionState["zones"][number]): string {
  switch (zone.cropType) {
    case "lettuce":
      return "Leafy Greens Bay";
    case "potato":
      return "Tuber Production Bay";
    case "beans":
      return "Protein Crop Bay";
    case "radish":
      return "Fast Harvest Bay";
    default:
      return `${toLabel(zone.cropType)} Bay`;
  }
}

function mapStressType(type: StressType): BackendMissionState["zones"][number]["stress"]["type"] {
  switch (type) {
    case "water_deficit":
      return "water_stress";
    case "heat":
    case "cold":
      return "temperature_drift";
    case "energy_shortage":
      return "energy_pressure";
    case "nitrogen_deficiency":
    case "light_deficit":
    case "salinity":
      return "nutrient_imbalance";
    case "none":
    default:
      return "none";
  }
}

function mapEventLevel(type: EventType): BackendMissionState["eventLog"][number]["level"] {
  switch (type) {
    case "critical":
      return "critical";
    case "warning":
    case "scenario_injected":
      return "warning";
    case "info":
    case "ai_action":
    case "harvest":
    case "replant":
    default:
      return "info";
  }
}

function buildStressSummary(zone: MissionState["zones"][number]): string {
  if (!zone.stress.active || zone.stress.type === "none") {
    return `${deriveZoneName(zone)} remains within the target operating band.`;
  }

  const symptomText =
    zone.stress.symptoms.length > 0 ? ` Symptoms: ${zone.stress.symptoms.join(", ")}.` : "";
  return `${deriveZoneName(zone)} is under ${zone.stress.severity} ${toLabel(
    zone.stress.type,
  )} stress.${zone.stress.boltingRisk ? " Bolting risk is active." : ""}${symptomText}`;
}

function deriveNutrientMixPercent(resources: MissionState["resources"]): number {
  const n = clamp((resources.nutrientN / 180) * 100, 0, 100);
  const p = clamp((resources.nutrientP / 55) * 100, 0, 100);
  const k = clamp((resources.nutrientK / 220) * 100, 0, 100);
  return round((n + p + k) / 3);
}

function deriveNutrientMixStatus(
  percent: number,
): BackendMissionState["resources"]["nutrientMixStatus"] {
  if (percent >= 80) {
    return "balanced";
  }

  if (percent >= 60) {
    return "watch";
  }

  return "critical";
}

function deriveMicronutrientAdequacyPercent(nutrition: NutritionStatus): number {
  const micronutrients = [
    nutrition.vitaminA.coveragePercent,
    nutrition.vitaminC.coveragePercent,
    nutrition.vitaminK.coveragePercent,
    nutrition.folate.coveragePercent,
    nutrition.iron.coveragePercent,
    nutrition.potassium.coveragePercent,
    nutrition.magnesium.coveragePercent,
  ];

  return round(
    micronutrients.reduce((sum, value) => sum + value, 0) / micronutrients.length,
  );
}

function mapNutritionStatus(nutrition: NutritionStatus): BackendNutritionStatus {
  return {
    dailyCaloriesProduced: nutrition.dailyCaloriesProduced,
    dailyCaloriesTarget: nutrition.dailyCaloriesTarget,
    caloricCoveragePercent: nutrition.caloricCoveragePercent,
    dailyProteinProducedG: nutrition.dailyProteinG,
    dailyProteinTargetG: nutrition.dailyProteinTarget,
    proteinCoveragePercent: nutrition.proteinCoveragePercent,
    micronutrientAdequacyPercent: deriveMicronutrientAdequacyPercent(nutrition),
    vitaminA: nutrition.vitaminA,
    vitaminC: nutrition.vitaminC,
    vitaminK: nutrition.vitaminK,
    folate: nutrition.folate,
    iron: nutrition.iron,
    potassium: nutrition.potassium,
    magnesium: nutrition.magnesium,
    nutritionalCoverageScore: nutrition.nutritionalCoverageScore,
    daysSafe: nutrition.daysSafe,
    trend: nutrition.trend,
  };
}

function mapFailureScenario(
  scenario: FailureScenario | null,
): BackendMissionState["activeScenario"] {
  if (!scenario) {
    return null;
  }

  return {
    scenarioId: scenario.scenarioId,
    type: scenario.scenarioType,
    severity: scenario.severity,
    title: toLabel(scenario.scenarioType),
    description: scenario.description,
    injectedAt: scenario.injectedAt,
    affectedZoneIds: scenario.affectedZones,
    parameterOverrides: scenario.parameterOverrides,
  };
}

export function mapMissionState(mission: MissionState): BackendMissionState {
  const nutrientSolutionLevelPercent = deriveNutrientMixPercent(mission.resources);
  const nutrientMixStatus = deriveNutrientMixStatus(nutrientSolutionLevelPercent);

  return {
    missionId: mission.missionId,
    missionDay: mission.missionDay,
    missionDurationDays: mission.missionDurationTotal,
    crewSize: mission.crewSize,
    status: mission.status,
    zones: mission.zones.map((zone) => ({
      zoneId: zone.zoneId,
      name: deriveZoneName(zone),
      cropType: zone.cropType,
      areaM2: zone.areaM2,
      growthDay: zone.growthDay,
      growthCycleDays: zone.growthCycleTotal,
      growthProgressPercent: zone.growthProgressPercent,
      projectedYieldKg: zone.projectedYieldKg,
      allocationPercent: zone.allocationPercent,
      status: zone.status,
      sensors: {
        temperature: zone.sensors.temperature,
        humidity: zone.sensors.humidity,
        co2Ppm: zone.sensors.co2Ppm,
        lightPAR: zone.sensors.lightPAR,
        photoperiodHours: zone.sensors.photoperiodHours,
        nutrientPH: zone.sensors.nutrientPH,
        electricalConductivity: zone.sensors.electricalConductivity,
        soilMoisture: zone.sensors.soilMoisture,
      },
      stress: {
        active: zone.stress.active,
        type: mapStressType(zone.stress.type),
        severity: zone.stress.severity,
        summary: buildStressSummary(zone),
        boltingRisk: zone.stress.boltingRisk,
        symptoms: zone.stress.symptoms,
      },
    })),
    resources: {
      waterReservoirL: mission.resources.waterReservoirL,
      waterRecyclingEfficiencyPercent: mission.resources.waterRecyclingEfficiency,
      waterDailyConsumptionL: mission.resources.waterDailyConsumptionL,
      waterDaysRemaining: mission.resources.waterDaysRemaining,
      nutrientSolutionLevelPercent,
      nutrientMixStatus,
      energyAvailableKwh: mission.resources.energyAvailableKwh,
      energyDailyConsumptionKwh: mission.resources.energyConsumptionKwhPerDay,
      solarGenerationKwhPerDay: mission.resources.solarGenerationKwhPerDay,
      energyDaysRemaining: mission.resources.energyDaysRemaining,
      energyReserveHours: round(mission.resources.energyDaysRemaining * 24),
      nutrientN: mission.resources.nutrientN,
      nutrientP: mission.resources.nutrientP,
      nutrientK: mission.resources.nutrientK,
    },
    nutrition: mapNutritionStatus(mission.nutrition),
    activeScenario: mapFailureScenario(mission.activeScenario),
    eventLog: mission.eventLog.map((entry) => ({
      eventId: entry.eventId,
      timestamp: entry.timestamp,
      missionDay: entry.missionDay,
      level: mapEventLevel(entry.type),
      type: entry.type,
      message: entry.message,
      zoneId: entry.zoneId,
    })),
    lastUpdated: mission.lastUpdated,
  };
}

function mapScenarioCatalogItem(item: ScenarioCatalogEntry): BackendScenarioCatalogItem {
  const severities: BackendScenarioSeverityOption[] = ([
    "mild",
    "moderate",
    "critical",
  ] as const).map((severity) => ({
    severity,
    label: toLabel(severity),
    effectSummary: item.description,
    parameterOverrides: item.defaultSeverityEffects[severity],
  }));

  return {
    scenarioType: item.scenarioType,
    label: item.label,
    description: item.description,
    affectedResources: item.affectedResources,
    nutritionRisk: item.nutritionRisk,
    severities,
  };
}

function mapAgentActions(decision: AIDecision): BackendAgentAction[] {
  return decision.recommendedActions.map((action) => ({
    actionId: action.actionId,
    type:
      action.actionType === "adjust_temperature_setpoint"
        ? "adjust_temperature_setpoint"
        : action.actionType === "pause_zone"
          ? "pause_zone"
          : action.actionType,
    urgency: action.urgency,
    targetZoneId: action.targetZoneId,
    description: action.description,
    parameterChanges: action.parameterChanges,
    nutritionImpact: action.nutritionImpact,
    tradeoff: action.tradeoff,
  }));
}

function derivePlannerMode(
  planner: PlannerOutput,
): BackendPlannerOutput["mode"] {
  return planner.missionState.status === "nutrition_preservation_mode"
    ? "nutrition_preservation"
    : "normal";
}

function buildPlannerExplanation(planner: PlannerOutput): string {
  if (planner.changes.length === 0) {
    return "No deterministic planner change was required for the current mission state.";
  }

  const topChanges = planner.changes
    .slice(0, 3)
    .map((change) => `${change.field} -> ${String(change.newValue)}`)
    .join(", ");

  return planner.nutritionRiskDetected
    ? `Nutrition risk is active. Key projected changes: ${topChanges}.`
    : `Planner analysis completed with no nutrition-preservation trigger. Key state changes: ${topChanges}.`;
}

function mapPlannerChanges(planner: PlannerOutput): BackendPlannerChange[] {
  return planner.changes.map((change) => ({
    field: change.field,
    previousValue: change.previousValue,
    newValue: change.newValue,
    reason: change.reason,
  }));
}

function mapPlannerStressFlags(planner: PlannerOutput): BackendPlannerStressFlag[] {
  return planner.stressFlags.map((flag) => ({
    zoneId: flag.zoneId,
    stressType: flag.stressType,
    severity: flag.severity,
    detectedAt: flag.detectedAt,
    rule: flag.rule,
  }));
}

function mapAgentAnalysis(decision: AIDecision): BackendAgentAnalysis {
  return {
    decisionId: decision.decisionId,
    missionDay: decision.missionDay,
    timestamp: decision.timestamp,
    riskLevel: decision.riskLevel,
    riskSummary: decision.riskSummary,
    nutritionPreservationMode: decision.nutritionPreservationMode,
    recommendedActions: mapAgentActions(decision),
    comparison: {
      before: decision.comparison.before,
      after: decision.comparison.after,
      delta: decision.comparison.delta,
      summary: decision.comparison.summary,
    },
    explanation: decision.explanation,
    criticalNutrientDependencies: decision.criticalNutrientDependencies,
    triggeredByScenario: decision.triggeredByScenario,
    kbContextUsed: decision.kbContextUsed,
    implementationStatus: "stub",
  };
}

async function fetchCanonicalMissionState(): Promise<MissionState> {
  return requestJson<MissionState>("/api/mission/state");
}

async function fetchCanonicalPlannerOutput(): Promise<PlannerOutput> {
  return requestJson<PlannerOutput>("/api/planner/analyze", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

async function fetchCanonicalAgentDecision(
  focus: BackendAgentAnalyzeFocus = "mission_overview",
): Promise<AIDecision> {
  try {
    return await requestAiJson<AIDecision>("/ai/analyze", {
      method: "POST",
      body: JSON.stringify({ focus }),
    });
  } catch {
    return requestJson<AIDecision>("/api/agent/analyze", {
      method: "POST",
      body: JSON.stringify({ focus }),
    });
  }
}

async function fetchCanonicalAgentChat(question: string): Promise<BackendAgentChatResponse> {
  return requestAiJson<BackendAgentChatResponse>("/ai/chat", {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

export function fetchMissionState(): Promise<BackendMissionState> {
  return fetchCanonicalMissionState().then(mapMissionState);
}

export function fetchScenarioCatalog(): Promise<BackendScenarioCatalogItem[]> {
  return requestJson<ScenarioCatalogEntry[]>("/api/scenarios").then((items) =>
    items.map(mapScenarioCatalogItem),
  );
}

export async function fetchPlannerAnalysis(): Promise<BackendPlannerOutput> {
  const [beforeMission, planner] = await Promise.all([
    fetchCanonicalMissionState(),
    fetchCanonicalPlannerOutput(),
  ]);

  return {
    mode: derivePlannerMode(planner),
    nutritionRiskDetected: planner.nutritionRiskDetected,
    changes: mapPlannerChanges(planner),
    stressFlags: mapPlannerStressFlags(planner),
    nutritionForecast: {
      before: mapNutritionStatus(beforeMission.nutrition),
      after: mapNutritionStatus(planner.missionState.nutrition),
    },
    explanation: buildPlannerExplanation(planner),
  };
}

export async function fetchAgentAnalysis(
  focus: BackendAgentAnalyzeFocus = "mission_overview",
): Promise<BackendAgentAnalysis> {
  const decision = await fetchCanonicalAgentDecision(focus);
  return mapAgentAnalysis(decision);
}

export async function injectScenario(
  payload: BackendScenarioInjectRequest,
): Promise<BackendMissionState> {
  const requestPayload: ScenarioInjectRequest = {
    scenarioType: payload.scenarioType,
    severity: payload.severity ?? "moderate",
    affectedZones: payload.affectedZoneIds,
  };

  const result = await requestJson<PlannerOutput>("/api/simulation/scenario/inject", {
    method: "POST",
    body: JSON.stringify(requestPayload),
  });
  return mapMissionState(result.missionState);
}

export function resetSimulation(): Promise<BackendMissionState> {
  return requestJson<MissionState>("/api/simulation/reset", {
    method: "POST",
    body: JSON.stringify({}),
  }).then(mapMissionState);
}

export function tweakSimulation(
  payload: BackendSimulationTweakRequest,
): Promise<BackendMissionState> {
  return requestJson<MissionState>("/api/simulation/tweak", {
    method: "POST",
    body: JSON.stringify({
      zones: payload.zones?.map((zone) => ({
        zoneId: zone.zoneId,
        temperature: zone.temperature,
        humidity: zone.humidity,
        co2Ppm: zone.co2Ppm,
        lightPAR: zone.lightPAR,
        photoperiodHours: zone.photoperiodHours,
        nutrientPH: zone.nutrientPH,
        electricalConductivity: zone.electricalConductivity,
        soilMoisture: zone.soilMoisture,
      })),
      resources: payload.resources
        ? {
            waterRecyclingEfficiency: payload.resources.waterRecyclingEfficiencyPercent,
            waterDailyConsumptionL: payload.resources.waterDailyConsumptionL,
            waterReservoirL: payload.resources.waterReservoirL,
            energyAvailableKwh: payload.resources.energyAvailableKwh,
            energyConsumptionKwhPerDay: payload.resources.energyDailyConsumptionKwh,
            solarGenerationKwhPerDay: payload.resources.solarGenerationKwhPerDay,
            nutrientN: payload.resources.nutrientN,
            nutrientP: payload.resources.nutrientP,
            nutrientK: payload.resources.nutrientK,
          }
        : undefined,
    }),
  }).then(mapMissionState);
}
