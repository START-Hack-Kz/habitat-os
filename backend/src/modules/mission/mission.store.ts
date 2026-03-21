import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { MISSION_SEED } from "../../data/mission.seed";
import type { MissionState } from "./mission.types";

type MissionStateRecord = {
  missionId: string;
  state: MissionState;
  updatedAt: string;
};

function cloneMissionState(state: MissionState): MissionState {
  return structuredClone(state);
}

function createSeedState(): MissionState {
  return cloneMissionState(MISSION_SEED);
}

let currentMissionState = createSeedState();
let hasHydratedFromPersistence = false;
let dynamoClient: DynamoDBDocumentClient | null | undefined;

function getMissionStateTable(): string {
  return process.env.MISSION_STATE_TABLE?.trim() ?? "";
}

function getMissionStateKey(): string {
  return process.env.MISSION_STATE_KEY?.trim() || MISSION_SEED.missionId;
}

function useStrongReads(): boolean {
  return process.env.MISSION_STATE_STRONG_READS !== "false";
}

function getDynamoClient(): DynamoDBDocumentClient | null {
  if (dynamoClient !== undefined) {
    return dynamoClient;
  }

  if (getMissionStateTable().length === 0) {
    dynamoClient = null;
    return dynamoClient;
  }

  dynamoClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({
      region: process.env.AWS_REGION,
    }),
    {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    },
  );
  return dynamoClient;
}

function buildMissionStateRecord(state: MissionState): MissionStateRecord {
  return {
    missionId: getMissionStateKey(),
    state: cloneMissionState(state),
    updatedAt: state.lastUpdated,
  };
}

function isPersistedMissionState(value: unknown): value is MissionState {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (
    "missionId" in value &&
    "zones" in value &&
    "resources" in value &&
    "nutrition" in value &&
    "eventLog" in value &&
    "lastUpdated" in value
  );
}

export function isMissionPersistenceEnabled(): boolean {
  return getDynamoClient() !== null && getMissionStateTable().length > 0;
}

async function readMissionStateRecord(): Promise<MissionStateRecord | null> {
  const client = getDynamoClient();
  const missionStateTable = getMissionStateTable();

  if (!client || missionStateTable.length === 0) {
    return null;
  }

  const response = await client.send(
    new GetCommand({
      TableName: missionStateTable,
      Key: {
        missionId: getMissionStateKey(),
      },
      ConsistentRead: useStrongReads(),
    }),
  );

  if (!response.Item) {
    return null;
  }

  const item = response.Item as Partial<MissionStateRecord>;

  if (!isPersistedMissionState(item.state)) {
    return null;
  }

  return {
    missionId: getMissionStateKey(),
    state: cloneMissionState(item.state),
    updatedAt:
      typeof item.updatedAt === "string" ? item.updatedAt : item.state.lastUpdated,
  };
}

async function writeMissionStateRecord(state: MissionState): Promise<void> {
  const client = getDynamoClient();
  const missionStateTable = getMissionStateTable();

  if (!client || missionStateTable.length === 0) {
    return;
  }

  await client.send(
    new PutCommand({
      TableName: missionStateTable,
      Item: buildMissionStateRecord(state),
    }),
  );
}

export function getMissionState(): MissionState {
  return cloneMissionState(currentMissionState);
}

export function setMissionState(nextState: MissionState): MissionState {
  currentMissionState = cloneMissionState(nextState);
  hasHydratedFromPersistence = true;
  return getMissionState();
}

export function resetMissionState(): MissionState {
  currentMissionState = createSeedState();
  hasHydratedFromPersistence = false;
  return getMissionState();
}

export async function hydrateMissionState(force = false): Promise<MissionState> {
  if (!isMissionPersistenceEnabled()) {
    return getMissionState();
  }

  if (!force && hasHydratedFromPersistence) {
    return getMissionState();
  }

  const persistedRecord = await readMissionStateRecord();

  if (!persistedRecord) {
    const seedState = createSeedState();
    currentMissionState = seedState;
    await writeMissionStateRecord(seedState);
    hasHydratedFromPersistence = true;
    return getMissionState();
  }

  currentMissionState = cloneMissionState(persistedRecord.state);
  hasHydratedFromPersistence = true;
  return getMissionState();
}

export async function persistMissionState(nextState: MissionState): Promise<MissionState> {
  currentMissionState = cloneMissionState(nextState);
  hasHydratedFromPersistence = true;
  await writeMissionStateRecord(currentMissionState);
  return getMissionState();
}

export async function resetMissionStatePersisted(): Promise<MissionState> {
  return persistMissionState(createSeedState());
}
