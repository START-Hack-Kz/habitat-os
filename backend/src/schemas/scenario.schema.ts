import { z } from "zod";
import {
  scenarioSeverityValues,
  scenarioTypeValues,
} from "../modules/mission/mission.types";

export const manualTweakParamsSchema = z
  .object({
    waterRecyclingEfficiency: z.number().finite().min(0).max(100).optional(),
    waterDailyConsumptionL: z.number().finite().nonnegative().optional(),
    energyAvailableKwh: z.number().finite().nonnegative().optional(),
    energyConsumptionKwhPerDay: z.number().finite().nonnegative().optional(),
    temperatureZoneA: z.number().finite().optional(),
    temperatureZoneB: z.number().finite().optional(),
    temperatureZoneC: z.number().finite().optional(),
    temperatureZoneD: z.number().finite().optional(),
    lightPAROverride: z.number().finite().nonnegative().optional(),
  })
  .strict();

export const scenarioInjectRequestSchema = z
  .object({
    scenarioType: z.enum(scenarioTypeValues),
    severity: z.enum(scenarioSeverityValues),
    affectedZones: z.array(z.string().trim().min(1)).min(1).max(4).optional(),
    customOverrides: manualTweakParamsSchema.partial().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.scenarioType === "single_zone_control_failure" &&
      value.affectedZones?.length !== 1
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "single_zone_control_failure requires exactly one affected zone",
        path: ["affectedZones"],
      });
    }
  })
  .strict();

export const simulationResetRequestSchema = z.object({}).strict();

export type ScenarioInjectRequest = z.infer<typeof scenarioInjectRequestSchema>;
export type ManualTweakParams = z.infer<typeof manualTweakParamsSchema>;
export type SimulationResetRequest = z.infer<typeof simulationResetRequestSchema>;
