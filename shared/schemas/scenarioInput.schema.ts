// ScenarioInput — payload sent by the frontend to inject a failure scenario.
// Also used for manual parameter tweaks.

export type ScenarioType = "water_recycling_decline" | "energy_budget_reduction" | "temperature_control_failure";
export type ScenarioSeverity = "mild" | "moderate" | "critical";

// ─── Scenario injection request ───────────────────────────────────────────────

export interface ScenarioInjectRequest {
  scenarioType: ScenarioType;
  severity: ScenarioSeverity;

  // Optional: override which zones are affected (defaults to all zones if omitted)
  affectedZones?: string[];

  // Optional: manual parameter overrides (advanced tweak mode)
  // These are merged with the scenario's default parameter overrides.
  // Example: { waterRecyclingEfficiency: 55 } to make it worse than the default
  customOverrides?: Partial<ManualTweakParams>;
}

// ─── Manual tweak parameters ──────────────────────────────────────────────────
// Subset of simulation parameters the operator can adjust directly.
// Used for demo fine-tuning without injecting a full scenario.

export interface ManualTweakParams {
  waterRecyclingEfficiency: number;     // % (0–100)
  waterDailyConsumptionL: number;       // L/day
  energyAvailableKwh: number;           // kWh
  energyConsumptionKwhPerDay: number;   // kWh/day
  temperatureZoneA: number;             // °C override for zone-A
  temperatureZoneB: number;             // °C override for zone-B
  temperatureZoneC: number;             // °C override for zone-C
  temperatureZoneD: number;             // °C override for zone-D
  lightPAROverride: number;             // µmol/m²/s applied to all zones
}

// ─── Scenario reset request ───────────────────────────────────────────────────

export interface ScenarioResetRequest {
  // No fields needed — resets to baseline mission state
  // POST /simulation/reset
}

// ─── Predefined scenario catalog entry (returned by GET /scenarios) ───────────

export interface ScenarioCatalogEntry {
  scenarioType: ScenarioType;
  label: string;                        // Display name
  description: string;                  // What happens
  defaultSeverityEffects: {
    mild: Record<string, number>;
    moderate: Record<string, number>;
    critical: Record<string, number>;
  };
  affectedResources: string[];          // e.g. ["water", "energy"]
  nutritionRisk: string;                // e.g. "High — water stress threatens lettuce and potato zones"
}
