import { calculateNutrition } from "../modules/nutrition/nutrition.calculator";
import type { CropType, MissionState, ZoneSensors, ZoneStress } from "../modules/mission/mission.types";

function roundToSingleDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function buildGrowthProgressPercent(growthDay: number, growthCycleTotal: number): number {
  return roundToSingleDecimal((growthDay / Math.max(1, growthCycleTotal)) * 100);
}

function buildSensors(input: ZoneSensors): ZoneSensors {
  return input;
}

function buildStress(input: ZoneStress): ZoneStress {
  return input;
}

function buildBaselineSensors(cropType: CropType): ZoneSensors {
  if (cropType === "lettuce") {
    return buildSensors({
      temperature: 21,
      humidity: 60,
      co2Ppm: 950,
      lightPAR: 210,
      photoperiodHours: 16,
      nutrientPH: 6.1,
      electricalConductivity: 1.8,
      soilMoisture: 74,
    });
  }

  if (cropType === "potato") {
    return buildSensors({
      temperature: 19,
      humidity: 68,
      co2Ppm: 950,
      lightPAR: 320,
      photoperiodHours: 16,
      nutrientPH: 5.8,
      electricalConductivity: 2.1,
      soilMoisture: 78,
    });
  }

  if (cropType === "beans") {
    return buildSensors({
      temperature: 22,
      humidity: 64,
      co2Ppm: 950,
      lightPAR: 240,
      photoperiodHours: 16,
      nutrientPH: 6.3,
      electricalConductivity: 2,
      soilMoisture: 72,
    });
  }

  return buildSensors({
    temperature: 20,
    humidity: 62,
    co2Ppm: 950,
    lightPAR: 180,
    photoperiodHours: 16,
    nutrientPH: 6,
    electricalConductivity: 1.7,
    soilMoisture: 70,
  });
}

const BASE_MISSION_SEED = {
  missionId: "mars-greenhouse-alpha",
  missionDay: 87,
  missionDurationTotal: 450,
  crewSize: 4,
  status: "nominal",
  zones: [
    {
      zoneId: "zone-A",
      cropType: "lettuce",
      areaM2: 40,
      growthDay: 35,
      growthCycleTotal: 35,
      growthProgressPercent: buildGrowthProgressPercent(19, 35),
      status: "healthy",
      sensors: buildBaselineSensors("lettuce"),
      stress: buildStress({
        active: false,
        type: "none",
        severity: "none",
        boltingRisk: false,
        symptoms: [],
      }),
      projectedYieldKg: 160,
      allocationPercent: 22,
    },
    {
      zoneId: "zone-B",
      cropType: "potato",
      areaM2: 90,
      growthDay: 46,
      growthCycleTotal: 90,
      growthProgressPercent: buildGrowthProgressPercent(46, 90),
      status: "healthy",
      sensors: buildBaselineSensors("potato"),
      stress: buildStress({
        active: false,
        type: "none",
        severity: "none",
        boltingRisk: false,
        symptoms: [],
      }),
      projectedYieldKg: 540,
      allocationPercent: 38,
    },
    {
      zoneId: "zone-C",
      cropType: "beans",
      areaM2: 50,
      growthDay: 31,
      growthCycleTotal: 60,
      growthProgressPercent: buildGrowthProgressPercent(31, 60),
      status: "healthy",
      sensors: buildBaselineSensors("beans"),
      stress: buildStress({
        active: false,
        type: "none",
        severity: "none",
        boltingRisk: false,
        symptoms: [],
      }),
      projectedYieldKg: 150,
      allocationPercent: 26,
    },
    {
      zoneId: "zone-D",
      cropType: "radish",
      areaM2: 20,
      growthDay: 13,
      growthCycleTotal: 25,
      growthProgressPercent: buildGrowthProgressPercent(13, 25),
      status: "healthy",
      sensors: buildBaselineSensors("radish"),
      stress: buildStress({
        active: false,
        type: "none",
        severity: "none",
        boltingRisk: false,
        symptoms: [],
      }),
      projectedYieldKg: 60,
      allocationPercent: 14,
    },
  ],
  resources: {
    waterReservoirL: 5800,
    waterRecyclingEfficiency: 91,
    waterDailyConsumptionL: 112,
    waterDaysRemaining: 51.8,
    energyAvailableKwh: 420,
    energyConsumptionKwhPerDay: 195,
    solarGenerationKwhPerDay: 185,
    energyDaysRemaining: 42,
    nutrientN: 180,
    nutrientP: 55,
    nutrientK: 220,
  },
  activeScenario: null,
  eventLog: [
    {
      eventId: "evt-seed-003",
      timestamp: "2026-03-19T08:00:00.000Z",
      missionDay: 87,
      type: "info",
      message: "Zone-D radish remains on track for harvest in 12 days.",
      zoneId: "zone-D",
    },
    {
      eventId: "evt-seed-002",
      timestamp: "2026-03-18T14:00:00.000Z",
      missionDay: 86,
      type: "info",
      message: "Water recycling efficiency steady at 91%. All greenhouse systems nominal.",
    },
    {
      eventId: "evt-seed-001",
      timestamp: "2026-03-17T09:00:00.000Z",
      missionDay: 85,
      type: "info",
      message: "Mission day 85 systems check complete. All crop zones healthy.",
    },
  ],
  lastUpdated: "2026-03-19T10:00:00.000Z",
} satisfies Omit<MissionState, "nutrition">;

export const MISSION_SEED: MissionState = {
  ...BASE_MISSION_SEED,
  nutrition: calculateNutrition({
    zones: BASE_MISSION_SEED.zones,
    resources: BASE_MISSION_SEED.resources,
    crewSize: BASE_MISSION_SEED.crewSize,
    missionDurationTotal: BASE_MISSION_SEED.missionDurationTotal,
    missionDay: BASE_MISSION_SEED.missionDay,
  }),
};
