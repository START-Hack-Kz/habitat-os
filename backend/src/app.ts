import fastifyCors from "@fastify/cors";
import Fastify from "fastify";
import { agentRoutes } from "./routes/agent";
import { healthRoutes } from "./routes/health";
import { hydrateMissionState } from "./modules/mission/mission.store";
import { missionRoutes } from "./routes/mission";
import { plannerRoutes } from "./routes/planner";
import { plantRoutes } from "./routes/plants";
import { scenariosRoutes } from "./routes/scenarios";
import { simulationRoutes } from "./routes/simulation";

function getAllowedOrigins(): string[] {
  const configuredOrigins = process.env.CORS_ORIGINS ?? process.env.CORS_ORIGIN ?? "";

  if (configuredOrigins.trim().length > 0) {
    return configuredOrigins
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }

  return [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];
}

function isAllowedOrigin(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes("*")) {
    return true;
  }

  try {
    const url = new URL(origin);
    if (
      (url.protocol === "http:" || url.protocol === "https:") &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return allowedOrigins.includes(origin);
}

export function buildApp() {
  const app = Fastify();
  const allowedOrigins = getAllowedOrigins();

  app.addHook("onRequest", async (request) => {
    const requestPath = request.raw.url ?? "";

    if (request.method === "OPTIONS" || requestPath.startsWith("/health")) {
      return;
    }

    await hydrateMissionState(true);
  });

  void app.register(fastifyCors, {
    origin(origin, callback) {
      if (isAllowedOrigin(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`), false);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    maxAge: 86400,
  });

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
  void app.register(plantRoutes);
  void app.register(scenariosRoutes);
  void app.register(simulationRoutes);
  void app.register(plannerRoutes);

  return app;
}
