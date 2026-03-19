import type { ScenarioCatalogEntry } from "../../../shared/schemas/scenarioInput.schema";
import type { FastifyPluginAsync } from "fastify";
import { SCENARIO_CATALOG } from "../data/scenarios.data";

export const scenariosRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/scenarios", async (): Promise<ScenarioCatalogEntry[]> => {
    return Object.values(SCENARIO_CATALOG).map((scenario) => {
      return {
        scenarioType: scenario.scenarioType,
        label: scenario.label,
        description: scenario.description,
        defaultSeverityEffects: {
          mild: { ...scenario.severityEffects.mild.parameterOverrides },
          moderate: { ...scenario.severityEffects.moderate.parameterOverrides },
          critical: { ...scenario.severityEffects.critical.parameterOverrides },
        },
        affectedResources: [...scenario.affectedResources],
        nutritionRisk: scenario.nutritionRisk,
      };
    });
  });
};
