import { renderHeader } from "./components/header";
import { mountGreenhouseLanding, renderGreenhouseLanding } from "./components/greenhouseLanding";
import { renderNavigation } from "./components/navigation";
import {
  fetchAgentAnalysis,
  fetchAgentChat,
  fetchMissionState,
  fetchPlannerAnalysis,
  fetchScenarioCatalog,
  injectScenario,
  resetSimulation,
  tweakSimulation,
} from "./data/api";
import { getGreenhouseById, greenhouseCatalog } from "./data/greenhouses";
import { getZoneCompositionProfile } from "./data/zoneComposition";
import {
  type AutoRemediationPlan,
  createAutoRemediationPlan,
  createAutomatedResponse,
} from "./monitoring/autoRemediation";
import {
  evaluateZoneSensor,
  formatControlActionType,
  reconcileControlActions,
} from "./monitoring/controlActions";
import type {
  AlertLevel,
  AutomatedControlResponse,
  BackendAgentAnalysis,
<<<<<<< HEAD
  BackendAgentChatConfidence,
=======
  BackendAgentAnalyzeFocus,
>>>>>>> 3ce8c794337794602881965d18258dc26accf9e6
  BackendAgentChatResponse,
  BackendCropZone,
  BackendEventLogEntry,
  BackendMissionState,
  BackendPlannerOutput,
  BackendScenarioCatalogItem,
  BackendScenarioSeverity,
<<<<<<< HEAD
  GreenhouseSummary,
=======
  ChatReply,
  ControlActionItem,
  ControlAlert,
  ControlLogEntry,
>>>>>>> 3ce8c794337794602881965d18258dc26accf9e6
  HeaderModel,
  StatusTone,
  TabDefinition,
  TabId,
} from "./types";
import {
  renderAlertStrip,
  renderDataTable,
  renderGaugeBar,
  renderKpiTile,
  renderLogEntry,
  renderNotice,
  renderNutrientPieChart,
  renderPanel,
  renderStatusBadge,
} from "./ui/primitives";

type AppView = "landing" | "detail";

interface AppState {
  view: AppView;
  activeGreenhouseId: string;
  activeTab: TabId;
  selectedZoneId: string;
  selectedScenarioType: BackendScenarioCatalogItem["scenarioType"] | "";
  mission: BackendMissionState | null;
  scenarios: BackendScenarioCatalogItem[];
  planner: BackendPlannerOutput | null;
  agent: BackendAgentAnalysis | null;
<<<<<<< HEAD
  companionMessages: CompanionMessage[];
  companionLog: CompanionLogItem[];
  companionBusy: boolean;
=======
  agentFocus: BackendAgentAnalyzeFocus;
  agentIncidents: AgentIncidentItem[];
  agentChatDraft: string;
  agentChatHistory: ChatReply[];
  agentChatResponse: BackendAgentChatResponse | null;
  agentBusy: boolean;
  controlActions: ControlActionItem[];
  automationResponses: AutomatedControlResponse[];
  controlLog: ControlLogEntry[];
  controlAlert: ControlAlert | null;
  activeControlIssueRanks: Record<string, number>;
  automationInFlight: Record<string, string>;
>>>>>>> 3ce8c794337794602881965d18258dc26accf9e6
  booting: boolean;
  busy: boolean;
  syncMessage: string;
  error: string;
  pollIntervalMs: number;
}

interface MetricTileData {
  label: string;
  value: string;
  sub: string;
  progress: number;
  progressColor: string;
  level?: StatusTone;
}

interface NutritionMiniRow {
  label: string;
  value: string;
  tone: StatusTone;
  badge: string;
}

interface GrowthStageData {
  label: string;
  sol: string;
  state: "done" | "active" | "future";
}

interface OverviewResourceTileData {
  label: string;
  value: string;
  unit: string;
  status: string;
  fillPct: number;
  fillColor: string;
  caution: boolean;
}

interface SensorReadingData {
  label: string;
  value: string;
  state: string;
  tone: StatusTone;
}

interface CombinedLogItem {
  timestamp: string;
  rendered: string;
}

type ZoneSensorKey = keyof BackendCropZone["sensors"];

interface AgentIncidentItem {
  id: string;
  fingerprint: string;
  recordedAt: string;
  focus: BackendAgentAnalyzeFocus;
  missionStatus: BackendMissionState["status"];
  scenarioLabel: string | null;
  analysis: BackendAgentAnalysis;
}

interface MicronutrientMiniData {
  id: string;
  label: string;
  produced: string;
  target: string;
  coveragePercent: number;
  tone: StatusTone;
}

interface CompanionMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  meta?: string;
}

interface CompanionLogItem {
  id: string;
  kind: "cmd" | "fact" | "next";
  line: string;
  body: string;
  tone: StatusTone;
}

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "I. Overview" },
  { id: "crops", label: "II. Crops & Growth" },
  { id: "resources", label: "III. Resources" },
  { id: "nutrition", label: "IV. Nutrition" },
  { id: "risk", label: "V. Risk & Scenarios" },
  { id: "agent", label: "VI. Companion" },
];

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_CONTROL_APPLY_DELAY_MS = 1_400;
const MISSION_POLL_INTERVAL_MS = Math.max(
  5_000,
  Number(import.meta.env.VITE_MISSION_POLL_MS ?? DEFAULT_POLL_INTERVAL_MS),
);
const CONTROL_APPLY_DELAY_MS = Math.max(
  400,
  Number(import.meta.env.VITE_CONTROL_APPLY_DELAY_MS ?? DEFAULT_CONTROL_APPLY_DELAY_MS),
);

export function renderApp(root: HTMLDivElement): void {
  const initialRoute = parseRoute(window.location.pathname);
  let landingSceneController: { dispose: () => void } | null = null;
  const state: AppState = {
    view: initialRoute.view,
    activeGreenhouseId: initialRoute.greenhouseId,
    activeTab: "overview",
    selectedZoneId: "",
    selectedScenarioType: "",
    mission: null,
    scenarios: [],
    planner: null,
    agent: null,
<<<<<<< HEAD
    companionMessages: [],
    companionLog: [],
    companionBusy: false,
=======
    agentFocus: "mission_overview",
    agentIncidents: [],
    agentChatDraft: "",
    agentChatHistory: [],
    agentChatResponse: null,
    agentBusy: false,
    controlActions: [],
    automationResponses: [],
    controlLog: [],
    controlAlert: null,
    activeControlIssueRanks: {},
    automationInFlight: {},
>>>>>>> 3ce8c794337794602881965d18258dc26accf9e6
    booting: true,
    busy: false,
    syncMessage: "Connecting to live mission state.",
    error: "",
    pollIntervalMs: MISSION_POLL_INTERVAL_MS,
  };
  let pollTimer: number | null = null;
  let lastDecisionSupportKey = "";
  let lastAutoAnalyzeKey = "";

  const draw = () => {
    if (state.view === "landing") {
      root.innerHTML = renderLandingShell(state);
      landingSceneController?.dispose();
      const landingRoot = root.querySelector<HTMLElement>(".landing-scene");
      if (landingRoot) {
        landingSceneController = mountGreenhouseLanding(landingRoot, {
          greenhouses: greenhouseCatalog,
          onSelect: navigateToGreenhouse,
        });
      }
      return;
    }

    landingSceneController?.dispose();
    landingSceneController = null;

    const greenhouse = getActiveGreenhouse(state);
    const headerModel = createHeaderModel(state.mission, state.planner, state.agent, greenhouse);
    const navTabs = createNavigationTabs(state.mission, state.agent);

    root.innerHTML = `
      <div class="app-frame">
        ${renderHeader(headerModel)}
        ${renderNavigation(navTabs, state.activeTab)}

        <div class="app-shell">
          ${renderGreenhouseContextBar(greenhouse)}
          ${state.error ? renderErrorStrip(state.error) : ""}
          ${state.busy ? renderBusyStrip(state.syncMessage) : ""}
          ${
            state.booting && !state.mission
              ? renderBootState()
              : `
                <main class="workspace">
                  ${renderPage(state)}
                </main>
              `
          }
          ${renderAutomationRail(state.automationResponses)}
        </div>
      </div>
    `;
  };

  root.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const greenhouseTrigger = target.closest<HTMLElement>("[data-greenhouse-open]");
    const tabButton = target.closest<HTMLElement>("[data-tab-target]");
    const homeTrigger = target.closest<HTMLElement>("[data-route-home]");
    const zoneTrigger = target.closest<HTMLElement>("[data-zone-select]");
    const injectTrigger = target.closest<HTMLElement>("[data-scenario-inject]");
    const resetTrigger = target.closest<HTMLElement>("[data-scenario-reset]");
    const plannerRefresh = target.closest<HTMLElement>("[data-planner-refresh]");
    const agentAnalyze = target.closest<HTMLElement>("[data-agent-analyze]");
    const agentSend = target.closest<HTMLElement>("[data-agent-send]");

    if (greenhouseTrigger) {
      const greenhouseId = greenhouseTrigger.dataset.greenhouseOpen ?? "";

      if (getGreenhouseById(greenhouseId)) {
        navigateToGreenhouse(greenhouseId);
      }

      return;
    }

    if (homeTrigger) {
      navigateToLanding();
      return;
    }

    if (tabButton) {
      const nextTab = tabButton.dataset.tabTarget as TabId | undefined;

      if (nextTab && nextTab !== state.activeTab) {
        state.activeTab = nextTab;
        draw();
      }

      return;
    }

    if (zoneTrigger) {
      const zoneId = zoneTrigger.dataset.zoneSelect ?? "";

      if (zoneId) {
        state.selectedZoneId = zoneId;

        draw();
      }

      return;
    }

    if (injectTrigger) {
      const scenarioType = injectTrigger.dataset.scenarioInject as AppState["selectedScenarioType"];
      const severity = injectTrigger.dataset.scenarioSeverity as BackendScenarioSeverity | undefined;

      if (scenarioType && severity) {
        void runScenarioInject(scenarioType, severity);
      }

      return;
    }

    if (resetTrigger) {
      void runScenarioReset();
      return;
    }

    if (plannerRefresh) {
      void refreshPlanner("Refreshing planner analysis.");
      return;
    }

    if (agentAnalyze) {
      void runAgentAnalyze();
      return;
    }

    if (agentSend) {
      void runAgentChat();
    }
  });

  root.addEventListener("input", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.matches("[data-agent-input]")) {
      state.agentChatDraft = target.value;
    }
  });

  root.addEventListener("keydown", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.matches("[data-agent-input]") && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void runAgentChat();
    }
  });

  root.addEventListener("submit", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLFormElement) || !target.matches("[data-agent-form]")) {
      return;
    }

    event.preventDefault();
    const formData = new FormData(target);
    const question = String(formData.get("question") ?? "").trim();

    if (!question || state.companionBusy) {
      return;
    }

    void sendCompanionMessage(question);
  });

  window.addEventListener("popstate", () => {
    const route = parseRoute(window.location.pathname);
    state.view = route.view;
    state.activeGreenhouseId = route.greenhouseId;
    draw();
  });

  void bootstrap();
  startPolling();

  function applyMissionMonitoring(
    mission: BackendMissionState,
    emitControlEvents: boolean,
  ): boolean {
    const detection = reconcileControlActions(
      mission,
      state.activeControlIssueRanks,
      new Date().toISOString(),
    );

    state.controlActions = detection.activeActions;
    state.activeControlIssueRanks = detection.activeIssueRanks;

    if (emitControlEvents && detection.newLogEntries.length > 0) {
      state.controlLog = [...detection.newLogEntries, ...state.controlLog].slice(0, 18);
      if (!state.controlAlert || state.controlAlert.kind !== "automation") {
        state.controlAlert = detection.latestAlert;
      }
    } else if (state.controlActions.length === 0 && activeAutomationResponses(state.automationResponses).length === 0) {
      state.controlAlert = null;
    } else if (
      (!state.controlAlert || state.controlAlert.kind !== "automation") &&
      detection.latestAlert
    ) {
      state.controlAlert = detection.latestAlert;
    }

    if (emitControlEvents && detection.newLogEntries.length > 0) {
      void queueAutoRemediation(mission, detection);
    }

    return detection.shouldRefreshPlanner;
  }

  async function queueAutoRemediation(
    mission: BackendMissionState,
    detection: ReturnType<typeof reconcileControlActions>,
  ): Promise<void> {
    const triggeredKeys = [...new Set(detection.newLogEntries.map((entry) => entry.abnormalityKey))];

    for (const abnormalityKey of triggeredKeys) {
      if (state.automationInFlight[abnormalityKey]) {
        continue;
      }

      const actions = detection.activeActions.filter((action) => action.abnormalityKey === abnormalityKey);
      const plan = createAutoRemediationPlan(mission, actions, new Date().toISOString());

      if (!plan) {
        continue;
      }

      state.automationInFlight[abnormalityKey] = plan.responseId;
      void executeAutoRemediation(plan);
    }
  }

  async function executeAutoRemediation(plan: AutoRemediationPlan): Promise<void> {
    const startedAt = new Date().toISOString();
    const detectedResponse = createAutomatedResponse(plan, "detected", startedAt);
    upsertAutomationResponse(detectedResponse);
    pushAutomationLog(detectedResponse);
    state.controlAlert = createAutomationAlert(detectedResponse);
    draw();

    await wait(CONTROL_APPLY_DELAY_MS);

    const executingAt = new Date().toISOString();
    const executingResponse = {
      ...detectedResponse,
      phase: "executing" as const,
      statusLabel: plan.machineryLabel,
      message: plan.executingMessage,
      updatedAt: executingAt,
    };
    upsertAutomationResponse(executingResponse);
    pushAutomationLog(executingResponse);
    state.controlAlert = createAutomationAlert(executingResponse);
    draw();

    if (!plan.tweakRequest) {
      finalizeAutomation(plan, executingResponse, "attention");
      return;
    }

    try {
      const mission = await tweakSimulation(plan.tweakRequest);
      state.mission = mission;
      const shouldRefreshPlanner = applyMissionMonitoring(mission, false);
      syncSelections(state);

      if (shouldRefreshPlanner) {
        await refreshDecisionSupportSilently();
      }

      const phase = state.activeControlIssueRanks[plan.abnormalityKey] ? "attention" : "resolved";
      finalizeAutomation(plan, executingResponse, phase);
      state.error = "";
    } catch (error) {
      finalizeAutomation(plan, executingResponse, "attention", getErrorMessage(error));
      state.error = getErrorMessage(error);
    }
  }

  function finalizeAutomation(
    plan: AutoRemediationPlan,
    baseResponse: AutomatedControlResponse,
    phase: "resolved" | "attention",
    detail?: string,
  ): void {
    const updatedAt = new Date().toISOString();
    const finalResponse: AutomatedControlResponse = {
      ...baseResponse,
      phase,
      statusLabel: phase === "resolved" ? "Abstract response completed" : "Manual attention required",
      message:
        phase === "resolved"
          ? plan.resolvedMessage
          : `${plan.attentionMessage}${detail ? ` ${detail}` : ""}`,
      updatedAt,
    };
    upsertAutomationResponse(finalResponse);
    pushAutomationLog(finalResponse);
    state.controlAlert = createAutomationAlert(finalResponse);
    delete state.automationInFlight[plan.abnormalityKey];
    draw();
  }

  function upsertAutomationResponse(response: AutomatedControlResponse): void {
    state.automationResponses = [
      response,
      ...state.automationResponses.filter((item) => item.id !== response.id),
    ].slice(0, 12);
  }

  function pushAutomationLog(response: AutomatedControlResponse): void {
    const logEntry: ControlLogEntry = {
      id: `${response.id}:${response.phase}`,
      abnormalityKey: response.abnormalityKey,
      kind: "automation",
      timestamp: response.updatedAt,
      priority: response.priority,
      headline: response.headline,
      message: response.message,
      targetLabel: response.targetLabel,
      targetZoneId: response.targetZoneId,
      actionLabels: [response.statusLabel, ...response.actionTypes.map(formatControlActionType)],
      relatedSensors: [],
      recommendedSection: response.recommendedSection,
      autoTriggered: response.autoTriggered,
    };

    state.controlLog = [
      logEntry,
      ...state.controlLog,
    ].slice(0, 18);
  }

  function startPolling(): void {
    if (pollTimer !== null) {
      window.clearInterval(pollTimer);
    }

    pollTimer = window.setInterval(() => {
      void pollMissionState();
    }, state.pollIntervalMs);
  }

  async function bootstrap(): Promise<void> {
    state.booting = true;
    state.busy = true;
    state.syncMessage = "Loading mission, planner state, and decision support.";
    state.error = "";
    draw();

    try {
      const [missionResult, scenariosResult, plannerResult] = await Promise.allSettled([
        fetchMissionState(),
        fetchScenarioCatalog(),
        fetchPlannerAnalysis(),
      ]);

      if (missionResult.status !== "fulfilled") {
        throw missionResult.reason;
      }

      state.mission = missionResult.value;
      applyMissionMonitoring(state.mission, true);
      state.scenarios = scenariosResult.status === "fulfilled" ? scenariosResult.value : [];
      state.planner = plannerResult.status === "fulfilled" ? plannerResult.value : null;
      state.agentFocus = deriveAgentFocus(state.mission, state.planner);
      try {
        state.agent = await fetchAgentAnalysis(state.agentFocus);
        recordAgentIncident(state, state.agent, state.agentFocus);
        lastDecisionSupportKey = buildDecisionSupportKey(
          state.mission,
          state.planner,
          state.agentFocus,
        );
      } catch {
        state.agent = null;
        lastDecisionSupportKey = "";
      }
      syncSelections(state);
      state.error = "";
    } catch (error) {
      state.error = getErrorMessage(error);
    } finally {
      state.booting = false;
      state.busy = false;
      state.syncMessage = "";
      draw();
    }
  }

  async function refreshPlanner(message: string): Promise<void> {
    state.busy = true;
    state.syncMessage = message;
    draw();

    try {
      state.planner = await fetchPlannerAnalysis();
      state.agentFocus = deriveAgentFocus(state.mission, state.planner);
      state.agent = await fetchAgentAnalysis(state.agentFocus);
      recordAgentIncident(state, state.agent, state.agentFocus);
      if (state.mission) {
        lastDecisionSupportKey = buildDecisionSupportKey(
          state.mission,
          state.planner,
          state.agentFocus,
        );
        lastAutoAnalyzeKey = buildAutoAnalyzeKey(state.mission);
      }
      state.error = "";
    } catch (error) {
      state.planner = null;
      state.error = getErrorMessage(error);
    } finally {
      state.busy = false;
      state.syncMessage = "";
      draw();
    }
  }

<<<<<<< HEAD
  async function sendCompanionMessage(question: string): Promise<void> {
    state.companionMessages = [
      ...state.companionMessages,
      {
        id: `user-${Date.now()}`,
        role: "user",
        text: question,
      },
    ];
    state.companionBusy = true;
    draw();

    try {
      const response = await fetchAgentChat(question);
      state.companionMessages = [
        ...state.companionMessages,
        {
          id: `agent-${Date.now()}`,
          role: "agent",
          text: response.answer,
          meta: buildCompanionMessageMeta(response),
        },
      ];
      state.companionLog = mergeCompanionLog(state.companionLog, buildCompanionLogItems(response));
    } catch (error) {
      state.companionMessages = [
        ...state.companionMessages,
        {
          id: `agent-error-${Date.now()}`,
          role: "agent",
          text: `AETHER uplink unavailable: ${getErrorMessage(error)}`,
          meta: "uplink fault",
        },
      ];
      state.companionLog = mergeCompanionLog(state.companionLog, [
        {
          id: `log-error-${Date.now()}`,
          kind: "fact",
          line: "uplink_fault",
          body: "The chat request failed. Confirm the AI service is running on the configured uplink endpoint.",
          tone: "ABT",
        },
      ]);
    } finally {
      state.companionBusy = false;
=======
  async function runAgentAnalyze(): Promise<void> {
    state.agentBusy = true;
    state.syncMessage = "AETHER is analyzing the current mission state.";
    draw();

    try {
      state.agentFocus = deriveAgentFocus(state.mission, state.planner);
      state.agent = await fetchAgentAnalysis(state.agentFocus);
      recordAgentIncident(state, state.agent, state.agentFocus);
      if (state.mission) {
        lastDecisionSupportKey = buildDecisionSupportKey(
          state.mission,
          state.planner,
          state.agentFocus,
        );
        lastAutoAnalyzeKey = buildAutoAnalyzeKey(state.mission);
      }
      state.error = "";
    } catch (error) {
      state.error = getErrorMessage(error);
    } finally {
      state.agentBusy = false;
      state.syncMessage = "";
      draw();
    }
  }

  async function runAgentChat(): Promise<void> {
    const question = state.agentChatDraft.trim();

    if (!question || state.agentBusy) {
      return;
    }

    state.agentBusy = true;
    state.agentChatDraft = "";
    state.agentChatHistory = [
      ...state.agentChatHistory,
      {
        id: `user-${Date.now()}`,
        role: "user" as const,
        text: question,
      },
    ].slice(-18);
    draw();

    try {
      state.agentChatResponse = await fetchAgentChat(question);
      state.agentChatHistory = [
        ...state.agentChatHistory,
        {
          id: `agent-chat-${Date.now()}`,
          role: "agent" as const,
          text: state.agentChatResponse.answer,
        },
      ].slice(-18);
      state.error = "";
    } catch (error) {
      state.error = getErrorMessage(error);
    } finally {
      state.agentBusy = false;
      draw();
    }
  }

  async function refreshDecisionSupportSilently(): Promise<void> {
    try {
      state.planner = await fetchPlannerAnalysis();
      state.agentFocus = deriveAgentFocus(state.mission, state.planner);
      state.agent = await fetchAgentAnalysis(state.agentFocus);
      recordAgentIncident(state, state.agent, state.agentFocus);
      if (state.mission) {
        lastDecisionSupportKey = buildDecisionSupportKey(
          state.mission,
          state.planner,
          state.agentFocus,
        );
        lastAutoAnalyzeKey = buildAutoAnalyzeKey(state.mission);
      }
    } catch {
      // Keep the previous decision support snapshot during background polls.
    }
  }

  async function runAutomaticAgentAnalysis(reason: string): Promise<void> {
    if (!state.mission || state.agentBusy) {
      return;
    }

    state.agentBusy = true;
    pushAgentMonitorLog(
      state,
      `AETHER detected ${reason}. Auto-analysis request dispatched.`,
      state.mission.status === "critical" ? "critical" : "warning",
    );
    draw();

    try {
      state.planner = await fetchPlannerAnalysis();
      state.agentFocus = deriveAgentFocus(state.mission, state.planner);
      state.agent = await fetchAgentAnalysis(state.agentFocus);
      recordAgentIncident(state, state.agent, state.agentFocus);
      if (state.mission) {
        lastDecisionSupportKey = buildDecisionSupportKey(
          state.mission,
          state.planner,
          state.agentFocus,
        );
        lastAutoAnalyzeKey = buildAutoAnalyzeKey(state.mission);
      }
      pushAgentMonitorLog(
        state,
        `AETHER published ${formatRiskLevel(state.agent.riskLevel)} guidance: ${state.agent.riskSummary}`,
        state.agent.riskLevel === "critical"
          ? "critical"
          : state.agent.riskLevel === "high"
            ? "warning"
            : "info",
      );
      state.error = "";
    } catch (error) {
      state.error = getErrorMessage(error);
    } finally {
      state.agentBusy = false;
      draw();
    }
  }

  async function pollMissionState(): Promise<void> {
    if (state.busy) {
      return;
    }

    try {
      const mission = await fetchMissionState();
      state.mission = mission;
      const shouldRefreshPlanner = applyMissionMonitoring(mission, true);
      state.agentFocus = deriveAgentFocus(state.mission, state.planner);
      syncSelections(state);
      state.error = "";
      const nextDecisionSupportKey = buildDecisionSupportKey(
        mission,
        state.planner,
        state.agentFocus,
      );
      const nextAutoAnalyzeKey = buildAutoAnalyzeKey(mission);

      if (nextAutoAnalyzeKey && nextAutoAnalyzeKey !== lastAutoAnalyzeKey) {
        await runAutomaticAgentAnalysis(describeAutoAnalysisReason(mission));
      } else if (shouldRefreshPlanner || nextDecisionSupportKey !== lastDecisionSupportKey) {
        await refreshDecisionSupportSilently();
      } else if (!nextAutoAnalyzeKey) {
        lastAutoAnalyzeKey = "";
      }
    } catch (error) {
      state.error = getErrorMessage(error);
    } finally {
>>>>>>> 3ce8c794337794602881965d18258dc26accf9e6
      draw();
    }
  }

  async function runScenarioInject(
    scenarioType: BackendScenarioCatalogItem["scenarioType"],
    severity: BackendScenarioSeverity,
  ): Promise<void> {
    state.busy = true;
    state.syncMessage = `Injecting ${formatScenarioType(scenarioType)} (${severity}).`;
    draw();

    try {
      state.mission = await injectScenario({ scenarioType, severity });
      applyMissionMonitoring(state.mission, true);
      state.selectedScenarioType = scenarioType;
      syncSelections(state);
      state.agentFocus = deriveAgentFocus(state.mission, state.planner);

      try {
        state.planner = await fetchPlannerAnalysis();
      } catch {
        state.planner = null;
      }

      try {
        const focus = deriveAgentFocus(state.mission, state.planner);
        state.agent = await fetchAgentAnalysis(focus);
        recordAgentIncident(state, state.agent, focus);
        lastDecisionSupportKey = buildDecisionSupportKey(
          state.mission,
          state.planner,
          focus,
        );
        lastAutoAnalyzeKey = buildAutoAnalyzeKey(state.mission);
      } catch {
        state.agent = null;
        lastDecisionSupportKey = "";
        lastAutoAnalyzeKey = "";
      }

      state.error = "";
    } catch (error) {
      state.error = getErrorMessage(error);
    } finally {
      state.busy = false;
      state.syncMessage = "";
      draw();
    }
  }

  async function runScenarioReset(): Promise<void> {
    state.busy = true;
    state.syncMessage = "Resetting active scenario and refreshing mission state.";
    draw();

    try {
      state.mission = await resetSimulation();
      applyMissionMonitoring(state.mission, true);
      syncSelections(state);
      state.agentFocus = deriveAgentFocus(state.mission, state.planner);

      try {
        state.planner = await fetchPlannerAnalysis();
      } catch {
        state.planner = null;
      }

      try {
        const focus = deriveAgentFocus(state.mission, state.planner);
        state.agent = await fetchAgentAnalysis(focus);
        recordAgentIncident(state, state.agent, focus);
        lastDecisionSupportKey = buildDecisionSupportKey(
          state.mission,
          state.planner,
          focus,
        );
        lastAutoAnalyzeKey = buildAutoAnalyzeKey(state.mission);
      } catch {
        state.agent = null;
        lastDecisionSupportKey = "";
        lastAutoAnalyzeKey = "";
      }

      state.error = "";
    } catch (error) {
      state.error = getErrorMessage(error);
    } finally {
      state.busy = false;
      state.syncMessage = "";
      draw();
    }
  }

  function navigateToGreenhouse(greenhouseId: string): void {
    state.view = "detail";
    state.activeGreenhouseId = greenhouseId;
    window.history.pushState({}, "", `/greenhouse/${encodeURIComponent(greenhouseId)}`);
    draw();
  }

  function navigateToLanding(): void {
    state.view = "landing";
    window.history.pushState({}, "", "/");
    draw();
  }
}

function parseRoute(pathname: string): { view: AppView; greenhouseId: string } {
  const match = pathname.match(/^\/greenhouse\/([^/]+)\/?$/i);
  const fallbackGreenhouseId = greenhouseCatalog[0]?.id ?? "";

  if (!match) {
    return { view: "landing", greenhouseId: fallbackGreenhouseId };
  }

  const greenhouseId = decodeURIComponent(match[1]);
  return {
    view: getGreenhouseById(greenhouseId) ? "detail" : "landing",
    greenhouseId: getGreenhouseById(greenhouseId)?.id ?? fallbackGreenhouseId,
  };
}

function getActiveGreenhouse(state: AppState): GreenhouseSummary {
  return getGreenhouseById(state.activeGreenhouseId) ?? greenhouseCatalog[0];
}

function renderLandingShell(state: AppState): string {
  return `
    <div class="landing-frame">
      ${renderGreenhouseLanding(greenhouseCatalog, state.mission?.missionDay ?? null)}
    </div>
  `;
}

function renderGreenhouseContextBar(greenhouse: GreenhouseSummary): string {
  return `
    <div class="greenhouse-context">
      <button class="greenhouse-context__back" type="button" data-route-home="true">
        Return to habitat array
      </button>
      <div class="greenhouse-context__identity">
        <span class="greenhouse-context__code mono">${escapeHtml(greenhouse.code)}</span>
        <span class="greenhouse-context__name">${escapeHtml(greenhouse.name)}</span>
      </div>
    </div>
  `;
}

function renderPage(state: AppState): string {
  if (!state.mission) {
    return renderBootState();
  }

  const controlBanner = state.controlAlert ? renderControlAlert(state.controlAlert) : "";

  switch (state.activeTab) {
    case "overview":
<<<<<<< HEAD
      return renderOverview(state.mission, state.planner);
=======
      return `${controlBanner}${renderOverview(state)}`;
>>>>>>> 3ce8c794337794602881965d18258dc26accf9e6
    case "crops":
      return `${controlBanner}${renderCrops(state.mission, state.selectedZoneId)}`;
    case "resources":
      return `${controlBanner}${renderResources(state.mission, state.planner)}`;
    case "nutrition":
      return `${controlBanner}${renderNutrition(state.mission, state.planner)}`;
    case "risk":
<<<<<<< HEAD
      return renderRisk(state.mission);
    case "agent":
      return renderAgent(
        state.mission,
        state.planner,
        state.agent,
        state.companionMessages,
        state.companionLog,
        state.companionBusy,
      );
    default:
      return renderOverview(state.mission, state.planner);
  }
}

function renderOverview(
  mission: BackendMissionState,
  planner: BackendPlannerOutput | null,
): string {
=======
      return `${controlBanner}${renderRisk(state)}`;
    case "agent":
      return `${controlBanner}${renderAgent(state)}`;
    default:
      return `${controlBanner}${renderOverview(state)}`;
  }
}

function renderOverview(state: AppState): string {
  const {
    mission,
    planner,
    agent,
    selectedZoneId,
    controlActions,
    automationResponses,
    pollIntervalMs,
  } = state;

  if (!mission) {
    return renderBootState();
  }

>>>>>>> 3ce8c794337794602881965d18258dc26accf9e6
  const metrics = buildOverviewMetrics(mission);

  return `
    ${renderMissionAlert(mission)}

    <section class="overview-home">
      <div class="overview-kpi-row">
        ${metrics.map((item) => renderMetricTile(item)).join("")}
      </div>

      <div class="overview-middle">
        ${renderPanel({
          title: "Zone Operations",
          dotColor: "var(--aero-blue)",
          rightSlot: renderStatusBadge(
            mission.activeScenario ? "Scenario Live" : "Nominal Watch",
            missionTone(mission),
          ),
          children: `
            <div class="overview-zone-ops">
              <div class="overview-zone-ops__summary">
                <div class="overview-zone-ops__summary-copy">
                  <p class="overview-zone-ops__eyebrow">Live greenhouse state</p>
                  <p class="overview-zone-ops__text">
                    ${mission.activeScenario
                      ? `${escapeHtml(mission.activeScenario.title)} is active across ${mission.activeScenario.affectedZoneIds.join(", ")}.`
                      : "All four crop bays are reading from the canonical mission snapshot."}
                  </p>
                </div>
                <div class="overview-zone-ops__summary-stats">
                  ${renderStatusBadge(
                    `${mission.zones.filter((zone) => zone.stress.active).length} stressed`,
                    mission.zones.some((zone) => zone.stress.active) ? "CAU" : "NOM",
                  )}
                  ${renderStatusBadge(
                    `${mission.zones.filter((zone) => zone.status === "critical").length} critical`,
                    mission.zones.some((zone) => zone.status === "critical") ? "ABT" : "NOM",
                  )}
                </div>
              </div>
                <div class="overview-zone-grid">
                ${mission.zones
                  .map((zone) => renderZoneOperationsCard(zone, false, false))
                  .join("")}
                </div>
            </div>
          `,
        })}

        <div class="overview-stack">
          ${renderPanel({
            title: "Resource Snapshot",
            dotColor: "var(--mars-orange)",
            children: `
              <div class="overview-env-grid">
                ${buildResourceTiles(mission).map((tile) => renderResourceTile(tile)).join("")}
              </div>
              <div class="overview-resource-footer">
                ${renderStatusBadge(
                  `Water ${mission.resources.waterDaysRemaining.toFixed(1)} d`,
                  toneFromPercent(mission.resources.waterRecyclingEfficiencyPercent, 85, 65),
                )}
                ${renderStatusBadge(
                  `Energy ${mission.resources.energyDaysRemaining.toFixed(1)} d`,
                  toneFromEnergyReserve(mission.resources.energyReserveHours),
                )}
                ${renderStatusBadge(
                  `Solar ${mission.resources.solarGenerationKwhPerDay} kWh/d`,
                  mission.resources.solarGenerationKwhPerDay >=
                    mission.resources.energyDailyConsumptionKwh * 0.9
                    ? "NOM"
                    : "CAU",
                )}
              </div>
            `,
          })}

          ${renderPanel({
            title: "Crew Nutrition",
            dotColor: "var(--nom)",
            children: `
              <div class="overview-nutrition-panel">
                <div class="overview-nutrition-mini">
                  ${buildNutritionMiniRows(mission).map((row) => renderOverviewNutritionRow(row)).join("")}
                </div>
                <div class="overview-micro-grid">
                  ${buildMicronutrientMiniRows(mission)
                    .map((item) => renderMicronutrientCell(item))
                    .join("")}
                </div>
              </div>
            `,
          })}

          ${renderPanel({
            title: "Automated Responses",
            dotColor: "var(--aero-blue)",
            rightSlot: renderStatusBadge(
              `${activeAutomationResponses(automationResponses).length} active · ${controlActions.length} recommended`,
              controlActionTone(controlActions, automationResponses),
            ),
            children: renderControlActionsPanel(controlActions, automationResponses, pollIntervalMs),
          })}

          ${renderPanel({
            title: "Incident / Planner",
            dotColor: "var(--cau)",
            children: renderIncidentPanel(mission, planner, agent, controlActions, automationResponses),
          })}
        </div>
      </div>

      <div class="overview-bottom">
        ${renderPanel({
          title: "Recent Mission Log",
          dotColor: "var(--cau)",
          rightSlot:
            '<button class="overview-link-btn" type="button" data-tab-target="agent">Open agent -></button>',
          children: `
            <div class="ui-log-list">
              ${buildCombinedLogItems(mission, state.controlLog)
                .slice(0, 6)
                .map((item) => item.rendered)
                .join("")}
            </div>
          `,
        })}

        ${renderPanel({
          title: "Mission Timeline",
          dotColor: "var(--aero-blue)",
          children: `
            <div class="overview-timeline-strip">
              ${mission.eventLog.slice(0, 6).map((entry) => renderTimelineCard(entry, mission.missionDay)).join("")}
            </div>
            ${
              planner
                ? renderNotice({
                    level: "info",
                    title: "Planner mode",
                    children: `Mission planner is currently operating in ${formatPlannerMode(planner.mode)} mode.`,
                  })
                : ""
            }
          `,
        })}
      </div>
    </section>
  `;
}

function renderCrops(mission: BackendMissionState, selectedZoneId: string): string {
  const selectedZone = getSelectedZone(mission, selectedZoneId);
  const compositionProfile = getZoneCompositionProfile(selectedZone.cropType);

  return `
    <section class="crop-tab">
      <div class="crop-kpi-row">
        ${buildCropMetrics(mission).map((item) => renderMetricTile(item)).join("")}
      </div>

      ${renderPanel({
        title: "Crop Health Grid",
        dotColor: "var(--nom)",
        children: `
          <div class="crop-health-grid">
            ${mission.zones.map((zone) => renderCropHealthCard(zone, zone.zoneId === selectedZone.zoneId)).join("")}
          </div>
        `,
      })}

      <div class="crop-detail-row">
        <div class="crop-detail-primary">
          ${renderPanel({
            title: "Growth Stage Tracker",
            dotColor: "var(--aero-blue)",
            rightSlot: renderStatusBadge(selectedZone.name, zoneTone(selectedZone)),
            children: `
              <div class="crop-stage-panel">
                <div class="crop-stage-line">
                  ${buildGrowthStages(selectedZone).map((stage) => renderGrowthStageNode(stage)).join("")}
                </div>
                <div class="crop-stage-gauges">
                  ${buildZoneGauges(selectedZone, mission).map((gauge) =>
                    renderGaugeBar({
                      name: gauge.name,
                      value: gauge.value,
                      fillPct: gauge.fillPct,
                      fillColor: gauge.fillColor,
                      label: gauge.label,
                      valueMuted: gauge.valueMuted,
                    }),
                  ).join("")}
                </div>
              </div>
            `,
          })}

          ${renderPanel({
            title: "Nutrient Composition",
            dotColor: "var(--nom)",
            rightSlot: renderStatusBadge(formatCropType(selectedZone.cropType), zoneTone(selectedZone)),
            children: `
              <div class="crop-nutrient-panel">
                ${renderNutrientPieChart({
                  slices: compositionProfile.slices,
                  centerLabel: "",
                  centerValue: "",
                })}
                <div class="crop-nutrient-panel__meta">
                  <div class="crop-nutrient-legend">
                    ${compositionProfile.slices
                      .map(
                        (slice) => `
                          <div class="crop-nutrient-legend__item">
                            <span class="crop-nutrient-legend__swatch" style="background:${slice.color}"></span>
                            <span class="crop-nutrient-legend__label">${escapeHtml(slice.label)}</span>
                            <span class="crop-nutrient-legend__value">${escapeHtml(slice.detail)}</span>
                            <span class="crop-nutrient-legend__pct mono">${slice.value}%</span>
                          </div>
                        `,
                      )
                      .join("")}
                  </div>
                  <p class="crop-nutrient-note">${escapeHtml(compositionProfile.note)} for ${escapeHtml(selectedZone.name)}.</p>
                </div>
              </div>
            `,
          })}

          ${renderPanel({
            title: "Selected Zone Telemetry",
            dotColor: "var(--nom)",
            children: `
              <div class="ui-kpi-grid ui-kpi-grid--hero">
                ${buildZoneTelemetry(selectedZone).map((item) => renderMetricTile(item)).join("")}
              </div>
              ${selectedZone.stress.active
                ? renderNotice({
                    level: noticeFromTone(zoneTone(selectedZone)),
                    title: "Active stress",
                    children: selectedZone.stress.summary,
                  })
                : renderNotice({
                    level: "ok",
                    title: "Zone state",
                    children: "The live mission snapshot reports this zone as stable with no active stress flag.",
                  })}
            `,
          })}
        </div>

        <div class="crop-detail-secondary">
          ${renderPanel({
            title: "Zone Yield Outlook",
            dotColor: "var(--mars-orange)",
            children: `
              ${renderDataTable({
                columns: ["Zone", "Crop", "Day", "Progress", "Projected Yield", "Status"],
                rows: mission.zones.map((zone) => [
                  `<span class="mono">${zone.zoneId}</span>`,
                  escapeHtml(zone.name),
                  `<span class="mono">${zone.growthDay}/${zone.growthCycleDays}</span>`,
                  `<span class="mono">${zone.growthProgressPercent}%</span>`,
                  `<span class="mono">${zone.projectedYieldKg.toFixed(1)} kg</span>`,
                  renderStatusBadge(formatZoneStatus(zone.status), zoneTone(zone)),
                ]),
              })}
            `,
          })}

          ${renderPanel({
            title: "Selected Zone Conditions",
            dotColor: "var(--aero-blue)",
            rightSlot: renderStatusBadge(selectedZone.zoneId, zoneTone(selectedZone)),
            children: `
              <div class="zone-conditions-grid">
                ${buildZoneConditionRows(selectedZone)
                  .map(
                    (item) => `
                      <div class="zone-conditions-card">
                        <span class="zone-conditions-card__label">${item.label}</span>
                        <span class="zone-conditions-card__value mono">${item.value}</span>
                      </div>
                    `,
                  )
                  .join("")}
              </div>
            `,
          })}
        </div>
      </div>
    </section>
  `;
}

function renderResources(mission: BackendMissionState, planner: BackendPlannerOutput | null): string {
  return `
    <section class="resources-tab">
      <div class="resource-kpi-row">
        ${buildResourceMetrics(mission).map((item) => renderMetricTile(item)).join("")}
      </div>

      <div class="resource-main-row">
        ${renderPanel({
          title: "Water Allocation",
          dotColor: "var(--aero-blue)",
          rightSlot: mission.activeScenario ? renderStatusBadge(mission.activeScenario.severity, severityTone(mission.activeScenario.severity)) : "",
          children: `
            <div class="ui-alloc-list">
              ${mission.zones
                .map((zone) =>
                  renderGaugeBar({
                    name: `${zone.zoneId} · ${zone.name}`,
                    value: `${zone.allocationPercent}%`,
                    fillPct: zone.allocationPercent,
                    fillColor: "var(--aero-blue)",
                    label: formatCropType(zone.cropType),
                    valueMuted: `${zone.projectedYieldKg.toFixed(1)} kg projected`,
                  }),
                )
                .join("")}
            </div>
          `,
        })}

        <div class="resource-stack">
          ${renderPanel({
            title: "Nutrient Solution",
            dotColor: "var(--cau)",
            children: `
              <div class="ui-kpi-grid ui-kpi-grid--hero">
                ${buildNutrientSolutionMetrics(mission).map((item) => renderMetricTile(item)).join("")}
              </div>
            `,
          })}

          ${renderPanel({
            title: "Energy Systems",
            dotColor: "var(--nom)",
            children: `
              <div class="ui-kpi-grid ui-kpi-grid--hero">
                ${buildEnergyMetrics(mission).map((item) => renderMetricTile(item)).join("")}
              </div>
            `,
          })}
        </div>
      </div>

      ${renderPanel({
        title: "Planner Response",
        dotColor: "var(--abt)",
        rightSlot:
          '<button class="btn btn-ghost" type="button" data-planner-refresh="true">Refresh analysis</button>',
        children: planner
          ? `
              <div class="planner-response">
                <div class="failure-realloc-grid">
                <div class="failure-realloc-col planner-response__col planner-response__col--status">
                  <p class="failure-realloc-col__title">Mission Readout</p>
                  <div class="failure-realloc-col__rows">
                    <div class="failure-realloc-row">
                      <span class="failure-realloc-row__label">Planner mode</span>
                      <span class="failure-realloc-row__value">${formatPlannerMode(planner.mode)}</span>
                    </div>
                    <div class="failure-realloc-row">
                      <span class="failure-realloc-row__label">Nutrition risk</span>
                      <span class="failure-realloc-row__value">${planner.nutritionRiskDetected ? "Detected" : "Not detected"}</span>
                    </div>
                    <div class="failure-realloc-row">
                      <span class="failure-realloc-row__label">Current scenario</span>
                      <span class="failure-realloc-row__value">${mission.activeScenario ? escapeHtml(mission.activeScenario.title) : "No active scenario"}</span>
                    </div>
                  </div>
                  ${renderNotice({
                    level: planner.nutritionRiskDetected ? "warn" : "info",
                    title: "Deterministic assessment",
                    children: planner.explanation,
                  })}
                </div>

                <div class="failure-realloc-col planner-response__col planner-response__col--changes">
                  <p class="failure-realloc-col__title">Projected Changes</p>
                  <div class="failure-realloc-col__rows">
                    ${planner.changes.length > 0
                      ? planner.changes
                          .slice(0, 6)
                          .map(
                            (change) => `
                              <div class="failure-realloc-row">
                                <span class="failure-realloc-row__label">${escapeHtml(formatPlannerField(change.field))}</span>
                                <span class="failure-realloc-row__value">
                                  <span class="mono">${escapeHtml(formatPlannerValue(change.previousValue))}</span>
                                  &nbsp;→&nbsp;
                                  <span class="mono">${escapeHtml(formatPlannerValue(change.newValue))}</span>
                                </span>
                              </div>
                            `,
                          )
                          .join("")
                      : `
                          <div class="failure-realloc-row">
                            <span class="failure-realloc-row__label">Projected state</span>
                            <span class="failure-realloc-row__value">No deterministic state changes required.</span>
                          </div>
                        `}
                  </div>
                </div>

                <div class="failure-realloc-col planner-response__col planner-response__col--flags">
                  <p class="failure-realloc-col__title">Stress Flags</p>
                  <div class="failure-realloc-col__rows">
                    ${planner.stressFlags.length > 0
                      ? planner.stressFlags
                          .slice(0, 6)
                          .map(
                            (flag) => `
                              <div class="failure-realloc-row">
                                <span class="failure-realloc-row__label">${escapeHtml(flag.zoneId)} · ${escapeHtml(flag.stressType.replaceAll("_", " "))}</span>
                                <span class="failure-realloc-row__value">
                                  ${escapeHtml(flag.severity)}<br><span class="mono">${escapeHtml(flag.rule)}</span>
                                </span>
                              </div>
                            `,
                          )
                          .join("")
                      : `
                          <div class="failure-realloc-row">
                            <span class="failure-realloc-row__label">Operational watch</span>
                            <span class="failure-realloc-row__value">No planner stress flags are currently raised.</span>
                          </div>
                        `}
                  </div>
                </div>
                </div>
              </div>
            `
          : renderNotice({
              level: "warn",
              title: "Planner unavailable",
              children: "Mission and resource state are live, but the planner response was not available on this refresh.",
            }),
      })}
    </section>
  `;
}

function renderNutrition(mission: BackendMissionState, planner: BackendPlannerOutput | null): string {
  return `
    <section class="overview-home">
      <div class="content-grid">
        ${renderPanel({
          title: "Daily Output",
          dotColor: "var(--nom)",
          children: `
            <div class="ui-kpi-grid ui-kpi-grid--hero">
              ${buildNutritionMetrics(mission).map((item) => renderMetricTile(item)).join("")}
            </div>
          `,
        })}

        ${renderPanel({
          title: "Nutrition Summary",
          dotColor: "var(--cau)",
          children: renderDataTable({
            columns: ["Metric", "Current", "Target", "Coverage", "Trend"],
            rows: buildNutritionSummaryRows(mission),
          }),
        })}

        ${renderPanel({
          title: "Planner Forecast",
          dotColor: "var(--mars-orange)",
          children: `
            <div class="nutrition-panel-stack">
              ${
                planner
                  ? renderDataTable({
                      columns: ["Metric", "Before", "After"],
                      rows: buildPlannerForecastRows(planner),
                    })
                  : renderNotice({
                      level: "warn",
                      title: "Forecast unavailable",
                      children: "The mission planner is required for before/after nutrition forecasting.",
                    })
              }
              <div class="nutrition-micro-section">
                <div class="section-head section-head--compact">
                  <h3>Micronutrient Coverage</h3>
                  <span class="section-meta">Live habitat values</span>
                </div>
                <div class="overview-micro-grid nutrition-micro-grid">
                  ${buildMicronutrientMiniRows(mission).map((item) => renderMicronutrientCell(item)).join("")}
                </div>
              </div>
            </div>
          `,
        })}
      </div>
    </section>
  `;
}

<<<<<<< HEAD
function renderRisk(mission: BackendMissionState): string {
=======
function renderRisk(state: AppState): string {
  const { mission, scenarios, selectedScenarioType, controlLog, controlActions, automationResponses } = state;

  if (!mission) {
    return renderBootState();
  }

  const selectedScenario =
    scenarios.find((item) => item.scenarioType === selectedScenarioType) ??
    scenarios.find((item) => item.scenarioType === mission.activeScenario?.type) ??
    scenarios[0];

>>>>>>> 3ce8c794337794602881965d18258dc26accf9e6
  return `
    ${renderRiskAlert(mission)}

    <section class="risk-tab">
      <div class="risk-kpi-row">
        ${buildRiskMetrics(mission).map((item) => renderMetricTile(item)).join("")}
      </div>

      <div class="risk-main-row">
        ${renderPanel({
          title: "Emergency Log",
          dotColor: "var(--abt)",
          rightSlot: mission.activeScenario
            ? '<button class="btn btn-danger" type="button" data-scenario-reset="true">Reset scenario</button>'
            : renderStatusBadge("No active scenario", "NOM"),
          children: `
            <div class="risk-emergency-list">
              ${buildCombinedLogItems(mission, controlLog)
                .slice(0, 8)
                .map((item) => item.rendered)
                .join("")}
            </div>
          `,
        })}

        ${renderPanel({
          title: "Operational Watchlist",
          dotColor: "var(--cau)",
          children: `
            <div class="ui-gauge-list">
              ${buildRiskGauges(mission)
                .map((item) =>
                  renderGaugeBar({
                    name: item.name,
                    value: item.value,
                    fillPct: item.fillPct,
                    fillColor: item.fillColor,
                    label: item.label,
                    valueMuted: item.valueMuted,
                  }),
                )
                .join("")}
            </div>
            ${controlActions.length > 0
              ? renderNotice({
                  level: noticeFromTone(controlActionTone(controlActions, automationResponses)),
                  title: "Abstract control monitor",
                  children: `${controlActions.length} recommendation${controlActions.length === 1 ? "" : "s"} detected. ${activeAutomationResponses(automationResponses).length} automated response${activeAutomationResponses(automationResponses).length === 1 ? "" : "s"} currently running.`,
                })
              : ""}
          `,
        })}
      </div>
    </section>
  `;
}

<<<<<<< HEAD
function renderAgent(
  mission: BackendMissionState,
  planner: BackendPlannerOutput | null,
  agent: BackendAgentAnalysis | null,
  messages: CompanionMessage[],
  log: CompanionLogItem[],
  companionBusy: boolean,
): string {
=======
function renderAgent(state: AppState): string {
  const {
    mission,
    planner,
    agent,
    agentIncidents,
    controlActions,
    automationResponses,
    controlLog,
    pollIntervalMs,
    agentChatDraft,
    agentChatHistory,
    agentChatResponse,
    agentBusy,
  } = state;

  if (!mission) {
    return renderBootState();
  }

>>>>>>> 3ce8c794337794602881965d18258dc26accf9e6
  return `
    <section class="agent-tab">
      <div class="agent-hub">
        <div class="agent-hub__hero">
          <p class="agent-hub__kicker mono">Mission intelligence uplink</p>
          <h2 class="agent-hub__title">AETHER Companion</h2>
          <p class="agent-hub__subtitle">Mission intelligence uplink for greenhouse operations</p>
        </div>

        <div class="agent-workspace">
          <div class="agent-uplink ${agent ? "" : "agent-uplink--offline"}">
            <div class="agent-uplink__aurora"></div>
            <div class="agent-uplink__header">
              <div>
                <p class="agent-uplink__label mono">AETHER uplink</p>
                <p class="agent-uplink__meta">Live advisory thread for mission risk, nutrition continuity, and safe next actions</p>
              </div>
              <div class="agent-uplink__header-actions">
                <button class="btn btn-ghost agent-uplink__refresh" type="button" data-planner-refresh="true">Refresh planner</button>
                <button class="btn btn-primary agent-uplink__refresh" type="button" data-agent-analyze="true" ${agentBusy ? "disabled" : ""}>Analyze current state</button>
              </div>
            </div>

            ${
<<<<<<< HEAD
              messages.length > 0
                ? `
                    <div class="agent-uplink__thread">
                      ${messages
                        .map(
                          (message) => `
                            <article class="agent-uplink__message agent-uplink__message--${message.role}">
                              <div class="agent-uplink__avatar agent-uplink__avatar--${message.role}">
                                ${message.role === "user" ? "YOU" : "AE"}
                              </div>
                              <div class="agent-uplink__bubble agent-uplink__bubble--${message.role}">
                                <p class="agent-uplink__message-role mono">${message.role === "user" ? "Operator" : "AETHER"}</p>
                                <p class="agent-uplink__message-text">${escapeHtml(message.text)}</p>
                                ${
                                  message.meta
                                    ? `<p class="agent-uplink__message-meta mono">${escapeHtml(message.meta)}</p>`
                                    : ""
                                }
                              </div>
                            </article>
                          `,
                        )
                        .join("")}
                      ${
                        companionBusy
                          ? `
                              <article class="agent-uplink__message agent-uplink__message--agent">
                                <div class="agent-uplink__avatar agent-uplink__avatar--agent">AE</div>
                                <div class="agent-uplink__bubble agent-uplink__bubble--agent">
                                  <p class="agent-uplink__message-role mono">AETHER</p>
                                  <p class="agent-uplink__message-text">Processing mission context and composing a grounded response.</p>
                                </div>
                              </article>
                            `
                          : ""
                      }
                    </div>
                  `
                : `
                    <div class="agent-uplink__thread agent-uplink__thread--empty">
                      <div class="agent-uplink__thread-empty">
                        <p class="agent-uplink__thread-empty-title">No conversation yet</p>
                        <p class="agent-uplink__thread-empty-body">Start a mission query to open the AETHER thread.</p>
                      </div>
                    </div>
                  `
            }

            ${
              !agent && messages.length === 0
                ? `
=======
              agentChatHistory.length > 0
                ? `
                    <div class="agent-uplink__thread">
                      ${renderAgentChatHistory(agentChatHistory)}
                    </div>
                  `
                : mission
                  ? `
                      <div class="agent-uplink__thread">
                        ${renderAgentIntroThread(mission, planner, agent)}
                      </div>
                    `
                  : `
>>>>>>> 3ce8c794337794602881965d18258dc26accf9e6
                    <div class="agent-uplink__empty">
                      <p class="agent-uplink__empty-title">Companion offline</p>
                      <p class="agent-uplink__empty-body">The mission snapshot is live, but the advisor did not return any signal bundle for this refresh.</p>
                    </div>
                  `
                : ""
            }

            <div class="agent-uplink__composer">
              <form class="agent-uplink__input-shell" data-agent-form>
                <div class="agent-uplink__input-tools">
                  <span class="agent-uplink__tool mono">sol ${mission.missionDay}</span>
                  <span class="agent-uplink__tool mono">${planner?.nutritionRiskDetected ? "nutrition watch" : "nutrition stable"}</span>
                  <span class="agent-uplink__tool mono">${mission.activeScenario ? formatScenarioSeverity(mission.activeScenario.severity) : "nominal"}</span>
                </div>
                <div class="agent-uplink__input-row">
                  <input
                    class="agent-uplink__input"
                    type="text"
<<<<<<< HEAD
                    name="question"
                    placeholder="Ask AETHER about mission risk, nutrition continuity, or safe next actions..."
                    ${companionBusy ? "disabled" : ""}
                  />
                  <button class="agent-uplink__send" type="submit" ${companionBusy ? "disabled" : ""}>
                    <span class="agent-uplink__send-label">${companionBusy ? "Thinking" : "Transmit"}</span>
                  </button>
                </div>
              </form>
=======
                    value="${escapeAttribute(agentChatDraft)}"
                    placeholder="Ask AETHER about mission risk, nutrition continuity, or safe next actions..."
                    data-agent-input="true"
                    ${agentBusy ? "disabled" : ""}
                  />
                  <button class="agent-uplink__send" type="button" data-agent-send="true" ${agentBusy ? "disabled" : ""}>
                    <span class="agent-uplink__send-label">Transmit</span>
                  </button>
                </div>
              </div>

              <div class="agent-signal-block">
                <p class="agent-signal-block__title">Autonomous Monitor</p>
                ${renderControlActionsPanel(controlActions, automationResponses, pollIntervalMs, 4)}
              </div>

              <div class="agent-signal-block">
                <p class="agent-signal-block__title">Combined Activity Log</p>
                <div class="agent-log-scroll">
                  ${buildCombinedLogItems(mission, controlLog)
                    .slice(0, 8)
                    .map((item) => item.rendered)
                    .join("")}
                </div>
              </div>
>>>>>>> 3ce8c794337794602881965d18258dc26accf9e6
            </div>
          </div>

          <aside class="agent-log-shell">
            <div class="agent-log-shell__header">
              <p class="agent-log-shell__label mono">Incident Log</p>
              <p class="agent-log-shell__meta">Structured emergency analyses, projected impacts, and recommended responses</p>
            </div>
            <div class="agent-log-shell__body">
<<<<<<< HEAD
              <div class="agent-uplink__command-list">
                ${
                  log.length > 0
                    ? log
                        .map(
                          (item, index) => `
                            <article class="agent-uplink__command">
                              <div class="agent-uplink__command-head">
                                <span class="agent-uplink__command-index mono">LOG ${String(index).padStart(2, "0")}</span>
                                ${renderStatusBadge(item.kind, item.tone)}
                              </div>
                              <p class="agent-uplink__command-line mono">${escapeHtml(item.line)}</p>
                              <p class="agent-uplink__command-body">${escapeHtml(item.body)}</p>
                            </article>
                          `,
                        )
                        .join("")
                    : `
                        <article class="agent-uplink__command agent-uplink__command--idle">
                          <div class="agent-uplink__command-head">
                            <span class="agent-uplink__command-index mono">LOG 00</span>
                            ${renderStatusBadge("empty", "NOM")}
                          </div>
                          <p class="agent-uplink__command-line mono">await_chat_input</p>
                          <p class="agent-uplink__command-body">AETHER will record command recommendations and key mission notes here after the conversation begins.</p>
                        </article>
                      `
                }
              </div>
=======
              ${renderAgentIncidentLog(agentIncidents, mission, planner, agent, agentChatResponse)}
>>>>>>> 3ce8c794337794602881965d18258dc26accf9e6
            </div>
          </aside>
        </div>
      </div>
    </section>
  `;
}

function renderAgentChatHistory(history: ChatReply[]): string {
  return history
    .map(
      (entry) => `
        <article class="agent-uplink__message agent-uplink__message--${entry.role}">
          <p class="agent-uplink__message-role">${escapeHtml(entry.role)}</p>
          <p class="agent-uplink__message-text">${escapeHtml(entry.text)}</p>
        </article>
      `,
    )
    .join("");
}

function renderAgentIntroThread(
  mission: BackendMissionState,
  planner: BackendPlannerOutput | null,
  agent: BackendAgentAnalysis | null,
): string {
  return [
    {
      id: "agent:intro:system",
      role: "system" as const,
      text: `Mission day ${mission.missionDay}. Ask AETHER about habitat anomalies, scenario impact, nutrition continuity, or safe next actions.`,
    },
    {
      id: "agent:intro:agent",
      role: "agent" as const,
      text: agent
        ? `The latest analysis is ${agent.riskLevel} risk with ${agent.recommendedActions.length} recommended action${agent.recommendedActions.length === 1 ? "" : "s"}. Emergency details are tracked in the incident log on the right.`
        : `No analysis bundle is cached yet. Run Analyze to snapshot the current mission state${planner?.nutritionRiskDetected ? " and nutrition risk" : ""}.`,
    },
  ]
    .map(
      (entry) => `
        <article class="agent-uplink__message agent-uplink__message--${entry.role}">
          <p class="agent-uplink__message-role">${escapeHtml(entry.role)}</p>
          <p class="agent-uplink__message-text">${escapeHtml(entry.text)}</p>
        </article>
      `,
    )
    .join("");
}

function renderAgentIncidentLog(
  incidents: AgentIncidentItem[],
  mission: BackendMissionState,
  planner: BackendPlannerOutput | null,
  agent: BackendAgentAnalysis | null,
  chat: BackendAgentChatResponse | null,
): string {
  const entries: string[] = [];
  const historicalIncidents = agent
    ? incidents.filter((incident) => incident.analysis.decisionId !== agent.decisionId)
    : incidents;

  if (agent) {
    entries.push(`
      <article class="agent-incident-spotlight agent-incident-spotlight--${agent.riskLevel}">
        <div class="agent-incident-spotlight__head">
          <div>
            <p class="agent-incident-spotlight__kicker mono">Current analysis</p>
            <p class="agent-incident-spotlight__title">${escapeHtml(agent.riskSummary)}</p>
          </div>
          <div class="agent-incident-spotlight__badges">
            ${renderStatusBadge(formatRiskLevel(agent.riskLevel), riskTone(agent.riskLevel))}
            ${renderStatusBadge(
              mission.activeScenario ? formatScenarioSeverity(mission.activeScenario.severity) : formatMissionStatus(mission.status),
              mission.activeScenario ? severityTone(mission.activeScenario.severity) : missionTone(mission),
            )}
          </div>
        </div>
        <div class="agent-incident-spotlight__grid">
          <div class="agent-incident-spotlight__cell">
            <span class="agent-incident-spotlight__label">Mission state</span>
            <span class="mono">${escapeHtml(formatMissionStatus(mission.status))}</span>
          </div>
          <div class="agent-incident-spotlight__cell">
            <span class="agent-incident-spotlight__label">Scenario</span>
            <span class="mono">${escapeHtml(mission.activeScenario?.title ?? "No active scenario")}</span>
          </div>
          <div class="agent-incident-spotlight__cell">
            <span class="agent-incident-spotlight__label">Coverage delta</span>
            <span class="mono">${agent.comparison.delta.scoreDelta >= 0 ? "+" : ""}${agent.comparison.delta.scoreDelta}</span>
          </div>
          <div class="agent-incident-spotlight__cell">
            <span class="agent-incident-spotlight__label">Days-safe delta</span>
            <span class="mono">${agent.comparison.delta.daysSafeDelta >= 0 ? "+" : ""}${agent.comparison.delta.daysSafeDelta}</span>
          </div>
        </div>
        <p class="agent-incident-spotlight__body">${escapeHtml(agent.explanation)}</p>
        <div class="agent-incident-spotlight__actions">
          ${
            agent.recommendedActions.length > 0
              ? agent.recommendedActions
                  .slice(0, 3)
                  .map((action) =>
                    renderStatusBadge(
                      `${action.type.replaceAll("_", " ")}${action.targetZoneId ? ` · ${action.targetZoneId}` : ""}`,
                      action.urgency === "immediate" ? "ABT" : "CAU",
                    ),
                  )
                  .join("")
              : renderStatusBadge("No immediate action", "NOM")
          }
        </div>
      </article>
    `);
  }

  if (historicalIncidents.length > 0) {
    entries.push(`
      <div class="agent-incident-log">
        ${historicalIncidents
          .slice(0, 6)
          .map((incident, index) => renderAgentIncidentCard(incident, index))
          .join("")}
      </div>
    `);
  }

  if (chat) {
    entries.push(`
      <article class="agent-incident-chat-facts">
        <div class="agent-incident-chat-facts__head">
          <div>
            <p class="agent-incident-chat-facts__kicker mono">Latest Q&A</p>
            <p class="agent-incident-chat-facts__title">${escapeHtml(chat.relevantSection ?? "chat_response")}</p>
          </div>
          ${renderStatusBadge(chat.confidence, chat.confidence === "high" ? "NOM" : chat.confidence === "medium" ? "CAU" : "ABT")}
        </div>
        <p class="agent-incident-chat-facts__body">${escapeHtml(chat.answer)}</p>
        ${
          chat.supportingFacts.length > 0
            ? `
                <div class="agent-incident-chat-facts__fact-list">
                  ${chat.supportingFacts
                    .slice(0, 3)
                    .map((fact) => `<p class="agent-incident-chat-facts__fact">${escapeHtml(fact)}</p>`)
                    .join("")}
                </div>
              `
            : ""
        }
      </article>
    `);
  }

  if (entries.length === 0) {
    return renderNotice({
      level: "ok",
      title: "Incident log idle",
      children:
        planner?.nutritionRiskDetected || mission.activeScenario
          ? "AETHER is waiting for the next analyze pass to snapshot the current emergency state."
          : "No abnormal mission event has been promoted into the incident log yet.",
    });
  }

  return `<div class="agent-log-shell__stack">${entries.join("")}</div>`;
}

function renderAgentIncidentCard(incident: AgentIncidentItem, index: number): string {
  const actionMarkup =
    incident.analysis.recommendedActions.length > 0
      ? incident.analysis.recommendedActions
          .slice(0, 3)
          .map((action) =>
            renderStatusBadge(
              `${action.type.replaceAll("_", " ")}${action.targetZoneId ? ` · ${action.targetZoneId}` : ""}`,
              action.urgency === "immediate" ? "ABT" : "CAU",
            ),
          )
          .join("")
      : renderStatusBadge("monitoring only", "NOM");

  const dependencyMarkup =
    incident.analysis.criticalNutrientDependencies.length > 0
      ? incident.analysis.criticalNutrientDependencies
          .slice(0, 3)
          .map((dependency) => renderStatusBadge(dependency, "NOM"))
          .join("")
      : renderStatusBadge("no dependency shift", "NOM");

  return `
    <article class="agent-incident-card agent-incident-card--${incident.analysis.riskLevel}">
      <div class="agent-incident-card__head">
        <div>
          <p class="agent-incident-card__index mono">INC ${String(index + 1).padStart(2, "0")}</p>
          <p class="agent-incident-card__title">${escapeHtml(incident.analysis.riskSummary)}</p>
        </div>
        <div class="agent-incident-card__badges">
          ${renderStatusBadge(formatRiskLevel(incident.analysis.riskLevel), riskTone(incident.analysis.riskLevel))}
          ${renderStatusBadge(
            incident.scenarioLabel ?? formatMissionStatus(incident.missionStatus),
            incident.scenarioLabel ? "CAU" : missionStatusTone(incident.missionStatus),
          )}
        </div>
      </div>
      <div class="agent-incident-card__meta">
        <span class="mono">${escapeHtml(formatTimestamp(incident.recordedAt))}</span>
        <span class="mono">${escapeHtml(incident.focus.replaceAll("_", " "))}</span>
        <span class="mono">${incident.analysis.kbContextUsed ? "grounded tools" : "no KB"}</span>
      </div>
      <p class="agent-incident-card__body">${escapeHtml(incident.analysis.explanation)}</p>
      <div class="agent-incident-card__grid">
        <div class="agent-incident-card__cell">
          <span class="agent-incident-card__label">Coverage score</span>
          <span class="mono">${incident.analysis.comparison.before.nutritionalCoverageScore} → ${incident.analysis.comparison.after.nutritionalCoverageScore}</span>
        </div>
        <div class="agent-incident-card__cell">
          <span class="agent-incident-card__label">Days safe</span>
          <span class="mono">${incident.analysis.comparison.before.daysSafe} → ${incident.analysis.comparison.after.daysSafe}</span>
        </div>
      </div>
      <div class="agent-incident-card__section">
        <span class="agent-incident-card__section-title">Recommended actions</span>
        <div class="agent-incident-card__chips">${actionMarkup}</div>
      </div>
      <div class="agent-incident-card__section">
        <span class="agent-incident-card__section-title">Nutrient dependencies</span>
        <div class="agent-incident-card__chips">${dependencyMarkup}</div>
      </div>
    </article>
  `;
}

function renderBootState(): string {
  return renderPanel({
    title: "Mission Sync",
    dotColor: "var(--aero-blue)",
    children: renderNotice({
      level: "info",
      title: "Loading runtime state",
      children: "The dashboard is waiting for the mission state feed and related runtime services before rendering mission data.",
    }),
  });
}

function buildCompanionMessageMeta(response: BackendAgentChatResponse): string {
  const parts: string[] = [response.confidence];
  if (response.relevantSection) {
    parts.push(response.relevantSection);
  }
  return parts.join(" · ");
}

function buildCompanionLogItems(response: BackendAgentChatResponse): CompanionLogItem[] {
  const tone = toneFromChatConfidence(response.confidence);
  const items: CompanionLogItem[] = [];

  if (response.relevantSection) {
    items.push({
      id: `section-${Date.now()}`,
      kind: "fact",
      line: `section:${normalizeCommandLabel(response.relevantSection)}`,
      body: `Response grounded in ${response.relevantSection}.`,
      tone,
    });
  }

  response.suggestedActions.slice(0, 3).forEach((action, index) => {
    items.push({
      id: `action-${Date.now()}-${index}`,
      kind: "cmd",
      line: normalizeCommandLabel(action),
      body: action,
      tone,
    });
  });

  response.supportingFacts.slice(0, 3).forEach((fact, index) => {
    items.push({
      id: `fact-${Date.now()}-${index}`,
      kind: "fact",
      line: `fact_${String(index + 1).padStart(2, "0")}`,
      body: fact,
      tone,
    });
  });

  response.followUpQuestions.slice(0, 2).forEach((question, index) => {
    items.push({
      id: `next-${Date.now()}-${index}`,
      kind: "next",
      line: `follow_up_${String(index + 1).padStart(2, "0")}`,
      body: question,
      tone,
    });
  });

  return items;
}

function mergeCompanionLog(
  current: CompanionLogItem[],
  incoming: CompanionLogItem[],
): CompanionLogItem[] {
  return [...incoming, ...current].slice(0, 12);
}

function toneFromChatConfidence(confidence: BackendAgentChatConfidence): StatusTone {
  switch (confidence) {
    case "low":
      return "ABT";
    case "medium":
      return "CAU";
    default:
      return "NOM";
  }
}

function normalizeCommandLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 44) || "agent_note";
}

function renderMissionAlert(mission: BackendMissionState): string {
  if (mission.activeScenario) {
    return renderAlertStrip({
      level: alertFromTone(severityTone(mission.activeScenario.severity)),
      label: "Active Scenario",
      children: `${mission.activeScenario.title} — ${mission.activeScenario.description}`,
    });
  }

  return renderAlertStrip({
    level: alertFromTone(missionTone(mission)),
    label: "Mission Status",
    children: `Mission control is synced to the live habitat state. Overall status is ${formatMissionStatus(mission.status)}.`,
  });
}

function renderRiskAlert(mission: BackendMissionState): string {
  if (mission.activeScenario) {
    return renderAlertStrip({
      level: alertFromTone(severityTone(mission.activeScenario.severity)),
      label: "Scenario Live",
      children: `${mission.activeScenario.title} affecting ${mission.activeScenario.affectedZoneIds.join(", ") || "all zones"}.`,
    });
  }

  return renderAlertStrip({
    level: "nom",
    label: "No Active Scenario",
    children: "Risk tab is now driven by the scenario registry and live mission log only.",
  });
}

function renderControlAlert(alert: ControlAlert): string {
  return renderAlertStrip({
    level: alert.level,
    label: alert.kind === "automation" ? "Auto Response" : "Sensor Alert",
    children: `${alert.title} — ${alert.message}`,
  });
}

function renderControlActionsPanel(
  actions: ControlActionItem[],
  automationResponses: AutomatedControlResponse[],
  pollIntervalMs: number,
  limit = 3,
): string {
  const activeResponses = activeAutomationResponses(automationResponses);
  const activeResponseKeys = new Set(activeResponses.map((response) => response.abnormalityKey));
  const recommendedActions = actions.filter((action) => !activeResponseKeys.has(action.abnormalityKey));

  if (recommendedActions.length === 0 && automationResponses.length === 0) {
    return renderNotice({
      level: "ok",
      title: "Monitor stable",
      children: `Frontend mission polling is active every ${formatPollInterval(pollIntervalMs)}. No new abstract control recommendation is currently armed.`,
    });
  }

  return `
    <div class="control-action-stack">
      ${
        automationResponses.length > 0
          ? `
              <div class="control-action-list">
                ${automationResponses
                  .slice(0, limit)
                  .map((response) => renderAutomationResponseCard(response))
                  .join("")}
              </div>
            `
          : ""
      }

      <div class="control-action-list">
      ${recommendedActions
        .slice(0, limit)
        .map(
          (action) => `
            <article class="control-action-card control-action-card--${action.priority}">
              <div class="control-action-card__head">
                <div>
                  <p class="control-action-card__label">${escapeHtml(action.label)}</p>
                  <p class="control-action-card__target mono">${escapeHtml(action.targetLabel)}</p>
                </div>
                <div class="control-action-card__badges">
                  ${renderStatusBadge("recommended", controlPriorityTone(action.priority))}
                  ${renderStatusBadge(action.recommendedSection, "NOM")}
                </div>
              </div>
              <p class="control-action-card__summary">${escapeHtml(action.summary)}</p>
              <div class="control-action-card__meta">
                <span class="mono">${escapeHtml(action.triggerReason)}</span>
                <span class="mono">${action.relatedSensors.join(" · ")}</span>
              </div>
              ${renderNotice({
                level: noticeFromTone(controlPriorityTone(action.priority)),
                title: "Auto response queued",
                children: `${action.label} will be staged automatically on the next detected poll transition.`,
              })}
            </article>
          `,
        )
        .join("")}
      </div>
    </div>
  `;
}

function buildCombinedLogItems(
  mission: BackendMissionState,
  controlLog: ControlLogEntry[],
): CombinedLogItem[] {
  return [
    ...mission.eventLog.map((entry) => ({
      timestamp: entry.timestamp,
      rendered: renderMissionLogEntry(entry),
    })),
    ...controlLog.map((entry) => ({
      timestamp: entry.timestamp,
      rendered: renderControlLogEntry(entry),
    })),
  ].sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

function renderControlLogEntry(entry: ControlLogEntry): string {
  return renderLogEntry({
    type: logTypeFromControlPriority(entry.priority),
    icon: entry.kind === "automation" ? "AUTO" : entry.autoTriggered ? "AUTO" : "ADV",
    message: entry.message,
    meta: `${formatTimestamp(entry.timestamp)} | ${entry.targetLabel}`,
    confidence: entry.actionLabels.join(" / ").toUpperCase(),
    extra: renderStatusBadge(entry.recommendedSection, controlPriorityTone(entry.priority)),
  });
}

function renderAutomationResponseCard(response: AutomatedControlResponse): string {
  return `
    <article class="control-action-card control-action-card--${response.priority}">
      <div class="control-action-card__head">
        <div>
          <p class="control-action-card__label">${escapeHtml(response.statusLabel)}</p>
          <p class="control-action-card__target mono">${escapeHtml(response.targetLabel)}</p>
        </div>
        <div class="control-action-card__badges">
          ${renderStatusBadge(response.autoTriggered ? "auto" : "advisory", controlPriorityTone(response.priority))}
          ${renderStatusBadge(formatAutomationPhase(response.phase), response.phase === "resolved" ? "NOM" : response.phase === "attention" ? "ABT" : "CAU")}
        </div>
      </div>
      ${
        response.phase === "executing"
          ? `<div class="control-action-card__loader"><span></span></div>`
          : ""
      }
      <p class="control-action-card__summary">${escapeHtml(response.message)}</p>
      <div class="control-action-card__meta">
        <span class="mono">${escapeHtml(response.machineryLabel)}</span>
        <span class="mono">${formatTimestamp(response.updatedAt)}</span>
      </div>
    </article>
  `;
}

function renderAutomationRail(responses: AutomatedControlResponse[]): string {
  const visibleResponses = responses.slice(0, 4);

  if (visibleResponses.length === 0) {
    return "";
  }

  return `
    <aside class="automation-rail">
      ${visibleResponses
        .map(
          (response) => `
            <article class="automation-rail__card automation-rail__card--${response.priority}">
              <div class="automation-rail__head">
                <div>
                  <p class="automation-rail__label">${escapeHtml(response.statusLabel)}</p>
                  <p class="automation-rail__target mono">${escapeHtml(response.targetLabel)}</p>
                </div>
                ${renderStatusBadge(formatAutomationPhase(response.phase), response.phase === "resolved" ? "NOM" : response.phase === "attention" ? "ABT" : "CAU")}
              </div>
              <p class="automation-rail__message">${escapeHtml(response.message)}</p>
              <p class="automation-rail__machinery mono">${escapeHtml(response.machineryLabel)}</p>
              ${
                response.phase === "executing"
                  ? `<div class="automation-rail__loader"><span></span></div>`
                  : ""
              }
            </article>
          `,
        )
        .join("")}
    </aside>
  `;
}

function createAutomationAlert(response: AutomatedControlResponse): ControlAlert {
  return {
    id: `${response.id}:alert:${response.phase}`,
    abnormalityKey: response.abnormalityKey,
    kind: "automation",
    level: alertFromTone(controlPriorityTone(response.priority)),
    title: response.statusLabel,
    message: response.message,
    actionLabels: response.actionTypes.map(formatControlActionType),
    targetLabel: response.targetLabel,
    timestamp: response.updatedAt,
  };
}

function activeAutomationResponses(
  responses: AutomatedControlResponse[],
): AutomatedControlResponse[] {
  return responses.filter((response) => response.phase === "detected" || response.phase === "executing");
}

function formatAutomationPhase(phase: AutomatedControlResponse["phase"]): string {
  switch (phase) {
    case "detected":
      return "Detected";
    case "executing":
      return "Executing";
    case "resolved":
      return "Resolved";
    case "attention":
      return "Attention";
    default:
      return "Monitor";
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function renderBusyStrip(message: string): string {
  return renderAlertStrip({
    level: "cau",
    label: "Sync",
    children: message,
  });
}

function renderErrorStrip(message: string): string {
  return renderAlertStrip({
    level: "abt",
    label: "Runtime Fault",
    children: message,
  });
}

function createHeaderModel(
  mission: BackendMissionState | null,
  planner: BackendPlannerOutput | null,
  agent: BackendAgentAnalysis | null,
  greenhouse?: GreenhouseSummary,
): HeaderModel {
  if (!mission) {
    return {
      title: "AETHER",
      subtitle: greenhouse ? `${greenhouse.code} · ${greenhouse.name}` : "Mars Autonomous Greenhouse",
      missionDay: 0,
      missionDurationTotal: 0,
      agentState: "SYNCING",
      lastAction: "Connecting",
      systemTone: "CAU",
      systemLabel: "Runtime pending",
    };
  }

  return {
    title: "AETHER",
    subtitle: greenhouse ? `${greenhouse.code} · ${greenhouse.name}` : "Mars Autonomous Greenhouse",
    missionDay: mission.missionDay,
    missionDurationTotal: mission.missionDurationDays,
    agentState: agent ? formatRiskLevel(agent.riskLevel) : planner ? formatPlannerMode(planner.mode) : "Unavailable",
    lastAction: agent ? formatTimestamp(agent.timestamp) : mission.eventLog[0] ? formatEventStamp(mission.eventLog[0]) : "No events",
    systemTone: missionTone(mission),
    systemLabel: formatMissionStatus(mission.status),
  };
}

function createNavigationTabs(
  mission: BackendMissionState | null,
  agent: BackendAgentAnalysis | null,
): TabDefinition[] {
  const warningCount = mission
    ? mission.eventLog.filter((entry) => entry.level !== "info").length
    : undefined;
  const nutritionAlert = mission && mission.nutrition.caloricCoveragePercent < 100 ? 1 : undefined;
  const scenarioAlert = mission?.activeScenario ? 1 : warningCount;
  const agentAlert =
    agent && agent.recommendedActions.length > 0
      ? agent.recommendedActions.length
      : agent && agent.riskLevel !== "low"
        ? 1
        : undefined;

  return tabs.map((tab) => ({
    id: tab.id,
    label: tab.label,
    kicker: "",
    description: "",
    alertCount:
      tab.id === "risk"
        ? scenarioAlert
        : tab.id === "nutrition"
          ? nutritionAlert
          : tab.id === "agent"
            ? agentAlert
            : undefined,
  }));
}

function missionStatusTone(status: BackendMissionState["status"]): StatusTone {
  if (status === "critical") {
    return "ABT";
  }

  if (status === "warning" || status === "nutrition_preservation_mode") {
    return "CAU";
  }

  return "NOM";
}

function buildDecisionSupportKey(
  mission: BackendMissionState | null,
  planner: BackendPlannerOutput | null,
  focus: BackendAgentAnalyzeFocus,
): string {
  if (!mission) {
    return "mission:unavailable";
  }

  return [
    mission.lastUpdated,
    mission.status,
    mission.activeScenario?.type ?? "none",
    mission.activeScenario?.severity ?? "none",
    mission.nutrition.nutritionalCoverageScore,
    mission.nutrition.daysSafe,
    planner?.nutritionRiskDetected ? "planner:risk" : "planner:normal",
    focus,
  ].join("::");
}

function buildAutoAnalyzeKey(mission: BackendMissionState | null): string {
  if (!mission) {
    return "";
  }

  const abnormalZones = mission.zones
    .filter((zone) => zone.status !== "healthy" || zone.stress.active)
    .map((zone) => `${zone.zoneId}:${zone.status}:${zone.stress.type}:${zone.stress.severity}`)
    .join("|");

  const hasAbnormality =
    mission.status !== "nominal" ||
    Boolean(mission.activeScenario) ||
    abnormalZones.length > 0;

  if (!hasAbnormality) {
    return "";
  }

  return [
    mission.lastUpdated,
    mission.status,
    mission.activeScenario?.type ?? "none",
    mission.activeScenario?.severity ?? "none",
    abnormalZones,
  ].join("::");
}

function describeAutoAnalysisReason(mission: BackendMissionState): string {
  if (mission.activeScenario) {
    return `${mission.activeScenario.title} (${formatScenarioSeverity(mission.activeScenario.severity)})`;
  }

  const primaryZone = mission.zones.find((zone) => zone.status === "critical" || zone.stress.severity === "critical");

  if (primaryZone) {
    return `${primaryZone.zoneId} ${formatStressType(primaryZone.stress.type)} ${primaryZone.stress.severity}`;
  }

  if (mission.status !== "nominal") {
    return `mission status ${formatMissionStatus(mission.status)}`;
  }

  return "a new abnormal mission condition";
}

function pushAgentMonitorLog(
  state: AppState,
  message: string,
  priority: ControlLogEntry["priority"],
): void {
  const timestamp = new Date().toISOString();
  const entry: ControlLogEntry = {
    id: `agent-auto-${timestamp}`,
    abnormalityKey: `agent-auto-${timestamp}`,
    kind: "recommendation",
    timestamp,
    priority,
    headline: "AETHER auto-analysis",
    message,
    targetLabel: "Mission intelligence uplink",
    actionLabels: ["aether", "auto analyze"],
    relatedSensors: ["missionStatus"],
    recommendedSection: "agent",
    autoTriggered: true,
  };

  state.controlLog = [
    entry,
    ...state.controlLog,
  ].slice(0, 18);
}

function shouldLogAgentIncident(
  analysis: BackendAgentAnalysis,
  mission: BackendMissionState,
): boolean {
  return (
    analysis.riskLevel !== "low" ||
    analysis.recommendedActions.length > 0 ||
    analysis.nutritionPreservationMode ||
    mission.status !== "nominal" ||
    Boolean(mission.activeScenario)
  );
}

function buildAgentIncidentFingerprint(
  analysis: BackendAgentAnalysis,
  mission: BackendMissionState,
  focus: BackendAgentAnalyzeFocus,
): string {
  const actionKey = analysis.recommendedActions
    .map((action) => `${action.type}:${action.targetZoneId ?? "global"}`)
    .join("|");

  return [
    mission.status,
    mission.activeScenario?.type ?? "none",
    mission.activeScenario?.severity ?? "none",
    analysis.riskLevel,
    focus,
    actionKey,
    analysis.comparison.delta.scoreDelta,
    analysis.comparison.delta.daysSafeDelta,
  ].join("::");
}

function recordAgentIncident(
  state: AppState,
  analysis: BackendAgentAnalysis,
  focus: BackendAgentAnalyzeFocus,
): void {
  if (!state.mission || !shouldLogAgentIncident(analysis, state.mission)) {
    return;
  }

  const fingerprint = buildAgentIncidentFingerprint(analysis, state.mission, focus);

  if (state.agentIncidents.some((incident) => incident.fingerprint === fingerprint)) {
    return;
  }

  state.agentIncidents = [
    {
      id: `${analysis.decisionId}:${fingerprint}`,
      fingerprint,
      recordedAt: analysis.timestamp,
      focus,
      missionStatus: state.mission.status,
      scenarioLabel: state.mission.activeScenario?.title ?? null,
      analysis,
    },
    ...state.agentIncidents,
  ].slice(0, 12);
}

function syncSelections(state: AppState): void {
  if (!state.mission) {
    return;
  }

  const fallbackZone = state.mission.zones[0]?.zoneId ?? "";
  const zoneExists = state.mission.zones.some((zone) => zone.zoneId === state.selectedZoneId);
  state.selectedZoneId = zoneExists ? state.selectedZoneId : fallbackZone;

  const activeScenarioType = state.mission.activeScenario?.type ?? "";
  const firstScenarioType = state.scenarios[0]?.scenarioType ?? "";
  const scenarioExists = state.scenarios.some((scenario) => scenario.scenarioType === state.selectedScenarioType);
  state.selectedScenarioType = scenarioExists
    ? state.selectedScenarioType
    : activeScenarioType || firstScenarioType;
}

function getSelectedZone(mission: BackendMissionState, selectedZoneId: string): BackendCropZone {
  return mission.zones.find((zone) => zone.zoneId === selectedZoneId) ?? mission.zones[0];
}

function buildOverviewMetrics(mission: BackendMissionState): MetricTileData[] {
  const missionProgress = Math.round((mission.missionDay / mission.missionDurationDays) * 100);
  const healthyZones = mission.zones.filter((zone) => zoneTone(zone) === "NOM").length;
  const stressedZones = mission.zones.filter((zone) => zoneTone(zone) === "CAU").length;
  const criticalZones = mission.zones.filter((zone) => zoneTone(zone) === "ABT").length;

  return [
    {
      label: "Mission Progress",
      value: `${mission.missionDay}/${mission.missionDurationDays}`,
      sub: `${missionProgress}% mission elapsed`,
      progress: missionProgress,
      progressColor: "var(--aero-blue)",
      level: missionTone(mission),
    },
    {
      label: "Healthy Zones",
      value: `${healthyZones}/${mission.zones.length}`,
      sub: `${stressedZones} stressed · ${criticalZones} critical`,
      progress: Math.round((healthyZones / Math.max(mission.zones.length, 1)) * 100),
      progressColor: "var(--nom)",
      level: healthyZones === mission.zones.length ? "NOM" : healthyZones >= mission.zones.length / 2 ? "CAU" : "ABT",
    },
    {
      label: "Caloric Coverage",
      value: `${mission.nutrition.caloricCoveragePercent}%`,
      sub: `${mission.nutrition.dailyCaloriesProduced} of ${mission.nutrition.dailyCaloriesTarget} kcal/day`,
      progress: mission.nutrition.caloricCoveragePercent,
      progressColor: "var(--mars-orange)",
      level: toneFromPercent(mission.nutrition.caloricCoveragePercent, 95, 75),
    },
    {
      label: "Water Recycling",
      value: `${mission.resources.waterRecyclingEfficiencyPercent}%`,
      sub: `${mission.resources.waterDaysRemaining.toFixed(1)} d net runway`,
      progress: mission.resources.waterRecyclingEfficiencyPercent,
      progressColor: "var(--aero-blue)",
      level: toneFromPercent(mission.resources.waterRecyclingEfficiencyPercent, 85, 65),
    },
  ];
}

function buildCropMetrics(mission: BackendMissionState): MetricTileData[] {
  const riskyZones = mission.zones.filter((zone) => zoneTone(zone) !== "NOM").length;
  const nextHarvest = mission.zones.reduce(
    (lowest, zone) => Math.min(lowest, Math.max(zone.growthCycleDays - zone.growthDay, 0)),
    Number.POSITIVE_INFINITY,
  );
  const projectedYield = mission.zones.reduce((sum, zone) => sum + zone.projectedYieldKg, 0);
  const avgAllocation = Math.round(
    mission.zones.reduce((sum, zone) => sum + zone.allocationPercent, 0) / Math.max(mission.zones.length, 1),
  );

  return [
    {
      label: "Active Cultivation",
      value: `${mission.zones.length}`,
      sub: "Zones in live habitat feed",
      progress: 100,
      progressColor: "var(--nom)",
      level: "NOM" as StatusTone,
    },
    {
      label: "Next Harvest",
      value: `SOL +${nextHarvest === Number.POSITIVE_INFINITY ? 0 : nextHarvest}`,
      sub: "Shortest cycle remaining",
      progress: clampPercent(100 - (nextHarvest === Number.POSITIVE_INFINITY ? 0 : nextHarvest)),
      progressColor: "var(--cau)",
      level: nextHarvest <= 5 ? "CAU" : "NOM",
    },
    {
      label: "Projected Yield",
      value: `${projectedYield.toFixed(1)} kg`,
      sub: "Current zone projection",
      progress: clampPercent(projectedYield * 3),
      progressColor: "var(--aero-blue)",
      level: "NOM" as StatusTone,
    },
    {
      label: "At-Risk Zones",
      value: `${riskyZones}`,
      sub: `${avgAllocation}% average allocation`,
      progress: clampPercent((riskyZones / Math.max(mission.zones.length, 1)) * 100),
      progressColor: "var(--abt)",
      level: riskyZones === 0 ? "NOM" : riskyZones < 2 ? "CAU" : "ABT",
    },
  ];
}

function buildResourceMetrics(mission: BackendMissionState): MetricTileData[] {
  return [
    {
      label: "Water Reserve",
      value: `${mission.resources.waterReservoirL} L`,
      sub: `${mission.resources.waterDailyConsumptionL} L / day`,
      progress: clampPercent(mission.resources.waterReservoirL / 4),
      progressColor: "var(--aero-blue)",
      level: toneFromPercent(mission.resources.waterRecyclingEfficiencyPercent, 85, 65),
    },
    {
      label: "Recycle Efficiency",
      value: `${mission.resources.waterRecyclingEfficiencyPercent}%`,
      sub: "Closed-loop recovery",
      progress: mission.resources.waterRecyclingEfficiencyPercent,
      progressColor: "var(--aero-blue)",
      level: toneFromPercent(mission.resources.waterRecyclingEfficiencyPercent, 85, 65),
    },
    {
      label: "Nutrient Solution",
      value: `${mission.resources.nutrientSolutionLevelPercent}%`,
      sub: formatNutrientMixStatus(mission.resources.nutrientMixStatus),
      progress: mission.resources.nutrientSolutionLevelPercent,
      progressColor: "var(--cau)",
      level: toneFromMixStatus(mission.resources.nutrientMixStatus),
    },
    {
      label: "Energy Reserve",
      value: `${mission.resources.energyReserveHours} h`,
      sub: `${mission.resources.energyAvailableKwh} kWh available`,
      progress: clampPercent((mission.resources.energyAvailableKwh / Math.max(mission.resources.energyDailyConsumptionKwh, 1)) * 100),
      progressColor: "var(--nom)",
      level: toneFromEnergyReserve(mission.resources.energyReserveHours),
    },
  ];
}

function buildNutritionMetrics(mission: BackendMissionState): MetricTileData[] {
  return [
    {
      label: "Calories Produced",
      value: `${mission.nutrition.dailyCaloriesProduced}`,
      sub: "Daily output",
      progress: mission.nutrition.caloricCoveragePercent,
      progressColor: "var(--mars-orange)",
      level: toneFromPercent(mission.nutrition.caloricCoveragePercent, 95, 75),
    },
    {
      label: "Calorie Target",
      value: `${mission.nutrition.dailyCaloriesTarget}`,
      sub: "Daily requirement",
      progress: 100,
      progressColor: "var(--chrome-hi)",
      level: "NOM" as StatusTone,
    },
    {
      label: "Protein Produced",
      value: `${mission.nutrition.dailyProteinProducedG} g`,
      sub: "Daily output",
      progress: mission.nutrition.proteinCoveragePercent,
      progressColor: "var(--nom)",
      level: toneFromPercent(mission.nutrition.proteinCoveragePercent, 95, 75),
    },
    {
      label: "Protein Target",
      value: `${mission.nutrition.dailyProteinTargetG} g`,
      sub: "Daily requirement",
      progress: 100,
      progressColor: "var(--chrome-hi)",
      level: "NOM" as StatusTone,
    },
    {
      label: "Micronutrient Adequacy",
      value: `${mission.nutrition.micronutrientAdequacyPercent}%`,
      sub: mission.nutrition.trend,
      progress: mission.nutrition.micronutrientAdequacyPercent,
      progressColor: "var(--cau)",
      level: toneFromPercent(mission.nutrition.micronutrientAdequacyPercent, 90, 70),
    },
    {
      label: "Days Safe",
      value: `${mission.nutrition.daysSafe}`,
      sub: "Nutrition reserve horizon",
      progress: clampPercent(mission.nutrition.daysSafe * 10),
      progressColor: "var(--aero-blue)",
      level: mission.nutrition.daysSafe >= 7 ? "NOM" : mission.nutrition.daysSafe >= 4 ? "CAU" : "ABT",
    },
  ];
}

function buildRiskMetrics(mission: BackendMissionState): MetricTileData[] {
  const warningEvents = mission.eventLog.filter((entry) => entry.level === "warning").length;
  const criticalEvents = mission.eventLog.filter((entry) => entry.level === "critical").length;
  const alertEvents = warningEvents + criticalEvents;
  const stressedZones = mission.zones.filter((zone) => zone.stress.active).length;

  return [
    {
      label: "Mission Status",
      value: formatMissionStatus(mission.status),
      sub: "Runtime mission flag",
      progress: mission.status === "critical" ? 100 : mission.status === "warning" ? 65 : 28,
      progressColor: mission.status === "critical" ? "var(--abt)" : mission.status === "warning" ? "var(--cau)" : "var(--nom)",
      level: missionTone(mission),
    },
    {
      label: "Active Scenario",
      value: mission.activeScenario ? formatScenarioSeverity(mission.activeScenario.severity) : "None",
      sub: mission.activeScenario ? mission.activeScenario.title : "No injected fault",
      progress: mission.activeScenario ? (mission.activeScenario.severity === "critical" ? 100 : mission.activeScenario.severity === "moderate" ? 66 : 34) : 0,
      progressColor: mission.activeScenario ? (mission.activeScenario.severity === "critical" ? "var(--abt)" : "var(--cau)") : "var(--nom)",
      level: mission.activeScenario ? severityTone(mission.activeScenario.severity) : "NOM",
    },
    {
      label: "Alert Events",
      value: `${alertEvents}`,
      sub: `${warningEvents} warning · ${criticalEvents} critical`,
      progress: clampPercent(alertEvents * 18),
      progressColor: criticalEvents > 0 ? "var(--abt)" : "var(--cau)",
      level: criticalEvents > 0 ? "ABT" : warningEvents > 0 ? "CAU" : "NOM",
    },
    {
      label: "Stressed Zones",
      value: `${stressedZones}/${mission.zones.length}`,
      sub: "Stress flag active",
      progress: clampPercent((stressedZones / Math.max(mission.zones.length, 1)) * 100),
      progressColor: "var(--abt)",
      level: stressedZones === 0 ? "NOM" : stressedZones < 2 ? "CAU" : "ABT",
    },
  ];
}

function buildGrowthStages(zone: BackendCropZone): GrowthStageData[] {
  const stages = ["Start", "Establish", "Growth", "Mature", "Harvest"];
  const activeIndex = Math.min(4, Math.floor(zone.growthProgressPercent / 20));

  return stages.map((label, index) => ({
    label,
    sol: `${Math.min(zone.growthCycleDays, Math.round((zone.growthCycleDays / 5) * (index + 1)))}`,
    state: index < activeIndex ? "done" : index === activeIndex ? "active" : "future",
  }));
}

function buildZoneGauges(zone: BackendCropZone, mission: BackendMissionState) {
  const maxYield = Math.max(...mission.zones.map((item) => item.projectedYieldKg), 1);

  return [
    {
      name: "Growth",
      value: `${zone.growthProgressPercent}%`,
      fillPct: zone.growthProgressPercent,
      fillColor: "var(--aero-blue)",
      label: "Cycle completion",
      valueMuted: `${zone.growthDay}/${zone.growthCycleDays} days`,
    },
    {
      name: "Allocation",
      value: `${zone.allocationPercent}%`,
      fillPct: zone.allocationPercent,
      fillColor: "var(--nom)",
      label: "Resource share",
      valueMuted: formatCropType(zone.cropType),
    },
    {
      name: "Yield",
      value: `${zone.projectedYieldKg.toFixed(1)} kg`,
      fillPct: clampPercent((zone.projectedYieldKg / maxYield) * 100),
      fillColor: zoneTone(zone) === "ABT" ? "var(--abt)" : "var(--cau)",
      label: "Projected output",
      valueMuted: formatZoneStatus(zone.status),
    },
  ];
}

function buildZoneConditionRows(zone: BackendCropZone): Array<{ label: string; value: string }> {
  return [
    { label: "Temperature", value: `${zone.sensors.temperature} C` },
    { label: "Humidity", value: `${zone.sensors.humidity}%` },
    { label: "CO2 ppm", value: `${zone.sensors.co2Ppm}` },
    { label: "Light PAR", value: `${zone.sensors.lightPAR}` },
    { label: "Photoperiod", value: `${zone.sensors.photoperiodHours} h` },
    { label: "Nutrient pH", value: `${zone.sensors.nutrientPH}` },
    { label: "Conductivity", value: `${zone.sensors.electricalConductivity} mS` },
    { label: "Soil Moisture", value: `${zone.sensors.soilMoisture}%` },
  ];
}

function buildZoneTelemetry(zone: BackendCropZone) {
  return [
    {
      label: "Zone",
      value: zone.zoneId,
      sub: formatCropType(zone.cropType),
      progress: zone.growthProgressPercent,
      progressColor: "var(--chrome-hi)",
      level: zoneTone(zone),
    },
    {
      label: "Area",
      value: `${zone.areaM2} m²`,
      sub: "Assigned tray area",
      progress: clampPercent(zone.areaM2 * 20),
      progressColor: "var(--aero-blue)",
      level: "NOM" as StatusTone,
    },
    {
      label: "Cycle",
      value: `${zone.growthDay}/${zone.growthCycleDays}`,
      sub: "Growth day / total",
      progress: zone.growthProgressPercent,
      progressColor: "var(--nom)",
      level: zoneTone(zone),
    },
    {
      label: "Stress",
      value: zone.stress.active ? formatStressType(zone.stress.type) : "None",
      sub: zone.stress.active ? zone.stress.summary : "No active flag",
      progress: zone.stress.active ? severityProgress(zone.stress.severity) : 0,
      progressColor: zoneTone(zone) === "ABT" ? "var(--abt)" : "var(--cau)",
      level: zoneTone(zone),
    },
    {
      label: "Allocation",
      value: `${zone.allocationPercent}%`,
      sub: "Current share",
      progress: zone.allocationPercent,
      progressColor: "var(--aero-blue)",
      level: zoneTone(zone),
    },
    {
      label: "Projected Yield",
      value: `${zone.projectedYieldKg.toFixed(1)} kg`,
      sub: "Current habitat estimate",
      progress: clampPercent(zone.projectedYieldKg * 4),
      progressColor: "var(--mars-orange)",
      level: zoneTone(zone),
    },
  ];
}

function buildResourceTiles(mission: BackendMissionState): OverviewResourceTileData[] {
  return [
    {
      label: "Water Reservoir",
      value: `${mission.resources.waterReservoirL}`,
      unit: "L",
      status: `${mission.resources.waterDailyConsumptionL} L/day gross`,
      fillPct: clampPercent(mission.resources.waterReservoirL / 4),
      fillColor: "var(--aero-blue)",
      caution: false,
    },
    {
      label: "Recycle Efficiency",
      value: `${mission.resources.waterRecyclingEfficiencyPercent}`,
      unit: "%",
      status: "Closed-loop recovery",
      fillPct: mission.resources.waterRecyclingEfficiencyPercent,
      fillColor: "var(--aero-blue)",
      caution: mission.resources.waterRecyclingEfficiencyPercent < 85,
    },
    {
      label: "Nutrient Solution",
      value: `${mission.resources.nutrientSolutionLevelPercent}`,
      unit: "%",
      status: `N ${mission.resources.nutrientN} · P ${mission.resources.nutrientP} · K ${mission.resources.nutrientK}`,
      fillPct: mission.resources.nutrientSolutionLevelPercent,
      fillColor: "var(--cau)",
      caution: mission.resources.nutrientMixStatus !== "balanced",
    },
    {
      label: "Energy Reserve",
      value: `${mission.resources.energyAvailableKwh}`,
      unit: "kWh",
      status: `${mission.resources.energyDaysRemaining.toFixed(1)} d · ${mission.resources.energyReserveHours} h`,
      fillPct: clampPercent(
        (mission.resources.energyAvailableKwh /
          Math.max(mission.resources.energyDailyConsumptionKwh, 1)) *
          100,
      ),
      fillColor: "var(--nom)",
      caution: mission.resources.energyReserveHours < 8,
    },
    {
      label: "Solar Input",
      value: `${mission.resources.solarGenerationKwhPerDay}`,
      unit: "kWh/d",
      status: "Daily generation",
      fillPct: clampPercent((mission.resources.solarGenerationKwhPerDay / 220) * 100),
      fillColor: "var(--nom)",
      caution:
        mission.resources.solarGenerationKwhPerDay <
        mission.resources.energyDailyConsumptionKwh,
    },
    {
      label: "Chemistry Flag",
      value: formatNutrientMixStatus(mission.resources.nutrientMixStatus),
      unit: "",
      status: `${mission.resources.waterDaysRemaining.toFixed(1)} d water · ${mission.resources.energyDaysRemaining.toFixed(1)} d energy`,
      fillPct:
        mission.resources.nutrientMixStatus === "balanced"
          ? 100
          : mission.resources.nutrientMixStatus === "watch"
            ? 62
            : 24,
      fillColor:
        mission.resources.nutrientMixStatus === "balanced"
          ? "var(--nom)"
          : mission.resources.nutrientMixStatus === "watch"
            ? "var(--cau)"
            : "var(--abt)",
      caution: mission.resources.nutrientMixStatus !== "balanced",
    },
  ];
}

function buildNutritionMiniRows(mission: BackendMissionState): NutritionMiniRow[] {
  return [
    {
      label: "Calories",
      value: `${mission.nutrition.dailyCaloriesProduced} kcal`,
      tone: toneFromPercent(mission.nutrition.caloricCoveragePercent, 95, 75),
      badge: `${mission.nutrition.caloricCoveragePercent}%`,
    },
    {
      label: "Protein",
      value: `${mission.nutrition.dailyProteinProducedG} g`,
      tone: toneFromPercent(mission.nutrition.proteinCoveragePercent, 95, 75),
      badge: `${mission.nutrition.proteinCoveragePercent}%`,
    },
    {
      label: "Coverage Score",
      value: `${mission.nutrition.nutritionalCoverageScore}`,
      tone: toneFromPercent(mission.nutrition.nutritionalCoverageScore, 90, 70),
      badge: `${mission.nutrition.micronutrientAdequacyPercent}% micro`,
    },
    {
      label: "Days Safe",
      value: `${mission.nutrition.daysSafe}`,
      tone:
        mission.nutrition.daysSafe >= 180
          ? "NOM"
          : mission.nutrition.daysSafe >= 60
            ? "CAU"
            : "ABT",
      badge: mission.nutrition.trend,
    },
  ];
}

function buildMicronutrientMiniRows(
  mission: BackendMissionState,
): MicronutrientMiniData[] {
  return [
    {
      id: "vita",
      label: "Vit A",
      produced: `${mission.nutrition.vitaminA.produced}${mission.nutrition.vitaminA.unit}`,
      target: `${mission.nutrition.vitaminA.target}${mission.nutrition.vitaminA.unit}`,
      coveragePercent: deriveDisplayedCoveragePercent(
        mission.nutrition.vitaminA.produced,
        mission.nutrition.vitaminA.target,
      ),
      tone: toneFromPercent(
        deriveDisplayedCoveragePercent(
          mission.nutrition.vitaminA.produced,
          mission.nutrition.vitaminA.target,
        ),
        95,
        75,
      ),
    },
    {
      id: "vitc",
      label: "Vit C",
      produced: `${mission.nutrition.vitaminC.produced}${mission.nutrition.vitaminC.unit}`,
      target: `${mission.nutrition.vitaminC.target}${mission.nutrition.vitaminC.unit}`,
      coveragePercent: deriveDisplayedCoveragePercent(
        mission.nutrition.vitaminC.produced,
        mission.nutrition.vitaminC.target,
      ),
      tone: toneFromPercent(
        deriveDisplayedCoveragePercent(
          mission.nutrition.vitaminC.produced,
          mission.nutrition.vitaminC.target,
        ),
        95,
        75,
      ),
    },
    {
      id: "vitk",
      label: "Vit K",
      produced: `${mission.nutrition.vitaminK.produced}${mission.nutrition.vitaminK.unit}`,
      target: `${mission.nutrition.vitaminK.target}${mission.nutrition.vitaminK.unit}`,
      coveragePercent: deriveDisplayedCoveragePercent(
        mission.nutrition.vitaminK.produced,
        mission.nutrition.vitaminK.target,
      ),
      tone: toneFromPercent(
        deriveDisplayedCoveragePercent(
          mission.nutrition.vitaminK.produced,
          mission.nutrition.vitaminK.target,
        ),
        95,
        75,
      ),
    },
    {
      id: "fol",
      label: "Folate",
      produced: `${mission.nutrition.folate.produced}${mission.nutrition.folate.unit}`,
      target: `${mission.nutrition.folate.target}${mission.nutrition.folate.unit}`,
      coveragePercent: deriveDisplayedCoveragePercent(
        mission.nutrition.folate.produced,
        mission.nutrition.folate.target,
      ),
      tone: toneFromPercent(
        deriveDisplayedCoveragePercent(
          mission.nutrition.folate.produced,
          mission.nutrition.folate.target,
        ),
        95,
        75,
      ),
    },
    {
      id: "iron",
      label: "Iron",
      produced: `${mission.nutrition.iron.produced}${mission.nutrition.iron.unit}`,
      target: `${mission.nutrition.iron.target}${mission.nutrition.iron.unit}`,
      coveragePercent: deriveDisplayedCoveragePercent(
        mission.nutrition.iron.produced,
        mission.nutrition.iron.target,
      ),
      tone: toneFromPercent(
        deriveDisplayedCoveragePercent(
          mission.nutrition.iron.produced,
          mission.nutrition.iron.target,
        ),
        95,
        75,
      ),
    },
    {
      id: "pot",
      label: "Potassium",
      produced: `${mission.nutrition.potassium.produced}${mission.nutrition.potassium.unit}`,
      target: `${mission.nutrition.potassium.target}${mission.nutrition.potassium.unit}`,
      coveragePercent: deriveDisplayedCoveragePercent(
        mission.nutrition.potassium.produced,
        mission.nutrition.potassium.target,
      ),
      tone: toneFromPercent(
        deriveDisplayedCoveragePercent(
          mission.nutrition.potassium.produced,
          mission.nutrition.potassium.target,
        ),
        95,
        75,
      ),
    },
    {
      id: "mag",
      label: "Magnesium",
      produced: `${mission.nutrition.magnesium.produced}${mission.nutrition.magnesium.unit}`,
      target: `${mission.nutrition.magnesium.target}${mission.nutrition.magnesium.unit}`,
      coveragePercent: deriveDisplayedCoveragePercent(
        mission.nutrition.magnesium.produced,
        mission.nutrition.magnesium.target,
      ),
      tone: toneFromPercent(
        deriveDisplayedCoveragePercent(
          mission.nutrition.magnesium.produced,
          mission.nutrition.magnesium.target,
        ),
        95,
        75,
      ),
    },
  ];
}

function buildNutritionSummaryRows(mission: BackendMissionState): string[][] {
  return [
    [
      "Calories",
      `<span class="mono">${mission.nutrition.dailyCaloriesProduced} kcal</span>`,
      `<span class="mono">${mission.nutrition.dailyCaloriesTarget} kcal</span>`,
      renderStatusBadge(`${mission.nutrition.caloricCoveragePercent}%`, toneFromPercent(mission.nutrition.caloricCoveragePercent, 95, 75)),
      mission.nutrition.trend,
    ],
    [
      "Protein",
      `<span class="mono">${mission.nutrition.dailyProteinProducedG} g</span>`,
      `<span class="mono">${mission.nutrition.dailyProteinTargetG} g</span>`,
      renderStatusBadge(`${mission.nutrition.proteinCoveragePercent}%`, toneFromPercent(mission.nutrition.proteinCoveragePercent, 95, 75)),
      mission.nutrition.trend,
    ],
    [
      "Micronutrients",
      `<span class="mono">${mission.nutrition.micronutrientAdequacyPercent}%</span>`,
      `<span class="mono">100%</span>`,
      renderStatusBadge(`${mission.nutrition.micronutrientAdequacyPercent}%`, toneFromPercent(mission.nutrition.micronutrientAdequacyPercent, 90, 70)),
      mission.nutrition.trend,
    ],
    [
      "Coverage Score",
      `<span class="mono">${mission.nutrition.nutritionalCoverageScore}</span>`,
      `<span class="mono">100</span>`,
      renderStatusBadge(`${mission.nutrition.nutritionalCoverageScore}`, toneFromPercent(mission.nutrition.nutritionalCoverageScore, 90, 70)),
      `${mission.nutrition.daysSafe} days safe`,
    ],
  ];
}

function buildPlannerForecastRows(planner: BackendPlannerOutput): string[][] {
  return [
    [
      "Calories",
      `<span class="mono">${planner.nutritionForecast.before.caloricCoveragePercent}%</span>`,
      `<span class="mono">${planner.nutritionForecast.after.caloricCoveragePercent}%</span>`,
    ],
    [
      "Protein",
      `<span class="mono">${planner.nutritionForecast.before.proteinCoveragePercent}%</span>`,
      `<span class="mono">${planner.nutritionForecast.after.proteinCoveragePercent}%</span>`,
    ],
    [
      "Micronutrients",
      `<span class="mono">${planner.nutritionForecast.before.micronutrientAdequacyPercent}%</span>`,
      `<span class="mono">${planner.nutritionForecast.after.micronutrientAdequacyPercent}%</span>`,
    ],
    [
      "Coverage Score",
      `<span class="mono">${planner.nutritionForecast.before.nutritionalCoverageScore}</span>`,
      `<span class="mono">${planner.nutritionForecast.after.nutritionalCoverageScore}</span>`,
    ],
  ];
}

function buildNutrientSolutionMetrics(mission: BackendMissionState): MetricTileData[] {
  return [
    {
      label: "Solution Level",
      value: `${mission.resources.nutrientSolutionLevelPercent}%`,
      sub: "Reservoir concentration",
      progress: mission.resources.nutrientSolutionLevelPercent,
      progressColor: "var(--cau)",
      level: toneFromMixStatus(mission.resources.nutrientMixStatus),
    },
    {
      label: "Mix Status",
      value: formatNutrientMixStatus(mission.resources.nutrientMixStatus),
      sub: "Runtime chemistry flag",
      progress: mission.resources.nutrientMixStatus === "balanced" ? 100 : mission.resources.nutrientMixStatus === "watch" ? 62 : 28,
      progressColor: mission.resources.nutrientMixStatus === "balanced" ? "var(--nom)" : mission.resources.nutrientMixStatus === "watch" ? "var(--cau)" : "var(--abt)",
      level: toneFromMixStatus(mission.resources.nutrientMixStatus),
    },
    {
      label: "Coverage Score",
      value: `${mission.nutrition.nutritionalCoverageScore}`,
      sub: "Nutrition system result",
      progress: mission.nutrition.nutritionalCoverageScore,
      progressColor: "var(--mars-orange)",
      level: toneFromPercent(mission.nutrition.nutritionalCoverageScore, 90, 70),
    },
  ];
}

function buildEnergyMetrics(mission: BackendMissionState): MetricTileData[] {
  return [
    {
      label: "Available Energy",
      value: `${mission.resources.energyAvailableKwh} kWh`,
      sub: "Current budget",
      progress: clampPercent((mission.resources.energyAvailableKwh / 300) * 100),
      progressColor: "var(--nom)",
      level: toneFromEnergyReserve(mission.resources.energyReserveHours),
    },
    {
      label: "Daily Consumption",
      value: `${mission.resources.energyDailyConsumptionKwh} kWh`,
      sub: "Projected demand",
      progress: clampPercent((mission.resources.energyDailyConsumptionKwh / 300) * 100),
      progressColor: "var(--aero-blue)",
      level: mission.resources.energyDailyConsumptionKwh <= mission.resources.energyAvailableKwh ? "NOM" : "CAU",
    },
    {
      label: "Reserve Horizon",
      value: `${mission.resources.energyReserveHours} h`,
      sub: "Battery + solar buffer",
      progress: clampPercent(mission.resources.energyReserveHours * 8),
      progressColor: "var(--nom)",
      level: toneFromEnergyReserve(mission.resources.energyReserveHours),
    },
  ];
}

function buildRiskGauges(mission: BackendMissionState) {
  const stressedZones = mission.zones.filter((zone) => zone.stress.active).length;
  const energyPressure = Math.max(
    0,
    Math.round((mission.resources.energyDailyConsumptionKwh / Math.max(mission.resources.energyAvailableKwh, 1)) * 100),
  );

  return [
    {
      name: "Water risk",
      value: `${100 - mission.resources.waterRecyclingEfficiencyPercent}`,
      fillPct: clampPercent(100 - mission.resources.waterRecyclingEfficiencyPercent),
      fillColor: "var(--aero-blue)",
      label: "Efficiency gap",
      valueMuted: `${mission.resources.waterRecyclingEfficiencyPercent}% recovery`,
    },
    {
      name: "Nutrition gap",
      value: `${100 - mission.nutrition.nutritionalCoverageScore}`,
      fillPct: clampPercent(100 - mission.nutrition.nutritionalCoverageScore),
      fillColor: "var(--cau)",
      label: "Coverage deficit",
      valueMuted: `${mission.nutrition.nutritionalCoverageScore} score`,
    },
    {
      name: "Energy pressure",
      value: `${energyPressure}`,
      fillPct: clampPercent(energyPressure),
      fillColor: energyPressure > 100 ? "var(--abt)" : "var(--cau)",
      label: "Demand vs supply",
      valueMuted: `${mission.resources.energyReserveHours} h reserve`,
    },
    {
      name: "Zone stress",
      value: `${stressedZones}/${mission.zones.length}`,
      fillPct: clampPercent((stressedZones / Math.max(mission.zones.length, 1)) * 100),
      fillColor: stressedZones > 1 ? "var(--abt)" : stressedZones === 1 ? "var(--cau)" : "var(--nom)",
      label: "Active stress flags",
      valueMuted: mission.activeScenario ? formatScenarioSeverity(mission.activeScenario.severity) : "none",
    },
  ];
}

function stressSeverityRank(severity: BackendCropZone["stress"]["severity"]): number {
  switch (severity) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "moderate":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function stressTone(rank: number): StatusTone {
  if (rank >= 4) {
    return "ABT";
  }

  if (rank >= 2) {
    return "CAU";
  }

  return "NOM";
}

function stressSensorOverride(
  zone: BackendCropZone,
  sensorKey: ZoneSensorKey,
): Pick<SensorReadingData, "state" | "tone"> | null {
  if (!zone.stress.active) {
    return null;
  }

  const relatedSensors: Record<BackendCropZone["stress"]["type"], ZoneSensorKey[]> = {
    none: [],
    water_stress: ["soilMoisture", "humidity"],
    temperature_drift: ["temperature", "humidity"],
    nutrient_imbalance: ["nutrientPH", "electricalConductivity"],
    energy_pressure: ["lightPAR"],
  };

  if (!relatedSensors[zone.stress.type].includes(sensorKey)) {
    return null;
  }

  const rank = stressSeverityRank(zone.stress.severity);

  if (rank === 0) {
    return null;
  }

  const state =
    rank >= 4
      ? sensorKey === "temperature" && zone.sensors.temperature < 15
        ? "critical low"
        : "critical high"
      : zone.stress.type === "water_stress"
        ? "low stress"
        : zone.stress.type === "energy_pressure"
          ? "low stress"
          : "stress";

  return {
    state,
    tone: stressTone(rank),
  };
}

function evaluateDisplayedZoneSensor(
  zone: BackendCropZone,
  sensorKey: ZoneSensorKey,
): Pick<SensorReadingData, "state" | "tone"> {
  const base = evaluateZoneSensor(zone, sensorKey);
  const stressOverride = stressSensorOverride(zone, sensorKey);

  if (!stressOverride) {
    return {
      state: base.state,
      tone: base.tone,
    };
  }

  const overrideRank = stressSeverityRank(zone.stress.severity);
  const baseRank =
    base.tone === "ABT" ? 4 : base.tone === "CAU" ? 2 : 0;

  if (overrideRank <= baseRank) {
    return {
      state: base.state,
      tone: base.tone,
    };
  }

  return {
    state: stressOverride.state,
    tone: stressOverride.tone,
  };
}

function buildSensorReadings(zone: BackendCropZone): SensorReadingData[] {
  return [
    {
      label: "Temp",
      value: `${zone.sensors.temperature} C`,
      ...evaluateDisplayedZoneSensor(zone, "temperature"),
    },
    {
      label: "Humidity",
      value: `${zone.sensors.humidity}%`,
      ...evaluateDisplayedZoneSensor(zone, "humidity"),
    },
    {
      label: "PAR",
      value: `${zone.sensors.lightPAR}`,
      ...evaluateDisplayedZoneSensor(zone, "lightPAR"),
    },
    {
      label: "Moisture",
      value: `${zone.sensors.soilMoisture}%`,
      ...evaluateDisplayedZoneSensor(zone, "soilMoisture"),
    },
    {
      label: "pH",
      value: `${zone.sensors.nutrientPH}`,
      ...evaluateDisplayedZoneSensor(zone, "nutrientPH"),
    },
    {
      label: "EC",
      value: `${zone.sensors.electricalConductivity} mS`,
      ...evaluateDisplayedZoneSensor(zone, "electricalConductivity"),
    },
  ];
}

function renderMetricTile(item: MetricTileData): string {
  return renderKpiTile({
    label: item.label,
    value: item.value,
    sub: item.sub,
    progress: item.progress,
    progressColor: item.progressColor,
    level: item.level,
  });
}

function renderZoneOperationsCard(
  zone: BackendCropZone,
  isSelected: boolean,
  interactive = true,
): string {
  const sensorReadings = buildSensorReadings(zone);
  const symptoms = zone.stress.symptoms.slice(0, 3);
  const tag = interactive ? "button" : "div";
  const interactionAttrs = interactive
    ? `type="button" data-zone-select="${escapeHtml(zone.zoneId)}"`
    : "";

  return `
    <${tag}
      ${interactionAttrs}
      class="zone-ops-card ${zoneStatusClass(zone)} ${isSelected ? "is-selected" : ""} ${interactive ? "" : "zone-ops-card--static"}"
    >
      <div class="zone-ops-card__head">
        <div>
          <p class="zone-ops-card__zone mono">${escapeHtml(zone.zoneId)}</p>
          <p class="zone-ops-card__name">${escapeHtml(zone.name)}</p>
          <p class="zone-ops-card__meta">${escapeHtml(formatCropType(zone.cropType))}</p>
        </div>
        <div class="zone-ops-card__badges">
          ${renderStatusBadge(formatZoneStatus(zone.status), zoneTone(zone))}
          ${
            zone.stress.active
              ? renderStatusBadge(
                  `${formatStressType(zone.stress.type)} ${zone.stress.severity}`,
                  zoneTone(zone),
                )
              : renderStatusBadge("stable", "NOM")
          }
        </div>
      </div>

      <div class="zone-ops-card__metrics">
        <div class="zone-ops-card__metric">
          <span class="zone-ops-card__metric-label">Cycle</span>
          <span class="zone-ops-card__metric-value mono">${zone.growthDay}/${zone.growthCycleDays} d</span>
        </div>
        <div class="zone-ops-card__metric">
          <span class="zone-ops-card__metric-label">Progress</span>
          <span class="zone-ops-card__metric-value mono">${zone.growthProgressPercent}%</span>
        </div>
        <div class="zone-ops-card__metric">
          <span class="zone-ops-card__metric-label">Projected Yield</span>
          <span class="zone-ops-card__metric-value mono">${zone.projectedYieldKg.toFixed(1)} kg</span>
        </div>
        <div class="zone-ops-card__metric">
          <span class="zone-ops-card__metric-label">Allocation</span>
          <span class="zone-ops-card__metric-value mono">${zone.allocationPercent}%</span>
        </div>
      </div>

      <div class="ui-kpi__bar zone-ops-card__progress">
        <span style="width:${zone.growthProgressPercent}%; background:${toneColor(zoneTone(zone))}"></span>
      </div>

      <div class="zone-ops-card__stress">
        <p class="zone-ops-card__stress-text">${escapeHtml(zone.stress.summary)}</p>
        ${
          zone.stress.boltingRisk
            ? `<p class="zone-ops-card__risk">Bolting risk active</p>`
            : ""
        }
        ${
          symptoms.length > 0
            ? `<div class="zone-ops-card__symptoms">${symptoms
                .map((symptom) => renderStatusBadge(symptom.replaceAll("_", " "), zoneTone(zone)))
                .join("")}</div>`
            : ""
        }
      </div>

      <div class="zone-ops-card__sensor-grid">
        ${sensorReadings
          .map(
            (reading) => `
              <div class="zone-sensor zone-sensor--${reading.tone.toLowerCase()}">
                <div class="zone-sensor__head">
                  <span class="zone-sensor__label">${reading.label}</span>
                  ${renderStatusBadge(reading.state, reading.tone)}
                </div>
                <div class="zone-sensor__value mono">${reading.value}</div>
              </div>
            `,
          )
          .join("")}
      </div>
    </${tag}>
  `;
}

function renderCropHealthCard(zone: BackendCropZone, isSelected: boolean): string {
  return `
    <button
      type="button"
      class="crop-health-card ${isSelected ? "is-selected" : ""} crop-health-card--${zoneTone(zone).toLowerCase()}"
      data-zone-select="${escapeHtml(zone.zoneId)}"
    >
      <span class="crop-health-card__bar"></span>
      <div class="crop-health-card__top">
        <div>
          <p class="crop-health-card__name">${escapeHtml(zone.name)}</p>
          <p class="crop-health-card__meta">${escapeHtml(zone.zoneId)} · ${escapeHtml(formatCropType(zone.cropType))}</p>
        </div>
        ${renderStatusBadge(formatZoneStatus(zone.status), zoneTone(zone))}
      </div>
      <div class="crop-health-card__mid">
        <span class="crop-health-card__score mono">${zone.growthProgressPercent}%</span>
        <span class="crop-health-card__harvest mono">day ${zone.growthDay}/${zone.growthCycleDays}</span>
      </div>
      <div class="ui-kpi__bar">
        <span style="width:${zone.allocationPercent}%; background:${zoneTone(zone) === "ABT" ? "var(--abt)" : "var(--aero-blue)"}"></span>
      </div>
      <div class="crop-health-card__foot">
        <span class="mono">${zone.allocationPercent}% alloc</span>
        <span class="mono">${escapeHtml(zone.stress.active ? zone.stress.summary : "stable")}</span>
      </div>
    </button>
  `;
}

function renderGrowthStageNode(stage: GrowthStageData): string {
  return `
    <div class="crop-stage-node crop-stage-node--${stage.state}">
      <span class="crop-stage-node__dot"></span>
      <span class="crop-stage-node__label">${escapeHtml(stage.label)}</span>
      <span class="crop-stage-node__sol mono">${escapeHtml(stage.sol)}</span>
    </div>
  `;
}

function renderMissionLogEntry(entry: BackendEventLogEntry): string {
  return renderLogEntry({
    type: logTypeFromEvent(entry),
    icon: eventIcon(entry),
    message: entry.message,
    meta: `${formatEventStamp(entry)}${entry.zoneId ? ` | ${entry.zoneId}` : ""}`,
    confidence: entry.type.replaceAll("_", " ").toUpperCase(),
    extra:
      entry.type === "ai_action"
        ? renderStatusBadge("AI action", "CAU")
        : entry.zoneId
          ? renderStatusBadge(entry.zoneId, eventTone(entry.level))
          : "",
  });
}

function renderTimelineCard(entry: BackendEventLogEntry, currentMissionDay: number): string {
  const isCurrent = entry.missionDay === currentMissionDay;
  const missionDelta = currentMissionDay - entry.missionDay;

  return `
    <div class="overview-timeline-chip ${isCurrent ? "is-current" : ""}">
      <span class="overview-timeline-chip__sol mono">SOL ${entry.missionDay}</span>
      <span class="overview-timeline-chip__dot" style="background:${toneColor(eventTone(entry.level))}"></span>
      <span class="overview-timeline-chip__label">${entry.zoneId ? escapeHtml(entry.zoneId) : entry.type.replaceAll("_", " ")}</span>
      <span class="overview-timeline-chip__event">${escapeHtml(entry.message)}</span>
      <span class="overview-timeline-chip__meta mono">${isCurrent ? "current sol" : `${missionDelta} sol ago`}</span>
    </div>
  `;
}

function renderOverviewNutritionRow(row: NutritionMiniRow): string {
  return `
    <div class="overview-nutrition-row">
      <span>${escapeHtml(row.label)}</span>
      <span class="mono">${escapeHtml(row.value)}</span>
      ${renderStatusBadge(row.badge, row.tone)}
    </div>
  `;
}

function renderMicronutrientCell(item: MicronutrientMiniData): string {
  return `
    <div class="overview-micro-cell">
      <div class="overview-micro-cell__head">
        <span class="overview-micro-cell__label">${item.label}</span>
        ${renderStatusBadge(`${item.coveragePercent}%`, item.tone)}
      </div>
      <div class="overview-micro-cell__body">
        <span class="mono">${item.produced}</span>
        <span class="overview-micro-cell__target mono">target ${item.target}</span>
      </div>
    </div>
  `;
}

function renderResourceTile(tile: OverviewResourceTileData): string {
  return `
    <div class="overview-env-tile">
      <div class="overview-env-tile__head">
        <span class="overview-env-tile__label">${escapeHtml(tile.label)}</span>
        <span class="overview-env-tile__status mono">${escapeHtml(tile.status)}</span>
      </div>
      <div class="overview-env-tile__value mono ${tile.caution ? "overview-env-tile__value--cau" : ""}">${escapeHtml(tile.value)} ${escapeHtml(tile.unit)}</div>
      <div class="ui-kpi__bar">
        <span style="width:${tile.fillPct}%; background:${tile.fillColor}"></span>
      </div>
    </div>
  `;
}

function renderIncidentPanel(
  mission: BackendMissionState,
  planner: BackendPlannerOutput | null,
  agent: BackendAgentAnalysis | null,
  controlActions: ControlActionItem[],
  automationResponses: AutomatedControlResponse[],
): string {
  const primaryChange = planner?.changes[0];
  const primaryFlag = planner?.stressFlags[0];
  const primaryAutomation = automationResponses[0];
  const primaryAction = controlActions[0];
  const incidentLabel = mission.activeScenario
    ? `${mission.activeScenario.title} · ${formatScenarioSeverity(mission.activeScenario.severity)}`
    : "No active scenario";
  const incidentTone = mission.activeScenario
    ? severityTone(mission.activeScenario.severity)
    : missionTone(mission);

  return `
    <div class="incident-panel">
      <div class="incident-panel__row">
        <span class="incident-panel__label">Incident</span>
        <span class="incident-panel__value">${renderStatusBadge(incidentLabel, incidentTone)}</span>
      </div>
      <div class="incident-panel__row">
        <span class="incident-panel__label">Planner</span>
        <span class="incident-panel__value">${renderStatusBadge(
          planner ? formatPlannerMode(planner.mode) : "offline",
          planner?.mode === "nutrition_preservation" ? "CAU" : "NOM",
        )}</span>
      </div>
      <div class="incident-panel__row">
        <span class="incident-panel__label">Auto responses</span>
        <span class="incident-panel__value mono">${activeAutomationResponses(automationResponses).length}</span>
      </div>
      <div class="incident-panel__row">
        <span class="incident-panel__label">Recommendations</span>
        <span class="incident-panel__value mono">${controlActions.length}</span>
      </div>
      <div class="incident-panel__row">
        <span class="incident-panel__label">Projected changes</span>
        <span class="incident-panel__value mono">${planner?.changes.length ?? 0}</span>
      </div>
      <div class="incident-panel__row">
        <span class="incident-panel__label">Primary watch</span>
        <span class="incident-panel__value incident-panel__value--wrap">
          ${
            primaryAutomation
              ? escapeHtml(primaryAutomation.statusLabel)
              : primaryAction
                ? escapeHtml(primaryAction.label)
              : primaryFlag
                ? `${escapeHtml(primaryFlag.zoneId)} ${escapeHtml(primaryFlag.stressType.replaceAll("_", " "))} (${escapeHtml(primaryFlag.severity)})`
                : primaryChange
                  ? `${escapeHtml(primaryChange.field)} → ${escapeHtml(String(primaryChange.newValue))}`
                  : "No planner watch item raised."
          }
        </span>
      </div>
      ${
        mission.activeScenario
          ? renderNotice({
              level: noticeFromTone(incidentTone),
              title: "Scenario state",
              children: `${mission.activeScenario.description} Affected zones: ${mission.activeScenario.affectedZoneIds.join(", ")}.`,
            })
          : renderNotice({
              level: "ok",
              title: "Operational state",
              children:
                "No injected failure scenario is active. Planner remains in monitoring mode and the dashboard is rendering the live mission snapshot.",
            })
      }
      ${
        agent
          ? renderNotice({
              level: noticeFromTone(riskTone(agent.riskLevel)),
              title: `AETHER ${formatRiskLevel(agent.riskLevel)} signal`,
              children: `${agent.riskSummary}${agent.recommendedActions.length > 0 ? ` Recommended: ${agent.recommendedActions
                .slice(0, 2)
                .map((action) => action.type.replaceAll("_", " "))
                .join(", ")}.` : ""}`,
            })
          : ""
      }
    </div>
  `;
}

function renderScenarioCard(
  scenario: BackendScenarioCatalogItem,
  mission: BackendMissionState,
  selectedScenarioType?: BackendScenarioCatalogItem["scenarioType"],
): string {
  const isSelected = scenario.scenarioType === selectedScenarioType;
  const isActive = mission.activeScenario?.type === scenario.scenarioType;

  return `
    <article class="backend-scenario-card ${isSelected ? "is-selected" : ""} ${isActive ? "is-active" : ""}">
      <div class="backend-scenario-card__head">
        <div>
          <p class="backend-scenario-card__title">${escapeHtml(scenario.label)}</p>
          <p class="backend-scenario-card__meta">${escapeHtml(scenario.affectedResources.join(" · "))}</p>
        </div>
        ${isActive ? renderStatusBadge("Active", severityTone(mission.activeScenario?.severity ?? "mild")) : ""}
      </div>
      <p class="backend-scenario-card__body">${escapeHtml(scenario.description)}</p>
      ${renderNotice({
        level: "warn",
        title: "Nutrition risk",
        children: scenario.nutritionRisk,
      })}
      <div class="backend-scenario-card__severity">
        ${scenario.severities
          .map(
            (option) => `
              <button
                type="button"
                class="btn ${option.severity === "critical" ? "btn-danger" : option.severity === "moderate" ? "btn-primary" : "btn-ghost"}"
                data-scenario-inject="${scenario.scenarioType}"
                data-scenario-severity="${option.severity}"
              >
                ${escapeHtml(option.label)}
              </button>
            `,
          )
          .join("")}
      </div>
      <div class="ui-notice-stack">
        ${scenario.severities
          .map((option) =>
            renderNotice({
              level: noticeFromTone(severityTone(option.severity)),
              title: `${formatScenarioSeverity(option.severity)} · overrides`,
              children: option.effectSummary,
            }),
          )
          .join("")}
      </div>
    </article>
  `;
}

void renderScenarioCard;

function renderForecastRow(label: string, before: number, after: number): string {
  return `
    <div class="failure-realloc-row">
      <span class="failure-realloc-row__label">${escapeHtml(label)}</span>
      <span class="failure-realloc-row__value">
        <span class="mono">${before}</span>
        &nbsp;→&nbsp;
        <span class="mono">${after}</span>
      </span>
    </div>
  `;
}

void renderForecastRow;

function missionTone(mission: BackendMissionState): StatusTone {
  if (mission.status === "critical") {
    return "ABT";
  }

  if (mission.status === "warning" || mission.status === "nutrition_preservation_mode") {
    return "CAU";
  }

  return "NOM";
}

function zoneTone(zone: BackendCropZone): StatusTone {
  if (zone.status === "critical" || zone.status === "offline" || zone.stress.severity === "critical") {
    return "ABT";
  }

  if (
    zone.status === "stressed" ||
    zone.status === "harvesting" ||
    zone.stress.severity === "moderate" ||
    zone.stress.severity === "high" ||
    zone.stress.severity === "low"
  ) {
    return "CAU";
  }

  return "NOM";
}

function controlPriorityTone(priority: ControlLogEntry["priority"]): StatusTone {
  if (priority === "critical") {
    return "ABT";
  }

  if (priority === "warning") {
    return "CAU";
  }

  return "NOM";
}

function controlActionTone(
  actions: ControlActionItem[],
  automationResponses: AutomatedControlResponse[] = [],
): StatusTone {
  const activeResponses = activeAutomationResponses(automationResponses);

  if (
    actions.some((action) => action.priority === "critical") ||
    activeResponses.some((response) => response.priority === "critical")
  ) {
    return "ABT";
  }

  if (
    actions.some((action) => action.priority === "warning") ||
    activeResponses.some((response) => response.priority === "warning")
  ) {
    return "CAU";
  }

  return "NOM";
}

function eventTone(level: BackendEventLogEntry["level"]): StatusTone {
  if (level === "critical") {
    return "ABT";
  }

  if (level === "warning") {
    return "CAU";
  }

  return "NOM";
}

function severityTone(severity: BackendScenarioSeverity): StatusTone {
  if (severity === "critical") {
    return "ABT";
  }

  if (severity === "moderate") {
    return "CAU";
  }

  return "NOM";
}

function riskTone(riskLevel: BackendAgentAnalysis["riskLevel"]): StatusTone {
  if (riskLevel === "critical") {
    return "ABT";
  }

  if (riskLevel === "high" || riskLevel === "moderate") {
    return "CAU";
  }

  return "NOM";
}

function toneFromPercent(value: number, nominalAt: number, cautionAt: number): StatusTone {
  if (value >= nominalAt) {
    return "NOM";
  }

  if (value >= cautionAt) {
    return "CAU";
  }

  return "ABT";
}

function toneFromMixStatus(status: BackendMissionState["resources"]["nutrientMixStatus"]): StatusTone {
  if (status === "critical") {
    return "ABT";
  }

  if (status === "watch") {
    return "CAU";
  }

  return "NOM";
}

function toneFromEnergyReserve(hours: number): StatusTone {
  if (hours >= 12) {
    return "NOM";
  }

  if (hours >= 6) {
    return "CAU";
  }

  return "ABT";
}

function zoneStatusClass(zone: BackendCropZone): string {
  const tone = zoneTone(zone).toLowerCase();
  const offline = zone.status === "offline" ? " cell-offline" : "";
  return `status-${tone}${offline}`;
}

function logTypeFromEvent(entry: BackendEventLogEntry): "act" | "wrn" | "alr" | "inf" {
  if (entry.type === "ai_action") {
    return "act";
  }

  if (entry.level === "critical") {
    return "alr";
  }

  if (entry.level === "warning" || entry.type === "scenario_injected") {
    return "wrn";
  }

  return "inf";
}

function logTypeFromControlPriority(priority: ControlLogEntry["priority"]): "act" | "wrn" | "alr" | "inf" {
  if (priority === "critical") {
    return "alr";
  }

  if (priority === "warning") {
    return "wrn";
  }

  return "act";
}

function eventIcon(entry: BackendEventLogEntry): string {
  if (entry.type === "ai_action") {
    return "AI";
  }

  if (entry.type === "scenario_injected") {
    return "SIM";
  }

  if (entry.level === "critical") {
    return "ACT";
  }

  if (entry.level === "warning") {
    return "WRN";
  }

  return "INF";
}

function alertFromTone(tone: StatusTone): AlertLevel {
  if (tone === "ABT") {
    return "abt";
  }

  if (tone === "CAU") {
    return "cau";
  }

  return "nom";
}

function noticeFromTone(tone: StatusTone): "ok" | "info" | "warn" | "crit" {
  if (tone === "ABT") {
    return "crit";
  }

  if (tone === "CAU") {
    return "warn";
  }

  return "ok";
}

function formatMissionStatus(status: BackendMissionState["status"]): string {
  return status
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatCropType(type: BackendCropZone["cropType"]): string {
  if (type === "beans") {
    return "Beans";
  }

  return `${type.slice(0, 1).toUpperCase()}${type.slice(1)}`;
}

function formatZoneStatus(status: BackendCropZone["status"]): string {
  return status.replaceAll("_", " ");
}

function formatScenarioType(type: BackendScenarioCatalogItem["scenarioType"]): string {
  return type.replaceAll("_", " ");
}

function formatScenarioSeverity(severity: BackendScenarioSeverity): string {
  return severity.slice(0, 1).toUpperCase() + severity.slice(1);
}

function formatPlannerMode(mode: BackendPlannerOutput["mode"] | undefined): string {
  return (mode ?? "normal")
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatRiskLevel(riskLevel: BackendAgentAnalysis["riskLevel"]): string {
  return riskLevel.slice(0, 1).toUpperCase() + riskLevel.slice(1);
}

function deriveAgentFocus(
  mission: BackendMissionState | null,
  planner: BackendPlannerOutput | null,
): BackendAgentAnalyzeFocus {
  if (mission?.activeScenario) {
    return "scenario_response";
  }

  if (planner?.nutritionRiskDetected || mission?.status === "critical" || mission?.status === "nutrition_preservation_mode") {
    return "nutrition_risk";
  }

  return "mission_overview";
}

function formatPlannerField(value: string): string {
  return value
    .split(".")
    .map((segment) =>
      segment
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replaceAll("_", " ")
        .split(" ")
        .filter(Boolean)
        .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
        .join(" "),
    )
    .join(" · ");
}

function formatPlannerValue(value: string | number | boolean): string {
  if (typeof value === "boolean") {
    return value ? "Enabled" : "Disabled";
  }

  return String(value);
}

function formatNutrientMixStatus(status: BackendMissionState["resources"]["nutrientMixStatus"]): string {
  return status.replaceAll("_", " ");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

function formatStressType(type: BackendCropZone["stress"]["type"]): string {
  return type.replaceAll("_", " ");
}

function formatEventStamp(entry: BackendEventLogEntry): string {
  return `${formatTimestamp(entry.timestamp)} | SOL ${entry.missionDay}`;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")} ${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}Z`;
}

function formatPollInterval(value: number): string {
  if (value % 60_000 === 0) {
    return `${Math.round(value / 60_000)} min`;
  }

  return `${Math.round(value / 1_000)} sec`;
}

function toneColor(tone: StatusTone): string {
  if (tone === "ABT") {
    return "var(--abt)";
  }

  if (tone === "CAU") {
    return "var(--cau)";
  }

  return "var(--nom)";
}

function severityProgress(severity: BackendCropZone["stress"]["severity"]): number {
  switch (severity) {
    case "critical":
      return 100;
    case "high":
      return 80;
    case "moderate":
      return 60;
    case "low":
      return 35;
    default:
      return 0;
  }
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function deriveDisplayedCoveragePercent(produced: number, target: number): number {
  if (target <= 0) {
    return 0;
  }

  return Math.round((produced / target) * 100);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Mission control could not reach the live habitat runtime services.";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
