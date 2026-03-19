import { MISSION_SEED } from "../data/mission.seed";
import { buildMissionSnapshot } from "../modules/mission/mission.service";
import type { MissionState } from "../modules/mission/mission.types";

const exampleSource: MissionState = structuredClone(MISSION_SEED);

exampleSource.missionDay = 128;
exampleSource.status = "warning";
exampleSource.zones = exampleSource.zones.map((zone) => {
  if (zone.zoneId === "zone-A") {
    return {
      ...zone,
      growthDay: 22,
      sensors: {
        ...zone.sensors,
        temperature: 27,
        humidity: 42,
      },
    };
  }

  if (zone.zoneId === "zone-B") {
    return {
      ...zone,
      growthDay: 55,
      sensors: {
        ...zone.sensors,
        temperature: 27,
      },
    };
  }

  return zone;
});
exampleSource.activeScenario = {
  scenarioId: "scen-example-001",
  scenarioType: "temperature_control_failure",
  severity: "moderate",
  injectedAt: "2026-03-19T09:45:00.000Z",
  affectedZones: exampleSource.zones.map((zone) => zone.zoneId),
  parameterOverrides: {
    temperatureZoneA: 27,
    temperatureZoneB: 27,
    temperatureZoneC: 26,
    temperatureZoneD: 25,
  },
  description:
    "Temperature control drift is pushing lettuce toward bolting risk and starting to cut potato yield.",
};
exampleSource.eventLog = [
  {
    eventId: "evt-example-003",
    missionDay: 128,
    timestamp: "2026-03-19T09:45:00.000Z",
    type: "scenario_injected",
    message:
      "Temperature at 27C. Lettuce bolting risk active. Potato yield reduction beginning.",
  },
  {
    eventId: "evt-example-002",
    missionDay: 128,
    timestamp: "2026-03-19T09:30:00.000Z",
    type: "warning",
    message: "Zone-A canopy temperature is above the target range.",
    zoneId: "zone-A",
  },
  {
    eventId: "evt-example-001",
    missionDay: 127,
    timestamp: "2026-03-18T16:10:00.000Z",
    type: "info",
    message: "Zone-D remains on pace for the planned harvest window.",
    zoneId: "zone-D",
  },
];
exampleSource.lastUpdated = "2026-03-19T10:00:00.000Z";

export const missionStateExample = buildMissionSnapshot(exampleSource);
