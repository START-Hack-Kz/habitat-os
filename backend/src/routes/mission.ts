import type { FastifyPluginAsync } from "fastify";
import { getCurrentMissionSnapshot } from "../modules/mission/mission.service";

export const missionRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/mission/state", async () => {
    return getCurrentMissionSnapshot();
  });
};
