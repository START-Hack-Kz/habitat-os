import { MISSION_SEED } from "../../data/mission.seed";
import { buildMissionSnapshot } from "../mission/mission.service";
import { calculateNutrition } from "./nutrition.calculator";

const nominalSnapshot = buildMissionSnapshot(MISSION_SEED);
const nominal = calculateNutrition({
  zones: nominalSnapshot.zones,
  resources: nominalSnapshot.resources,
  crewSize: nominalSnapshot.crewSize,
  missionDurationTotal: nominalSnapshot.missionDurationTotal,
  missionDay: nominalSnapshot.missionDay,
});

console.log("=== CASE 1: Nominal seed state ===");
console.log(JSON.stringify(nominal, null, 2));

const failureState = structuredClone(MISSION_SEED);
failureState.zones = failureState.zones.map((zone) => {
  if (zone.zoneId === "zone-A") {
    return {
      ...zone,
      sensors: {
        ...zone.sensors,
        temperature: 32,
        humidity: 35,
      },
    };
  }

  if (zone.zoneId === "zone-B") {
    return {
      ...zone,
      sensors: {
        ...zone.sensors,
        soilMoisture: 15,
      },
    };
  }

  return zone;
});
failureState.resources = {
  ...failureState.resources,
  waterRecyclingEfficiency: 45,
};

const failureSnapshot = buildMissionSnapshot(failureState);
const failure = calculateNutrition({
  zones: failureSnapshot.zones,
  resources: failureSnapshot.resources,
  crewSize: failureSnapshot.crewSize,
  missionDurationTotal: failureSnapshot.missionDurationTotal,
  missionDay: failureSnapshot.missionDay,
  previousScore: nominal.nutritionalCoverageScore,
});

console.log("\n=== CASE 2: High heat on lettuce + low soil moisture on potato ===");
console.log(JSON.stringify(failure, null, 2));

console.log("\n=== DERIVED STATE ===");
console.log(
  JSON.stringify(
    failureSnapshot.zones.map((zone) => ({
      zoneId: zone.zoneId,
      stress: zone.stress,
      projectedYieldKg: zone.projectedYieldKg,
    })),
    null,
    2,
  ),
);

console.log("\n=== DELTA ===");
console.log(
  `caloricCoverage: ${nominal.caloricCoveragePercent}% -> ${failure.caloricCoveragePercent}%`,
);
console.log(
  `proteinCoverage: ${nominal.proteinCoveragePercent}% -> ${failure.proteinCoveragePercent}%`,
);
console.log(
  `vitaminA: ${nominal.vitaminA.coveragePercent}% -> ${failure.vitaminA.coveragePercent}%`,
);
console.log(
  `potassium: ${nominal.potassium.coveragePercent}% -> ${failure.potassium.coveragePercent}%`,
);
console.log(
  `coverageScore: ${nominal.nutritionalCoverageScore} -> ${failure.nutritionalCoverageScore}`,
);
console.log(`daysSafe: ${nominal.daysSafe} -> ${failure.daysSafe}`);
console.log(`trend: ${failure.trend}`);
