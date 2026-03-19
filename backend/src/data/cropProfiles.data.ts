/**
 * cropProfiles.data.ts
 * Static crop profile data for the Mars Greenhouse MVP.
 * All environmental ranges, yield figures, and nutritional values are
 * grounded in the Mars Crop Knowledge Base (MCP) unless marked [APPROX].
 */

export type CropId = "lettuce" | "potato" | "beans" | "radish";
export type MissionRole =
  | "micronutrient_stabilizer"
  | "caloric_backbone"
  | "protein_security"
  | "fast_buffer";
export type WaterDemand = "high" | "moderate" | "low";
export type StressSensitivity = "high" | "moderate" | "low";

export interface CropEnvironmentRange {
  tempOptimalMinC: number;       // MCP-grounded
  tempOptimalMaxC: number;       // MCP-grounded
  tempHeatStressAboveC: number;  // MCP-grounded
  humidityOptimalMinPct: number; // MCP-grounded
  humidityOptimalMaxPct: number; // MCP-grounded
  lightPARMinUmol: number;       // MCP-grounded
  lightPARMaxUmol: number;       // MCP-grounded
  co2OptimalMinPpm: number;      // MCP-grounded (800–1200 ppm for C3 plants)
  co2OptimalMaxPpm: number;      // MCP-grounded
  nutrientPhMin: number;         // MCP-grounded
  nutrientPhMax: number;         // MCP-grounded
}

export interface CropNutrition {
  kcalPer100g: number;           // MCP-grounded
  proteinPer100gG: number;       // MCP-grounded
  primaryMicronutrients: string[]; // MCP-grounded (crop-to-nutrient mapping)
}

export interface CropStressSensitivities {
  heat: StressSensitivity;       // MCP-grounded
  waterDeficit: StressSensitivity; // MCP-grounded
  nitrogenDeficiency: StressSensitivity; // MCP-grounded
  salinity: StressSensitivity;   // MCP-grounded
}

export interface CropProfile {
  cropId: CropId;
  label: string;
  scientificName: string;
  missionRole: MissionRole;
  // Growth — MCP-grounded
  growthCycleMinDays: number;
  growthCycleMaxDays: number;
  harvestIndexMin: number;       // fraction of biomass that is edible
  harvestIndexMax: number;
  yieldMinKgPerM2: number;
  yieldMaxKgPerM2: number;
  waterDemand: WaterDemand;
  // Environment thresholds — MCP-grounded
  environment: CropEnvironmentRange;
  // Nutritional output — MCP-grounded
  nutrition: CropNutrition;
  // Stress sensitivities — MCP-grounded
  stress: CropStressSensitivities;
  // Short note on why this crop matters for the mission
  missionNote: string;
}

// ─────────────────────────────────────────────────────────────────────────────

export const CROP_PROFILES: Record<CropId, CropProfile> = {
  lettuce: {
    cropId: "lettuce",
    label: "Lettuce",
    scientificName: "Lactuca sativa",
    missionRole: "micronutrient_stabilizer",
    // MCP: growth cycle 30–45 days, harvest index 0.7–0.9, yield 3–5 kg/m²
    growthCycleMinDays: 30,
    growthCycleMaxDays: 45,
    harvestIndexMin: 0.7,
    harvestIndexMax: 0.9,
    yieldMinKgPerM2: 3,
    yieldMaxKgPerM2: 5,
    waterDemand: "high", // MCP: high water demand, ~95% tissue water content
    environment: {
      tempOptimalMinC: 15,       // MCP
      tempOptimalMaxC: 22,       // MCP
      tempHeatStressAboveC: 25,  // MCP: bolting risk above 25°C
      humidityOptimalMinPct: 50, // MCP
      humidityOptimalMaxPct: 70, // MCP
      lightPARMinUmol: 150,      // MCP
      lightPARMaxUmol: 250,      // MCP
      co2OptimalMinPpm: 800,     // MCP: 800–1200 ppm for C3 plants
      co2OptimalMaxPpm: 1200,    // MCP
      nutrientPhMin: 5.5,        // MCP
      nutrientPhMax: 6.5,        // MCP
    },
    nutrition: {
      kcalPer100g: 15,           // MCP
      proteinPer100gG: 1.4,      // MCP
      primaryMicronutrients: ["vitamin_k", "vitamin_a", "folate"], // MCP
    },
    stress: {
      heat: "high",              // MCP: high sensitivity
      waterDeficit: "high",      // MCP: high sensitivity
      nitrogenDeficiency: "high", // MCP: nitrogen-sensitive crop
      salinity: "moderate",      // MCP: moderate sensitivity
    },
    missionNote:
      "Primary micronutrient source. Fast cycle enables rapid nutritional correction. Low caloric value — deprioritise under caloric crisis.",
  },

  potato: {
    cropId: "potato",
    label: "Potato",
    scientificName: "Solanum tuberosum",
    missionRole: "caloric_backbone",
    // MCP: growth cycle 70–120 days, harvest index ~0.75, yield 4–8 kg/m²
    growthCycleMinDays: 70,
    growthCycleMaxDays: 120,
    harvestIndexMin: 0.75,
    harvestIndexMax: 0.75,
    yieldMinKgPerM2: 4,
    yieldMaxKgPerM2: 8,
    waterDemand: "moderate", // MCP: moderate to high; sensitive to waterlogging
    environment: {
      tempOptimalMinC: 16,       // MCP
      tempOptimalMaxC: 20,       // MCP
      tempHeatStressAboveC: 26,  // MCP: 25–28°C; using midpoint [APPROX]
      humidityOptimalMinPct: 60, // [APPROX] — MCP does not specify; reasonable for tuber crop
      humidityOptimalMaxPct: 80, // [APPROX]
      lightPARMinUmol: 200,      // MCP
      lightPARMaxUmol: 400,      // MCP
      co2OptimalMinPpm: 800,     // MCP
      co2OptimalMaxPpm: 1200,    // MCP
      nutrientPhMin: 5.5,        // MCP
      nutrientPhMax: 6.0,        // MCP
    },
    nutrition: {
      kcalPer100g: 77,           // MCP
      proteinPer100gG: 2.0,      // MCP
      primaryMicronutrients: ["potassium", "vitamin_c"], // MCP
    },
    stress: {
      heat: "moderate",          // MCP: moderate sensitivity
      waterDeficit: "moderate",  // MCP: moderate to high; using moderate [APPROX]
      nitrogenDeficiency: "moderate", // MCP: moderate nitrogen demand [APPROX]
      salinity: "moderate",      // [APPROX] — not explicitly stated in MCP
    },
    missionNote:
      "Caloric backbone — 77 kcal/100g, highest yield per m². Longest growth cycle. Protect at all costs under resource failure.",
  },

  beans: {
    cropId: "beans",
    label: "Beans",
    scientificName: "Phaseolus vulgaris",
    missionRole: "protein_security",
    // MCP: growth cycle 50–70 days, harvest index 0.5–0.6, yield 2–4 kg/m²
    growthCycleMinDays: 50,
    growthCycleMaxDays: 70,
    harvestIndexMin: 0.5,
    harvestIndexMax: 0.6,
    yieldMinKgPerM2: 2,
    yieldMaxKgPerM2: 4,
    waterDemand: "moderate", // MCP: moderate water need
    environment: {
      tempOptimalMinC: 18,       // MCP
      tempOptimalMaxC: 25,       // MCP
      tempHeatStressAboveC: 30,  // MCP
      humidityOptimalMinPct: 55, // [APPROX] — MCP does not specify
      humidityOptimalMaxPct: 75, // [APPROX]
      lightPARMinUmol: 150,      // [APPROX] — MCP says "moderate light requirement"
      lightPARMaxUmol: 300,      // [APPROX]
      co2OptimalMinPpm: 800,     // MCP
      co2OptimalMaxPpm: 1200,    // MCP
      nutrientPhMin: 6.0,        // [APPROX] — MCP notes phosphorus sensitivity; typical legume range
      nutrientPhMax: 7.0,        // [APPROX]
    },
    nutrition: {
      kcalPer100g: 100,          // MCP: 80–120 kcal; using midpoint [APPROX]
      proteinPer100gG: 7.0,      // MCP: 5–9 g; using midpoint [APPROX]
      primaryMicronutrients: ["iron", "magnesium", "folate"], // MCP: legumes supply iron, magnesium
    },
    stress: {
      heat: "moderate",          // MCP: moderate sensitivity
      waterDeficit: "moderate",  // MCP: moderate sensitivity
      nitrogenDeficiency: "low", // MCP: nitrogen fixation capability reduces dependency
      salinity: "moderate",      // MCP: moderate sensitivity
    },
    missionNote:
      "Sole plant-based protein source. 5–9 g protein/100g. Protect bean zone to prevent protein deficit.",
  },

  radish: {
    cropId: "radish",
    label: "Radish",
    scientificName: "Raphanus sativus",
    missionRole: "fast_buffer",
    // MCP: growth cycle 21–30 days, harvest index 0.6–0.8, yield 2–4 kg/m²
    growthCycleMinDays: 21,
    growthCycleMaxDays: 30,
    harvestIndexMin: 0.6,
    harvestIndexMax: 0.8,
    yieldMinKgPerM2: 2,
    yieldMaxKgPerM2: 4,
    waterDemand: "moderate", // MCP: consistent moisture required
    environment: {
      tempOptimalMinC: 15,       // MCP
      tempOptimalMaxC: 22,       // MCP
      tempHeatStressAboveC: 26,  // MCP
      humidityOptimalMinPct: 50, // [APPROX] — MCP does not specify; similar to lettuce
      humidityOptimalMaxPct: 70, // [APPROX]
      lightPARMinUmol: 120,      // [APPROX] — MCP says "moderate light requirement"
      lightPARMaxUmol: 250,      // [APPROX]
      co2OptimalMinPpm: 800,     // MCP
      co2OptimalMaxPpm: 1200,    // MCP
      nutrientPhMin: 5.8,        // [APPROX] — typical root vegetable range
      nutrientPhMax: 6.8,        // [APPROX]
    },
    nutrition: {
      kcalPer100g: 16,           // MCP
      proteinPer100gG: 0.7,      // [APPROX] — MCP does not specify; low protein typical for root veg
      primaryMicronutrients: ["vitamin_c"], // MCP
    },
    stress: {
      heat: "moderate",          // MCP: moderate sensitivity
      waterDeficit: "high",      // MCP: high sensitivity to water inconsistency
      nitrogenDeficiency: "moderate", // MCP: moderate nitrogen demand [APPROX]
      salinity: "moderate",      // [APPROX]
    },
    missionNote:
      "Fastest cycle (21–30 days). Acts as system feedback crop and short-term yield buffer. Low caloric value — deprioritise under resource pressure.",
  },
};
