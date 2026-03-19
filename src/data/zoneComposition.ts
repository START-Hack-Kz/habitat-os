import type { BackendCropType, CropNutrientSlice } from "../types";

export interface ZoneCompositionSlice extends CropNutrientSlice {
  detail: string;
}

export interface ZoneCompositionProfile {
  slices: ZoneCompositionSlice[];
  note: string;
}

const ZONE_COMPOSITION: Record<BackendCropType, ZoneCompositionProfile> = {
  lettuce: {
    slices: [
      { label: "Vitamin A", value: 34, color: "var(--nom)", detail: "Leaf micronutrient bias" },
      { label: "Vitamin K", value: 26, color: "var(--aero-blue)", detail: "Crew resilience support" },
      { label: "Folate", value: 18, color: "var(--cau)", detail: "Cell repair buffer" },
      { label: "Fiber", value: 12, color: "var(--mars-orange)", detail: "Digestive support" },
      { label: "Hydration", value: 10, color: "var(--chrome-hi)", detail: "Water-rich edible mass" },
    ],
    note: "Primary nutrient contribution: Vitamin A",
  },
  potato: {
    slices: [
      { label: "Potassium", value: 34, color: "var(--nom)", detail: "Electrolyte backbone" },
      { label: "Calories", value: 28, color: "var(--aero-blue)", detail: "Mission energy reserve" },
      { label: "Vitamin C", value: 16, color: "var(--cau)", detail: "Immune support buffer" },
      { label: "Fiber", value: 12, color: "var(--mars-orange)", detail: "Digestive support" },
      { label: "Iron", value: 10, color: "var(--chrome-hi)", detail: "Trace mineral support" },
    ],
    note: "Primary nutrient contribution: Potassium",
  },
  beans: {
    slices: [
      { label: "Protein", value: 36, color: "var(--nom)", detail: "Crew protein security" },
      { label: "Iron", value: 22, color: "var(--aero-blue)", detail: "Oxygen transport support" },
      { label: "Folate", value: 18, color: "var(--cau)", detail: "Repair and synthesis support" },
      { label: "Fiber", value: 14, color: "var(--mars-orange)", detail: "Digestive resilience" },
      { label: "Magnesium", value: 10, color: "var(--chrome-hi)", detail: "Metabolic balance" },
    ],
    note: "Primary nutrient contribution: Protein",
  },
  radish: {
    slices: [
      { label: "Vitamin C", value: 30, color: "var(--nom)", detail: "Fast-response micronutrient buffer" },
      { label: "Hydration", value: 24, color: "var(--aero-blue)", detail: "Water-rich edible mass" },
      { label: "Folate", value: 18, color: "var(--cau)", detail: "Repair support" },
      { label: "Potassium", value: 16, color: "var(--mars-orange)", detail: "Electrolyte support" },
      { label: "Fiber", value: 12, color: "var(--chrome-hi)", detail: "Digestive support" },
    ],
    note: "Primary nutrient contribution: Vitamin C",
  },
};

export function getZoneCompositionProfile(cropType: BackendCropType): ZoneCompositionProfile {
  return ZONE_COMPOSITION[cropType];
}
