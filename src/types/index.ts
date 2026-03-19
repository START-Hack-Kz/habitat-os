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
  repoSignals: {
    panelCount: number;
    endpointCount: number;
    scenarioTypeCount: number;
  };
}
