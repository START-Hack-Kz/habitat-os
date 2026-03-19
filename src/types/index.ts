export type TabId =
  | "overview"
  | "crops"
  | "resources"
  | "nutrition"
  | "risk"
  | "agent";

export type StatusTone = "NOM" | "CAU" | "ABT";
export type NoticeLevel = "ok" | "info" | "warn" | "crit";
export type AlertLevel = "nom" | "cau" | "abt";
export type LogEntryType = "act" | "wrn" | "alr" | "inf";
export type ButtonTone = "default" | "primary" | "danger";

export interface CropNutrientSlice {
  label: string;
  value: number;
  color: string;
}

export interface CropData {
  id: string;
  emoji: string;
  name: string;
  stage: string;
  zone: string;
  role: string;
  healthScore: number;
  healthLevel: StatusTone;
  projectedYieldKg: number;
  targetYieldKg: number;
  allocationPct: number;
  stressLabel: string;
  harvestSol: string;
  sparkPoints: number[];
  sparkColor: string;
  nutrients: CropNutrientSlice[];
}

export interface EnvParam {
  id: string;
  label: string;
  value: string;
  unit: string;
  fillPct: number;
  fillCol: string;
  warmFlag: string;
}

export interface OverviewLogItem {
  id: string;
  type: LogEntryType;
  icon: string;
  message: string;
  meta: string;
  confidence: string;
  confidenceLevel: StatusTone;
}

export interface FullAgentLogItem extends OverviewLogItem {
  extra: string;
}

export interface TimelineEvent {
  id: string;
  sol: string;
  label: string;
  dotColor: string;
  event: string;
}

export interface WaterAllocItem {
  id: string;
  zoneName: string;
  detail: string;
  fillPct: number;
  fillColor: string;
  offline?: boolean;
}

export interface GaugeItem {
  id: string;
  label: string;
  value: string;
  fillPct: number;
  fillColor: string;
  level: StatusTone;
}

export interface NutrientRow {
  id: string;
  nutrient: string;
  current: string;
  target: string;
  coverage: string;
  coverageLevel: StatusTone;
  source: string;
}

export interface FragilityItem {
  id: string;
  icon: string;
  title: string;
  score: string;
  scoreLevel: StatusTone;
  detail: string;
}

export interface MissionMemoryItem {
  id: string;
  sol: string;
  text: string;
  tags: string[];
}

export interface Tradeoff {
  id: string;
  title: string;
  benefit: string;
  cost: string;
  level: StatusTone;
}

export interface ScenarioCard {
  id: string;
  key: string;
  label: string;
  before: string[];
  after: string[];
  response: string;
  level: StatusTone;
}

export interface ChatReply {
  id: string;
  role: "system" | "user" | "agent";
  text: string;
}

export interface GridCell {
  id: string;
  emoji: string;
  label: string;
  statusClass: string;
  modifierClass?: string;
}

export interface OverviewMetric {
  id: string;
  label: string;
  value: string;
  sub: string;
  progress: number;
  progressColor: string;
  level?: StatusTone;
}

export interface CropMetric {
  id: string;
  label: string;
  value: string;
  sub: string;
  progress: number;
  progressColor: string;
  level?: StatusTone;
}

export interface CropStageNode {
  id: string;
  label: string;
  sol: string;
  state: "done" | "active" | "future";
}

export interface CropDependencyRow {
  id: string;
  zoneSystem: string;
  functionLabel: string;
  dependency: string;
  fallback: string;
  impact: string;
  level: StatusTone;
}

export interface ResourceMetric {
  id: string;
  label: string;
  value: string;
  sub: string;
  progress: number;
  progressColor: string;
  level?: StatusTone;
}

export interface FailureReallocColumn {
  id: string;
  title: string;
  rows: Array<{
    label: string;
    value: string;
    level?: StatusTone;
  }>;
}

export interface RiskMetric {
  id: string;
  label: string;
  value: string;
  sub: string;
  progress: number;
  progressColor: string;
  level?: StatusTone;
}

export interface EmergencyEntry {
  id: string;
  type: "act" | "wrn" | "inf";
  icon: string;
  message: string;
  meta: string;
  responsePlan?: string[];
}

export interface ScenarioSimulation {
  id: string;
  label: string;
  tone: "default" | "danger";
  level: StatusTone;
  note: string;
  before: Array<{ label: string; value: string }>;
  after: Array<{ label: string; value: string; level?: StatusTone }>;
}

export interface FailureImpactColumn {
  id: string;
  title: string;
  rows: Array<{
    label: string;
    value: string;
    level?: StatusTone;
  }>;
}

export interface AgentMetric {
  id: string;
  label: string;
  value: string;
  sub: string;
  progress: number;
  progressColor: string;
  level?: StatusTone;
}

export interface TradeoffOption {
  id: string;
  label: string;
  pros: string;
  cons: string;
  confidencePct: number;
  confidenceLevel: StatusTone;
  note: string;
}

export interface TradeoffDecision {
  id: string;
  title: string;
  status: StatusTone;
  summary: string;
  options: TradeoffOption[];
}

export interface ConfidenceRow {
  id: string;
  recommendation: string;
  confidencePct: number;
  confidenceLevel: StatusTone;
  authorization: "AUTO-APPROVED" | "CREW REVIEW" | "CREW REQUIRED";
}

export interface TabDefinition {
  id: TabId;
  label: string;
  kicker: string;
  description: string;
  alertCount?: number;
}

export interface HeaderModel {
  title: string;
  subtitle: string;
  missionDay: number;
  missionDurationTotal: number;
  agentState: string;
  lastAction: string;
  systemTone: StatusTone;
  systemLabel: string;
}

export interface PageHero {
  eyebrow: string;
  title: string;
  subtitle: string;
  body: string;
}

export interface PageContent {
  introTitle: string;
  introBody: string;
}

export interface MissionDataBundle {
  headerModel: HeaderModel;
  tabs: TabDefinition[];
  pageHero: PageHero;
  pageContent: Record<TabId, PageContent>;
  overviewAlert: { label: string; body: string; level: AlertLevel };
  riskAlert: { label: string; body: string; level: AlertLevel };
  crops: CropData[];
  envParams: EnvParam[];
  overviewLog: OverviewLogItem[];
  fullAgentLog: FullAgentLogItem[];
  timeline: TimelineEvent[];
  waterAlloc: WaterAllocItem[];
  npkGauges: GaugeItem[];
  energyGauges: GaugeItem[];
  riskGauges: GaugeItem[];
  nutrients: NutrientRow[];
  fragility: FragilityItem[];
  missionMemory: MissionMemoryItem[];
  tradeoffs: Tradeoff[];
  scenarios: ScenarioCard[];
  chatReplies: ChatReply[];
  ghCells: GridCell[];
  overviewMetrics: OverviewMetric[];
  cropMetrics: CropMetric[];
  cropStages: Record<string, CropStageNode[]>;
  cropDependencies: CropDependencyRow[];
  resourceMetrics: ResourceMetric[];
  failureRealloc: FailureReallocColumn[];
  riskMetrics: RiskMetric[];
  emergencyLog: EmergencyEntry[];
  scenarioSimulations: ScenarioSimulation[];
  failureImpact: FailureImpactColumn[];
  agentMetrics: AgentMetric[];
  tradeoffDecisions: TradeoffDecision[];
  confidenceRows: ConfidenceRow[];
  repoSignals: {
    panelCount: number;
    endpointCount: number;
    scenarioTypeCount: number;
  };
}

export type BackendMissionStatus =
  | "nominal"
  | "warning"
  | "critical"
  | "nutrition_preservation_mode";

export type BackendCropType = "lettuce" | "potato" | "beans" | "radish";
export type BackendZoneStatus =
  | "healthy"
  | "stressed"
  | "critical"
  | "harvesting"
  | "offline";
export type BackendStressType =
  | "none"
  | "water_stress"
  | "temperature_drift"
  | "nutrient_imbalance"
  | "energy_pressure";
export type BackendStressSeverity =
  | "none"
  | "low"
  | "moderate"
  | "high"
  | "critical";
export type BackendScenarioType =
  | "water_recycling_decline"
  | "energy_budget_reduction"
  | "temperature_control_failure";
export type BackendScenarioSeverity = "mild" | "moderate" | "critical";
export type BackendEventLevel = "info" | "warning" | "critical";
export type BackendNutrientMixStatus = "balanced" | "watch" | "critical";
export type BackendNutritionTrend = "improving" | "stable" | "declining";
export type BackendPlannerMode = "normal" | "nutrition_preservation";
export type BackendPlannerActionType =
  | "reallocate_water"
  | "reduce_lighting"
  | "adjust_temperature"
  | "flag_zone_offline";

export interface BackendZoneStress {
  active: boolean;
  type: BackendStressType;
  severity: BackendStressSeverity;
  summary: string;
}

export interface BackendCropZone {
  zoneId: string;
  name: string;
  cropType: BackendCropType;
  areaM2: number;
  growthDay: number;
  growthCycleDays: number;
  growthProgressPercent: number;
  projectedYieldKg: number;
  allocationPercent: number;
  status: BackendZoneStatus;
  stress: BackendZoneStress;
}

export interface BackendResourceState {
  waterReservoirL: number;
  waterRecyclingEfficiencyPercent: number;
  waterDailyConsumptionL: number;
  nutrientSolutionLevelPercent: number;
  nutrientMixStatus: BackendNutrientMixStatus;
  energyAvailableKwh: number;
  energyDailyConsumptionKwh: number;
  energyReserveHours: number;
}

export interface BackendNutritionStatus {
  dailyCaloriesProduced: number;
  dailyCaloriesTarget: number;
  caloricCoveragePercent: number;
  dailyProteinProducedG: number;
  dailyProteinTargetG: number;
  proteinCoveragePercent: number;
  micronutrientAdequacyPercent: number;
  nutritionalCoverageScore: number;
  daysSafe: number;
  trend: BackendNutritionTrend;
}

export interface BackendFailureScenario {
  scenarioId: string;
  type: BackendScenarioType;
  severity: BackendScenarioSeverity;
  title: string;
  description: string;
  injectedAt: string;
  affectedZoneIds: string[];
  parameterOverrides: Record<string, number>;
}

export interface BackendEventLogEntry {
  eventId: string;
  timestamp: string;
  missionDay: number;
  level: BackendEventLevel;
  message: string;
  zoneId?: string;
}

export interface BackendMissionState {
  missionId: string;
  missionDay: number;
  missionDurationDays: number;
  crewSize: number;
  status: BackendMissionStatus;
  zones: BackendCropZone[];
  resources: BackendResourceState;
  nutrition: BackendNutritionStatus;
  activeScenario: BackendFailureScenario | null;
  eventLog: BackendEventLogEntry[];
  lastUpdated: string;
}

export interface BackendScenarioSeverityOption {
  severity: BackendScenarioSeverity;
  label: string;
  effectSummary: string;
  parameterOverrides: Record<string, number>;
}

export interface BackendScenarioCatalogItem {
  scenarioType: BackendScenarioType;
  label: string;
  description: string;
  affectedResources: string[];
  nutritionRisk: string;
  severities: BackendScenarioSeverityOption[];
}

export interface BackendPlannerAction {
  type: BackendPlannerActionType;
  targetZoneId?: string;
  description: string;
  reason: string;
}

export interface BackendNutritionForecast {
  before: BackendNutritionStatus;
  after: BackendNutritionStatus;
}

export interface BackendPlannerOutput {
  mode: BackendPlannerMode;
  recommendedActions: BackendPlannerAction[];
  nutritionForecast: BackendNutritionForecast;
  explanation: string;
}

export interface BackendScenarioInjectRequest {
  scenarioType: BackendScenarioType;
  severity?: BackendScenarioSeverity;
  affectedZoneIds?: string[];
}
