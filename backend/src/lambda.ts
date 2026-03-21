import { resolve } from "node:path";
import { config } from "dotenv";
import awsLambdaFastify from "@fastify/aws-lambda";
import { buildApp } from "./app";

config({ path: resolve(__dirname, "../.env") });

const app = buildApp();
const proxy = awsLambdaFastify(app, {
  serializeLambdaArguments: false,
});

let appReady: Promise<unknown> | undefined;

function ensureAppReady() {
  appReady ??= Promise.resolve(app.ready());
  return appReady;
}

export const handler = async (
  event: Parameters<typeof proxy>[0],
  context: Parameters<typeof proxy>[1],
) => {
  await ensureAppReady();
  return proxy(event, context);
};
