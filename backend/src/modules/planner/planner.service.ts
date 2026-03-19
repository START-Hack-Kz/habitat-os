import {
  buildMissionSnapshot,
  getCurrentMissionSnapshot,
} from "../mission/mission.service";
import type {
  CropType,
  MissionState,
  StressSeverity,
} from "../mission/mission.types";
import type {
  PlannerAction,
  PlannerOutput,
} from "./planner.types";

const NUTRITION_PRESERVATION_SCORE_THRESHOLD = 70;
const NUTRITION_PRESERVATION_DAYS_THRESHOLD = 30;

const CROP_PRIORITY: Record<CropType, number> = {
  potato: 1,
  beans: 2,
  lettuce: 3,
  radish: 4,
};

const STRESS_ORDER: StressSeverity[] = [
  "none",
  "low",
  "moderate",
  "high",
  "critical",
];

function cloneMissionState(state: MissionState): MissionState {
  return structuredClone(state);
}

function roundToSingleDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function shouldEnterNutritionPreservationMode(state: MissionState): boolean {
  return (
    state.nutrition.nutritionalCoverageScore < NUTRITION_PRESERVATION_SCORE_THRESHOLD ||
    state.nutrition.daysSafe < NUTRITION_PRESERVATION_DAYS_THRESHOLD
  );
}

function getPrioritySortedZones(state: MissionState, descending = false) {
  return [...state.zones]
    .filter((zone) => zone.status !== "offline")
    .sort((left, right) => {
      const leftRank = CROP_PRIORITY[left.cropType];
      const rightRank = CROP_PRIORITY[right.cropType];
      return descending ? rightRank - leftRank : leftRank - rightRank;
    });
}

function stepStressSeverity(
  currentSeverity: StressSeverity,
  direction: "up" | "down",
): StressSeverity {
  const index = STRESS_ORDER.indexOf(currentSeverity);
  const safeIndex = index === -1 ? 0 : index;
  const nextIndex =
    direction === "up"
      ? Math.min(STRESS_ORDER.length - 1, safeIndex + 1)
      : Math.max(0, safeIndex - 1);

  return STRESS_ORDER[nextIndex];
}

function deriveZoneStatus(severity: StressSeverity) {
  if (severity === "critical") {
    return "critical" as const;
  }

  if (severity === "none") {
    return "healthy" as const;
  }

  return "stressed" as const;
}

function applyYieldShift(state: MissionState, zoneId: string, factor: number): void {
  state.zones = state.zones.map((zone) =>
    zone.zoneId === zoneId
      ? {
          ...zone,
          projectedYieldKg: roundToSingleDecimal(Math.max(0, zone.projectedYieldKg * factor)),
        }
      : zone,
  );
}

function applyStressShift(
  state: MissionState,
  zoneId: string,
  direction: "up" | "down",
  stressType: "water_stress" | "energy_pressure" | "temperature_drift",
  summary: string,
): void {
  state.zones = state.zones.map((zone) => {
    if (zone.zoneId !== zoneId) {
      return zone;
    }

    const severity = stepStressSeverity(zone.stress.severity, direction);
    return {
      ...zone,
      status: deriveZoneStatus(severity),
      stress: {
        ...zone.stress,
        active: severity !== "none",
        type: severity === "none" ? "none" : stressType,
        severity,
        summary,
      },
    };
  });
}

function shiftAllocation(
  state: MissionState,
  fromZoneId: string,
  toZoneId: string,
  amount: number,
): void {
  let freed = 0;

  state.zones = state.zones.map((zone) => {
    if (zone.zoneId === fromZoneId) {
      const nextAllocation = Math.max(0, zone.allocationPercent - amount);
      freed = zone.allocationPercent - nextAllocation;
      return {
        ...zone,
        allocationPercent: nextAllocation,
      };
    }

    return zone;
  });

  state.zones = state.zones.map((zone) =>
    zone.zoneId === toZoneId
      ? {
          ...zone,
          allocationPercent: Math.min(100, zone.allocationPercent + freed),
        }
      : zone,
  );
}

function findLowestPriorityZone(state: MissionState): MissionState["zones"][number] | undefined {
  return getPrioritySortedZones(state, true)[0];
}

function findHighestPriorityZone(state: MissionState): MissionState["zones"][number] | undefined {
  return getPrioritySortedZones(state, false)[0];
}

function findSecondaryPriorityZone(state: MissionState): MissionState["zones"][number] | undefined {
  return getPrioritySortedZones(state, false)[1];
}

function applyReallocateWaterAction(state: MissionState): PlannerAction | null {
  const donor = findLowestPriorityZone(state);
  const primary = findHighestPriorityZone(state);
  const secondary = findSecondaryPriorityZone(state);

  if (!donor || !primary || donor.zoneId === primary.zoneId) {
    return null;
  }

  shiftAllocation(state, donor.zoneId, primary.zoneId, 15);
  applyYieldShift(state, donor.zoneId, 0.82);
  applyStressShift(
    state,
    donor.zoneId,
    "up",
    "water_stress",
    "Planner reduced support to protect crew nutrition continuity.",
  );

  applyYieldShift(state, primary.zoneId, 1.08);
  applyStressShift(
    state,
    primary.zoneId,
    "down",
    "water_stress",
    "Planner protected the highest-priority calorie crop.",
  );

  if (secondary && secondary.zoneId !== donor.zoneId && secondary.zoneId !== primary.zoneId) {
    shiftAllocation(state, donor.zoneId, secondary.zoneId, 5);
    applyYieldShift(state, secondary.zoneId, 1.05);
    applyStressShift(
      state,
      secondary.zoneId,
      "down",
      "water_stress",
      "Planner protected the secondary protein crop.",
    );
  }

  return {
    type: "reallocate_water",
    description: `Shift water support away from ${donor.name} toward ${primary.name}${secondary ? ` and ${secondary.name}` : ""}.`,
    reason: "Protect calories first, then protein, while accepting controlled cuts to lower-priority crops.",
  };
}

function applyReduceLightingAction(state: MissionState): PlannerAction | null {
  const donor = findLowestPriorityZone(state);
  if (!donor) {
    return null;
  }

  applyYieldShift(state, donor.zoneId, 0.8);
  applyStressShift(
    state,
    donor.zoneId,
    "up",
    "energy_pressure",
    "Planner reduced lighting on a lower-priority zone to preserve critical loads.",
  );

  return {
    type: "reduce_lighting",
    targetZoneId: donor.zoneId,
    description: `Reduce lighting intensity for ${donor.name}.`,
    reason: "Preserve energy for higher-priority nutrition zones during scarcity.",
  };
}

function applyAdjustTemperatureAction(state: MissionState): PlannerAction | null {
  let changed = false;

  state.zones = state.zones.map((zone) => {
    if (zone.stress.type !== "temperature_drift" && zone.stress.severity === "none") {
      return zone;
    }

    const nextSeverity = stepStressSeverity(zone.stress.severity, "down");
    if (nextSeverity !== zone.stress.severity) {
      changed = true;
    }

    return {
      ...zone,
      status: deriveZoneStatus(nextSeverity),
      stress: {
        ...zone.stress,
        active: nextSeverity !== "none",
        type: nextSeverity === "none" ? "none" : "temperature_drift",
        severity: nextSeverity,
        summary: "Planner adjusted the greenhouse temperature setpoint toward recovery.",
      },
      projectedYieldKg: roundToSingleDecimal(zone.projectedYieldKg * 1.05),
    };
  });

  if (!changed) {
    return null;
  }

  return {
    type: "adjust_temperature",
    description: "Lower the greenhouse temperature setpoint to relieve heat stress.",
    reason: "Temperature drift is degrading yield, especially for lettuce and potatoes.",
  };
}

function applyFlagZoneOfflineAction(state: MissionState): PlannerAction | null {
  const donor = findLowestPriorityZone(state);
  const primary = findHighestPriorityZone(state);

  if (!donor || !primary || donor.zoneId === primary.zoneId) {
    return null;
  }

  const freedAllocation = donor.allocationPercent;

  state.zones = state.zones.map((zone) => {
    if (zone.zoneId === donor.zoneId) {
      return {
        ...zone,
        allocationPercent: 0,
        projectedYieldKg: 0,
        status: "offline",
        stress: {
          ...zone.stress,
          active: true,
          type: zone.stress.type === "none" ? "water_stress" : zone.stress.type,
          severity: "critical",
          summary: "Planner flagged this lower-priority zone offline to protect crew nutrition continuity.",
        },
      };
    }

    if (zone.zoneId === primary.zoneId) {
      return {
        ...zone,
        allocationPercent: Math.min(100, zone.allocationPercent + freedAllocation),
        projectedYieldKg: roundToSingleDecimal(zone.projectedYieldKg * 1.12),
      };
    }

    return zone;
  });

  applyStressShift(
    state,
    primary.zoneId,
    "down",
    "water_stress",
    "Planner redirected released support into the top-priority crop.",
  );

  return {
    type: "flag_zone_offline",
    targetZoneId: donor.zoneId,
    description: `Flag ${donor.name} offline and redirect support to ${primary.name}.`,
    reason: "Last-resort action to preserve calories and protein when nutrition continuity is at risk.",
  };
}

function buildExplanation(
  before: MissionState,
  after: MissionState,
  actions: PlannerAction[],
): string {
  if (actions.length === 0) {
    return "Nutrition remains above the preservation thresholds, so no deterministic reallocation is recommended.";
  }

  return `Nutrition Preservation Mode is active because the mission nutrition score is ${before.nutrition.nutritionalCoverageScore} with ${before.nutrition.daysSafe} safe days remaining. The planner protects calories first through potatoes, then protein through beans, and accepts controlled cuts to lower-priority crops when necessary. The recommended actions shift support away from lower-priority zones and forecast the nutrition score moving from ${before.nutrition.nutritionalCoverageScore} to ${after.nutrition.nutritionalCoverageScore}.`;
}

export function createNutritionPreservationPlan(
  sourceState: MissionState,
): PlannerOutput {
  const beforeSnapshot = buildMissionSnapshot(sourceState);

  if (!shouldEnterNutritionPreservationMode(beforeSnapshot)) {
    return {
      mode: "normal",
      recommendedActions: [],
      nutritionForecast: {
        before: beforeSnapshot.nutrition,
        after: beforeSnapshot.nutrition,
      },
      explanation:
        "Nutrition remains above the preservation thresholds, so the backend keeps the mission in normal mode with no deterministic reallocation actions.",
    };
  }

  const afterState = cloneMissionState(beforeSnapshot);
  afterState.status = "nutrition_preservation_mode";
  const actions: PlannerAction[] = [];
  const activeScenarioType = beforeSnapshot.activeScenario?.type ?? null;

  const primaryAction =
    activeScenarioType === "energy_budget_reduction"
      ? applyReduceLightingAction(afterState)
      : activeScenarioType === "temperature_control_failure"
        ? applyAdjustTemperatureAction(afterState)
        : applyReallocateWaterAction(afterState);

  if (primaryAction) {
    actions.push(primaryAction);
  }

  if (
    beforeSnapshot.nutrition.nutritionalCoverageScore < 55 ||
    beforeSnapshot.nutrition.daysSafe < 20
  ) {
    const lastResortAction = applyFlagZoneOfflineAction(afterState);
    if (lastResortAction) {
      actions.push(lastResortAction);
    }
  }

  if (actions.length < 3 && activeScenarioType !== "water_recycling_decline") {
    const waterAction = applyReallocateWaterAction(afterState);
    if (waterAction) {
      actions.push(waterAction);
    }
  }

  const recommendedActions = actions.slice(0, 3);
  const afterSnapshot = buildMissionSnapshot(afterState);

  return {
    mode: "nutrition_preservation",
    recommendedActions,
    nutritionForecast: {
      before: beforeSnapshot.nutrition,
      after: afterSnapshot.nutrition,
    },
    explanation: buildExplanation(beforeSnapshot, afterSnapshot, recommendedActions),
  };
}

export function getCurrentNutritionPreservationPlan(): PlannerOutput {
  return createNutritionPreservationPlan(getCurrentMissionSnapshot());
}
