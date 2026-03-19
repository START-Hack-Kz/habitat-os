import Fastify from "fastify";
import { agentRoutes } from "./routes/agent";
import { healthRoutes } from "./routes/health";
import { missionRoutes } from "./routes/mission";
import { plannerRoutes } from "./routes/planner";
import { scenariosRoutes } from "./routes/scenarios";
import { simulationRoutes } from "./routes/simulation";

export function buildApp() {
  const app = Fastify();

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    if (!reply.sent) {
      reply.status(500).send({
        error: "Internal server error",
      });
    }
  });

  void app.register(agentRoutes);
  void app.register(healthRoutes);
  void app.register(missionRoutes);
  void app.register(scenariosRoutes);
  void app.register(simulationRoutes);
  void app.register(plannerRoutes);

  return app;
}
