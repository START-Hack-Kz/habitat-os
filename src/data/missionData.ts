import aiDecisionExample from "../../shared/examples/aiDecision.example.json";
import cropProfilesExample from "../../shared/examples/cropProfiles.example.json";
import missionStateExample from "../../shared/examples/missionState.example.json";
import apiContractRaw from "../../docs/api-contract.md?raw";
import frontendHandoffRaw from "../../docs/frontend-handoff.md?raw";
import mvpScopeRaw from "../../docs/mvp-scope.md?raw";
import scenarioSchemaRaw from "../../shared/schemas/scenarioInput.schema.ts?raw";
import type {
  AgentMetric,
  CropData,
  CropNutrientSlice,
  CropDependencyRow,
  CropMetric,
  CropStageNode,
  EmergencyEntry,
  EnvParam,
  FailureReallocColumn,
  FailureImpactColumn,
  FragilityItem,
  FullAgentLogItem,
  GaugeItem,
  GridCell,
  HeaderModel,
  MissionDataBundle,
  MissionMemoryItem,
  OverviewMetric,
  OverviewLogItem,
  PageContent,
  PageHero,
  ResourceMetric,
  RiskMetric,
  ScenarioCard,
  ScenarioSimulation,
  StatusTone,
  TabDefinition,
  TimelineEvent,
  TradeoffDecision,
  Tradeoff,
  WaterAllocItem,
  NutrientRow,
  ChatReply,
  ConfidenceRow,
} from "../types";

type CropProfile = (typeof cropProfilesExample)[number];

const mission = missionStateExample;
const aiDecision = aiDecisionExample;
const profileMap = new Map<string, CropProfile>(
  cropProfilesExample.map((profile) => [profile.cropId, profile]),
);

const scenarioKeys = getScenarioTypes(scenarioSchemaRaw);
const endpointCount = countMatches(apiContractRaw, /^### \d+\./gm);
const panelCount = countMatches(frontendHandoffRaw, /^### Panel \d+/gm);

const cropPalette = [
  { emoji: "🥬", color: "var(--nom)" },
  { emoji: "🥔", color: "var(--mars-orange)" },
  { emoji: "🫛", color: "var(--aero-blue)" },
  { emoji: "🌱", color: "var(--cau)" },
  { emoji: "🥬", color: "var(--aero-blue)" },
  { emoji: "🫐", color: "var(--cau)" },
  { emoji: "🍅", color: "var(--abt)" },
  { emoji: "🌾", color: "var(--nom)" },
];

const nutrientPalette = [
  "var(--nom)",
  "var(--aero-blue)",
  "var(--cau)",
  "var(--mars-orange)",
  "var(--chrome-hi)",
];

const cropNutrientSeeds: Record<string, Array<{ label: string; value: number }>> = {
  lettuce: [
    { label: "Vitamin A", value: 34 },
    { label: "Vitamin K", value: 26 },
    { label: "Folate", value: 18 },
    { label: "Fiber", value: 12 },
    { label: "Hydration", value: 10 },
  ],
  potato: [
    { label: "Calories", value: 40 },
    { label: "Potassium", value: 24 },
    { label: "Vitamin C", value: 16 },
    { label: "Fiber", value: 12 },
    { label: "Protein", value: 8 },
  ],
  beans: [
    { label: "Protein", value: 34 },
    { label: "Folate", value: 22 },
    { label: "Iron", value: 18 },
    { label: "Magnesium", value: 14 },
    { label: "Fiber", value: 12 },
  ],
  radish: [
    { label: "Vitamin C", value: 34 },
    { label: "Fiber", value: 22 },
    { label: "Folate", value: 16 },
    { label: "Potassium", value: 16 },
    { label: "Hydration", value: 12 },
  ],
  spinach: [
    { label: "Iron", value: 28 },
    { label: "Vitamin K", value: 24 },
    { label: "Folate", value: 20 },
    { label: "Magnesium", value: 16 },
    { label: "Fiber", value: 12 },
  ],
  blueberry: [
    { label: "Antioxidants", value: 34 },
    { label: "Vitamin C", value: 22 },
    { label: "Fiber", value: 18 },
    { label: "Manganese", value: 14 },
    { label: "Polyphenols", value: 12 },
  ],
  tomato: [
    { label: "Lycopene", value: 30 },
    { label: "Vitamin C", value: 24 },
    { label: "Potassium", value: 20 },
    { label: "Folate", value: 14 },
    { label: "Fiber", value: 12 },
  ],
  soybean: [
    { label: "Protein", value: 38 },
    { label: "Iron", value: 18 },
    { label: "Folate", value: 16 },
    { label: "Magnesium", value: 16 },
    { label: "Fiber", value: 12 },
  ],
};

function buildCropNutrientSlices(cropKey: string): CropNutrientSlice[] {
  const seeds = cropNutrientSeeds[cropKey] ?? cropNutrientSeeds.radish;

  return seeds.map((slice, index) => ({
    ...slice,
    color: nutrientPalette[index % nutrientPalette.length],
  }));
}

const pageHero: PageHero = {
  eyebrow: "Milestone M5",
  title: "Mission Data Single Source",
  subtitle: "Shared UI Library + Central Mock Dataset",
  body:
    "Every dashboard surface now pulls copy and fixture content from a single typed mission data module informed by docs and shared workflow files.",
};

const missionProgressPct = Number(
  ((mission.missionDay / mission.missionDurationTotal) * 100).toFixed(1),
);

const pageContent: Record<
  MissionDataBundle["tabs"][number]["id"],
  PageContent
> = {
  overview: {
    introTitle: "I. Overview",
    introBody:
      "Workflow-aware primitives reading from the same mission dataset that powers the rest of the dashboard.",
  },
  crops: {
    introTitle: "II. Crops & Growth",
    introBody:
      "Eight crop records extend the challenge story while staying anchored to the shared crop profiles and mission-state zones.",
  },
  resources: {
    introTitle: "III. Resources",
    introBody:
      "Environmental and allocation panels now come from typed gauge and allocation arrays in missionData.ts.",
  },
  nutrition: {
    introTitle: "IV. Nutrition",
    introBody:
      "Nine nutrient records and dedicated risk gauges keep the nutrition workflow centralized and reusable.",
  },
  risk: {
    introTitle: "V. Risk & Scenarios",
    introBody:
      "Risk views are driven by schema-derived scenarios, fragility records, timeline events, and mission memory entries.",
  },
  agent: {
    introTitle: "VI. AI Intelligence",
    introBody:
      "Agent logs, tradeoffs, and chat replies are sourced from one typed data module instead of inline page strings.",
  },
};

const tabs: TabDefinition[] = [
  { id: "overview", label: "I. Overview", kicker: `${panelCount} panels`, description: pageContent.overview.introBody },
  { id: "crops", label: "II. Crops & Growth", kicker: "8 crops", description: pageContent.crops.introBody },
  { id: "resources", label: "III. Resources", kicker: `${endpointCount} endpoints`, description: pageContent.resources.introBody },
  { id: "nutrition", label: "IV. Nutrition", kicker: "9 nutrients", description: pageContent.nutrition.introBody },
  { id: "risk", label: "V. Risk & Scenarios", kicker: "4 scenarios", description: pageContent.risk.introBody, alertCount: 3 },
  { id: "agent", label: "VI. AI Intelligence", kicker: "7 log items", description: pageContent.agent.introBody },
];

const headerModel: HeaderModel = {
  title: "AETHER",
  subtitle: "Mars Autonomous Greenhouse",
  missionDay: mission.missionDay,
  missionDurationTotal: mission.missionDurationTotal,
  agentState: aiDecision.nutritionPreservationMode ? "ACTIVE" : "IDLE",
  lastAction: formatRelativeMinutes(mission.lastUpdated, aiDecision.timestamp),
  systemTone: mapMissionStatus(mission.status),
  systemLabel: mission.status.replaceAll("_", " "),
};

const crops: CropData[] = [
  ...mission.zones.map((zone, index) => {
    const profile = profileMap.get(zone.cropType);
    const palette = cropPalette[index];

    return {
      id: zone.zoneId,
      emoji: palette.emoji,
      name: profile?.label ?? zone.cropType,
      stage: `Day ${zone.growthDay}/${zone.growthCycleTotal}`,
      zone: zone.zoneId.toUpperCase(),
      role: formatMissionRole(profile?.missionRole ?? "support"),
      healthScore: Math.round(zone.growthProgressPercent),
      healthLevel: mapZoneStatus(zone.status),
      projectedYieldKg: zone.projectedYieldKg,
      targetYieldKg: Math.round(
        (profile?.yieldMax ?? Math.max(zone.projectedYieldKg, 1)) * zone.areaM2,
      ),
      allocationPct: zone.allocationPercent,
      stressLabel: zone.stress.active
        ? `${zone.stress.type} ${zone.stress.severity}`
        : "stable",
      harvestSol: `SOL ${mission.missionDay + (zone.growthCycleTotal - zone.growthDay)}`,
      sparkPoints: buildSparkPoints(Math.round(zone.growthProgressPercent)),
      sparkColor: palette.color,
      nutrients: buildCropNutrientSlices(zone.cropType),
    };
  }),
  {
    id: "zone-e",
    emoji: cropPalette[4].emoji,
    name: "Spinach",
    stage: "Day 14/32",
    zone: "ZONE-E",
    role: "Leaf reserve",
    healthScore: 83,
    healthLevel: "NOM",
    projectedYieldKg: 18,
    targetYieldKg: 21,
    allocationPct: 9,
    stressLabel: "stable",
    harvestSol: "SOL 105",
    sparkPoints: [62, 66, 71, 77, 80, 83],
    sparkColor: cropPalette[4].color,
    nutrients: buildCropNutrientSlices("spinach"),
  },
  {
    id: "zone-f",
    emoji: cropPalette[5].emoji,
    name: "Blueberry",
    stage: "Day 51/88",
    zone: "ZONE-F",
    role: "Micronutrient reserve",
    healthScore: 68,
    healthLevel: "CAU",
    projectedYieldKg: 14,
    targetYieldKg: 20,
    allocationPct: 7,
    stressLabel: "light deficit",
    harvestSol: "SOL 124",
    sparkPoints: [74, 73, 70, 69, 68, 68],
    sparkColor: cropPalette[5].color,
    nutrients: buildCropNutrientSlices("blueberry"),
  },
  {
    id: "zone-g",
    emoji: cropPalette[6].emoji,
    name: "Tomato",
    stage: "Day 39/74",
    zone: "ZONE-G",
    role: "Crew variety",
    healthScore: 57,
    healthLevel: "ABT",
    projectedYieldKg: 22,
    targetYieldKg: 34,
    allocationPct: 8,
    stressLabel: "water deficit",
    harvestSol: "SOL 122",
    sparkPoints: [77, 72, 66, 63, 59, 57],
    sparkColor: cropPalette[6].color,
    nutrients: buildCropNutrientSlices("tomato"),
  },
  {
    id: "zone-h",
    emoji: cropPalette[7].emoji,
    name: "Soybean",
    stage: "Day 28/61",
    zone: "ZONE-H",
    role: "Protein reserve",
    healthScore: 79,
    healthLevel: "NOM",
    projectedYieldKg: 26,
    targetYieldKg: 30,
    allocationPct: 11,
    stressLabel: "stable",
    harvestSol: "SOL 120",
    sparkPoints: [55, 60, 67, 71, 76, 79],
    sparkColor: cropPalette[7].color,
    nutrients: buildCropNutrientSlices("soybean"),
  },
];

const envParams: EnvParam[] = [
  {
    id: "temp",
    label: "Temperature",
    value: "23.8",
    unit: "C",
    fillPct: 66,
    fillCol: "var(--cau)",
    warmFlag: "Zone-A warm",
  },
  {
    id: "humid",
    label: "Humidity",
    value: "61",
    unit: "%",
    fillPct: 61,
    fillCol: "var(--nom)",
    warmFlag: "Within band",
  },
  {
    id: "co2",
    label: "CO2",
    value: "950",
    unit: "ppm",
    fillPct: 79,
    fillCol: "var(--aero-blue)",
    warmFlag: "Boosted",
  },
  {
    id: "par",
    label: "PAR",
    value: "200",
    unit: "umol",
    fillPct: 50,
    fillCol: "var(--mars-orange)",
    warmFlag: "Reduced",
  },
];

const overviewLog: OverviewLogItem[] = mission.eventLog.map((event, index) => ({
  id: event.eventId,
  type: mapStatusToLogType(mapEventType(event.type)),
  icon: index === 0 ? "ACT" : index === 1 ? "WRN" : "INF",
  message: sanitizeText(event.message),
  meta: `${formatIsoStamp(event.timestamp)} | ${event.zoneId ?? "SYSTEM"}`,
  confidence: `${index === 0 ? 94 : 78 - index * 6}%`,
  confidenceLevel: mapEventType(event.type),
}));

const fullAgentLog: FullAgentLogItem[] = [
  ...overviewLog.map((item, index) => ({
    ...item,
    extra: index === 0 ? "Planner override applied" : "Tracking from workflow examples",
  })),
  {
    id: aiDecision.decisionId,
    type: "act",
    icon: "ACT",
    message: sanitizeText(aiDecision.explanation),
    meta: `${formatIsoStamp(aiDecision.timestamp)} | AI ANALYZE`,
    confidence: "96%",
    confidenceLevel: "CAU",
    extra: "Nutrition preservation mode",
  },
  {
    id: "log-apply",
    type: "wrn",
    icon: "SIM",
    message: "Awaiting operator approval before applying recommended reallocations.",
    meta: "Workflow gate | POST /agent/apply",
    confidence: "88%",
    confidenceLevel: "CAU",
    extra: "No auto-apply",
  },
  {
    id: "log-poll",
    type: "inf",
    icon: "POLL",
    message: "Mission state remains poll-driven per the API contract guidance.",
    meta: "GET /mission/state | 5s cadence",
    confidence: "91%",
    confidenceLevel: "NOM",
    extra: "Frontend assumption",
  },
];

const overviewMetrics: OverviewMetric[] = [
  {
    id: "mission-progress",
    label: "Mission Progress",
    value: `${missionProgressPct}%`,
    sub: `SOL ${mission.missionDay} of ${mission.missionDurationTotal}`,
    progress: missionProgressPct,
    progressColor: "var(--mars-orange)",
  },
  {
    id: "caloric-coverage",
    label: "Caloric Coverage",
    value: `${mission.nutrition.caloricCoveragePercent}%`,
    sub: `${mission.nutrition.dailyCaloriesProduced} / ${mission.nutrition.dailyCaloriesTarget} kcal`,
    progress: mission.nutrition.caloricCoveragePercent,
    progressColor: "var(--aero-blue)",
  },
  {
    id: "protein-coverage",
    label: "Protein Coverage",
    value: `${mission.nutrition.proteinCoveragePercent}%`,
    sub: `${mission.nutrition.dailyProteinG} / ${mission.nutrition.dailyProteinTarget} g`,
    progress: mission.nutrition.proteinCoveragePercent,
    progressColor: "var(--nom)",
  },
  {
    id: "water-efficiency",
    label: "Water Efficiency",
    value: `${mission.resources.waterRecyclingEfficiency}%`,
    sub: `${mission.resources.waterDaysRemaining} days remaining`,
    progress: mission.resources.waterRecyclingEfficiency,
    progressColor:
      mission.resources.waterRecyclingEfficiency < 70 ? "var(--abt)" : "var(--cau)",
    level: mission.resources.waterRecyclingEfficiency < 70 ? "ABT" : "CAU",
  },
];

const cropMetrics: CropMetric[] = [
  {
    id: "active-cultivars",
    label: "Active Cultivars",
    value: String(crops.length),
    sub: "4 mission zones + 4 reserves",
    progress: 100,
    progressColor: "var(--nom)",
  },
  {
    id: "next-harvest",
    label: "Next Harvest",
    value: getNextHarvestSol(crops),
    sub: "Radish remains the fastest cycle",
    progress: 72,
    progressColor: "var(--cau)",
    level: "CAU",
  },
  {
    id: "projected-yield",
    label: "Projected Yield",
    value: `${getProjectedYieldCoverage(crops)}%`,
    sub: `${sumProjectedYield(crops)} kg projected`,
    progress: getProjectedYieldCoverage(crops),
    progressColor: "var(--aero-blue)",
    level: getProjectedYieldCoverage(crops) >= 75 ? "NOM" : "CAU",
  },
  {
    id: "at-risk",
    label: "At-Risk Crops",
    value: String(crops.filter((crop) => crop.healthLevel !== "NOM").length),
    sub: "Scenario-sensitive cultivars",
    progress: 38,
    progressColor: "var(--abt)",
    level: "CAU",
  },
];

const cropStages: Record<string, CropStageNode[]> = Object.fromEntries(
  crops.map((crop) => [crop.id, buildCropStages(crop)]),
);

const cropDependencies: CropDependencyRow[] = [
  {
    id: "dep-zone-a",
    zoneSystem: "Zone-A / Lettuce",
    functionLabel: "Micronutrient",
    dependency: "Irrigation + thermal control",
    fallback: "Reduce harvest cadence",
    impact: "Folate and vitamin K output falls first.",
    level: "CAU",
  },
  {
    id: "dep-zone-b",
    zoneSystem: "Zone-B / Potato",
    functionLabel: "Calories",
    dependency: "Water budget + recycle loop",
    fallback: "Protect allocation priority",
    impact: "Main caloric runway shortens if yield slips.",
    level: "NOM",
  },
  {
    id: "dep-zone-c",
    zoneSystem: "Zone-C / Beans",
    functionLabel: "Protein",
    dependency: "Stable NPK uptake",
    fallback: "Hold pod set under reduced water",
    impact: "Protein continuity drops without pod retention.",
    level: "NOM",
  },
  {
    id: "dep-zone-d",
    zoneSystem: "Zone-D / Radish",
    functionLabel: "Fast buffer",
    dependency: "Water + rapid cycle timing",
    fallback: "Harvest early if stress climbs",
    impact: "Short-term buffer output delays by 4-5 days.",
    level: "CAU",
  },
  {
    id: "dep-recycler",
    zoneSystem: "Water Recycler",
    functionLabel: "Shared utility",
    dependency: "Filter efficiency at 60%",
    fallback: "Ration and redirect flow",
    impact: "All crop yield coverage compresses under water loss.",
    level: "CAU",
  },
];

const resourceMetrics: ResourceMetric[] = [
  {
    id: "water-reserve",
    label: "Water Reserve",
    value: "71%",
    sub: `${mission.resources.waterReservoirL} L live reserve`,
    progress: 71,
    progressColor: "var(--aero-blue)",
  },
  {
    id: "energy-capacity",
    label: "Energy Capacity",
    value: "68%",
    sub: `${mission.resources.energyAvailableKwh} kWh available`,
    progress: 68,
    progressColor: "var(--cau)",
    level: "CAU",
  },
  {
    id: "npk-reserve",
    label: "NPK Reserve",
    value: "22%",
    sub: "Phosphorus is the current floor",
    progress: 22,
    progressColor: "var(--abt)",
    level: "ABT",
  },
  {
    id: "o2-balance",
    label: "O2 Balance",
    value: "+4.2%",
    sub: "Canopy remains net positive",
    progress: 54,
    progressColor: "var(--nom)",
  },
];

const failureRealloc: FailureReallocColumn[] = [
  {
    id: "failure-event",
    title: "Failure Event",
    rows: [
      {
        label: "Scenario",
        value: "Water recycling decline",
        level: "ABT",
      },
      {
        label: "Description",
        value: sanitizeText(mission.activeScenario?.description ?? "No active scenario."),
      },
      {
        label: "Trigger",
        value: "Filter degradation cut recycle efficiency to 60%",
        level: "CAU",
      },
    ],
  },
  {
    id: "realloc-actions",
    title: "Reallocation Actions",
    rows: [
      {
        label: "Water shift",
        value: "Zone-A 20 -> 10, Zone-D 10 -> 5, Zone-B 40 -> 50, Zone-C 30 -> 35",
        level: "CAU",
      },
      {
        label: "Lighting trim",
        value: "Zone-A PAR 200 -> 150 and photoperiod reduced to 14h",
      },
      {
        label: "Override path",
        value: "Manual override remains available before POST /agent/apply",
      },
    ],
  },
  {
    id: "mission-impact",
    title: "Mission Impact",
    rows: [
      {
        label: "Calories",
        value: "Coverage preserved near 76% instead of projected 41%",
        level: "NOM",
      },
      {
        label: "Tradeoff",
        value: "Radish harvest delay plus lower folate/Vitamin K output",
        level: "CAU",
      },
      {
        label: "Days Safe",
        value: "Extends crew nutrition runway by 14 days",
        level: "NOM",
      },
    ],
  },
];

const riskMetrics: RiskMetric[] = [
  {
    id: "risk-index",
    label: "Risk Index",
    value: "34/100",
    sub: "Aggregate mission instability",
    progress: 34,
    progressColor: "var(--cau)",
    level: "CAU",
  },
  {
    id: "active-emergencies",
    label: "Active Emergencies",
    value: "2",
    sub: "Critical + monitoring entries",
    progress: 50,
    progressColor: "var(--cau)",
    level: "CAU",
  },
  {
    id: "impact-24h",
    label: "24h Impact",
    value: "LOW",
    sub: "Containment plan holding",
    progress: 26,
    progressColor: "var(--aero-blue)",
  },
  {
    id: "next-review",
    label: "Next Review",
    value: "SOL 130",
    sub: "Escalation checkpoint",
    progress: 70,
    progressColor: "var(--mars-orange)",
    level: "CAU",
  },
];

const emergencyLog: EmergencyEntry[] = [
  {
    id: "emg-1",
    type: "act",
    icon: "ACTIVE",
    message: "Radish germination failure in Zone-C confirmed. Moisture variance remains under investigation.",
    meta: "SOL 087 | escalation open",
    responsePlan: [
      "1. isolate feed line delta",
      "2. hold irrigation override",
      "3. compare canopy response against baseline",
    ],
  },
  {
    id: "emg-2",
    type: "wrn",
    icon: "MON",
    message: "Zone-B moisture recovered after allocation shift, but reservoir pressure remains unstable.",
    meta: "SOL 087 | monitoring",
    responsePlan: [
      "1. maintain reduced load",
      "2. verify recycler output every 4h",
      "3. alert if pressure falls below floor",
    ],
  },
  {
    id: "emg-3",
    type: "inf",
    icon: "RES",
    message: "LED bus surge cleared after staged restart. No further canopy drift detected.",
    meta: "SOL 086 | resolved",
  },
];

const scenarioSimulations: ScenarioSimulation[] = [
  {
    id: "dust",
    label: "Dust Storm",
    tone: "default",
    level: "CAU",
    note: "Simulates reduced solar input and HVAC drag.",
    before: [
      { label: "Power margin", value: "68%" },
      { label: "PAR stability", value: "Nominal" },
      { label: "Cooling load", value: "Stable" },
    ],
    after: [
      { label: "Power margin", value: "52%", level: "CAU" },
      { label: "PAR stability", value: "Compressed", level: "CAU" },
      { label: "Cooling load", value: "Elevated", level: "CAU" },
    ],
  },
  {
    id: "water",
    label: "Water -50%",
    tone: "default",
    level: "CAU",
    note: "Replays the recycler-loss path described in the active scenario example.",
    before: [
      { label: "Reservoir runway", value: "30 days" },
      { label: "Crop allocation", value: "20/40/30/10" },
      { label: "Days safe", value: "38" },
    ],
    after: [
      { label: "Reservoir runway", value: "12 days", level: "ABT" },
      { label: "Crop allocation", value: "10/50/35/5", level: "CAU" },
      { label: "Days safe", value: "52", level: "NOM" },
    ],
  },
  {
    id: "power",
    label: "Power Failure",
    tone: "default",
    level: "CAU",
    note: "Cuts lighting surplus and forces staged load balancing.",
    before: [
      { label: "LED capacity", value: "74%" },
      { label: "Pump sync", value: "Parallel" },
      { label: "Sensor rail", value: "Nominal" },
    ],
    after: [
      { label: "LED capacity", value: "48%", level: "CAU" },
      { label: "Pump sync", value: "Staggered", level: "CAU" },
      { label: "Sensor rail", value: "Protected", level: "NOM" },
    ],
  },
  {
    id: "cascade",
    label: "Cascade Failure",
    tone: "danger",
    level: "ABT",
    note: "Compounds water, power, and canopy instability across the greenhouse.",
    before: [
      { label: "Mission risk", value: "34/100" },
      { label: "Emergency count", value: "2" },
      { label: "Crew nutrition", value: "74 score" },
    ],
    after: [
      { label: "Mission risk", value: "83/100", level: "ABT" },
      { label: "Emergency count", value: "5", level: "ABT" },
      { label: "Crew nutrition", value: "58 score", level: "ABT" },
    ],
  },
];

const failureImpact: FailureImpactColumn[] = [
  {
    id: "impact-immediate",
    title: "Immediate (0-7 sols)",
    rows: [
      { label: "Moisture", value: "Zone-C stays under watch", level: "CAU" },
      { label: "Water", value: "Recycler remains limiting utility", level: "ABT" },
      { label: "Ops", value: "Manual override window stays open" },
    ],
  },
  {
    id: "impact-short",
    title: "Short-term (8-30 sols)",
    rows: [
      { label: "Calories", value: "Potato allocation preserved", level: "NOM" },
      { label: "Micronutrients", value: "Radish + lettuce drift likely", level: "CAU" },
      { label: "Review", value: "SOL 130 checkpoint scheduled" },
    ],
  },
  {
    id: "impact-protocol",
    title: "AI Response Protocol",
    rows: [
      { label: "Analyze", value: "POST /agent/analyze required before apply" },
      { label: "Apply", value: "Operator confirms selected actions only" },
      { label: "Reset", value: "Simulation reset remains final rollback" },
    ],
  },
];

const agentMetrics: AgentMetric[] = [
  {
    id: "decisions",
    label: "Decisions",
    value: "847",
    sub: "Historical planner + AI actions",
    progress: 84,
    progressColor: "var(--aero-blue)",
  },
  {
    id: "overrides",
    label: "Crew Overrides",
    value: "12",
    sub: "Manual interventions tracked",
    progress: 24,
    progressColor: "var(--cau)",
    level: "CAU",
  },
  {
    id: "resolved",
    label: "Tradeoffs Resolved",
    value: "34",
    sub: "Active reasoning outcomes",
    progress: 68,
    progressColor: "var(--nom)",
  },
  {
    id: "latency",
    label: "Mean Latency",
    value: "1.4s",
    sub: "Decision turnaround",
    progress: 72,
    progressColor: "var(--nom)",
    level: "NOM",
  },
];

const tradeoffDecisions: TradeoffDecision[] = [
  {
    id: "decision-water",
    title: "Water Reallocation",
    status: "CAU",
    summary:
      "Redirecting water toward potato and beans preserves calories and protein, but it reduces fast-turn micronutrient buffers.",
    options: [
      {
        id: "decision-water-a",
        label: "Protect Calories",
        pros: "Maintains potato and bean output under recycler loss.",
        cons: "Lettuce and radish micronutrient output declines.",
        confidencePct: 84,
        confidenceLevel: "NOM",
        note: "Best runway extension against current water loss.",
      },
      {
        id: "decision-water-b",
        label: "Preserve Variety",
        pros: "Balances micronutrients across more zones.",
        cons: "Shortens crew caloric runway during the active scenario.",
        confidencePct: 63,
        confidenceLevel: "CAU",
        note: "Lower resilience if recycler efficiency drops again.",
      },
    ],
  },
  {
    id: "decision-lighting",
    title: "Lighting Compression",
    status: "CAU",
    summary:
      "Reducing PAR in Zone-A lowers evapotranspiration and extends water runway, but canopy recovery slows.",
    options: [
      {
        id: "decision-lighting-a",
        label: "PAR Trim",
        pros: "Cuts water demand without collapsing the canopy.",
        cons: "Slows lettuce recovery and reduces vitamin output.",
        confidencePct: 71,
        confidenceLevel: "CAU",
        note: "Recommended while energy remains stable.",
      },
      {
        id: "decision-lighting-b",
        label: "Hold Spectrum",
        pros: "Protects growth velocity and visual recovery.",
        cons: "Consumes water faster and increases thermal load.",
        confidencePct: 48,
        confidenceLevel: "ABT",
        note: "Not preferred under the current failure state.",
      },
    ],
  },
];

const confidenceRows: ConfidenceRow[] = [
  {
    id: "conf-1",
    recommendation: "Water reallocation to potato + beans",
    confidencePct: 84,
    confidenceLevel: "NOM",
    authorization: "AUTO-APPROVED",
  },
  {
    id: "conf-2",
    recommendation: "Zone-A PAR reduction",
    confidencePct: 71,
    confidenceLevel: "CAU",
    authorization: "CREW REVIEW",
  },
  {
    id: "conf-3",
    recommendation: "Reserve loop pressure clamp",
    confidencePct: 66,
    confidenceLevel: "CAU",
    authorization: "CREW REVIEW",
  },
  {
    id: "conf-4",
    recommendation: "Micronutrient supplementation swap",
    confidencePct: 59,
    confidenceLevel: "CAU",
    authorization: "CREW REVIEW",
  },
  {
    id: "conf-5",
    recommendation: "Full canopy sacrifice protocol",
    confidencePct: 38,
    confidenceLevel: "ABT",
    authorization: "CREW REQUIRED",
  },
];

const timeline: TimelineEvent[] = [
  ...mission.eventLog.map((event) => ({
    id: event.eventId,
    sol: `SOL ${event.missionDay}`,
    label: event.zoneId ?? "Mission",
    dotColor: getToneColor(mapEventType(event.type)),
    event: sanitizeText(event.message),
  })),
  ...[
    "Scenario injection recommended",
    "AI analysis window",
    "Water recovery review",
    "Crew nutrition checkpoint",
    "Light cycle compression",
    "Harvest buffer recalculation",
    "Mission review board",
  ].map((event, index) => ({
    id: `time-${index}`,
    sol: `SOL ${88 + index}`,
    label: index % 2 === 0 ? "Planning" : "Ops",
    dotColor: index % 3 === 0 ? "var(--abt)" : index % 2 === 0 ? "var(--aero-blue)" : "var(--cau)",
    event,
  })),
].slice(0, 10);

const waterAlloc: WaterAllocItem[] = [
  { id: "wa-1", zoneName: "Zone-A", detail: "20% / 140L", fillPct: 20, fillColor: "var(--cau)" },
  { id: "wa-2", zoneName: "Zone-B", detail: "40% / 140L", fillPct: 40, fillColor: "var(--nom)" },
  { id: "wa-3", zoneName: "Zone-C", detail: "30% / 140L", fillPct: 30, fillColor: "var(--aero-blue)" },
  { id: "wa-4", zoneName: "Zone-D", detail: "10% / 140L", fillPct: 10, fillColor: "var(--nom)" },
  { id: "wa-5", zoneName: "Reserve", detail: "05% / contingency", fillPct: 5, fillColor: "var(--mars-orange)" },
  { id: "wa-6", zoneName: "Loop-Beta", detail: "offline", fillPct: 0, fillColor: "var(--abt)", offline: true },
];

const npkGauges: GaugeItem[] = [
  { id: "n", label: "Nitrogen", value: `${mission.resources.nutrientN} mg/L`, fillPct: 75, fillColor: "var(--cau)", level: "CAU" },
  { id: "p", label: "Phosphorus", value: `${mission.resources.nutrientP} mg/L`, fillPct: 56, fillColor: "var(--cau)", level: "CAU" },
  { id: "k", label: "Potassium", value: `${mission.resources.nutrientK} mg/L`, fillPct: 80, fillColor: "var(--nom)", level: "NOM" },
];

const energyGauges: GaugeItem[] = [
  { id: "lights", label: "LED lights", value: "74%", fillPct: 74, fillColor: "var(--aero-blue)", level: "NOM" },
  { id: "hvac", label: "HVAC", value: "63%", fillPct: 63, fillColor: "var(--cau)", level: "CAU" },
  { id: "pumps", label: "Water pumps", value: "81%", fillPct: 81, fillColor: "var(--nom)", level: "NOM" },
  { id: "sensors", label: "Sensors", value: "92%", fillPct: 92, fillColor: "var(--nom)", level: "NOM" },
];

const riskGauges: GaugeItem[] = [
  { id: "risk-nutrition", label: "Nutritional", value: "74", fillPct: 74, fillColor: "var(--cau)", level: "CAU" },
  { id: "risk-crop", label: "Crop failure", value: "61", fillPct: 61, fillColor: "var(--cau)", level: "CAU" },
  { id: "risk-resource", label: "Resource depletion", value: "83", fillPct: 83, fillColor: "var(--abt)", level: "ABT" },
  { id: "risk-system", label: "System failure", value: "47", fillPct: 47, fillColor: "var(--aero-blue)", level: "NOM" },
  { id: "risk-mission", label: "Mission completion", value: "52", fillPct: 52, fillColor: "var(--nom)", level: "NOM" },
];

const nutrients: NutrientRow[] = [
  { id: "nut-1", nutrient: "Calories", current: "9500 kcal", target: "12000 kcal", coverage: "79%", coverageLevel: "CAU", source: "Potato backbone" },
  { id: "nut-2", nutrient: "Protein", current: "310 g", target: "450 g", coverage: "69%", coverageLevel: "CAU", source: "Beans" },
  { id: "nut-3", nutrient: "Vitamin A", current: "Adequate", target: "Adequate", coverage: "OK", coverageLevel: "NOM", source: "Lettuce" },
  { id: "nut-4", nutrient: "Vitamin C", current: "Adequate", target: "Adequate", coverage: "OK", coverageLevel: "NOM", source: "Potato + Radish" },
  { id: "nut-5", nutrient: "Vitamin K", current: "Adequate", target: "Adequate", coverage: "OK", coverageLevel: "NOM", source: "Lettuce" },
  { id: "nut-6", nutrient: "Folate", current: "Low", target: "Adequate", coverage: "Risk", coverageLevel: "ABT", source: "Lettuce + Beans" },
  { id: "nut-7", nutrient: "Vitamin D", current: "Synthetic assist", target: "Stable", coverage: "Monitored", coverageLevel: "CAU", source: "Crew reserve" },
  { id: "nut-8", nutrient: "Protein score", current: "0.69", target: "1.00", coverage: "69%", coverageLevel: "CAU", source: "Beans / Soybean" },
  { id: "nut-9", nutrient: "Iron", current: "Marginal", target: "Stable", coverage: "Watch", coverageLevel: "CAU", source: "Beans / KB" },
];

const fragility: FragilityItem[] = [
  { id: "frag-1", icon: "THM", title: "Thermal loop", score: "74", scoreLevel: "CAU", detail: "Zone-A heat drift remains the fastest path to bolting and water loss." },
  { id: "frag-2", icon: "RES", title: "Reservoir margin", score: "83", scoreLevel: "ABT", detail: "Water recycling decline is the main system-wide bottleneck in the current workflow." },
  { id: "frag-3", icon: "MIC", title: "Micronutrient gap", score: "66", scoreLevel: "CAU", detail: "Folate continuity weakens if lettuce is de-prioritized for calorie protection." },
];

const missionMemory: MissionMemoryItem[] = [
  { id: "mem-1", sol: "SOL 82", text: "Baseline mission state loaded for mid-mission demo.", tags: ["baseline", "mid-mission"] },
  { id: "mem-2", sol: "SOL 84", text: "Scenario injection flow approved for three predefined failure types.", tags: ["scenario", "workflow"] },
  { id: "mem-3", sol: "SOL 86", text: "Operator guidance updated to poll mission state after every major action.", tags: ["polling", "api"] },
  { id: "mem-4", sol: "SOL 87", text: "Water recycling decline triggered nutrition preservation analysis.", tags: ["water", "nutrition"] },
  { id: "mem-5", sol: "SOL 88", text: "Shared UI component library adopted across all tabs.", tags: ["ui", "library"] },
];

const tradeoffs: Tradeoff[] = [
  {
    id: "trade-1",
    title: "Radish / NPK",
    benefit: "Preserves higher-value calorie and protein crops under water stress.",
    cost: "Delays rapid radish harvest and weakens fast-turn buffer output.",
    level: "CAU",
  },
  {
    id: "trade-2",
    title: "Vitamin D / Energy",
    benefit: "Cuts lighting demand and extends system runway during energy compression.",
    cost: "Raises dependence on supplements and slows fresh produce recovery.",
    level: "ABT",
  },
];

const scenarios: ScenarioCard[] = [
  {
    id: "scn-dust",
    key: "dust",
    label: "Dust load",
    before: ["Solar gain stable", "HVAC within nominal band"],
    after: ["PAR compression", "HVAC draw increased"],
    response: "Shift light schedule and defer non-essential cycles until generation recovers.",
    level: "CAU",
  },
  {
    id: "scn-water",
    key: "water",
    label: "Water decline",
    before: ["Recycling above threshold", "Normal irrigation cadence"],
    after: ["Reservoir loss accelerating", "Rationing required"],
    response: "Protect potato and bean zones first; reduce low-calorie water use.",
    level: "ABT",
  },
  {
    id: "scn-power",
    key: "power",
    label: "Power budget",
    before: ["Lighting full spectrum", "Pump overlap allowed"],
    after: ["Lighting compressed", "Loads staggered"],
    response: "Trim non-critical loads and shift actions to lower-draw windows.",
    level: "CAU",
  },
  {
    id: "scn-cascade",
    key: "cascade",
    label: "Cascade failure",
    before: ["Single bottleneck", "Localized risk"],
    after: ["Cross-system coupling", "Mission-wide instability"],
    response: "Lock to preservation mode, simplify goals, and maintain crew nutrition first.",
    level: "ABT",
  },
];

const chatReplies: ChatReply[] = [
  { id: "chat-1", role: "system", text: "Mission context loaded from shared baseline state." },
  { id: "chat-2", role: "user", text: "Analyze the active scenario with a nutrition focus." },
  { id: "chat-3", role: "agent", text: sanitizeText(aiDecision.riskSummary) },
  { id: "chat-4", role: "agent", text: sanitizeText(aiDecision.comparison.summary) },
  { id: "chat-5", role: "system", text: "Awaiting operator confirmation before POST /agent/apply." },
];

const ghCells: GridCell[] = Array.from({ length: 16 }, (_, index) => ({
  id: `cell-${index + 1}`,
  emoji: index % 5 === 0 ? "💧" : index % 4 === 0 ? "🌡️" : index % 3 === 0 ? "🪴" : "🔆",
  label: `Cell ${String(index + 1).padStart(2, "0")}`,
  statusClass:
    index % 7 === 0 ? "status-abt" : index % 3 === 0 ? "status-cau" : "status-nom",
}));

const overviewGhCells: GridCell[] = [
  { id: "cell-a1", emoji: "L", label: "A1", statusClass: "status-nom" },
  { id: "cell-a2", emoji: "W", label: "A2", statusClass: "status-nom" },
  { id: "cell-a3", emoji: "S", label: "A3", statusClass: "status-nom" },
  { id: "cell-a4", emoji: "P", label: "A4", statusClass: "status-nom" },
  { id: "cell-b1", emoji: "H", label: "B1", statusClass: "status-nom" },
  { id: "cell-b2", emoji: "H", label: "B2", statusClass: "status-cau" },
  { id: "cell-b3", emoji: "W", label: "B3", statusClass: "status-nom" },
  { id: "cell-b4", emoji: "X", label: "B4", statusClass: "status-abt" },
  { id: "cell-e1", emoji: "L", label: "E1", statusClass: "status-nom" },
  { id: "cell-e2", emoji: "C", label: "E2", statusClass: "status-nom" },
  { id: "cell-e3", emoji: "W", label: "E3", statusClass: "status-nom" },
  { id: "cell-e4", emoji: "P", label: "E4", statusClass: "status-nom" },
  {
    id: "cell-f1",
    emoji: "--",
    label: "F1",
    statusClass: "status-cau",
    modifierClass: "gh-cell--ghost",
  },
  {
    id: "cell-f2",
    emoji: "--",
    label: "F2",
    statusClass: "status-cau",
    modifierClass: "gh-cell--ghost",
  },
  { id: "cell-f3", emoji: "M", label: "F3", statusClass: "status-nom" },
  { id: "cell-f4", emoji: "W", label: "F4", statusClass: "status-nom" },
];

export const missionData: MissionDataBundle = {
  headerModel,
  tabs,
  pageHero,
  pageContent,
  overviewAlert: {
    label: "Workflow",
    body: "Shared primitives are now validated against the docs and example mission workflow.",
    level: "cau",
  },
  riskAlert: {
    label: "Active Scenario",
    body: sanitizeText(mission.activeScenario?.description ?? "No active scenario."),
    level: "abt",
  },
  crops,
  envParams,
  overviewLog,
  fullAgentLog,
  timeline,
  waterAlloc,
  npkGauges,
  energyGauges,
  riskGauges,
  nutrients,
  fragility,
  missionMemory,
  tradeoffs,
  scenarios,
  chatReplies,
  ghCells: overviewGhCells,
  overviewMetrics,
  cropMetrics,
  cropStages,
  cropDependencies,
  resourceMetrics,
  failureRealloc,
  riskMetrics,
  emergencyLog,
  scenarioSimulations,
  failureImpact,
  agentMetrics,
  tradeoffDecisions,
  confidenceRows,
  repoSignals: {
    panelCount,
    endpointCount,
    scenarioTypeCount: scenarioKeys.length,
  },
};

export { chatReplies };
export { confidenceRows };
export { crops };
export { cropDependencies };
export { cropMetrics };
export { cropStages };
export { energyGauges };
export { envParams };
export { failureRealloc };
export { fragility };
export { fullAgentLog };
export { failureImpact };
export { emergencyLog };
export { agentMetrics };
export const overviewGridCells = missionData.ghCells;
export const { overviewAlert } = missionData;
export { overviewLog };
export { headerModel };
export { missionMemory };
export { npkGauges };
export { nutrients };
export { overviewMetrics };
export const pageContentByTab = missionData.pageContent;
export const missionHero = missionData.pageHero;
export { resourceMetrics };
export { riskMetrics };
export const { repoSignals } = missionData;
export const { riskAlert } = missionData;
export { riskGauges };
export { scenarioSimulations };
export { scenarios };
export const missionTabs = missionData.tabs;
export { timeline };
export { tradeoffDecisions };
export { tradeoffs };
export { waterAlloc };

function countMatches(source: string, pattern: RegExp): number {
  return Array.from(source.matchAll(pattern)).length;
}

function getScenarioTypes(source: string): string[] {
  const match = source.match(/export type ScenarioType = ([^;]+);/);
  if (!match) {
    return [];
  }
  return match[1]
    .split("|")
    .map((item) => item.trim().replaceAll('"', ""))
    .filter(Boolean);
}

function mapMissionStatus(status: string): StatusTone {
  switch (status) {
    case "nominal":
      return "NOM";
    case "warning":
    case "nutrition_preservation_mode":
      return "CAU";
    case "critical":
      return "ABT";
    default:
      return "CAU";
  }
}

function mapZoneStatus(status: string): StatusTone {
  switch (status) {
    case "healthy":
    case "harvesting":
      return "NOM";
    case "stressed":
    case "replanting":
      return "CAU";
    case "critical":
    case "offline":
      return "ABT";
    default:
      return "CAU";
  }
}

function mapEventType(type: string): StatusTone {
  switch (type) {
    case "critical":
    case "ai_action":
      return "ABT";
    case "warning":
    case "scenario_injected":
    case "replant":
      return "CAU";
    default:
      return "NOM";
  }
}

function mapStatusToLogType(status: StatusTone): OverviewLogItem["type"] {
  switch (status) {
    case "ABT":
      return "alr";
    case "CAU":
      return "wrn";
    case "NOM":
      return "inf";
    default:
      return "act";
  }
}

function getToneColor(status: StatusTone): string {
  switch (status) {
    case "NOM":
      return "var(--nom)";
    case "CAU":
      return "var(--cau)";
    case "ABT":
      return "var(--abt)";
    default:
      return "var(--aero-blue)";
  }
}

function buildCropStages(crop: CropData): CropStageNode[] {
  const progress = crop.healthScore / 100;
  const activeIndex = Math.min(4, Math.max(0, Math.floor(progress * 5)));
  const baseSol = Number.parseInt(crop.harvestSol.replace("SOL ", ""), 10) - 16;
  const labels = ["Seed", "Root", "Canopy", "Bulk", "Harvest"];

  return labels.map((label, index) => ({
    id: `${crop.id}-${label.toLowerCase()}`,
    label,
    sol: `SOL ${baseSol + index * 4}`,
    state: index < activeIndex ? "done" : index === activeIndex ? "active" : "future",
  }));
}

function getNextHarvestSol(items: CropData[]): string {
  const next = Math.min(
    ...items.map((crop) => Number.parseInt(crop.harvestSol.replace("SOL ", ""), 10)),
  );
  return `SOL ${next}`;
}

function sumProjectedYield(items: CropData[]): number {
  return Math.round(items.reduce((sum, crop) => sum + crop.projectedYieldKg, 0));
}

function getProjectedYieldCoverage(items: CropData[]): number {
  const projected = items.reduce((sum, crop) => sum + crop.projectedYieldKg, 0);
  const target = items.reduce((sum, crop) => sum + crop.targetYieldKg, 0);

  return Math.round((projected / target) * 100);
}

function formatMissionRole(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildSparkPoints(seed: number): number[] {
  return [seed - 18, seed - 10, seed - 6, seed - 3, seed - 1, seed].map((value) =>
    Math.max(24, value),
  );
}

function sanitizeText(value: string): string {
  return value
    .replaceAll("Â°C", " C")
    .replaceAll("Âµmol/mÂ²/s", " umol/m2/s")
    .replaceAll("â€”", "-")
    .replaceAll("â€“", "-")
    .replaceAll("Ã—", "x")
    .replaceAll("Â·", "·")
    .replaceAll("â†’", "->");
}

function formatRelativeMinutes(fromIso: string, toIso: string): string {
  const minutes = Math.max(
    0,
    Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000),
  );
  return `${minutes}m ago`;
}

function formatIsoStamp(value: string): string {
  const date = new Date(value);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day}/${month} ${hours}:${minutes}Z`;
}

void mvpScopeRaw;
void ghCells;
