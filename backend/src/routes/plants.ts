import type { FastifyPluginAsync } from "fastify";
import { getMissionState, persistMissionState } from "../modules/mission/mission.store";
import { applyPlantDecision, triggerPlantHealthCheck } from "../modules/plants/plant.service";
import {
  plantDecisionApplyRequestSchema,
  plantHealthTriggerRequestSchema,
} from "../schemas/plant.schema";

export const plantRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/plants/health-check/trigger", async (request, reply) => {
    const parsed = plantHealthTriggerRequestSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid plant health trigger request",
        details: parsed.error.issues,
      });
    }

    const nextState = triggerPlantHealthCheck(getMissionState(), parsed.data);
    return persistMissionState(nextState);
  });

  app.post("/api/plants/decision/apply", async (request, reply) => {
    const parsed = plantDecisionApplyRequestSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid plant decision request",
        details: parsed.error.issues,
      });
    }

    const nextState = applyPlantDecision(getMissionState(), parsed.data);
    return persistMissionState(nextState);
  });
};
