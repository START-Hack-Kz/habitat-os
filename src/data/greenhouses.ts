import type { GreenhouseSummary } from "../types";

export const greenhouseCatalog: GreenhouseSummary[] = [
  {
    id: "gh-gamma",
    code: "GH-01",
    name: "Leafy Greens Bay",
    status: "NOM",
    nutritionContinuity: 91,
    waterReserve: 79,
    anomaly: "Stable",
    zoneId: "zone-A",
    cropType: "lettuce",
    plantCount: 20,
    silhouette: "vault",
  },
  {
    id: "gh-alpha",
    code: "GH-02",
    name: "Tuber Production Bay",
    status: "NOM",
    nutritionContinuity: 96,
    waterReserve: 88,
    anomaly: "Nominal",
    zoneId: "zone-B",
    cropType: "potato",
    plantCount: 20,
    silhouette: "arched",
  },
  {
    id: "gh-beta",
    code: "GH-03",
    name: "Protein Crop Bay",
    status: "CAU",
    nutritionContinuity: 82,
    waterReserve: 67,
    anomaly: "Light watch",
    zoneId: "zone-C",
    cropType: "beans",
    plantCount: 20,
    silhouette: "spine",
  },
  {
    id: "gh-delta",
    code: "GH-04",
    name: "Fast Harvest Bay",
    status: "ABT",
    nutritionContinuity: 74,
    waterReserve: 52,
    anomaly: "Pressure fault",
    zoneId: "zone-D",
    cropType: "radish",
    plantCount: 20,
    silhouette: "spire",
  },
];

export function getGreenhouseById(id: string): GreenhouseSummary | undefined {
  return greenhouseCatalog.find((greenhouse) => greenhouse.id === id);
}
