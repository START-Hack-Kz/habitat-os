import type { GreenhouseSummary } from "../types";

export const greenhouseCatalog: GreenhouseSummary[] = [
  {
    id: "gh-alpha",
    code: "GH-01",
    name: "Ares Alpha",
    status: "NOM",
    nutritionContinuity: 96,
    waterReserve: 88,
    anomaly: "Nominal",
    silhouette: "arched",
  },
  {
    id: "gh-beta",
    code: "GH-02",
    name: "Borealis Beta",
    status: "CAU",
    nutritionContinuity: 82,
    waterReserve: 67,
    anomaly: "Light watch",
    silhouette: "spine",
  },
  {
    id: "gh-gamma",
    code: "GH-03",
    name: "Horizon Gamma",
    status: "NOM",
    nutritionContinuity: 91,
    waterReserve: 79,
    anomaly: "Stable",
    silhouette: "vault",
  },
  {
    id: "gh-delta",
    code: "GH-04",
    name: "Kepler Delta",
    status: "ABT",
    nutritionContinuity: 74,
    waterReserve: 52,
    anomaly: "Pressure fault",
    silhouette: "spire",
  },
];

export function getGreenhouseById(id: string): GreenhouseSummary | undefined {
  return greenhouseCatalog.find((greenhouse) => greenhouse.id === id);
}
