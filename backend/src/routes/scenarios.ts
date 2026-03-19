import type { FastifyPluginAsync } from "fastify";
import { SCENARIO_CATALOG } from "../data/scenarios.data";
import {
  scenarioSeverityValues,
  type FailureScenarioSeverity,
} from "../modules/mission/mission.types";

export const scenariosRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/scenarios", async () => {
    return Object.values(SCENARIO_CATALOG).map((scenario) => {
      return {
        scenarioType: scenario.scenarioType,
        label: scenario.label,
        description: scenario.description,
        affectedResources: scenario.affectedResources,
        nutritionRisk: scenario.nutritionRisk,
        severities: scenarioSeverityValues.map((severity) => {
          const effect =
            scenario.severityEffects[severity as FailureScenarioSeverity];

          return {
            severity,
            label: effect.label,
            effectSummary: effect.effectSummary,
            parameterOverrides: effect.parameterOverrides,
          };
        }),
      };
    });
  });
};
