import { buildMissionSnapshot } from "../mission/mission.service";
import type {
  CropZone,
  EventLogEntry,
  MissionState,
  PlantHealthCheck,
  PlantRecommendedAction,
  PlantRecord,
  PlantRecoverabilityLabel,
  PlantSeverityLabel,
  PlantStatus,
} from "../mission/mission.types";

const PLANT_ROWS = 4;
const PLANTS_PER_ROW = 5;
const MANUAL_INTERVENTION_STATUSES = new Set<PlantStatus>(["critical", "dead"]);
const PLANT_WORKFLOW_ZONE_ID = "zone-A";

export type PlantDecisionApplyRequest = {
  plantId: string;
  targetStatus: PlantStatus;
  severityLabel: PlantSeverityLabel;
  recoverabilityLabel: PlantRecoverabilityLabel;
  recommendedAction: PlantRecommendedAction;
  summary: string;
};

export type PlantHealthTriggerRequest = {
  zoneId: string;
  rowNo: number;
  plantNo: number;
  imageUri?: string;
  colorStressScore: number;
  wiltingScore: number;
  lesionScore: number;
  growthDeclineScore: number;
};

type SeedPlantBlueprint = {
  currentStatus: PlantStatus;
  severityLabel: PlantSeverityLabel;
  recoverabilityLabel: PlantRecoverabilityLabel;
  recommendedAction: PlantRecommendedAction;
  scores: {
    colorStressScore: number;
    wiltingScore: number;
    lesionScore: number;
    growthDeclineScore: number;
  };
};

function cloneMissionState(state: MissionState): MissionState {
  return structuredClone(state);
}

function deriveTimestamp(state: MissionState): string {
  const parsed = Date.parse(state.lastUpdated);
  const baseTime = Number.isNaN(parsed)
    ? Date.parse("2026-03-19T10:00:00.000Z")
    : parsed;

  return new Date(baseTime + 1000).toISOString();
}

function buildPlantId(zoneId: string, rowNo: number, plantNo: number): string {
  const zoneLetter = zoneId.replace(/^zone-/, "").charAt(0).toUpperCase() || "0";
  const suffix = [
    zoneLetter.charCodeAt(0).toString(16).padStart(2, "0"),
    rowNo.toString(16).padStart(2, "0"),
    plantNo.toString(16).padStart(2, "0"),
    "000000",
  ].join("");

  return `00000000-0000-4000-8000-${suffix}`;
}

function buildCheckId(plantId: string, capturedAt: string): string {
  const normalized = plantId.replace(/[^a-f0-9]/gi, "").slice(-12).padStart(12, "0");
  const timestampHex = Math.max(0, Math.floor(Date.parse(capturedAt) / 1000))
    .toString(16)
    .slice(-8)
    .padStart(8, "0");

  return `00000000-0000-4000-9000-${timestampHex}${normalized.slice(-4)}`;
}

function sortPlants(plants: PlantRecord[]): PlantRecord[] {
  return [...plants].sort((left, right) => {
    if (left.zoneId !== right.zoneId) {
      return left.zoneId.localeCompare(right.zoneId);
    }

    if (left.rowNo !== right.rowNo) {
      return left.rowNo - right.rowNo;
    }

    return left.plantNo - right.plantNo;
  });
}

function derivePlantedAt(zone: CropZone, referenceTimestamp: string): string {
  const parsed = Date.parse(referenceTimestamp);

  if (Number.isNaN(parsed)) {
    return "2026-01-01T00:00:00.000Z";
  }

  return new Date(parsed - zone.growthDay * 24 * 60 * 60 * 1000).toISOString();
}

function getSeedPlantBlueprint(
  _zoneId: string,
  _rowNo: number,
  _plantNo: number,
): SeedPlantBlueprint | null {
  return null;
}

function buildZoneSeedPlants(zone: CropZone, referenceTimestamp: string): PlantRecord[] {
  const plantedAt = derivePlantedAt(zone, referenceTimestamp);
  const plants: PlantRecord[] = [];

  for (let rowNo = 1; rowNo <= PLANT_ROWS; rowNo += 1) {
    for (let plantNo = 1; plantNo <= PLANTS_PER_ROW; plantNo += 1) {
      const blueprint = getSeedPlantBlueprint(zone.zoneId, rowNo, plantNo);
      plants.push({
        plantId: buildPlantId(zone.zoneId, rowNo, plantNo),
        zoneId: zone.zoneId,
        rowNo,
        plantNo,
        cropType: zone.cropType,
        plantedAt,
        currentStatus: blueprint?.currentStatus ?? "healthy",
      });
    }
  }

  return plants;
}

function defaultSeverityLabelFromStatus(status: PlantStatus): PlantSeverityLabel {
  switch (status) {
    case "watch":
      return "watch";
    case "sick":
      return "sick";
    case "critical":
      return "critical";
    case "dead":
      return "dead";
    case "healthy":
    case "replaced":
    default:
      return "healthy";
  }
}

function defaultRecoverabilityFromStatus(status: PlantStatus): PlantRecoverabilityLabel {
  return status === "critical" || status === "dead" ? "unrecoverable" : "recoverable";
}

function defaultRecommendedActionFromStatus(status: PlantStatus): PlantRecommendedAction {
  if (status === "critical" || status === "dead") {
    return "replace";
  }

  if (status === "sick") {
    return "treat";
  }

  return "monitor";
}

function defaultScoresFromStatus(status: PlantStatus): SeedPlantBlueprint["scores"] {
  if (status === "critical" || status === "dead") {
    return {
      colorStressScore: 0.9,
      wiltingScore: 0.93,
      lesionScore: 0.72,
      growthDeclineScore: 0.87,
    };
  }

  if (status === "sick") {
    return {
      colorStressScore: 0.56,
      wiltingScore: 0.61,
      lesionScore: 0.22,
      growthDeclineScore: 0.48,
    };
  }

  if (status === "watch") {
    return {
      colorStressScore: 0.28,
      wiltingScore: 0.25,
      lesionScore: 0.08,
      growthDeclineScore: 0.18,
    };
  }

  return {
    colorStressScore: 0.08,
    wiltingScore: 0.06,
    lesionScore: 0.03,
    growthDeclineScore: 0.05,
  };
}

function buildSeedHealthCheck(
  plant: PlantRecord,
  referenceTimestamp: string,
): PlantHealthCheck {
  const blueprint = getSeedPlantBlueprint(plant.zoneId, plant.rowNo, plant.plantNo);
  const severityLabel = blueprint?.severityLabel ?? defaultSeverityLabelFromStatus(plant.currentStatus);
  const recoverabilityLabel =
    blueprint?.recoverabilityLabel ?? defaultRecoverabilityFromStatus(plant.currentStatus);
  const recommendedAction =
    blueprint?.recommendedAction ?? defaultRecommendedActionFromStatus(plant.currentStatus);
  const scores = blueprint?.scores ?? defaultScoresFromStatus(plant.currentStatus);

  return {
    checkId: buildCheckId(plant.plantId, referenceTimestamp),
    plantId: plant.plantId,
    capturedAt: referenceTimestamp,
    imageUri: `marscam://${plant.zoneId}/row-${plant.rowNo}/plant-${plant.plantNo}/${referenceTimestamp}.jpg`,
    colorStressScore: scores.colorStressScore,
    wiltingScore: scores.wiltingScore,
    lesionScore: scores.lesionScore,
    growthDeclineScore: scores.growthDeclineScore,
    severityLabel,
    recoverabilityLabel,
    recommendedAction,
  };
}

function deriveTriggeredSeverityLabel(input: {
  colorStressScore: number;
  wiltingScore: number;
  lesionScore: number;
  growthDeclineScore: number;
}): PlantSeverityLabel {
  const peak = Math.max(
    input.colorStressScore,
    input.wiltingScore,
    input.lesionScore,
    input.growthDeclineScore,
  );

  if (peak >= 0.82) {
    return "critical";
  }
  if (peak >= 0.5) {
    return "sick";
  }
  if (peak >= 0.24) {
    return "watch";
  }
  return "healthy";
}

function deriveTriggeredRecoverabilityLabel(
  severityLabel: PlantSeverityLabel,
  lesionScore: number,
  growthDeclineScore: number,
): PlantRecoverabilityLabel {
  if (severityLabel === "critical" || lesionScore >= 0.6 || growthDeclineScore >= 0.78) {
    return "unrecoverable";
  }
  return "recoverable";
}

function deriveTriggeredRecommendedAction(
  severityLabel: PlantSeverityLabel,
  recoverabilityLabel: PlantRecoverabilityLabel,
): PlantRecommendedAction {
  if (recoverabilityLabel === "unrecoverable" || severityLabel === "critical") {
    return "replace";
  }
  if (severityLabel === "sick") {
    return "treat";
  }
  return "monitor";
}

export function buildSeedPlants(
  zones: CropZone[],
  referenceTimestamp: string,
): PlantRecord[] {
  return sortPlants(zones.flatMap((zone) => buildZoneSeedPlants(zone, referenceTimestamp)));
}

export function buildSeedPlantHealthChecks(
  plants: PlantRecord[],
  referenceTimestamp: string,
): PlantHealthCheck[] {
  return sortPlants(plants).map((plant) => buildSeedHealthCheck(plant, referenceTimestamp));
}

export function reconcilePlants(input: {
  currentPlants: PlantRecord[];
  zones: CropZone[];
  referenceTimestamp: string;
}): PlantRecord[] {
  const { currentPlants, zones, referenceTimestamp } = input;
  const plantsByZone = new Map<string, PlantRecord[]>();

  for (const plant of currentPlants) {
    const plants = plantsByZone.get(plant.zoneId) ?? [];
    plants.push(plant);
    plantsByZone.set(plant.zoneId, plants);
  }

  const nextPlants = zones.flatMap((zone) => {
    const existing = plantsByZone.get(zone.zoneId);
    const zonePlants = sortPlants(existing ?? buildZoneSeedPlants(zone, referenceTimestamp));

    return zonePlants.map((plant) => ({
      ...plant,
      cropType: zone.cropType,
      zoneId: zone.zoneId,
    }));
  });

  return sortPlants(nextPlants);
}

export function reconcilePlantHealthChecks(input: {
  currentChecks: PlantHealthCheck[];
  plants: PlantRecord[];
  referenceTimestamp: string;
}): PlantHealthCheck[] {
  const { currentChecks, plants, referenceTimestamp } = input;
  const checksByPlantId = new Map(currentChecks.map((check) => [check.plantId, check]));

  return sortPlants(plants).map((plant) => {
    const existing = checksByPlantId.get(plant.plantId);

    if (!existing) {
      return buildSeedHealthCheck(plant, referenceTimestamp);
    }

    if (plant.currentStatus === "critical" || plant.currentStatus === "dead") {
      return {
        ...existing,
        severityLabel: plant.currentStatus === "dead" ? "dead" : "critical",
        recoverabilityLabel: "unrecoverable",
        recommendedAction: "replace",
      };
    }

    if (plant.currentStatus === "replaced") {
      return {
        ...existing,
        severityLabel: "healthy",
        recoverabilityLabel: "recoverable",
        recommendedAction: "monitor",
      };
    }

    return existing;
  });
}

export function countManualInterventionPlants(
  plants: PlantRecord[],
  zoneId?: string,
): number {
  return plants.filter((plant) => {
    return (!zoneId || plant.zoneId === zoneId) && MANUAL_INTERVENTION_STATUSES.has(plant.currentStatus);
  }).length;
}

export function buildPlantInterventionEvents(input: {
  beforeState: MissionState;
  afterState: MissionState;
  timestamp: string;
}): EventLogEntry[] {
  const { beforeState, afterState, timestamp } = input;
  const zoneIds = new Set([
    ...beforeState.plants.map((plant) => plant.zoneId),
    ...afterState.plants.map((plant) => plant.zoneId),
  ]);
  const events: EventLogEntry[] = [];

  for (const zoneId of zoneIds) {
    const beforeManualCount = countManualInterventionPlants(beforeState.plants, zoneId);
    const afterManualCount = countManualInterventionPlants(afterState.plants, zoneId);

    if (afterManualCount > beforeManualCount) {
      events.push({
        eventId: `evt-plant-${zoneId}-${Date.parse(timestamp)}`,
        missionDay: afterState.missionDay,
        timestamp,
        type: "critical",
        zoneId,
        message: `Robot patrol paused in ${zoneId}. ${afterManualCount} plants marked critical for human harvest or replacement.`,
      });
      continue;
    }

    if (beforeManualCount > 0 && afterManualCount === 0) {
      events.push({
        eventId: `evt-plant-clear-${zoneId}-${Date.parse(timestamp)}`,
        missionDay: afterState.missionDay,
        timestamp,
        type: "info",
        zoneId,
        message: `Robot patrol resumed in ${zoneId}. No plants remain flagged for manual harvest or replacement.`,
      });
    }
  }

  return events;
}

export function applyPlantDecision(
  sourceState: MissionState,
  request: PlantDecisionApplyRequest,
): MissionState {
  const beforeSnapshot = buildMissionSnapshot(sourceState);
  const state = cloneMissionState(beforeSnapshot);
  const timestamp = deriveTimestamp(state);
  const targetPlant = state.plants.find((plant) => plant.plantId === request.plantId);

  if (!targetPlant) {
    throw new Error(`Plant ${request.plantId} was not found in mission state.`);
  }

  state.plants = state.plants.map((plant) =>
    plant.plantId === request.plantId
      ? {
          ...plant,
          currentStatus: request.targetStatus,
        }
      : plant,
  );

  const existingCheck = state.plantHealthChecks.find((check) => check.plantId === request.plantId);
  const baseCheck = existingCheck ?? buildSeedHealthCheck(targetPlant, timestamp);

  state.plantHealthChecks = state.plantHealthChecks.some((check) => check.plantId === request.plantId)
    ? state.plantHealthChecks.map((check) =>
        check.plantId === request.plantId
          ? {
              ...baseCheck,
              capturedAt: timestamp,
              imageUri: `marscam://${targetPlant.zoneId}/row-${targetPlant.rowNo}/plant-${targetPlant.plantNo}/${timestamp}.jpg`,
              checkId: buildCheckId(targetPlant.plantId, timestamp),
              severityLabel: request.severityLabel,
              recoverabilityLabel: request.recoverabilityLabel,
              recommendedAction: request.recommendedAction,
            }
          : check,
      )
    : [
        ...state.plantHealthChecks,
        {
          ...baseCheck,
          capturedAt: timestamp,
          imageUri: `marscam://${targetPlant.zoneId}/row-${targetPlant.rowNo}/plant-${targetPlant.plantNo}/${timestamp}.jpg`,
          checkId: buildCheckId(targetPlant.plantId, timestamp),
          severityLabel: request.severityLabel,
          recoverabilityLabel: request.recoverabilityLabel,
          recommendedAction: request.recommendedAction,
        },
      ];

  state.lastUpdated = timestamp;
  const nextState = buildMissionSnapshot(state);
  nextState.eventLog.push({
    eventId: `evt-${String(nextState.eventLog.length + 1).padStart(3, "0")}`,
    missionDay: nextState.missionDay,
    timestamp,
    type: request.targetStatus === "critical" || request.targetStatus === "dead" ? "critical" : "ai_action",
    zoneId: targetPlant.zoneId,
    message: request.summary,
  });
  nextState.eventLog.push(
    ...buildPlantInterventionEvents({
      beforeState: beforeSnapshot,
      afterState: nextState,
      timestamp,
    }),
  );

  return buildMissionSnapshot(nextState);
}

export function triggerPlantHealthCheck(
  sourceState: MissionState,
  request: PlantHealthTriggerRequest,
): MissionState {
  if (request.zoneId !== PLANT_WORKFLOW_ZONE_ID) {
    throw new Error(`Plant-health workflow is currently enabled only for ${PLANT_WORKFLOW_ZONE_ID}.`);
  }

  const beforeSnapshot = buildMissionSnapshot(sourceState);
  const state = cloneMissionState(beforeSnapshot);
  const timestamp = deriveTimestamp(state);
  const targetPlant = state.plants.find(
    (plant) =>
      plant.zoneId === request.zoneId &&
      plant.rowNo === request.rowNo &&
      plant.plantNo === request.plantNo,
  );

  if (!targetPlant) {
    throw new Error(
      `Plant ${request.zoneId} row ${request.rowNo} plant ${request.plantNo} was not found.`,
    );
  }

  const severityLabel = deriveTriggeredSeverityLabel(request);
  const recoverabilityLabel = deriveTriggeredRecoverabilityLabel(
    severityLabel,
    request.lesionScore,
    request.growthDeclineScore,
  );
  const recommendedAction = deriveTriggeredRecommendedAction(
    severityLabel,
    recoverabilityLabel,
  );

  state.plants = state.plants.map((plant) =>
    plant.plantId === targetPlant.plantId
      ? {
          ...plant,
          currentStatus: severityLabel === "healthy" ? "watch" : "sick",
        }
      : plant,
  );

  const nextCheck: PlantHealthCheck = {
    checkId: buildCheckId(targetPlant.plantId, timestamp),
    plantId: targetPlant.plantId,
    capturedAt: timestamp,
    imageUri:
      request.imageUri ??
      `marscam://${targetPlant.zoneId}/row-${targetPlant.rowNo}/plant-${targetPlant.plantNo}/${timestamp}.jpg`,
    colorStressScore: request.colorStressScore,
    wiltingScore: request.wiltingScore,
    lesionScore: request.lesionScore,
    growthDeclineScore: request.growthDeclineScore,
    severityLabel,
    recoverabilityLabel,
    recommendedAction,
  };

  state.plantHealthChecks = state.plantHealthChecks.some(
    (check) => check.plantId === targetPlant.plantId,
  )
    ? state.plantHealthChecks.map((check) =>
        check.plantId === targetPlant.plantId ? nextCheck : check,
      )
    : [...state.plantHealthChecks, nextCheck];

  state.lastUpdated = timestamp;
  const nextState = buildMissionSnapshot(state);
  nextState.eventLog.unshift({
    eventId: `evt-plant-health-${Date.parse(timestamp)}`,
    missionDay: nextState.missionDay,
    timestamp,
    type: severityLabel === "critical" ? "critical" : "warning",
    zoneId: targetPlant.zoneId,
    message: `Canopy rover flagged ${targetPlant.zoneId} row ${targetPlant.rowNo} plant ${targetPlant.plantNo} for AI triage after a disease scan.`,
  });
  nextState.eventLog = nextState.eventLog.slice(0, 20);

  return buildMissionSnapshot(nextState);
}
