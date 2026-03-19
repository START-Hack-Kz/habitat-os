import type { FastifyPluginAsync } from "fastify";
import { analyzeCurrentMissionWithStub } from "../modules/agent/agent.stub";
import { agentAnalyzeRequestSchema } from "../schemas/agent.schema";

export const agentRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/agent/analyze", async (request, reply) => {
    const parsed = agentAnalyzeRequestSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid agent analyze request",
        details: parsed.error.issues,
      });
    }

    return analyzeCurrentMissionWithStub(parsed.data);
  });
};
