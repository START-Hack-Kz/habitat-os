// CropProfile — static knowledge-base-derived data for each crop type.
// These are constants, not simulation state. Loaded once at startup.
// Source: Mars Greenhouse KB (Bedrock)

export type CropCategory = "leafy_green" | "root_tuber" | "legume" | "herb";
export type WaterDemand = "high" | "moderate" | "low";
export type NutrientSensitivity = "high" | "moderate" | "low";
export type CO2Benefit = "strong" | "moderate" | "low";
export type MissionRole = "micronutrient_stabilizer" | "caloric_backbone" | "protein_security" | "fast_buffer" | "morale";

export interface CropProfile {
  cropId: string;                       // matches CropType enum
  label: string;                        // display name
  scientificName: string;
  category: CropCategory;
  missionRole: MissionRole;

  // Growth
  growthCycleMin: number;               // days
  growthCycleMax: number;               // days
  harvestIndexMin: number;              // fraction of biomass that's edible
  harvestIndexMax: number;
  yieldMin: number;                     // kg/m²/cycle
  yieldMax: number;

  // Environmental thresholds
  tempOptimalMin: number;               // °C
  tempOptimalMax: number;               // °C
  tempHeatStressThreshold: number;      // °C — above this, stress begins
  humidityOptimalMin: number;           // %
  humidityOptimalMax: number;           // %
  lightPARMin: number;                  // µmol/m²/s
  lightPARMax: number;
  co2Benefit: CO2Benefit;
  nutrientPhMin: number;
  nutrientPhMax: number;

  // Resource demands
  waterDemand: WaterDemand;
  nitrogenSensitivity: NutrientSensitivity;

  // Nutritional output (per 100g fresh weight)
  kcalPer100g: number;
  proteinPer100g: number;               // g
  vitamins: string[];                   // e.g. ["vitamin_k", "vitamin_a", "folate"]

  // Stress sensitivities (for simulation logic)
  stressSensitivities: {
    heat: NutrientSensitivity;
    waterDeficit: NutrientSensitivity;
    nitrogenDeficiency: NutrientSensitivity;
    salinity: NutrientSensitivity;
    lightDeficit: NutrientSensitivity;
  };
}
