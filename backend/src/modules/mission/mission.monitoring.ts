import type {
  PlannerOutput,
  SimulationChange,
  StressFlag,
} from "../../../../shared/schemas/plannerOutput.schema";
import { CROP_PROFILES } from "../../data/cropProfiles.data";
import type { MissionState } from "./mission.types";

const NUTRITION_RISK_SCORE_THRESHOLD = 70;
const NUTRITION_RISK_DAYS_THRESHOLD = 30;

function pushChange(
  changes: SimulationChange[],
  field: string,
  previousValue: number | string | boolean,
  newValue: number | string | boolean,
  reason: string,
): void {
  if (previousValue === newValue) {
    return;
  }

  changes.push({
    field,
    previousValue,
    newValue,
    reason,
  });
}

export function detectNutritionRisk(state: MissionState): boolean {
  return (
    state.nutrition.nutritionalCoverageScore < NUTRITION_RISK_SCORE_THRESHOLD ||
    state.nutrition.daysSafe < NUTRITION_RISK_DAYS_THRESHOLD
  );
}

export function createStressFlags(state: MissionState): StressFlag[] {
  return state.zones
    .filter((zone) => zone.stress.active || zone.status === "critical" || zone.status === "offline")
    .map((zone) => {
      const profile = CROP_PROFILES[zone.cropType];
      let rule = "zone stress active";

      if (zone.stress.type === "heat") {
        rule = `temperature >= ${profile.tempHeatStressThreshold}C`;
      } else if (zone.stress.type === "water_deficit") {
        rule = "water recycling decline or low root-zone moisture";
      } else if (zone.stress.type === "light_deficit") {
        rule = `lightPAR < ${profile.lightPARMin}`;
      } else if (zone.stress.type === "energy_shortage") {
        rule = "energy deficit reducing environmental support";
      } else if (zone.stress.type === "nitrogen_deficiency") {
        rule = "nutrient nitrogen below target band";
      } else if (zone.stress.type === "salinity") {
        rule = "electrical conductivity above target band";
      } else if (zone.stress.type === "cold") {
        rule = `temperature <= ${profile.tempOptimalMin}`;
      }

      return {
        zoneId: zone.zoneId,
        stressType: zone.stress.type,
        severity: zone.stress.severity,
        detectedAt: state.lastUpdated,
        rule,
      };
    });
}

export function createSimulationChanges(
  beforeState: MissionState,
  afterState: MissionState,
  reason: string,
): SimulationChange[] {
  const changes: SimulationChange[] = [];

  pushChange(
    changes,
    "status",
    beforeState.status,
    afterState.status,
    reason,
  );

  pushChange(
    changes,
    "activeScenario.scenarioType",
    beforeState.activeScenario?.scenarioType ?? "none",
    afterState.activeScenario?.scenarioType ?? "none",
    reason,
  );

  pushChange(
    changes,
    "activeScenario.severity",
    beforeState.activeScenario?.severity ?? "none",
    afterState.activeScenario?.severity ?? "none",
    reason,
  );

  const resourceKeys: Array<keyof MissionState["resources"]> = [
    "waterReservoirL",
    "waterRecyclingEfficiency",
    "waterDailyConsumptionL",
    "waterDaysRemaining",
    "energyAvailableKwh",
    "energyConsumptionKwhPerDay",
    "solarGenerationKwhPerDay",
    "energyDaysRemaining",
    "nutrientN",
    "nutrientP",
    "nutrientK",
  ];

  for (const key of resourceKeys) {
    pushChange(
      changes,
      `resources.${key}`,
      beforeState.resources[key],
      afterState.resources[key],
      reason,
    );
  }

  const nutritionKeys = [
    "caloricCoveragePercent",
    "proteinCoveragePercent",
    "nutritionalCoverageScore",
    "daysSafe",
  ] as const;

  for (const key of nutritionKeys) {
    pushChange(
      changes,
      `nutrition.${key}`,
      beforeState.nutrition[key],
      afterState.nutrition[key],
      reason,
    );
  }

  for (const afterZone of afterState.zones) {
    const beforeZone = beforeState.zones.find((zone) => zone.zoneId === afterZone.zoneId);
    if (!beforeZone) {
      continue;
    }

    const zonePrefix = `zones.${afterZone.zoneId}`;

    pushChange(
      changes,
      `${zonePrefix}.status`,
      beforeZone.status,
      afterZone.status,
      reason,
    );
    pushChange(
      changes,
      `${zonePrefix}.projectedYieldKg`,
      beforeZone.projectedYieldKg,
      afterZone.projectedYieldKg,
      reason,
    );
    pushChange(
      changes,
      `${zonePrefix}.allocationPercent`,
      beforeZone.allocationPercent,
      afterZone.allocationPercent,
      reason,
    );
    pushChange(
      changes,
      `${zonePrefix}.stress.type`,
      beforeZone.stress.type,
      afterZone.stress.type,
      reason,
    );
    pushChange(
      changes,
      `${zonePrefix}.stress.severity`,
      beforeZone.stress.severity,
      afterZone.stress.severity,
      reason,
    );
    pushChange(
      changes,
      `${zonePrefix}.stress.boltingRisk`,
      beforeZone.stress.boltingRisk,
      afterZone.stress.boltingRisk,
      reason,
    );
    pushChange(
      changes,
      `${zonePrefix}.stress.symptoms`,
      beforeZone.stress.symptoms.join(","),
      afterZone.stress.symptoms.join(","),
      reason,
    );
    pushChange(
      changes,
      `${zonePrefix}.sensors.temperature`,
      beforeZone.sensors.temperature,
      afterZone.sensors.temperature,
      reason,
    );
    pushChange(
      changes,
      `${zonePrefix}.sensors.lightPAR`,
      beforeZone.sensors.lightPAR,
      afterZone.sensors.lightPAR,
      reason,
    );
    pushChange(
      changes,
      `${zonePrefix}.sensors.photoperiodHours`,
      beforeZone.sensors.photoperiodHours,
      afterZone.sensors.photoperiodHours,
      reason,
    );
    pushChange(
      changes,
      `${zonePrefix}.sensors.soilMoisture`,
      beforeZone.sensors.soilMoisture,
      afterZone.sensors.soilMoisture,
      reason,
    );
  }

  return changes;
}

export function createPlannerOutput(input: {
  beforeState: MissionState;
  missionState: MissionState;
  reason: string;
}): PlannerOutput {
  const { beforeState, missionState, reason } = input;

  return {
    missionState,
    changes: createSimulationChanges(beforeState, missionState, reason),
    nutritionRiskDetected: detectNutritionRisk(missionState),
    stressFlags: createStressFlags(missionState),
  };
}
