import { z } from "zod";

const zoneSensorOverrideSchema = z
  .object({
    zoneId: z.string().trim().min(1),
    temperature: z.number().finite().optional(),
    humidity: z.number().finite().min(0).max(100).optional(),
    co2Ppm: z.number().finite().nonnegative().optional(),
    lightPAR: z.number().finite().nonnegative().optional(),
    photoperiodHours: z.number().finite().min(0).max(24).optional(),
    nutrientPH: z.number().finite().optional(),
    electricalConductivity: z.number().finite().nonnegative().optional(),
    soilMoisture: z.number().finite().min(0).max(100).optional(),
  })
  .strict()
  .refine((value) => {
    return (
      value.temperature !== undefined ||
      value.humidity !== undefined ||
      value.co2Ppm !== undefined ||
      value.lightPAR !== undefined ||
      value.photoperiodHours !== undefined ||
      value.nutrientPH !== undefined ||
      value.electricalConductivity !== undefined ||
      value.soilMoisture !== undefined
    );
  }, "At least one zone sensor field must be provided");

const resourceOverrideSchema = z
  .object({
    waterRecyclingEfficiency: z.number().finite().min(0).max(100).optional(),
    waterDailyConsumptionL: z.number().finite().nonnegative().optional(),
    waterReservoirL: z.number().finite().nonnegative().optional(),
    energyAvailableKwh: z.number().finite().nonnegative().optional(),
    energyConsumptionKwhPerDay: z.number().finite().nonnegative().optional(),
    solarGenerationKwhPerDay: z.number().finite().nonnegative().optional(),
    nutrientN: z.number().finite().nonnegative().optional(),
    nutrientP: z.number().finite().nonnegative().optional(),
    nutrientK: z.number().finite().nonnegative().optional(),
  })
  .strict();

export const simulationTweakRequestSchema = z
  .object({
    zones: z.array(zoneSensorOverrideSchema).min(1).optional(),
    resources: resourceOverrideSchema.optional(),
  })
  .strict()
  .refine((value) => value.zones !== undefined || value.resources !== undefined, {
    message: "Provide at least one zone or resource override",
  });

export type SimulationTweakRequest = z.infer<typeof simulationTweakRequestSchema>;
