import type {
  BackendCropZone,
  BackendPlantHealthCheck,
  BackendPlantRecord,
  BackendPlantStatus,
  GreenhouseSummary,
  StatusTone,
} from "../types";

export interface HabitatPlantSlot {
  id: string;
  code: string;
  label: string;
  cropType: GreenhouseSummary["cropType"];
  status: BackendPlantStatus;
  tone: StatusTone;
  growthPercent: number;
  waterPercent: number;
  rowNo: number;
  plantNo: number;
  requiresManualIntervention: boolean;
  severityLabel: BackendPlantHealthCheck["severityLabel"];
  recoverabilityLabel: BackendPlantHealthCheck["recoverabilityLabel"];
  recommendedAction: BackendPlantHealthCheck["recommendedAction"];
  scores: Pick<
    BackendPlantHealthCheck,
    "colorStressScore" | "wiltingScore" | "lesionScore" | "growthDeclineScore"
  >;
  x: number;
  y: number;
}

export interface HabitatDogTrailPoint {
  x: number;
  y: number;
}

export interface HabitatOperationsModel {
  habitatId: string;
  habitatName: string;
  habitatCode: string;
  zoneId: string;
  cropLabel: string;
  plantCount: number;
  statusTone: StatusTone;
  statusLabel: string;
  summary: string;
  manualInterventionCount: number;
  abnormalPlantCount: number;
  projectedYieldKg: number;
  growthProgressPercent: number;
  allocationPercent: number;
  growthDay: number;
  growthCycleDays: number;
  plants: HabitatPlantSlot[];
  robotPaused: boolean;
  robotHoldingPosition: boolean;
  robotFocusX: number;
  robotFocusY: number;
  robotStatusLabel: string;
  robotStatusDetail: string;
  dogPath: HabitatDogTrailPoint[];
}

const slotPositions: Array<{ x: number; y: number }> = [
  { x: 13, y: 13 },
  { x: 37, y: 13 },
  { x: 61, y: 13 },
  { x: 85, y: 13 },
  { x: 13, y: 31 },
  { x: 37, y: 31 },
  { x: 61, y: 31 },
  { x: 85, y: 31 },
  { x: 13, y: 49 },
  { x: 37, y: 49 },
  { x: 61, y: 49 },
  { x: 85, y: 49 },
  { x: 13, y: 67 },
  { x: 37, y: 67 },
  { x: 61, y: 67 },
  { x: 85, y: 67 },
  { x: 13, y: 85 },
  { x: 37, y: 85 },
  { x: 61, y: 85 },
  { x: 85, y: 85 },
];

const dogPatrolPath: HabitatDogTrailPoint[] = [
  { x: 25, y: 92 },
  { x: 25, y: 4.5 },
  { x: 49, y: 4.5 },
  { x: 73, y: 4.5 },
  { x: 73, y: 92 },
  { x: 73, y: 4.5 },
  { x: 49, y: 4.5 },
  { x: 49, y: 92 },
  { x: 49, y: 4.5 },
  { x: 25, y: 4.5 },
  { x: 25, y: 92 },
];

export function buildHabitatOperationsModel(
  greenhouse: GreenhouseSummary,
  zone: BackendCropZone | undefined,
  plants: BackendPlantRecord[],
  plantHealthChecks: BackendPlantHealthCheck[],
): HabitatOperationsModel {
  const zonePlants = sortPlantsForZone(plants);
  const checksByPlantId = new Map(plantHealthChecks.map((check) => [check.plantId, check]));
  const manualInterventionCount = zonePlants.filter((plant) =>
    plant.currentStatus === "critical" || plant.currentStatus === "dead",
  ).length;
  const abnormalPlantCount = zonePlants.filter((plant) => plant.currentStatus !== "healthy").length;
  const focusPlant =
    zonePlants.find((plant) => plant.currentStatus === "sick") ??
    zonePlants.find((plant) => plant.currentStatus === "critical" || plant.currentStatus === "dead") ??
    null;
  const robotPaused = manualInterventionCount > 0;
  const robotHoldingPosition = robotPaused || focusPlant?.currentStatus === "sick";
  const tone =
    manualInterventionCount > 0 ? "ABT" : zone ? zoneTone(zone) : greenhouse.status;
  const cropLabel = formatCropType(greenhouse.cropType);
  const prefix = cropLabel.slice(0, 3).toUpperCase();
  const growthBase = zone?.growthProgressPercent ?? 0;
  const waterBase = zone?.allocationPercent ?? 0;
  const statusLabel = manualInterventionCount > 0
    ? "Manual action required"
    : focusPlant?.currentStatus === "sick"
      ? "Plant triage in progress"
      : zone
        ? formatZoneStatus(zone.status)
        : "Standby";
  const summary =
    manualInterventionCount > 0
      ? `${manualInterventionCount} plants are flagged red for human harvest or replacement. The mobile robot is parked until manual intervention clears the bay.`
      : focusPlant?.currentStatus === "sick"
        ? `Canopy rover has halted on a diseased plant in ${greenhouse.name} and is waiting for AI triage.`
        : abnormalPlantCount > 0
        ? `${abnormalPlantCount} plants are under watch in ${greenhouse.name}. Autonomous patrol remains active while the bay is monitored.`
        : zone?.stress.active
          ? zone.stress.summary
          : `${greenhouse.name} is holding ${greenhouse.plantCount} ${cropLabel.toLowerCase()} plants within mission tolerance.`;
  const robotStatusLabel = robotPaused
    ? "Robot paused"
    : focusPlant?.currentStatus === "sick"
      ? "Robot inspecting plant"
      : "Robot patrol active";
  const robotStatusDetail = robotPaused
    ? `${manualInterventionCount} plants require human harvest or replacement.`
    : focusPlant?.currentStatus === "sick"
      ? `The rover is parked at row ${focusPlant.rowNo} plant ${focusPlant.plantNo} while AI decides whether to keep or replace it.`
      : abnormalPlantCount > 0
      ? `${abnormalPlantCount} plants are under watch while the robot keeps surveying the lane.`
      : "No plant intervention flag is active in this habitat.";
  const displayPlants = zonePlants.length > 0 ? zonePlants : buildFallbackPlants(greenhouse);
  const focusPlantIndex =
    focusPlant === null
      ? -1
      : displayPlants.findIndex((plant) => plant.plantId === focusPlant.plantId);
  const focusPosition =
    focusPlantIndex >= 0
      ? slotPositions[focusPlantIndex] ?? slotPositions[slotPositions.length - 1]
      : dogPatrolPath[0];

  return {
    habitatId: greenhouse.id,
    habitatName: greenhouse.name,
    habitatCode: greenhouse.code,
    zoneId: greenhouse.zoneId,
    cropLabel,
    plantCount: greenhouse.plantCount,
    statusTone: tone,
    statusLabel,
    summary,
    manualInterventionCount,
    abnormalPlantCount,
    projectedYieldKg: zone?.projectedYieldKg ?? 0,
    growthProgressPercent: zone?.growthProgressPercent ?? 0,
    allocationPercent: zone?.allocationPercent ?? 0,
    growthDay: zone?.growthDay ?? 0,
    growthCycleDays: zone?.growthCycleDays ?? 0,
    plants: displayPlants.map((plant, index) => {
      const position = slotPositions[index] ?? slotPositions[slotPositions.length - 1];
      return {
        id: plant.plantId,
        code: `${prefix}-R${plant.rowNo}P${plant.plantNo}`,
        label: `${cropLabel} plant`,
        cropType: plant.cropType,
        status: plant.currentStatus,
        tone: plantToneFromStatus(plant.currentStatus),
        growthPercent: clampPercent(growthBase + growthOffsetFromStatus(plant.currentStatus)),
        waterPercent: clampPercent(waterBase + waterOffsetFromStatus(plant.currentStatus)),
        rowNo: plant.rowNo,
        plantNo: plant.plantNo,
        requiresManualIntervention:
          plant.currentStatus === "critical" || plant.currentStatus === "dead",
        severityLabel:
          checksByPlantId.get(plant.plantId)?.severityLabel ?? severityLabelFromStatus(plant.currentStatus),
        recoverabilityLabel:
          checksByPlantId.get(plant.plantId)?.recoverabilityLabel ??
          (plant.currentStatus === "critical" || plant.currentStatus === "dead"
            ? "unrecoverable"
            : "recoverable"),
        recommendedAction:
          checksByPlantId.get(plant.plantId)?.recommendedAction ??
          (plant.currentStatus === "sick"
            ? "treat"
            : plant.currentStatus === "critical" || plant.currentStatus === "dead"
              ? "replace"
              : "monitor"),
        scores: {
          colorStressScore: checksByPlantId.get(plant.plantId)?.colorStressScore ?? 0,
          wiltingScore: checksByPlantId.get(plant.plantId)?.wiltingScore ?? 0,
          lesionScore: checksByPlantId.get(plant.plantId)?.lesionScore ?? 0,
          growthDeclineScore: checksByPlantId.get(plant.plantId)?.growthDeclineScore ?? 0,
        },
        x: position.x,
        y: position.y,
      };
    }),
    robotPaused,
    robotHoldingPosition,
    robotFocusX: focusPosition.x,
    robotFocusY: focusPosition.y,
    robotStatusLabel,
    robotStatusDetail,
    dogPath: dogPatrolPath,
  };
}

function buildFallbackPlants(greenhouse: GreenhouseSummary): BackendPlantRecord[] {
  return Array.from({ length: greenhouse.plantCount }, (_, index) => ({
    plantId: `${greenhouse.id}-plant-${index + 1}`,
    zoneId: greenhouse.zoneId,
    rowNo: Math.floor(index / 5) + 1,
    plantNo: (index % 5) + 1,
    cropType: greenhouse.cropType,
    plantedAt: "2026-01-01T00:00:00.000Z",
    currentStatus: "healthy",
  }));
}

function sortPlantsForZone(plants: BackendPlantRecord[]): BackendPlantRecord[] {
  return [...plants].sort((left, right) => {
    if (left.rowNo !== right.rowNo) {
      return left.rowNo - right.rowNo;
    }

    return left.plantNo - right.plantNo;
  });
}

function plantToneFromStatus(status: BackendPlantStatus): StatusTone {
  switch (status) {
    case "critical":
    case "dead":
      return "ABT";
    case "watch":
    case "sick":
      return "CAU";
    case "replaced":
    case "healthy":
    default:
      return "NOM";
  }
}

function severityLabelFromStatus(
  status: BackendPlantStatus,
): BackendPlantHealthCheck["severityLabel"] {
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

function growthOffsetFromStatus(status: BackendPlantStatus): number {
  switch (status) {
    case "critical":
    case "dead":
      return -26;
    case "sick":
      return -16;
    case "watch":
      return -8;
    case "replaced":
      return -42;
    case "healthy":
    default:
      return 0;
  }
}

function waterOffsetFromStatus(status: BackendPlantStatus): number {
  switch (status) {
    case "critical":
    case "dead":
      return -24;
    case "sick":
      return -12;
    case "watch":
      return -6;
    case "replaced":
      return -18;
    case "healthy":
    default:
      return 0;
  }
}

function zoneTone(zone: BackendCropZone): StatusTone {
  if (zone.status === "critical" || zone.status === "offline" || zone.stress.severity === "critical") {
    return "ABT";
  }
  if (
    zone.status === "stressed" ||
    zone.status === "harvesting" ||
    zone.stress.severity === "moderate" ||
    zone.stress.severity === "high" ||
    zone.stress.severity === "low"
  ) {
    return "CAU";
  }
  return "NOM";
}

function formatCropType(type: GreenhouseSummary["cropType"]): string {
  switch (type) {
    case "beans":
      return "Beans";
    case "potato":
      return "Potatoes";
    case "radish":
      return "Radish";
    default:
      return "Lettuce";
  }
}

function formatZoneStatus(status: BackendCropZone["status"]): string {
  switch (status) {
    case "critical":
      return "Critical";
    case "harvesting":
      return "Harvesting";
    case "healthy":
      return "Healthy";
    case "offline":
      return "Offline";
    default:
      return "Stressed";
  }
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}
