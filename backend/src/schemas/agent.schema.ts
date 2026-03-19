import { z } from "zod";

export const agentAnalysisFocusValues = [
  "mission_overview",
  "nutrition_risk",
  "scenario_response",
] as const;

export const agentAnalyzeRequestSchema = z
  .object({
    missionId: z.string().trim().min(1),
    focus: z.enum(agentAnalysisFocusValues),
    question: z.string().trim().min(1).max(500).optional(),
    includeEventLog: z.boolean().optional(),
  })
  .strict();

export type AgentAnalyzeRequest = z.infer<typeof agentAnalyzeRequestSchema>;
