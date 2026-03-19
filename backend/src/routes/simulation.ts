import type { FastifyPluginAsync } from "fastify";
import { getCurrentMissionSnapshot } from "../modules/mission/mission.service";
import { resetMissionState } from "../modules/mission/mission.store";
import { injectScenario } from "../modules/scenarios/scenario.service";
import { tweakCurrentMission } from "../modules/simulation/tweak.service";
import {
  scenarioInjectRequestSchema,
  simulationResetRequestSchema,
} from "../schemas/scenario.schema";
import { simulationTweakRequestSchema } from "../schemas/simulation.schema";

export const simulationRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/simulation/scenario/inject", async (request, reply) => {
    const parsed = scenarioInjectRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid scenario injection request",
        details: parsed.error.issues,
      });
    }

    return injectScenario(parsed.data);
  });

  app.post("/api/simulation/reset", async (request, reply) => {
    const parsed = simulationResetRequestSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid simulation reset request",
        details: parsed.error.issues,
      });
    }

    resetMissionState();
    return getCurrentMissionSnapshot();
  });

  app.post("/api/simulation/tweak", async (request, reply) => {
    const parsed = simulationTweakRequestSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid simulation tweak request",
        details: parsed.error.issues,
      });
    }

    return tweakCurrentMission(parsed.data);
  });
};
