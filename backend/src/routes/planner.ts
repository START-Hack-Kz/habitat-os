import type { FastifyPluginAsync } from "fastify";
import { getCurrentNutritionPreservationPlan } from "../modules/planner/planner.service";
import { simulationResetRequestSchema } from "../schemas/scenario.schema";

export const plannerRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/planner/analyze", async (request, reply) => {
    const parsed = simulationResetRequestSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid planner analyze request",
        details: parsed.error.issues,
      });
    }

    return getCurrentNutritionPreservationPlan();
  });
};
