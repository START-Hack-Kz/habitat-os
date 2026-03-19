import { z } from "zod";
import {
  scenarioSeverityValues,
  scenarioTypeValues,
} from "../modules/mission/mission.types";

export const scenarioInjectRequestSchema = z
  .object({
    scenarioType: z.enum(scenarioTypeValues),
    severity: z.enum(scenarioSeverityValues).optional(),
    affectedZoneIds: z.array(z.string().trim().min(1)).min(1).max(4).optional(),
  })
  .strict();

export const simulationResetRequestSchema = z.object({}).strict();

export type ScenarioInjectRequest = z.infer<typeof scenarioInjectRequestSchema>;
export type SimulationResetRequest = z.infer<
  typeof simulationResetRequestSchema
>;
