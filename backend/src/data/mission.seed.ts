/**
 * mission.seed.ts
 * Baseline mission seed state for the Mars Greenhouse simulation.
 * Represents a nominal mid-mission snapshot (day 87 of 450) before any failure.
 * Use this to initialise or reset the simulation.
 *
 * Sensor/environment values are commented with their status relative to
 * MCP-derived optimal ranges where applicable.
 *
 * MCP-grounded values are noted inline.
 * [APPROX] marks values where MCP gave qualitative guidance only.
 */

import type { MissionState } from "../modules/mission/mission.types";

export const MISSION_SEED: MissionState = {
  missionId: "mars-greenhouse-alpha",
  missionDay: 87,           // mid-mission — more dramatic than day 1
  missionDurationDays: 450, // MCP: 450-day surface mission
  crewSize: 4,              // MCP: 4-astronaut crew
  status: "nominal",

  // ── Crop zones ─────────────────────────────────────────────────────────────
  // Area allocation follows MCP strategic model:
  // 40–50% potato, 20–30% legumes, 15–20% leafy greens, 5–10% radish
  // Total area: 200 m² → potato 45%, beans 25%, lettuce 20%, radish 10%
  // Area sized so nominal caloric coverage ≈ 90% at 12,000 kcal/day target [APPROX]
  zones: [
    {
      zoneId: "zone-a",
      name: "Leafy Greens Bay",
      cropType: "lettuce",
      areaM2: 40,
      growthDay: 19,
      growthCycleDays: 35,   // MCP: 30–45 days; using 35 [APPROX midpoint]
      growthProgressPercent: 54.3,
      projectedYieldKg: 160, // [APPROX] 40 m² × 4 kg/m² (mid-range of MCP 3–5 kg/m²)
      allocationPercent: 22,
      status: "healthy",
      stress: {
        active: false,
        type: "none",
        severity: "none",
        summary: "Lettuce canopy is within optimal range. No stress detected.",
      },
    },
    {
      zoneId: "zone-b",
      name: "Tuber Production Bay",
      cropType: "potato",
      areaM2: 90,
      growthDay: 46,
      growthCycleDays: 90,   // MCP: 70–120 days; using 90 [APPROX midpoint]
      growthProgressPercent: 51.1,
      projectedYieldKg: 540, // [APPROX] 90 m² × 6 kg/m² (mid-range of MCP 4–8 kg/m²)
      allocationPercent: 38,
      status: "healthy",
      stress: {
        active: false,
        type: "none",
        severity: "none",
        summary: "Potato canopy is tracking within the target range.",
      },
    },
    {
      zoneId: "zone-c",
      name: "Protein Crop Bay",
      cropType: "beans",
      areaM2: 50,
      growthDay: 31,
      growthCycleDays: 60,   // MCP: 50–70 days; using 60 [APPROX midpoint]
      growthProgressPercent: 51.7,
      projectedYieldKg: 150, // [APPROX] 50 m² × 3 kg/m² (mid-range of MCP 2–4 kg/m²)
      allocationPercent: 26,
      status: "healthy",
      stress: {
        active: false,
        type: "none",
        severity: "none",
        summary: "Bean vines are stable under current lighting conditions.",
      },
    },
    {
      zoneId: "zone-d",
      name: "Fast Harvest Bay",
      cropType: "radish",
      areaM2: 20,
      growthDay: 13,
      growthCycleDays: 25,   // MCP: 21–30 days; using 25 [APPROX midpoint]
      growthProgressPercent: 52.0,
      projectedYieldKg: 60,  // [APPROX] 20 m² × 3 kg/m² (mid-range of MCP 2–4 kg/m²)
      allocationPercent: 14,
      status: "healthy",
      stress: {
        active: false,
        type: "none",
        severity: "none",
        summary: "Radish zone is on pace for the planned harvest window.",
      },
    },
  ],

  // ── Resource state ──────────────────────────────────────────────────────────
  resources: {
    waterReservoirL: 5800,                  // normal — healthy reserve for mid-mission [APPROX]
    waterRecyclingEfficiencyPercent: 91,    // normal — MCP target >85–95%; 91% is healthy
    waterDailyConsumptionL: 112,            // normal — [APPROX] 4 zones × ~28 L/day average
    nutrientSolutionLevelPercent: 88,       // normal — well-stocked [APPROX]
    nutrientMixStatus: "balanced",          // normal
    energyAvailableKwh: 420,               // normal — healthy reserve [APPROX]
    energyDailyConsumptionKwh: 195,        // normal — [APPROX] lighting + climate + pumps
    energyReserveHours: 51,                // normal — derived: (420 / 195) × 24 [APPROX]
  },

  // ── Nutrition status ────────────────────────────────────────────────────────
  // Targets from MCP: 12,000 kcal/day (4 × 3,000), 450 g protein/day (4 × ~112g)
  // Values below are what calculateNutrition() produces for this seed state.
  nutrition: {
    dailyCaloriesProduced: 8190,           // normal — 68% coverage [calculator-derived]
    dailyCaloriesTarget: 12000,            // MCP-grounded
    caloricCoveragePercent: 68,            // normal [calculator-derived]
    dailyProteinProducedG: 376,            // normal — 84% of target [calculator-derived]
    dailyProteinTargetG: 450,              // MCP-grounded
    proteinCoveragePercent: 84,            // normal [calculator-derived]
    micronutrientAdequacyPercent: 100,     // normal — all zones healthy
    nutritionalCoverageScore: 79,          // normal — weighted composite [calculator-derived]
    daysSafe: 287,                         // normal — comfortable runway [calculator-derived]
    trend: "stable",                       // nominal state = stable
  },

  // ── No active scenario ──────────────────────────────────────────────────────
  activeScenario: null,

  // ── Seed event log ──────────────────────────────────────────────────────────
  eventLog: [
    {
      eventId: "evt-seed-003",
      timestamp: "2026-03-19T08:00:00.000Z",
      missionDay: 87,
      level: "info",
      message: "Zone D radish on track for harvest in 12 days.",
      zoneId: "zone-d",
    },
    {
      eventId: "evt-seed-002",
      timestamp: "2026-03-18T14:00:00.000Z",
      missionDay: 86,
      level: "info",
      message: "Water recycling efficiency at 91%. All systems nominal.",
    },
    {
      eventId: "evt-seed-001",
      timestamp: "2026-03-17T09:00:00.000Z",
      missionDay: 85,
      level: "info",
      message: "Mission day 85 check complete. All zones healthy. Nutrition coverage at 89%.",
    },
  ],

  lastUpdated: "2026-03-19T10:00:00.000Z",
} satisfies MissionState;
