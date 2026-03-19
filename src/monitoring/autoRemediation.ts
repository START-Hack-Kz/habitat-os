import { SENSOR_THRESHOLDS } from "./controlActions";
import type {
  AutomatedControlResponse,
  BackendCropZone,
  BackendMissionState,
  BackendSimulationResourceOverride,
  BackendSimulationTweakRequest,
  BackendSimulationZoneOverride,
  ControlActionItem,
  ControlActionPriority,
  ControlActionType,
} from "../types";

export interface AutoRemediationPlan {
  responseId: string;
  abnormalityKey: string;
  priority: ControlActionPriority;
  headline: string;
  detectedMessage: string;
  executingMessage: string;
  resolvedMessage: string;
  attentionMessage: string;
  machineryLabel: string;
  targetLabel: string;
  targetZoneId?: string;
  recommendedSection: ControlActionItem["recommendedSection"];
  actionTypes: ControlActionType[];
  tweakRequest: BackendSimulationTweakRequest | null;
  autoTriggered: boolean;
}

function roundValue(sensorKey: keyof BackendCropZone["sensors"], value: number): number {
  switch (sensorKey) {
    case "nutrientPH":
    case "electricalConductivity":
      return Number(value.toFixed(1));
    case "photoperiodHours":
      return Number(value.toFixed(1));
    default:
      return Math.round(value);
  }
}

function midpoint(zone: BackendCropZone, sensorKey: keyof BackendCropZone["sensors"]): number {
  const threshold = SENSOR_THRESHOLDS[zone.cropType][sensorKey];
  return roundValue(sensorKey, (threshold.low + threshold.high) / 2);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function upsertZoneOverride(
  zones: BackendSimulationZoneOverride[],
  zoneId: string,
  patch: Omit<BackendSimulationZoneOverride, "zoneId">,
): BackendSimulationZoneOverride[] {
  const existing = zones.find((zone) => zone.zoneId === zoneId);

  if (existing) {
    Object.assign(existing, patch);
    return zones;
  }

  zones.push({ zoneId, ...patch });
  return zones;
}

function buildMachineryLabel(actionType: ControlActionType): string {
  switch (actionType) {
    case "adjust_temperature":
      return "Adjusting fan and thermal loop";
    case "adjust_humidity":
      return "Cycling humidifier and airflow loop";
    case "increase_irrigation":
      return "Increasing irrigation pulse";
    case "reduce_irrigation":
      return "Reducing irrigation pulse";
    case "increase_lighting":
      return "Increasing LED array output";
    case "reduce_lighting":
      return "Dimming non-critical lighting banks";
    case "rebalance_lighting":
      return "Rebalancing lighting schedule";
    case "adjust_nutrient_ph":
      return "Metering pH correction into nutrient loop";
    case "adjust_nutrient_dose":
      return "Adjusting nutrient dosing pump";
    case "flush_solution":
      return "Flushing nutrient solution";
    case "reallocate_water":
      return "Rebalancing shared water loop";
    case "rebalance_energy":
      return "Rebalancing auxiliary power bus";
    case "flag_manual_attention":
      return "Escalating operator watch";
    default:
      return "Applying abstract control response";
  }
}

function mergeResourcePatch(
  current: BackendMissionState["resources"],
  existing: BackendSimulationResourceOverride | undefined,
  actionType: ControlActionType,
): BackendSimulationResourceOverride | undefined {
  const patch = { ...(existing ?? {}) };

  switch (actionType) {
    case "reallocate_water":
      patch.waterRecyclingEfficiencyPercent = Math.max(
        current.waterRecyclingEfficiencyPercent,
        90,
      );
      if (current.waterDaysRemaining < 45) {
        patch.waterDailyConsumptionL = Math.max(55, Math.round(current.waterDailyConsumptionL * 0.88));
      }
      return patch;
    case "rebalance_energy": {
      const targetDaily = Math.max(140, Math.round(current.energyAvailableKwh / 3));
      patch.energyDailyConsumptionKwh = Math.min(
        current.energyDailyConsumptionKwh,
        targetDaily,
      );
      patch.energyAvailableKwh = Math.max(
        current.energyAvailableKwh,
        Math.round((patch.energyDailyConsumptionKwh ?? current.energyDailyConsumptionKwh) * 3),
      );
      return patch;
    }
    default:
      return existing;
  }
}

function buildTweakRequest(
  mission: BackendMissionState,
  actions: ControlActionItem[],
): BackendSimulationTweakRequest | null {
  const zoneOverrides: BackendSimulationZoneOverride[] = [];
  let resourceOverride: BackendSimulationResourceOverride | undefined;

  for (const action of actions) {
    const zone = action.targetZoneId
      ? mission.zones.find((item) => item.zoneId === action.targetZoneId)
      : undefined;

    switch (action.actionType) {
      case "adjust_temperature":
        if (zone) {
          upsertZoneOverride(zoneOverrides, zone.zoneId, {
            temperature: midpoint(zone, "temperature"),
          });
        }
        break;
      case "adjust_humidity":
        if (zone) {
          upsertZoneOverride(zoneOverrides, zone.zoneId, {
            humidity: midpoint(zone, "humidity"),
          });
        }
        break;
      case "increase_irrigation":
      case "reduce_irrigation":
        if (zone) {
          upsertZoneOverride(zoneOverrides, zone.zoneId, {
            soilMoisture: midpoint(zone, "soilMoisture"),
          });
        }
        break;
      case "increase_lighting":
      case "reduce_lighting":
      case "rebalance_lighting":
        if (zone) {
          upsertZoneOverride(zoneOverrides, zone.zoneId, {
            lightPAR: midpoint(zone, "lightPAR"),
            photoperiodHours: midpoint(zone, "photoperiodHours"),
          });
        }
        break;
      case "adjust_nutrient_ph":
        if (zone) {
          upsertZoneOverride(zoneOverrides, zone.zoneId, {
            nutrientPH: midpoint(zone, "nutrientPH"),
          });
        }
        break;
      case "adjust_nutrient_dose":
      case "flush_solution":
        if (zone) {
          upsertZoneOverride(zoneOverrides, zone.zoneId, {
            electricalConductivity: midpoint(zone, "electricalConductivity"),
          });
        }
        break;
      case "reallocate_water":
      case "rebalance_energy":
        resourceOverride = mergeResourcePatch(mission.resources, resourceOverride, action.actionType);
        break;
      case "flag_manual_attention":
        break;
    }
  }

  if (zoneOverrides.length === 0 && !resourceOverride) {
    return null;
  }

  return {
    zones: zoneOverrides.length > 0 ? zoneOverrides : undefined,
    resources: resourceOverride,
  };
}

export function createAutoRemediationPlan(
  mission: BackendMissionState,
  actions: ControlActionItem[],
  detectedAt: string,
): AutoRemediationPlan | null {
  if (actions.length === 0) {
    return null;
  }

  const prioritizedActions = [...actions].sort((left, right) => right.severityRank - left.severityRank);
  const primaryAction = prioritizedActions[0];
  const autoActions = unique(
    prioritizedActions
      .filter((action) => action.autoTriggered && !action.advisoryOnly)
      .map((action) => action.actionType),
  );
  const visibleActionTypes = unique(
    prioritizedActions
      .filter((action) => action.autoTriggered || action.advisoryOnly)
      .map((action) => action.actionType),
  );
  const tweakRequest = buildTweakRequest(
    mission,
    prioritizedActions.filter((action) => autoActions.includes(action.actionType)),
  );
  const machineryLabel = unique(
    (autoActions.length > 0 ? autoActions : visibleActionTypes).map(buildMachineryLabel),
  ).join(" + ");

  return {
    responseId: `${primaryAction.abnormalityKey}:${detectedAt}`,
    abnormalityKey: primaryAction.abnormalityKey,
    priority: primaryAction.priority,
    headline: primaryAction.headline,
    detectedMessage: `${primaryAction.summary} Trigger: ${primaryAction.triggerReason}`,
    executingMessage:
      tweakRequest !== null
        ? `${machineryLabel} for ${primaryAction.targetLabel}. Writing corrected operating values back to the simulation.`
        : `${machineryLabel} for ${primaryAction.targetLabel}. Crew review is still required before the issue can be cleared.`,
    resolvedMessage:
      tweakRequest !== null
        ? `${primaryAction.targetLabel} has been pushed back toward the nominal operating band.`
        : `${primaryAction.targetLabel} remains under watch.`,
    attentionMessage: `${primaryAction.targetLabel} still requires operator attention after the abstract response.`,
    machineryLabel,
    targetLabel: primaryAction.targetLabel,
    targetZoneId: primaryAction.targetZoneId,
    recommendedSection: primaryAction.recommendedSection,
    actionTypes: visibleActionTypes,
    tweakRequest,
    autoTriggered: autoActions.length > 0,
  };
}

export function createAutomatedResponse(
  plan: AutoRemediationPlan,
  phase: AutomatedControlResponse["phase"],
  timestamp: string,
): AutomatedControlResponse {
  const statusLabel =
    phase === "detected"
      ? "Abnormality detected"
      : phase === "executing"
        ? plan.machineryLabel
        : phase === "resolved"
          ? "Abstract response completed"
          : "Manual attention required";
  const message =
    phase === "detected"
      ? plan.detectedMessage
      : phase === "executing"
        ? plan.executingMessage
        : phase === "resolved"
          ? plan.resolvedMessage
          : plan.attentionMessage;

  return {
    id: plan.responseId,
    abnormalityKey: plan.abnormalityKey,
    actionTypes: plan.actionTypes,
    targetLabel: plan.targetLabel,
    targetZoneId: plan.targetZoneId,
    recommendedSection: plan.recommendedSection,
    priority: plan.priority,
    headline: plan.headline,
    statusLabel,
    machineryLabel: plan.machineryLabel,
    message,
    phase,
    startedAt: timestamp,
    updatedAt: timestamp,
    autoTriggered: plan.autoTriggered,
  };
}
