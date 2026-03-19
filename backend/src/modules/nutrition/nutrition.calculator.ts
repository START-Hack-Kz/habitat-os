import { CROP_PROFILES } from "../../data/cropProfiles.data";
import type {
  CropType,
  CropZone,
  MicronutrientStatus,
  NutritionStatus,
  NutritionTrend,
  ResourceState,
} from "../mission/mission.types";

type MicronutrientKey =
  | "vitaminA"
  | "vitaminC"
  | "vitaminK"
  | "folate"
  | "iron"
  | "potassium"
  | "magnesium";

type MicronutrientDensity = Record<MicronutrientKey, number>;

type MicronutrientDefinition = {
  key: MicronutrientKey;
  target: number;
  unit: string;
};

const MICRONUTRIENT_DEFINITIONS: MicronutrientDefinition[] = [
  { key: "vitaminA", target: 3600, unit: "µg" },
  { key: "vitaminC", target: 360, unit: "mg" },
  { key: "vitaminK", target: 480, unit: "µg" },
  { key: "folate", target: 1600, unit: "µg" },
  { key: "iron", target: 32, unit: "mg" },
  { key: "potassium", target: 14000, unit: "mg" },
  { key: "magnesium", target: 1600, unit: "mg" },
];

const ZERO_MICRONUTRIENTS: MicronutrientDensity = {
  vitaminA: 0,
  vitaminC: 0,
  vitaminK: 0,
  folate: 0,
  iron: 0,
  potassium: 0,
  magnesium: 0,
};

const MICRONUTRIENT_DENSITY_PER_100G: Record<CropType, MicronutrientDensity> = {
  lettuce: {
    vitaminA: 370,
    vitaminC: 9,
    vitaminK: 126,
    folate: 136,
    iron: 0.9,
    potassium: 194,
    magnesium: 13,
  },
  potato: {
    vitaminA: 0,
    vitaminC: 20,
    vitaminK: 2,
    folate: 16,
    iron: 0.8,
    potassium: 425,
    magnesium: 23,
  },
  beans: {
    vitaminA: 35,
    vitaminC: 2,
    vitaminK: 9,
    folate: 130,
    iron: 2.1,
    potassium: 340,
    magnesium: 48,
  },
  radish: {
    vitaminA: 7,
    vitaminC: 15,
    vitaminK: 1.3,
    folate: 25,
    iron: 0.3,
    potassium: 233,
    magnesium: 10,
  },
};

function buildMicronutrientStatus(input: {
  produced: number;
  target: number;
  unit: string;
}): MicronutrientStatus {
  const { produced, target, unit } = input;
  const roundedProduced = Math.round(produced);
  const coveragePercent =
    target <= 0 ? 0 : Math.min(100, Math.round((roundedProduced / target) * 100));

  return {
    produced: roundedProduced,
    target,
    unit,
    coveragePercent,
  };
}

export interface NutritionCalcInput {
  zones: CropZone[];
  resources: ResourceState;
  crewSize: number;
  missionDurationTotal: number;
  missionDay: number;
  previousScore?: number;
}

export function calculateNutrition(input: NutritionCalcInput): NutritionStatus {
  const {
    zones,
    crewSize,
    missionDurationTotal,
    missionDay,
    previousScore,
  } = input;

  const dailyCaloriesTarget = crewSize * 3000;
  const dailyProteinTarget = crewSize * 112.5;
  let totalDailyCalories = 0;
  let totalDailyProtein = 0;
  const producedMicronutrients: MicronutrientDensity = { ...ZERO_MICRONUTRIENTS };

  for (const zone of zones) {
    if (zone.status === "offline") {
      continue;
    }

    const profile = CROP_PROFILES[zone.cropType];
    if (!profile) {
      continue;
    }

    const dailyOutputKg = zone.projectedYieldKg / Math.max(1, zone.growthCycleTotal);
    const effectiveKg = dailyOutputKg;
    const effectiveHundredGrams = effectiveKg * 10;

    totalDailyCalories += effectiveHundredGrams * profile.kcalPer100g;
    totalDailyProtein += effectiveHundredGrams * profile.proteinPer100g;

    const micronutrientDensity = MICRONUTRIENT_DENSITY_PER_100G[zone.cropType];
    for (const definition of MICRONUTRIENT_DEFINITIONS) {
      producedMicronutrients[definition.key] +=
        effectiveHundredGrams * micronutrientDensity[definition.key];
    }
  }

  const dailyCaloriesProduced = Math.round(totalDailyCalories);
  const dailyProteinG = Math.round(totalDailyProtein);
  const caloricCoveragePercent = Math.min(
    100,
    Math.round((dailyCaloriesProduced / dailyCaloriesTarget) * 100),
  );
  const proteinCoveragePercent = Math.min(
    100,
    Math.round((dailyProteinG / dailyProteinTarget) * 100),
  );

  const micronutrientStatuses = Object.fromEntries(
    MICRONUTRIENT_DEFINITIONS.map((definition) => {
      return [
        definition.key,
        buildMicronutrientStatus({
          produced: producedMicronutrients[definition.key],
          target: definition.target,
          unit: definition.unit,
        }),
      ];
    }),
  ) as Record<MicronutrientKey, MicronutrientStatus>;

  const micronutrientAverageCoverage = Math.round(
    MICRONUTRIENT_DEFINITIONS.reduce((total, definition) => {
      return total + micronutrientStatuses[definition.key].coveragePercent;
    }, 0) / MICRONUTRIENT_DEFINITIONS.length,
  );

  const nutritionalCoverageScore = Math.round(
    0.5 * caloricCoveragePercent +
      0.3 * proteinCoveragePercent +
      0.2 * micronutrientAverageCoverage,
  );

  const remainingDays = Math.max(0, missionDurationTotal - missionDay);
  const daysSafe = Math.max(
    0,
    Math.round(remainingDays * (nutritionalCoverageScore / 100)),
  );

  let trend: NutritionTrend = "stable";
  if (previousScore !== undefined) {
    const delta = nutritionalCoverageScore - previousScore;
    if (delta >= 2) {
      trend = "improving";
    } else if (delta <= -2) {
      trend = "declining";
    }
  }

  return {
    dailyCaloriesProduced,
    dailyCaloriesTarget,
    caloricCoveragePercent,
    dailyProteinG,
    dailyProteinTarget,
    proteinCoveragePercent,
    vitaminA: micronutrientStatuses.vitaminA,
    vitaminC: micronutrientStatuses.vitaminC,
    vitaminK: micronutrientStatuses.vitaminK,
    folate: micronutrientStatuses.folate,
    iron: micronutrientStatuses.iron,
    potassium: micronutrientStatuses.potassium,
    magnesium: micronutrientStatuses.magnesium,
    nutritionalCoverageScore,
    daysSafe,
    trend,
  };
}
