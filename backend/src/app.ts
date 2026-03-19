import Fastify from "fastify";

export function buildApp() {
  const app = Fastify();

  app.get("/health", async () => {
    return { ok: true };
  });

  return app;
}
