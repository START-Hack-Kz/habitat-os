import { MISSION_SEED } from "../../data/mission.seed";
import type { MissionState } from "./mission.types";

function cloneMissionState(state: MissionState): MissionState {
  return structuredClone(state);
}

let currentMissionState = cloneMissionState(MISSION_SEED);

export function getMissionState(): MissionState {
  return cloneMissionState(currentMissionState);
}

export function setMissionState(nextState: MissionState): MissionState {
  currentMissionState = cloneMissionState(nextState);
  return getMissionState();
}

export function resetMissionState(): MissionState {
  currentMissionState = cloneMissionState(MISSION_SEED);
  return getMissionState();
}
