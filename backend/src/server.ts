import { resolve } from "node:path";
import { config } from "dotenv";
import { buildApp } from "./app";

config({ path: resolve(__dirname, "../.env") });

const app = buildApp();
const port = Number.parseInt(process.env.PORT ?? "3001", 10);

async function start() {
  try {
    await app.listen({ host: "127.0.0.1", port });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
