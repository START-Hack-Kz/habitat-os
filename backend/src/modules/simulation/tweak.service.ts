import { buildMissionSnapshot, getCurrentMissionSnapshot } from "../mission/mission.service";
import { setMissionState } from "../mission/mission.store";
import type { MissionState } from "../mission/mission.types";
import type { SimulationTweakRequest } from "../../schemas/simulation.schema";

function cloneMissionState(state: MissionState): MissionState {
  return structuredClone(state);
}

function deriveTimestamp(state: MissionState): string {
  const parsed = Date.parse(state.lastUpdated);
  const baseTime = Number.isNaN(parsed)
    ? Date.parse("2026-03-19T10:00:00.000Z")
    : parsed;

  return new Date(baseTime + 1000).toISOString();
}

function buildEventMessage(request: SimulationTweakRequest): string {
  const zoneLabels =
    request.zones?.map((zone) => zone.zoneId).join(", ") ?? "resource state";

  if (request.zones && request.resources) {
    return `Simulation tweak applied to zones ${zoneLabels} and shared resources.`;
  }

  if (request.zones) {
    return `Simulation tweak applied to zones ${zoneLabels}.`;
  }

  return "Simulation tweak applied to shared resource values.";
}

export function applySimulationTweak(
  sourceState: MissionState,
  request: SimulationTweakRequest,
): MissionState {
  const state = cloneMissionState(sourceState);

  if (request.zones) {
    state.zones = state.zones.map((zone) => {
      const override = request.zones?.find((entry) => entry.zoneId === zone.zoneId);

      if (!override) {
        return zone;
      }

      return {
        ...zone,
        sensors: {
          ...zone.sensors,
          temperature: override.temperature ?? zone.sensors.temperature,
          humidity: override.humidity ?? zone.sensors.humidity,
          co2Ppm: override.co2Ppm ?? zone.sensors.co2Ppm,
          lightPAR: override.lightPAR ?? zone.sensors.lightPAR,
          photoperiodHours: override.photoperiodHours ?? zone.sensors.photoperiodHours,
          nutrientPH: override.nutrientPH ?? zone.sensors.nutrientPH,
          electricalConductivity:
            override.electricalConductivity ?? zone.sensors.electricalConductivity,
          soilMoisture: override.soilMoisture ?? zone.sensors.soilMoisture,
        },
        stress: {
          active: false,
          type: "none",
          severity: "none",
          boltingRisk: false,
          symptoms: [],
        },
      };
    });
  }

  if (request.resources) {
    state.resources = {
      ...state.resources,
      ...request.resources,
    };
  }

  const timestamp = deriveTimestamp(state);
  const nextState = buildMissionSnapshot({
    ...state,
    lastUpdated: timestamp,
  });
  const touchedZoneIds = request.zones?.map((zone) => zone.zoneId) ?? [];
  const hasAbnormality =
    nextState.status !== "nominal" ||
    nextState.zones.some((zone) => {
      return touchedZoneIds.includes(zone.zoneId) && zone.stress.active;
    });

  nextState.eventLog.push({
    eventId: `evt-${String(nextState.eventLog.length + 1).padStart(3, "0")}`,
    missionDay: nextState.missionDay,
    timestamp,
    type: nextState.status === "critical" ? "critical" : hasAbnormality ? "warning" : "info",
    message: buildEventMessage(request),
  });

  return buildMissionSnapshot(nextState);
}

export function tweakCurrentMission(
  request: SimulationTweakRequest,
): MissionState {
  const nextState = applySimulationTweak(getCurrentMissionSnapshot(), request);
  return setMissionState(nextState);
}
