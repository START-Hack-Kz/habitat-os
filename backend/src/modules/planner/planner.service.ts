import { CROP_PROFILES } from "../../data/cropProfiles.data";
import {
  buildMissionSnapshot,
  getCurrentMissionSnapshot,
} from "../mission/mission.service";
import {
  createPlannerOutput,
} from "../mission/mission.monitoring";
import type {
  CropType,
  MissionState,
  StressSeverity,
  StressType,
} from "../mission/mission.types";
import type {
  PlannerAction,
  PlannerExecution,
  PlannerMode,
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToSingleDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function shouldEnterNutritionPreservationMode(state: MissionState): boolean {
  const malfunctionZoneId =
    state.activeScenario?.scenarioType === "single_zone_control_failure"
      ? state.activeScenario.affectedZones[0]
      : null;
  const malfunctionZone = malfunctionZoneId
    ? state.zones.find((zone) => zone.zoneId === malfunctionZoneId)
    : undefined;

  if (
    state.activeScenario?.scenarioType === "single_zone_control_failure" &&
    malfunctionZone &&
    (state.activeScenario.severity !== "mild" ||
      malfunctionZone.status === "critical" ||
      malfunctionZone.status === "offline")
  ) {
    return true;
  }

  if (
    state.activeScenario &&
    (
      state.activeScenario.severity === "critical" ||
      (
        (state.activeScenario.scenarioType === "water_recycling_decline" ||
          state.activeScenario.scenarioType === "energy_budget_reduction") &&
        state.activeScenario.severity === "moderate"
      )
    )
  ) {
    return true;
  }

  return (
    state.nutrition.nutritionalCoverageScore < NUTRITION_PRESERVATION_SCORE_THRESHOLD ||
    state.nutrition.daysSafe < NUTRITION_PRESERVATION_DAYS_THRESHOLD
  );
}

function describeZone(zone: MissionState["zones"][number]): string {
  return `${zone.zoneId} (${CROP_PROFILES[zone.cropType].label})`;
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

function applyStressShift(input: {
  state: MissionState;
  zoneId: string;
  direction: "up" | "down";
  stressType: StressType;
}): void {
  const { state, zoneId, direction, stressType } = input;

  state.zones = state.zones.map((zone) => {
    if (zone.zoneId !== zoneId || zone.status === "offline") {
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
      },
    };
  });
}

function shiftAllocation(
  state: MissionState,
  fromZoneId: string,
  toZoneId: string,
  amount: number,
): number {
  let freed = 0;

  state.zones = state.zones.map((zone) => {
    if (zone.zoneId === fromZoneId) {
      const nextAllocation = roundToSingleDecimal(
        clamp(zone.allocationPercent - amount, 0, 100),
      );
      freed = roundToSingleDecimal(zone.allocationPercent - nextAllocation);
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
          allocationPercent: roundToSingleDecimal(
            clamp(zone.allocationPercent + freed, 0, 100),
          ),
        }
      : zone,
  );

  return freed;
}

function adjustZoneSensors(input: {
  state: MissionState;
  zoneId: string;
  soilMoistureDelta?: number;
  lightParDelta?: number;
  photoperiodDelta?: number;
  temperatureDelta?: number;
}): void {
  const {
    state,
    zoneId,
    soilMoistureDelta = 0,
    lightParDelta = 0,
    photoperiodDelta = 0,
    temperatureDelta = 0,
  } = input;

  state.zones = state.zones.map((zone) => {
    if (zone.zoneId !== zoneId) {
      return zone;
    }

    return {
      ...zone,
      sensors: {
        ...zone.sensors,
        soilMoisture: roundToSingleDecimal(
          clamp(zone.sensors.soilMoisture + soilMoistureDelta, 0, 100),
        ),
        lightPAR: roundToSingleDecimal(
          clamp(zone.sensors.lightPAR + lightParDelta, 0, 1200),
        ),
        photoperiodHours: roundToSingleDecimal(
          clamp(zone.sensors.photoperiodHours + photoperiodDelta, 0, 24),
        ),
        temperature: roundToSingleDecimal(
          clamp(zone.sensors.temperature + temperatureDelta, -10, 45),
        ),
      },
    };
  });
}

function buildActionId(state: MissionState, index: number): string {
  return `act-${state.missionDay}-${String(index).padStart(2, "0")}`;
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

function getPriorityRecipients(
  state: MissionState,
  excludedZoneId: string,
): MissionState["zones"] {
  return getPrioritySortedZones(state, false).filter((zone) => zone.zoneId !== excludedZoneId);
}

function applyReallocateWaterAction(
  state: MissionState,
  index: number,
): PlannerAction | null {
  const donor = findLowestPriorityZone(state);
  const primary = findHighestPriorityZone(state);
  const secondary = findSecondaryPriorityZone(state);

  if (!donor || !primary || donor.zoneId === primary.zoneId) {
    return null;
  }

  const donorStart = donor.allocationPercent;
  const primaryStart = primary.allocationPercent;
  shiftAllocation(state, donor.zoneId, primary.zoneId, 10);
  let freedSecondary = 0;

  if (secondary && secondary.zoneId !== donor.zoneId && secondary.zoneId !== primary.zoneId) {
    freedSecondary = shiftAllocation(state, donor.zoneId, secondary.zoneId, 5);
  }

  applyYieldShift(state, donor.zoneId, 0.82);
  applyStressShift({
    state,
    zoneId: donor.zoneId,
    direction: "up",
    stressType: "water_deficit",
  });
  adjustZoneSensors({
    state,
    zoneId: donor.zoneId,
    soilMoistureDelta: -15,
  });

  applyYieldShift(state, primary.zoneId, 1.08);
  applyStressShift({
    state,
    zoneId: primary.zoneId,
    direction: "down",
    stressType: "water_deficit",
  });
  adjustZoneSensors({
    state,
    zoneId: primary.zoneId,
    soilMoistureDelta: 28,
  });

  if (secondary && freedSecondary > 0) {
    applyYieldShift(state, secondary.zoneId, 1.05);
    applyStressShift({
      state,
      zoneId: secondary.zoneId,
      direction: "down",
      stressType: "water_deficit",
    });
    adjustZoneSensors({
      state,
      zoneId: secondary.zoneId,
      soilMoistureDelta: 10,
    });
  }

  const refreshedPrimary = state.zones.find((zone) => zone.zoneId === primary.zoneId);
  const refreshedDonor = state.zones.find((zone) => zone.zoneId === donor.zoneId);
  const refreshedSecondary = secondary
    ? state.zones.find((zone) => zone.zoneId === secondary.zoneId)
    : undefined;

  const parameterChanges: Record<string, number> = {
    [`${donor.zoneId}.allocationPercent`]: refreshedDonor?.allocationPercent ?? donorStart,
    [`${primary.zoneId}.allocationPercent`]:
      refreshedPrimary?.allocationPercent ?? primaryStart,
  };

  if (secondary && refreshedSecondary) {
    parameterChanges[`${secondary.zoneId}.allocationPercent`] =
      refreshedSecondary.allocationPercent;
  }

  return {
    actionId: buildActionId(state, index),
    actionType: "reallocate_water",
    urgency: "immediate",
    description: `Reduce shared water support to ${describeZone(donor)} and redirect it toward ${describeZone(primary)}${secondary ? ` and ${describeZone(secondary)}` : ""}.`,
    parameterChanges,
    nutritionImpact:
      "Protects the caloric backbone first and the protein crop second under water scarcity.",
    tradeoff: `${describeZone(donor)} will accept lower soil moisture and slower growth.`,
  };
}

function applyReduceLightingAction(
  state: MissionState,
  index: number,
): PlannerAction | null {
  const donor = findLowestPriorityZone(state);

  if (!donor) {
    return null;
  }

  applyYieldShift(state, donor.zoneId, 0.8);
  applyStressShift({
    state,
    zoneId: donor.zoneId,
    direction: "up",
    stressType: "light_deficit",
  });
  adjustZoneSensors({
    state,
    zoneId: donor.zoneId,
    lightParDelta: -40,
    photoperiodDelta: -2,
    temperatureDelta: -0.5,
  });

  const refreshed = state.zones.find((zone) => zone.zoneId === donor.zoneId);

  return {
    actionId: buildActionId(state, index),
    actionType: "reduce_lighting",
    urgency: "within_24h",
    targetZoneId: donor.zoneId,
    description: `Reduce LED intensity and photoperiod in ${describeZone(donor)}.`,
    parameterChanges: {
      [`${donor.zoneId}.sensors.lightPAR`]: refreshed?.sensors.lightPAR ?? donor.sensors.lightPAR,
      [`${donor.zoneId}.sensors.photoperiodHours`]:
        refreshed?.sensors.photoperiodHours ?? donor.sensors.photoperiodHours,
    },
    nutritionImpact: "Preserves energy availability for higher-priority zones without pausing the crop outright.",
    tradeoff: `${describeZone(donor)} will experience slower growth and lower projected yield.`,
  };
}

function applyAdjustTemperatureAction(
  state: MissionState,
  index: number,
): PlannerAction | null {
  const heatZones = state.zones.filter((zone) => {
    return zone.stress.type === "heat" || zone.sensors.temperature >= CROP_PROFILES[zone.cropType].tempHeatStressThreshold;
  });

  if (heatZones.length === 0) {
    return null;
  }

  for (const zone of heatZones) {
    adjustZoneSensors({
      state,
      zoneId: zone.zoneId,
      temperatureDelta: -3,
    });
    applyYieldShift(state, zone.zoneId, 1.05);
    applyStressShift({
      state,
      zoneId: zone.zoneId,
      direction: "down",
      stressType: "heat",
    });
  }

  return {
    actionId: buildActionId(state, index),
    actionType: "adjust_temperature_setpoint",
    urgency: "immediate",
    description: "Lower the greenhouse temperature setpoint to relieve heat stress across affected zones.",
    parameterChanges: Object.fromEntries(
      heatZones.map((zone) => {
        const refreshed = state.zones.find((entry) => entry.zoneId === zone.zoneId);
        return [`${zone.zoneId}.sensors.temperature`, refreshed?.sensors.temperature ?? zone.sensors.temperature];
      }),
    ),
    nutritionImpact: "Recovers projected yield in heat-sensitive crops, especially lettuce and potatoes.",
    tradeoff: "Temperature recovery consumes scarce climate-control margin.",
  };
}

function applyPauseZoneAction(
  state: MissionState,
  index: number,
): PlannerAction | null {
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
          type: zone.stress.type === "none" ? "water_deficit" : zone.stress.type,
          severity: "critical",
        },
      };
    }

    if (zone.zoneId === primary.zoneId) {
      return {
        ...zone,
        allocationPercent: roundToSingleDecimal(
          clamp(zone.allocationPercent + freedAllocation, 0, 100),
        ),
        projectedYieldKg: roundToSingleDecimal(zone.projectedYieldKg * 1.12),
      };
    }

    return zone;
  });

  applyStressShift({
    state,
    zoneId: primary.zoneId,
    direction: "down",
    stressType: "water_deficit",
  });
  adjustZoneSensors({
    state,
    zoneId: primary.zoneId,
    soilMoistureDelta: 25,
  });

  const refreshedPrimary = state.zones.find((zone) => zone.zoneId === primary.zoneId);

  return {
    actionId: buildActionId(state, index),
    actionType: "pause_zone",
    urgency: "immediate",
    targetZoneId: donor.zoneId,
    description: `Pause ${describeZone(donor)} and redirect shared support to ${describeZone(primary)}.`,
    parameterChanges: {
      [`${donor.zoneId}.allocationPercent`]: 0,
      [`${primary.zoneId}.allocationPercent`]:
        refreshedPrimary?.allocationPercent ?? primary.allocationPercent,
    },
    nutritionImpact: "Protects calories and protein when continuity is at immediate risk.",
    tradeoff: `${describeZone(donor)} is taken offline and its output is lost until recovery.`,
  };
}

function applyIsolateMalfunctionZoneAction(
  state: MissionState,
  malfunctionZoneId: string,
  index: number,
): PlannerAction | null {
  const targetZone = state.zones.find((zone) => zone.zoneId === malfunctionZoneId);

  if (!targetZone) {
    return null;
  }

  state.zones = state.zones.map((zone) => {
    if (zone.zoneId !== malfunctionZoneId) {
      return zone;
    }

    return {
      ...zone,
      status: "offline",
      projectedYieldKg: 0,
      stress: {
        ...zone.stress,
        active: true,
        type: zone.stress.type === "none" ? "energy_shortage" : zone.stress.type,
        severity: "critical",
      },
      sensors: {
        ...zone.sensors,
        lightPAR: 0,
        photoperiodHours: 0,
        soilMoisture: roundToSingleDecimal(clamp(zone.sensors.soilMoisture - 20, 0, 100)),
      },
    };
  });

  const refreshed = state.zones.find((zone) => zone.zoneId === malfunctionZoneId);

  return {
    actionId: buildActionId(state, index),
    actionType: "pause_zone",
    urgency: "immediate",
    targetZoneId: malfunctionZoneId,
    description: `Isolate ${describeZone(targetZone)} from active production while shared support is redirected.`,
    parameterChanges: {
      [`${malfunctionZoneId}.status`]: refreshed?.status === "offline" ? 1 : 0,
      [`${malfunctionZoneId}.sensors.lightPAR`]:
        refreshed?.sensors.lightPAR ?? targetZone.sensors.lightPAR,
      [`${malfunctionZoneId}.sensors.photoperiodHours`]:
        refreshed?.sensors.photoperiodHours ?? targetZone.sensors.photoperiodHours,
    },
    nutritionImpact:
      "Prevents a failing bay from consuming shared support needed by the remaining food crops.",
    tradeoff: `${describeZone(targetZone)} is taken offline until manual repair restores local controls.`,
  };
}

function applySingleZoneWaterRedistributionAction(
  state: MissionState,
  malfunctionZoneId: string,
  index: number,
): PlannerAction | null {
  const donor = state.zones.find((zone) => zone.zoneId === malfunctionZoneId);
  const recipients = getPriorityRecipients(state, malfunctionZoneId);
  const primary = recipients[0];
  const secondary = recipients[1];

  if (!donor || donor.allocationPercent <= 0 || !primary) {
    return null;
  }

  const primaryShift = roundToSingleDecimal(
    Math.min(donor.allocationPercent, Math.max(8, donor.allocationPercent * 0.6)),
  );
  const primaryFreed = shiftAllocation(state, donor.zoneId, primary.zoneId, primaryShift);

  let secondaryFreed = 0;
  if (secondary) {
    secondaryFreed = shiftAllocation(
      state,
      donor.zoneId,
      secondary.zoneId,
      Math.max(0, donor.allocationPercent - primaryFreed),
    );
  }

  adjustZoneSensors({
    state,
    zoneId: primary.zoneId,
    soilMoistureDelta: 14,
  });
  applyStressShift({
    state,
    zoneId: primary.zoneId,
    direction: "down",
    stressType: "water_deficit",
  });

  if (secondary && secondaryFreed > 0) {
    adjustZoneSensors({
      state,
      zoneId: secondary.zoneId,
      soilMoistureDelta: 9,
    });
    applyStressShift({
      state,
      zoneId: secondary.zoneId,
      direction: "down",
      stressType: "water_deficit",
    });
  }

  const refreshedDonor = state.zones.find((zone) => zone.zoneId === donor.zoneId);
  const refreshedPrimary = state.zones.find((zone) => zone.zoneId === primary.zoneId);
  const refreshedSecondary = secondary
    ? state.zones.find((zone) => zone.zoneId === secondary.zoneId)
    : undefined;

  const parameterChanges: Record<string, number> = {
    [`${donor.zoneId}.allocationPercent`]:
      refreshedDonor?.allocationPercent ?? donor.allocationPercent,
    [`${primary.zoneId}.allocationPercent`]:
      refreshedPrimary?.allocationPercent ?? primary.allocationPercent,
  };

  if (secondary && refreshedSecondary) {
    parameterChanges[`${secondary.zoneId}.allocationPercent`] =
      refreshedSecondary.allocationPercent;
  }

  return {
    actionId: buildActionId(state, index),
    actionType: "reallocate_water",
    urgency: "immediate",
    description: `Redirect shared irrigation from ${describeZone(donor)} toward ${describeZone(primary)}${secondary ? ` and ${describeZone(secondary)}` : ""}.`,
    parameterChanges,
    nutritionImpact:
      "Preserves caloric and protein continuity by restoring moisture support in the surviving priority zones.",
    tradeoff: `${describeZone(donor)} remains dry and unavailable until the control stack is repaired.`,
  };
}

function applySingleZoneEnergyPrioritizationAction(
  state: MissionState,
  malfunctionZoneId: string,
  index: number,
): PlannerAction | null {
  const recipients = getPriorityRecipients(state, malfunctionZoneId);
  const primary = recipients[0];
  const secondary = recipients[1];

  if (!primary) {
    return null;
  }

  adjustZoneSensors({
    state,
    zoneId: primary.zoneId,
    lightParDelta: 36,
    photoperiodDelta: 1.2,
    temperatureDelta: -0.5,
  });
  applyStressShift({
    state,
    zoneId: primary.zoneId,
    direction: "down",
    stressType: "light_deficit",
  });

  if (secondary) {
    adjustZoneSensors({
      state,
      zoneId: secondary.zoneId,
      lightParDelta: 22,
      photoperiodDelta: 0.8,
    });
    applyStressShift({
      state,
      zoneId: secondary.zoneId,
      direction: "down",
      stressType: "light_deficit",
    });
  }

  const refreshedPrimary = state.zones.find((zone) => zone.zoneId === primary.zoneId);
  const refreshedSecondary = secondary
    ? state.zones.find((zone) => zone.zoneId === secondary.zoneId)
    : undefined;

  const parameterChanges: Record<string, number> = {
    [`${primary.zoneId}.sensors.lightPAR`]:
      refreshedPrimary?.sensors.lightPAR ?? primary.sensors.lightPAR,
    [`${primary.zoneId}.sensors.photoperiodHours`]:
      refreshedPrimary?.sensors.photoperiodHours ?? primary.sensors.photoperiodHours,
  };

  if (secondary && refreshedSecondary) {
    parameterChanges[`${secondary.zoneId}.sensors.lightPAR`] =
      refreshedSecondary.sensors.lightPAR;
    parameterChanges[`${secondary.zoneId}.sensors.photoperiodHours`] =
      refreshedSecondary.sensors.photoperiodHours;
  }

  return {
    actionId: buildActionId(state, index),
    actionType: "prioritize_zone",
    urgency: "within_24h",
    targetZoneId: primary.zoneId,
    description: `Prioritize lighting and environmental support for ${describeZone(primary)}${secondary ? ` and ${describeZone(secondary)}` : ""}.`,
    parameterChanges,
    nutritionImpact:
      "Redirects electrical support toward the remaining productive zones to recover photosynthesis and yield continuity.",
    tradeoff: "The failed bay remains dark and unavailable while the remaining zones absorb the shared energy margin.",
  };
}

function buildExplanation(
  before: MissionState,
  after: MissionState,
  actions: PlannerAction[],
): string {
  if (actions.length === 0) {
    return "Nutrition remains above the preservation thresholds, so the planner keeps the greenhouse in normal mode with no deterministic intervention.";
  }

  return `Nutrition Preservation Mode is active because the mission score is ${before.nutrition.nutritionalCoverageScore} with ${before.nutrition.daysSafe} safe days remaining. The planner protects potatoes first for calories, then beans for protein, and accepts controlled cuts to lower-priority zones when necessary. This forecast moves the nutrition score from ${before.nutrition.nutritionalCoverageScore} to ${after.nutrition.nutritionalCoverageScore}.`;
}

export function createNutritionPreservationExecution(
  sourceState: MissionState,
): PlannerExecution {
  const beforeSnapshot = buildMissionSnapshot(sourceState);

  if (!shouldEnterNutritionPreservationMode(beforeSnapshot)) {
    const plan = createPlannerOutput({
      beforeState: beforeSnapshot,
      missionState: beforeSnapshot,
      reason: "Planner analyze: no action required",
    });

    return {
      plan: {
        ...plan,
        nutritionRiskDetected: false,
      },
      mode: "normal",
      recommendedActions: [],
      explanation:
        "Nutrition remains above the preservation thresholds, so the backend keeps the mission in normal mode with no deterministic reallocation actions.",
      beforeSnapshot,
      afterSnapshot: beforeSnapshot,
    };
  }

  const afterState = cloneMissionState(beforeSnapshot);
  afterState.status = "nutrition_preservation_mode";
  const actions: PlannerAction[] = [];
  const activeScenarioType = beforeSnapshot.activeScenario?.scenarioType ?? null;
  const malfunctionZoneId =
    activeScenarioType === "single_zone_control_failure"
      ? beforeSnapshot.activeScenario?.affectedZones[0]
      : undefined;

  if (activeScenarioType === "single_zone_control_failure" && malfunctionZoneId) {
    const isolateAction = applyIsolateMalfunctionZoneAction(afterState, malfunctionZoneId, 1);
    if (isolateAction) {
      actions.push(isolateAction);
    }

    const waterAction = applySingleZoneWaterRedistributionAction(
      afterState,
      malfunctionZoneId,
      actions.length + 1,
    );
    if (waterAction) {
      actions.push(waterAction);
    }

    const energyAction = applySingleZoneEnergyPrioritizationAction(
      afterState,
      malfunctionZoneId,
      actions.length + 1,
    );
    if (energyAction) {
      actions.push(energyAction);
    }
  } else {

    const primaryAction =
      activeScenarioType === "energy_budget_reduction"
        ? applyReduceLightingAction(afterState, 1)
        : activeScenarioType === "temperature_control_failure"
          ? applyAdjustTemperatureAction(afterState, 1)
          : applyReallocateWaterAction(afterState, 1);

    if (primaryAction) {
      actions.push(primaryAction);
    }

    if (
      beforeSnapshot.nutrition.nutritionalCoverageScore < 55 ||
      beforeSnapshot.nutrition.daysSafe < 20
    ) {
      const lastResortAction = applyPauseZoneAction(afterState, actions.length + 1);
      if (lastResortAction) {
        actions.push(lastResortAction);
      }
    }

    if (actions.length < 3 && activeScenarioType !== "water_recycling_decline") {
      const waterAction = applyReallocateWaterAction(afterState, actions.length + 1);
      if (waterAction) {
        actions.push(waterAction);
      }
    }
  }

  const recommendedActions = actions.slice(0, 3);
  const afterSnapshot = buildMissionSnapshot(afterState);
  const mode: PlannerMode = "nutrition_preservation";
  const plan: PlannerOutput = createPlannerOutput({
    beforeState: beforeSnapshot,
    missionState: afterSnapshot,
    reason: "Planner: Nutrition Preservation Mode projection",
  });

  return {
    plan: {
      ...plan,
      nutritionRiskDetected: true,
    },
    mode,
    recommendedActions,
    explanation: buildExplanation(beforeSnapshot, afterSnapshot, recommendedActions),
    beforeSnapshot,
    afterSnapshot,
  };
}

export function createNutritionPreservationPlan(
  sourceState: MissionState,
): PlannerOutput {
  return createNutritionPreservationExecution(sourceState).plan;
}

export function getCurrentNutritionPreservationPlan(): PlannerOutput {
  return createNutritionPreservationPlan(getCurrentMissionSnapshot());
}

export function getCurrentNutritionPreservationExecution(): PlannerExecution {
  return createNutritionPreservationExecution(getCurrentMissionSnapshot());
}
