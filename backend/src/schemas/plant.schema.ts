import { z } from "zod";
import {
  plantRecommendedActionValues,
  plantRecoverabilityLabelValues,
  plantSeverityLabelValues,
  plantStatusValues,
} from "../modules/mission/mission.types";

export const plantDecisionApplyRequestSchema = z
  .object({
    plantId: z.string().trim().uuid(),
    targetStatus: z.enum(plantStatusValues),
    severityLabel: z.enum(plantSeverityLabelValues),
    recoverabilityLabel: z.enum(plantRecoverabilityLabelValues),
    recommendedAction: z.enum(plantRecommendedActionValues),
    summary: z.string().trim().min(1).max(600),
  })
  .strict();

export const plantHealthTriggerRequestSchema = z
  .object({
    zoneId: z.string().trim().min(1).max(32),
    rowNo: z.number().int().min(1).max(20),
    plantNo: z.number().int().min(1).max(20),
    imageUri: z.string().trim().min(1).max(400).optional(),
    colorStressScore: z.number().min(0).max(1),
    wiltingScore: z.number().min(0).max(1),
    lesionScore: z.number().min(0).max(1),
    growthDeclineScore: z.number().min(0).max(1),
  })
  .strict();

export type PlantDecisionApplyRequest = z.infer<typeof plantDecisionApplyRequestSchema>;
export type PlantHealthTriggerRequest = z.infer<typeof plantHealthTriggerRequestSchema>;
