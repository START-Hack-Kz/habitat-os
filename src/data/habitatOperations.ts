import type { BackendCropZone, GreenhouseSummary, StatusTone } from "../types";

export interface HabitatPlantSlot {
  id: string;
  code: string;
  label: string;
  cropType: GreenhouseSummary["cropType"];
  tone: StatusTone;
  growthPercent: number;
  waterPercent: number;
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
  projectedYieldKg: number;
  growthProgressPercent: number;
  allocationPercent: number;
  growthDay: number;
  growthCycleDays: number;
  plants: HabitatPlantSlot[];
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
): HabitatOperationsModel {
  const tone = zone ? zoneTone(zone) : greenhouse.status;
  const cropLabel = formatCropType(greenhouse.cropType);
  const prefix = cropLabel.slice(0, 3).toUpperCase();
  const growthBase = zone?.growthProgressPercent ?? 0;
  const waterBase = zone?.allocationPercent ?? 0;

  return {
    habitatId: greenhouse.id,
    habitatName: greenhouse.name,
    habitatCode: greenhouse.code,
    zoneId: greenhouse.zoneId,
    cropLabel,
    plantCount: greenhouse.plantCount,
    statusTone: tone,
    statusLabel: zone ? formatZoneStatus(zone.status) : "Standby",
    summary: zone?.stress.active
      ? zone.stress.summary
      : `${greenhouse.name} is holding ${greenhouse.plantCount} ${cropLabel.toLowerCase()} plants within mission tolerance.`,
    projectedYieldKg: zone?.projectedYieldKg ?? 0,
    growthProgressPercent: zone?.growthProgressPercent ?? 0,
    allocationPercent: zone?.allocationPercent ?? 0,
    growthDay: zone?.growthDay ?? 0,
    growthCycleDays: zone?.growthCycleDays ?? 0,
    plants: Array.from({ length: greenhouse.plantCount }, (_, index) => {
      const position = slotPositions[index] ?? slotPositions[slotPositions.length - 1];
      const offset = ((index * 7) % 11) - 5;
      const waterOffset = ((index * 5) % 9) - 4;
      return {
        id: `${greenhouse.id}-plant-${index + 1}`,
        code: `${prefix}-${String(index + 1).padStart(2, "0")}`,
        label: cropLabel,
        cropType: greenhouse.cropType,
        tone: plantTone(tone, index),
        growthPercent: clampPercent(growthBase + offset),
        waterPercent: clampPercent(waterBase + waterOffset),
        x: position.x,
        y: position.y,
      };
    }),
    dogPath: dogPatrolPath,
  };
}

function plantTone(baseTone: StatusTone, index: number): StatusTone {
  if (baseTone === "ABT") {
    return index % 3 === 0 ? "CAU" : "ABT";
  }
  if (baseTone === "CAU") {
    return index % 4 === 0 ? "ABT" : "CAU";
  }
  return index % 5 === 0 ? "CAU" : "NOM";
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
