import { z } from "zod";

export const agentAnalysisFocusValues = [
  "mission_overview",
  "nutrition_risk",
  "scenario_response",
] as const;

export const agentAnalyzeRequestSchema = z
  .object({
    autoApply: z.boolean().optional(),
    focus: z.enum(agentAnalysisFocusValues).optional(),
  })
  .strict();

export type AgentAnalyzeRequest = z.infer<typeof agentAnalyzeRequestSchema>;
