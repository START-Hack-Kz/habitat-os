import { renderHeader } from "./components/header";
import { mountGreenhouseLanding, renderGreenhouseLanding } from "./components/greenhouseLanding";
import { renderNavigation } from "./components/navigation";
import {
  applyPlantDecision,
  applySimulationTweak,
  fetchAgentAnalysis,
  fetchAgentChat,
  fetchMissionState,
  fetchPlantDecisionAnalysis,
  fetchPlannerAnalysis,
  fetchScenarioCatalog,
  injectScenario,
  resetSimulation,
} from "./data/api";
import { getGreenhouseById, greenhouseCatalog } from "./data/greenhouses";
import { buildHabitatOperationsModel, type HabitatOperationsModel } from "./data/habitatOperations";
import { getZoneCompositionProfile } from "./data/zoneComposition";
import type {
  AlertLevel,
  BackendAgentAnalysis,
  BackendAgentChatConfidence,
  BackendAgentChatResponse,
  BackendCropZone,
  BackendEventLogEntry,
  BackendMissionState,
  BackendPlantDecisionResponse,
  BackendPlantHealthCheck,
  BackendPlantRecord,
  BackendPlannerOutput,
  BackendScenarioCatalogItem,
  BackendScenarioSeverity,
  GreenhouseSummary,
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
type AgentAnalysisFocus = "mission_overview" | "nutrition_risk" | "scenario_response";

interface AppState {
  view: AppView;
  activeGreenhouseId: string;
  activeTab: TabId;
  selectedZoneId: string;
  selectedOverviewHabitatId: string;
  overviewHabitatCollapsed: boolean;
  selectedScenarioType: BackendScenarioCatalogItem["scenarioType"] | "";
  mission: BackendMissionState | null;
  scenarios: BackendScenarioCatalogItem[];
  planner: BackendPlannerOutput | null;
  agent: BackendAgentAnalysis | null;
  agentAnalyzing: boolean;
  agentAnalysisLabel: string;
  companionMessages: CompanionMessage[];
  companionLog: CompanionLogItem[];
  companionBusy: boolean;
  booting: boolean;
  busy: boolean;
  syncMessage: string;
  error: string;
  sensorNotification: SensorNotification | null;
}

interface SensorNotification {
  id: string;
  level: AlertLevel;
  title: string;
  body: string;
  detail: string;
}

interface SensorResetPlan {
  key: string;
  zoneId: string;
  level: AlertLevel;
  title: string;
  body: string;
  detail: string;
  tweak: {
    zones: Array<{
      zoneId: string;
      temperature?: number;
      humidity?: number;
      nutrientPH?: number;
      soilMoisture?: number;
    }>;
  };
}

interface PlantWorkflowTarget {
  plant: BackendPlantRecord;
  healthCheck: BackendPlantHealthCheck;
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
  { id: "risk", label: "V. Logs" },
  { id: "agent", label: "VI. Companion" },
];

const MISSION_POLL_MS = resolveMissionPollMs(import.meta.env.VITE_MISSION_POLL_MS);

export function renderApp(root: HTMLDivElement): void {
  const initialRoute = parseRoute(window.location.pathname);
  let landingSceneController: { dispose: () => void } | null = null;
  const state: AppState = {
    view: initialRoute.view,
    activeGreenhouseId: initialRoute.greenhouseId,
    activeTab: "overview",
    selectedZoneId: "",
    selectedOverviewHabitatId: initialRoute.greenhouseId,
    overviewHabitatCollapsed: false,
    selectedScenarioType: "",
    mission: null,
    scenarios: [],
    planner: null,
    agent: null,
    agentAnalyzing: false,
    agentAnalysisLabel: "",
    companionMessages: [],
    companionLog: [],
    companionBusy: false,
    booting: true,
    busy: false,
    syncMessage: "Connecting to live mission state.",
    error: "",
    sensorNotification: null,
  };
  let pollTimer: number | null = null;
  let pollInFlight = false;
  let decisionSupportInFlight = false;
  let plantDecisionInFlight = false;
  let plantDecisionTimer: number | null = null;
  let scheduledPlantDecisionKey = "";
  let lastAgentAnalysisKey = "";
  let lastHandledAutoAnalysisKey = "";
  let lastHandledPlantDecisionKey = "";
  let lastMissionWatchKey = "";

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
          ${state.agentAnalyzing ? renderAgentBusyStrip(state.agentAnalysisLabel) : ""}
          ${renderSensorNotification(state.sensorNotification)}
          ${
            state.booting && !state.mission
              ? renderBootState()
              : `
                <main class="workspace">
                  ${renderPage(state)}
                </main>
              `
          }
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
    const habitatTabTrigger = target.closest<HTMLElement>("[data-overview-habitat]");
    const habitatToggleTrigger = target.closest<HTMLElement>("[data-overview-habitat-toggle]");
    const injectTrigger = target.closest<HTMLElement>("[data-scenario-inject]");
    const resetTrigger = target.closest<HTMLElement>("[data-scenario-reset]");
    const plannerRefresh = target.closest<HTMLElement>("[data-planner-refresh]");
    const sensorNotificationClose = target.closest<HTMLElement>("[data-sensor-notification-close]");

    if (sensorNotificationClose) {
      state.sensorNotification = null;
      draw();
      return;
    }

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

    if (habitatTabTrigger) {
      const greenhouseId = habitatTabTrigger.dataset.overviewHabitat ?? "";

      if (getGreenhouseById(greenhouseId)) {
        state.selectedOverviewHabitatId = greenhouseId;
        draw();
      }

      return;
    }

    if (habitatToggleTrigger) {
      state.overviewHabitatCollapsed = !state.overviewHabitatCollapsed;
      draw();
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
    state.selectedOverviewHabitatId = route.greenhouseId;
    draw();
  });

  window.addEventListener("beforeunload", () => {
    stopMissionPolling();
    stopPlantDecisionTimer();
  });

  void bootstrap();

  async function bootstrap(): Promise<void> {
    state.booting = true;
    state.busy = true;
    state.syncMessage = "Loading mission, planner state, and decision support.";
    state.error = "";
    draw();

    try {
      const [missionResult, scenariosResult] = await Promise.allSettled([
        fetchMissionState(),
        fetchScenarioCatalog(),
      ]);

      if (missionResult.status !== "fulfilled") {
        throw missionResult.reason;
      }

      state.mission = missionResult.value;
      state.scenarios = scenariosResult.status === "fulfilled" ? scenariosResult.value : [];
      syncSelections(state);
      lastHandledPlantDecisionKey = "";
      lastMissionWatchKey = buildMissionWatchKey(state.mission);
      const handledSensorReset = await handleSensorResetIfNeeded();
      if (!handledSensorReset) {
        await syncDecisionSupport({
          allowAutoAnalyze: false,
          busyMessage: state.syncMessage,
          showBusyStrip: false,
          recordAutoLog: false,
        });
        lastHandledAutoAnalysisKey = buildAutoAnalysisKey(state.mission, state.planner);
      }
      schedulePlantWorkflowIfNeeded();
      state.error = "";
    } catch (error) {
      state.error = getErrorMessage(error);
    } finally {
      state.booting = false;
      state.busy = false;
      state.syncMessage = "";
      startMissionPolling();
      draw();
    }
  }

  async function refreshPlanner(message: string): Promise<void> {
    await syncDecisionSupport({
      allowAutoAnalyze: false,
      busyMessage: message,
      showBusyStrip: true,
      recordAutoLog: false,
    });
  }

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
      state.sensorNotification = null;
      state.selectedScenarioType = scenarioType;
      syncSelections(state);
      lastMissionWatchKey = buildMissionWatchKey(state.mission);
      await syncDecisionSupport({
        allowAutoAnalyze: true,
        busyMessage: state.syncMessage,
        showBusyStrip: false,
        recordAutoLog: true,
      });
      schedulePlantWorkflowIfNeeded();
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
      state.sensorNotification = null;
      syncSelections(state);
      lastHandledPlantDecisionKey = "";
      lastMissionWatchKey = buildMissionWatchKey(state.mission);
      await syncDecisionSupport({
        allowAutoAnalyze: true,
        busyMessage: state.syncMessage,
        showBusyStrip: false,
        recordAutoLog: false,
      });
      schedulePlantWorkflowIfNeeded();
      state.error = "";
    } catch (error) {
      state.error = getErrorMessage(error);
    } finally {
      state.busy = false;
      state.syncMessage = "";
      draw();
    }
  }

  function startMissionPolling(): void {
    if (pollTimer !== null) {
      return;
    }

    pollTimer = window.setInterval(() => {
      void syncMissionStateFromPoll();
    }, MISSION_POLL_MS);
  }

  function stopMissionPolling(): void {
    if (pollTimer === null) {
      return;
    }

    window.clearInterval(pollTimer);
    pollTimer = null;
  }

  function stopPlantDecisionTimer(): void {
    if (plantDecisionTimer !== null) {
      window.clearTimeout(plantDecisionTimer);
      plantDecisionTimer = null;
    }
    scheduledPlantDecisionKey = "";
  }

  async function syncMissionStateFromPoll(): Promise<void> {
    if (pollInFlight || decisionSupportInFlight || state.busy) {
      return;
    }

    pollInFlight = true;

    try {
      const nextMission = await fetchMissionState();
      const nextMissionWatchKey = buildMissionWatchKey(nextMission);

      if (state.mission && nextMissionWatchKey === lastMissionWatchKey) {
        return;
      }

      state.mission = nextMission;
      lastMissionWatchKey = nextMissionWatchKey;
      syncSelections(state);
      const handledSensorReset = await handleSensorResetIfNeeded();
      if (!handledSensorReset) {
        await syncDecisionSupport({
          allowAutoAnalyze: true,
          busyMessage: "",
          showBusyStrip: false,
          recordAutoLog: true,
        });
      }
      schedulePlantWorkflowIfNeeded();
    } catch (error) {
      if (!state.mission) {
        state.error = getErrorMessage(error);
        draw();
      }
    } finally {
      pollInFlight = false;
    }
  }

  function schedulePlantWorkflowIfNeeded(): void {
    if (!state.mission || plantDecisionInFlight) {
      return;
    }

    const target = findPendingPlantWorkflowTarget(state.mission);
    if (!target) {
      stopPlantDecisionTimer();
      lastHandledPlantDecisionKey = "";
      return;
    }

    const nextKey = buildPlantWorkflowKey(target);
    if (nextKey === lastHandledPlantDecisionKey || nextKey === scheduledPlantDecisionKey) {
      return;
    }

    stopPlantDecisionTimer();
    scheduledPlantDecisionKey = nextKey;
    plantDecisionTimer = window.setTimeout(() => {
      plantDecisionTimer = null;
      scheduledPlantDecisionKey = "";
      void runPlantWorkflow(target, nextKey);
    }, 2200);
  }

  async function runPlantWorkflow(
    target: PlantWorkflowTarget,
    workflowKey: string,
  ): Promise<void> {
    if (plantDecisionInFlight) {
      return;
    }

    plantDecisionInFlight = true;
    state.companionLog = mergeCompanionLog(state.companionLog, [
      {
        id: `plant-scan-${Date.now()}`,
        kind: "cmd",
        line: `canopy_dog_scan_${normalizeCommandLabel(target.plant.zoneId)}_r${target.plant.rowNo}_p${target.plant.plantNo}`,
        body: `Canopy rover reached ${target.plant.zoneId} row ${target.plant.rowNo} plant ${target.plant.plantNo} and started a health triage scan.`,
        tone: "CAU",
      },
    ]);
    draw();

    try {
      const decision = await fetchPlantDecisionAnalysis(target.plant.plantId);
      const nextMission = await applyPlantDecision({
        plantId: decision.plantId,
        targetStatus: decision.targetStatus,
        severityLabel: decision.severityLabel,
        recoverabilityLabel: decision.recoverabilityLabel,
        recommendedAction: decision.recommendedAction,
        summary: decision.logMessage,
      });

      state.mission = nextMission;
      syncSelections(state);
      lastHandledPlantDecisionKey = workflowKey;
      lastMissionWatchKey = buildMissionWatchKey(nextMission);
      state.companionMessages = [
        ...state.companionMessages,
        buildPlantWorkflowMessage(decision, target),
      ];
      state.companionLog = mergeCompanionLog(
        state.companionLog,
        buildPlantWorkflowLogItems(decision, target),
      );
      state.error = "";
      draw();
      schedulePlantWorkflowIfNeeded();
    } catch (error) {
      state.companionLog = mergeCompanionLog(state.companionLog, [
        {
          id: `plant-scan-fail-${Date.now()}`,
          kind: "fact",
          line: `plant_triage_fault_${normalizeCommandLabel(target.plant.zoneId)}`,
          body: `Plant triage failed for ${target.plant.zoneId} row ${target.plant.rowNo} plant ${target.plant.plantNo}: ${getErrorMessage(error)}`,
          tone: "ABT",
        },
      ]);
      draw();
    } finally {
      plantDecisionInFlight = false;
    }
  }

  async function syncDecisionSupport(options: {
    allowAutoAnalyze: boolean;
    busyMessage: string;
    showBusyStrip: boolean;
    recordAutoLog: boolean;
  }): Promise<void> {
    if (!state.mission || decisionSupportInFlight) {
      return;
    }

    decisionSupportInFlight = true;

    if (options.showBusyStrip) {
      state.busy = true;
      state.syncMessage = options.busyMessage;
      draw();
    }

    try {
      try {
        state.planner = await fetchPlannerAnalysis();
      } catch {
        state.planner = null;
      }

      const hasIncident = hasMissionIncident(state.mission, state.planner);
      if (options.allowAutoAnalyze && !hasIncident) {
        state.agent = null;
        lastAgentAnalysisKey = "";
        lastHandledAutoAnalysisKey = "";
        state.error = "";
        return;
      }

      const focus = deriveAgentAnalysisFocus(state.mission, state.planner);
      const analysisKey = buildAgentAnalysisKey(state.mission, focus);
      const autoAnalysisKey = options.allowAutoAnalyze
        ? buildAutoAnalysisKey(state.mission, state.planner, focus)
        : "";
      const shouldRunAutoAnalyze =
        autoAnalysisKey.length > 0 && autoAnalysisKey !== lastHandledAutoAnalysisKey;
      const shouldRefreshAgent = options.allowAutoAnalyze
        ? shouldRunAutoAnalyze
        : !state.agent || analysisKey !== lastAgentAnalysisKey;

      if (shouldRefreshAgent) {
        state.agentAnalyzing = true;
        state.agentAnalysisLabel = buildAgentAnalysisLabel(state.mission, focus);
        draw();

        state.agent = await fetchAgentAnalysis({ focus });
        lastAgentAnalysisKey = analysisKey;

        if (shouldRunAutoAnalyze) {
          lastHandledAutoAnalysisKey = autoAnalysisKey;

          if (options.recordAutoLog) {
            state.companionLog = mergeCompanionLog(
              state.companionLog,
              buildAutoAnalysisLogItems(state.agent, focus),
            );
          }

          state.companionMessages = [
            ...state.companionMessages,
            buildAutoAnalysisMessage(state.agent, focus),
          ];
        }
      }

      state.error = "";
    } catch (error) {
      if (options.showBusyStrip) {
        state.error = getErrorMessage(error);
      } else if (options.recordAutoLog) {
        state.companionLog = mergeCompanionLog(state.companionLog, [
          {
            id: `auto-analysis-error-${Date.now()}`,
            kind: "fact",
            line: "auto_analyze_fault",
            body: `AETHER could not refresh the incident analysis: ${getErrorMessage(error)}`,
            tone: "ABT",
          },
        ]);
      }
    } finally {
      decisionSupportInFlight = false;
      state.agentAnalyzing = false;
      state.agentAnalysisLabel = "";

      if (options.showBusyStrip) {
        state.busy = false;
        state.syncMessage = "";
      }

      draw();
    }
  }

  async function handleSensorResetIfNeeded(): Promise<boolean> {
    if (!state.mission || state.mission.activeScenario) {
      return false;
    }

    const plan = detectSensorResetPlan(state.mission);

    if (!plan) {
      return false;
    }

    state.agent = null;
    lastAgentAnalysisKey = "";
    lastHandledAutoAnalysisKey = "";
    state.sensorNotification = {
      id: plan.key,
      level: plan.level,
      title: plan.title,
      body: plan.body,
      detail: plan.detail,
    };
    state.companionLog = mergeCompanionLog(state.companionLog, [
      {
        id: `sensor-reset-${Date.now()}`,
        kind: "cmd",
        line: `sensor_reset_${normalizeCommandLabel(plan.zoneId)}`,
        body: `${plan.title}. ${plan.body}`,
        tone: toneFromAlertLevel(plan.level),
      },
    ]);
    draw();

    try {
      await applySimulationTweak(plan.tweak);
      const correctedMission = await fetchMissionState();
      state.mission = correctedMission;
      lastMissionWatchKey = buildMissionWatchKey(correctedMission);
      syncSelections(state);
      const correctedZone = correctedMission.zones.find((zone) => zone.zoneId === plan.zoneId);
      const resultingTone = correctedZone ? zoneTone(correctedZone) : "CAU";
      const resultingLevel = alertFromTone(resultingTone);
      const resultingStatus = correctedZone
        ? formatZoneStatus(correctedZone.status)
        : "status unavailable";
      const resultingDetail = correctedZone
        ? correctedZone.stress.active
          ? `${plan.detail} ${plan.zoneId} sensors were normalized, but the zone remains ${resultingStatus} due to ${formatStressType(correctedZone.stress.type)} ${correctedZone.stress.severity}.`
          : `${plan.detail} ${plan.zoneId} is now ${resultingStatus}.`
        : plan.detail;
      state.sensorNotification = {
        ...state.sensorNotification,
        level: resultingLevel,
        body: correctedZone?.stress.active
          ? `${plan.zoneId} sensor values were restored, but the zone remains ${resultingStatus}.`
          : `${plan.zoneId} returned to nominal sensor targets and is now ${resultingStatus}.`,
        detail: resultingDetail,
      };
      state.companionLog = mergeCompanionLog(state.companionLog, [
        {
          id: `sensor-reset-ok-${Date.now()}`,
          kind: "fact",
          line: `sensor_reset_complete_${normalizeCommandLabel(plan.zoneId)}`,
          body: correctedZone?.stress.active
            ? `${plan.zoneId} primary sensors were restored, but the zone remains ${resultingStatus} with ${formatStressType(correctedZone.stress.type)} ${correctedZone.stress.severity}.`
            : `${plan.zoneId} primary sensors were restored and the zone is now ${resultingStatus}.`,
          tone: resultingTone,
        },
      ]);
    } catch (error) {
      state.sensorNotification = {
        ...state.sensorNotification,
        level: "abt",
        body: `Sensor reset failed: ${getErrorMessage(error)}`,
        detail: "Check the simulation tweak route and retry.",
      };
      state.companionLog = mergeCompanionLog(state.companionLog, [
        {
          id: `sensor-reset-fail-${Date.now()}`,
          kind: "fact",
          line: `sensor_reset_failed_${normalizeCommandLabel(plan.zoneId)}`,
          body: `Automatic sensor normalization failed: ${getErrorMessage(error)}`,
          tone: "ABT",
        },
      ]);
    }

    return true;
  }

  function navigateToGreenhouse(greenhouseId: string): void {
    state.view = "detail";
    state.activeGreenhouseId = greenhouseId;
    state.selectedOverviewHabitatId = greenhouseId;
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
      ${renderGreenhouseLanding(greenhouseCatalog, state.mission?.missionDay ?? null, state.mission)}
    </div>
  `;
}

function renderGreenhouseContextBar(_greenhouse: GreenhouseSummary): string {
  return `
    <div class="greenhouse-context">
      <button class="greenhouse-context__back" type="button" data-route-home="true">
        Return to habitat array
      </button>
    </div>
  `;
}

function renderPage(state: AppState): string {
  if (!state.mission) {
    return renderBootState();
  }

  const displayMission = deriveAgentSuggestedMission(state.mission, state.agent);

  switch (state.activeTab) {
    case "overview":
      return renderOverview(
        displayMission,
        state.planner,
        state.agent,
        state.agentAnalyzing,
        state.selectedOverviewHabitatId,
        state.overviewHabitatCollapsed,
      );
    case "crops":
      return renderCrops(displayMission, state.selectedZoneId);
    case "resources":
      return renderResources(displayMission, state.planner);
    case "nutrition":
      return renderNutrition(displayMission, state.planner);
    case "risk":
      return renderRisk(state.mission, state.companionLog);
    case "agent":
      return renderAgent(
        state.mission,
        state.planner,
        state.agent,
        state.companionMessages,
        state.companionLog,
        state.companionBusy,
        state.agentAnalyzing,
        state.agentAnalysisLabel,
      );
    default:
      return renderOverview(
        displayMission,
        state.planner,
        state.agent,
        state.agentAnalyzing,
        state.selectedOverviewHabitatId,
        state.overviewHabitatCollapsed,
      );
  }
}

function renderOverview(
  mission: BackendMissionState,
  planner: BackendPlannerOutput | null,
  _agent: BackendAgentAnalysis | null,
  _agentAnalyzing: boolean,
  selectedHabitatId: string,
  overviewHabitatCollapsed: boolean,
): string {
  const metrics = buildOverviewMetrics(mission);
  const habitats = greenhouseCatalog.map((greenhouse) =>
    buildHabitatOperationsModel(
      greenhouse,
      mission.zones.find((zone) => zone.zoneId === greenhouse.zoneId),
      mission.plants.filter((plant) => plant.zoneId === greenhouse.zoneId),
      mission.plantHealthChecks.filter((check) =>
        mission.plants.some(
          (plant) => plant.plantId === check.plantId && plant.zoneId === greenhouse.zoneId,
        ),
      ),
    ),
  );
  const selectedHabitat =
    habitats.find((habitat) => habitat.habitatId === selectedHabitatId) ?? habitats[0];

  return `
    ${renderMissionAlert(mission)}

    <section class="overview-home">
      <div class="overview-kpi-row">
        ${metrics.map((item) => renderMetricTile(item)).join("")}
      </div>

      <div class="overview-hero">
        ${renderPanel({
          title: "Habitat Operations",
          dotColor: "var(--aero-blue)",
          rightSlot: renderStatusBadge(
            `${selectedHabitat.cropLabel} lane active`,
            selectedHabitat.statusTone,
          ),
          children: renderHabitatOperationsWindow(selectedHabitat, habitats, overviewHabitatCollapsed),
        })}
      </div>

      <div class="overview-support-row overview-support-row--double">
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
      </div>

      <div class="overview-support-row overview-support-row--double">
        ${renderPanel({
          title: "Recent Mission Log",
          dotColor: "var(--cau)",
          rightSlot:
            '<button class="overview-link-btn" type="button" data-tab-target="agent">Open agent -></button>',
          children: `
            <div class="ui-log-list">
              ${mission.eventLog.slice(0, 4).map((entry) => renderMissionLogEntry(entry)).join("")}
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

function renderHabitatOperationsWindow(
  selectedHabitat: HabitatOperationsModel,
  habitats: HabitatOperationsModel[],
  collapsed: boolean,
): string {
  const dogPath = selectedHabitat.dogPath
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const dogPathId = `habitat-dog-route-${selectedHabitat.habitatId}`;
  const robotAnchor = selectedHabitat.robotHoldingPosition
    ? {
        x: selectedHabitat.robotFocusX,
        y: selectedHabitat.robotFocusY,
      }
    : selectedHabitat.dogPath[0] ?? { x: 25, y: 92 };

  return `
    <div class="habitat-window ${collapsed ? "is-collapsed" : ""}">
      <div class="habitat-window__tabs-row">
        <div class="habitat-window__tabs" role="tablist" aria-label="Habitat operations tabs">
        ${habitats
          .map(
            (habitat) => `
              <button
                type="button"
                class="habitat-window__tab ${habitat.habitatId === selectedHabitat.habitatId ? "is-active" : ""}"
                data-overview-habitat="${escapeHtml(habitat.habitatId)}"
              >
                <span class="habitat-window__tab-code mono">${escapeHtml(habitat.habitatCode)}</span>
                <span class="habitat-window__tab-name">${escapeHtml(habitat.habitatName)}</span>
              </button>
            `,
          )
          .join("")}
        </div>
        <button
          type="button"
          class="habitat-window__toggle"
          data-overview-habitat-toggle="true"
          aria-expanded="${collapsed ? "false" : "true"}"
        >
          ${collapsed ? "Expand" : "Minimize"}
        </button>
      </div>

      ${collapsed ? "" : `
      <div class="habitat-window__frame">
        <div class="habitat-window__header">
          <div class="habitat-window__identity">
            <p class="habitat-window__eyebrow mono">Connected habitat operations</p>
            <h2 class="habitat-window__title">${escapeHtml(selectedHabitat.habitatName)}</h2>
            <p class="habitat-window__subtitle">
              ${escapeHtml(selectedHabitat.cropLabel)} zone · ${selectedHabitat.plantCount} plants · ${escapeHtml(selectedHabitat.zoneId)}
            </p>
          </div>
          <div class="habitat-window__header-status">
            ${renderStatusBadge(selectedHabitat.statusLabel, selectedHabitat.statusTone)}
            ${renderStatusBadge(`${selectedHabitat.growthProgressPercent}% growth`, selectedHabitat.statusTone)}
            ${renderStatusBadge(selectedHabitat.robotStatusLabel, selectedHabitat.robotPaused ? "ABT" : "NOM")}
          </div>
        </div>

        <div class="habitat-window__stage">
          <div class="habitat-window__lane-map" aria-hidden="true">
            <div class="habitat-window__lane habitat-window__lane--vertical habitat-window__lane--left"></div>
            <div class="habitat-window__lane habitat-window__lane--vertical habitat-window__lane--center"></div>
            <div class="habitat-window__lane habitat-window__lane--vertical habitat-window__lane--right"></div>
            <div class="habitat-window__lane habitat-window__lane--horizontal habitat-window__lane--upper"></div>
            <div class="habitat-window__lane habitat-window__lane--horizontal habitat-window__lane--mid"></div>
            <div class="habitat-window__lane habitat-window__lane--horizontal habitat-window__lane--lower"></div>
            <div class="habitat-window__lane habitat-window__lane--horizontal habitat-window__lane--bottom"></div>
          </div>

          <div class="habitat-window__plants">
            ${selectedHabitat.plants.map((plant) => renderHabitatPlantBox(plant)).join("")}
          </div>

          ${
            selectedHabitat.robotHoldingPosition
              ? `
                  <div class="habitat-window__robot-alert">
                    <p class="habitat-window__robot-alert-title">${
                      selectedHabitat.robotPaused
                        ? "Manual harvest / replacement hold"
                        : "Plant health inspection"
                    }</p>
                    <p class="habitat-window__robot-alert-body">${escapeHtml(selectedHabitat.robotStatusDetail)}</p>
                  </div>
                `
              : ""
          }

          <svg class="habitat-window__dog-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path id="${dogPathId}" class="habitat-window__dog-route" d="${dogPath}" pathLength="100"></path>
            <g
              class="habitat-window__dog-runner ${selectedHabitat.robotHoldingPosition ? "is-paused" : ""}"
              ${selectedHabitat.robotHoldingPosition ? `transform="translate(${robotAnchor.x} ${robotAnchor.y})"` : ""}
            >
              <line class="habitat-window__dog-tail-glow" x1="-2.1" y1="0" x2="-0.78" y2="0"></line>
              <line class="habitat-window__dog-tail" x1="-1.55" y1="0" x2="-0.7" y2="0"></line>
              <g class="habitat-window__dog-icon">
                <ellipse class="habitat-window__dog-body" cx="-0.15" cy="0" rx="0.98" ry="0.58"></ellipse>
                <circle class="habitat-window__dog-head" cx="0.96" cy="0" r="0.34"></circle>
                <polygon class="habitat-window__dog-ear" points="1.06,-0.18 1.34,-0.54 1.16,-0.06"></polygon>
                <polygon class="habitat-window__dog-ear" points="1.06,0.18 1.34,0.54 1.16,0.06"></polygon>
                <rect class="habitat-window__dog-leg" x="-0.74" y="-0.76" width="0.18" height="0.38" rx="0.08"></rect>
                <rect class="habitat-window__dog-leg" x="-0.1" y="-0.78" width="0.18" height="0.4" rx="0.08"></rect>
                <rect class="habitat-window__dog-leg" x="-0.74" y="0.38" width="0.18" height="0.38" rx="0.08"></rect>
                <rect class="habitat-window__dog-leg" x="-0.1" y="0.4" width="0.18" height="0.4" rx="0.08"></rect>
                <circle class="habitat-window__dog-eye" cx="1.05" cy="-0.08" r="0.05"></circle>
                <circle class="habitat-window__dog-eye" cx="1.05" cy="0.08" r="0.05"></circle>
              </g>
              ${
                selectedHabitat.robotHoldingPosition
                  ? ""
                  : `
                      <animateMotion dur="18s" repeatCount="indefinite" rotate="auto">
                        <mpath href="#${dogPathId}" />
                      </animateMotion>
                    `
              }
            </g>
          </svg>
        </div>

        <div class="habitat-window__footer">
          <div class="habitat-window__footer-metric">
            <span class="habitat-window__footer-label mono">Cycle</span>
            <span class="habitat-window__footer-value mono">${selectedHabitat.growthDay}/${selectedHabitat.growthCycleDays} d</span>
          </div>
          <div class="habitat-window__footer-metric">
            <span class="habitat-window__footer-label mono">Projected yield</span>
            <span class="habitat-window__footer-value mono">${selectedHabitat.projectedYieldKg.toFixed(1)} kg</span>
          </div>
          <div class="habitat-window__footer-metric">
            <span class="habitat-window__footer-label mono">Allocation</span>
            <span class="habitat-window__footer-value mono">${selectedHabitat.allocationPercent}%</span>
          </div>
          <div class="habitat-window__footer-metric">
            <span class="habitat-window__footer-label mono">Flagged plants</span>
            <span class="habitat-window__footer-value mono">${selectedHabitat.manualInterventionCount}/${selectedHabitat.plantCount}</span>
          </div>
          <div class="habitat-window__footer-note">${escapeHtml(selectedHabitat.summary)}</div>
        </div>
      </div>
      `}
    </div>
  `;
}

function renderHabitatPlantBox(plant: HabitatOperationsModel["plants"][number]): string {
  return `
    <div
      class="habitat-plant habitat-plant--${plant.tone.toLowerCase()}"
      style="left:${plant.x}%; top:${plant.y}%"
      title="${escapeHtml(
        `${plant.label} · row ${plant.rowNo} · plant ${plant.plantNo} · ${formatPlantStatus(plant.status)} · ${plant.recommendedAction} · ${plant.recoverabilityLabel} · color ${Math.round(plant.scores.colorStressScore * 100)}% · wilting ${Math.round(plant.scores.wiltingScore * 100)}%`,
      )}"
    >
      <span class="habitat-plant__head">
        <span class="habitat-plant__code mono">${escapeHtml(plant.code)}</span>
        <span class="habitat-plant__icon" aria-hidden="true">${renderPlantIcon(plant.cropType)}</span>
      </span>
      <span class="habitat-plant__label">${escapeHtml(plant.label)}</span>
      <span class="habitat-plant__status mono">${escapeHtml(formatPlantStatus(plant.status))}</span>
    </div>
  `;
}

function renderPlantIcon(cropType: HabitatOperationsModel["plants"][number]["cropType"]): string {
  switch (cropType) {
    case "potato":
      return `
        <svg viewBox="0 0 24 24" role="presentation">
          <ellipse cx="12" cy="13" rx="6.5" ry="4.8"></ellipse>
          <circle cx="9" cy="12" r="0.8"></circle>
          <circle cx="13.4" cy="14.3" r="0.7"></circle>
          <path d="M12 8.2c0-2 1.5-3.3 3.4-4.2"></path>
          <path d="M12.1 8.4c-1.6-1.8-3.5-2.3-5.1-2.4"></path>
        </svg>
      `;
    case "beans":
      return `
        <svg viewBox="0 0 24 24" role="presentation">
          <path d="M8.4 7.2c3.9-2.3 8 .6 7.1 4.6-.7 3.3-4.8 5.5-8.4 4.3-3.1-1.1-3.7-5.3 1.3-8.9Z"></path>
          <path d="M10 9.3c2.4 1.2 3.7 2.6 4.7 4.8"></path>
        </svg>
      `;
    case "radish":
      return `
        <svg viewBox="0 0 24 24" role="presentation">
          <path d="M12 8.8c3.1 0 5.2 1.9 5.2 4.6 0 3.3-2.5 5.8-5.2 5.8s-5.2-2.5-5.2-5.8c0-2.7 2.1-4.6 5.2-4.6Z"></path>
          <path d="M11.8 8.8V5.4"></path>
          <path d="M11.9 5.8c-2.1-.2-3.6-1.2-4.6-3"></path>
          <path d="M12.2 5.8c1.7-.3 3.3-1.1 4.5-3"></path>
          <path d="M11.9 19.1v2.4"></path>
        </svg>
      `;
    default:
      return `
        <svg viewBox="0 0 24 24" role="presentation">
          <path d="M12 18.5c-3.7 0-6.3-2.5-6.3-6.1 0-4.8 4.3-7.8 10.6-8-0.1 6.2-3 14.1-10.1 14.1Z"></path>
          <path d="M11.2 18.2c1.5-4.4 3-8.4 6.1-11.9"></path>
        </svg>
      `;
  }
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

function renderRisk(
  mission: BackendMissionState,
  companionLog: CompanionLogItem[],
): string {
  return `
    ${renderRiskAlert(mission)}

    <section class="risk-tab">
      <div class="risk-kpi-row">
        ${buildRiskMetrics(mission).map((item) => renderMetricTile(item)).join("")}
      </div>

      <div class="risk-main-row">
        ${renderPanel({
          title: "Logs",
          dotColor: "var(--abt)",
          rightSlot: mission.activeScenario
            ? renderStatusBadge("Active scenario", "ABT")
            : renderStatusBadge("No active scenario", "NOM"),
          children: `
            <div class="risk-emergency-list">
              ${renderEmergencyLogFeed(mission, companionLog)}
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
          `,
        })}
      </div>
    </section>
  `;
}

function renderAgent(
  mission: BackendMissionState,
  planner: BackendPlannerOutput | null,
  agent: BackendAgentAnalysis | null,
  messages: CompanionMessage[],
  _log: CompanionLogItem[],
  companionBusy: boolean,
  agentAnalyzing: boolean,
  agentAnalysisLabel: string,
): string {
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
              <button class="btn btn-ghost agent-uplink__refresh" type="button" data-planner-refresh="true">Refresh analysis</button>
            </div>

            ${
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
                        companionBusy || agentAnalyzing
                          ? `
                              <article class="agent-uplink__message agent-uplink__message--agent">
                                <div class="agent-uplink__avatar agent-uplink__avatar--agent">AE</div>
                                <div class="agent-uplink__bubble agent-uplink__bubble--agent">
                                  <p class="agent-uplink__message-role mono">AETHER</p>
                                  <p class="agent-uplink__message-text">${
                                    companionBusy
                                      ? "Processing mission context and composing a grounded response."
                                      : escapeHtml(
                                          agentAnalysisLabel ||
                                            "Analyzing the latest mission shift and preparing an incident brief.",
                                        )
                                  }</p>
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
                    name="question"
                    placeholder="Ask AETHER about mission risk, nutrition continuity, or safe next actions..."
                    ${companionBusy ? "disabled" : ""}
                  />
                  <button class="agent-uplink__send" type="submit" ${companionBusy ? "disabled" : ""}>
                    <span class="agent-uplink__send-label">${companionBusy ? "Thinking" : "Transmit"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          <aside class="agent-voice-shell">
            <div class="agent-voice-shell__header">
              <p class="agent-voice-shell__label mono">Voice console</p>
              <p class="agent-voice-shell__meta">Hands-free AETHER access for live mission narration and operator questions</p>
            </div>
            <div class="agent-voice-shell__body">
              <div class="agent-voice-shell__note">
                <span class="agent-voice-shell__status"></span>
                <span>Voice agent linked to the same greenhouse knowledge base and companion persona</span>
              </div>
              <div class="agent-voice-shell__widget">
                <elevenlabs-convai agent-id="agent_5001km474bcje2mba0yt1a9g1v4c"></elevenlabs-convai>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
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

function toneFromRiskLevel(riskLevel: BackendAgentAnalysis["riskLevel"]): StatusTone {
  switch (riskLevel) {
    case "critical":
      return "ABT";
    case "high":
    case "moderate":
      return "CAU";
    default:
      return "NOM";
  }
}

function toneFromAlertLevel(level: AlertLevel): StatusTone {
  if (level === "abt") {
    return "ABT";
  }

  if (level === "cau") {
    return "CAU";
  }

  return "NOM";
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

function deriveAgentAnalysisFocus(
  mission: BackendMissionState,
  planner: BackendPlannerOutput | null,
): AgentAnalysisFocus {
  if (mission.activeScenario) {
    return "scenario_response";
  }

  if (
    planner?.nutritionRiskDetected ||
    mission.status !== "nominal" ||
    mission.zones.some((zone) => zone.stress.active || zone.status !== "healthy") ||
    mission.resources.waterDaysRemaining < 120 ||
    mission.resources.energyDaysRemaining < 60
  ) {
    return "nutrition_risk";
  }

  return "mission_overview";
}

function getLatestNonAiEvent(mission: BackendMissionState): BackendEventLogEntry | undefined {
  return mission.eventLog.find((entry) => entry.type !== "ai_action");
}

function isPlantWorkflowEvent(entry: BackendEventLogEntry): boolean {
  return (
    entry.message.startsWith("Canopy rover triage") ||
    entry.message.startsWith("Robot patrol paused") ||
    entry.message.startsWith("Robot patrol resumed")
  );
}

function getLatestMissionIncidentEvent(
  mission: BackendMissionState,
): BackendEventLogEntry | undefined {
  return mission.eventLog.find(
    (entry) => entry.type !== "ai_action" && !isPlantWorkflowEvent(entry),
  );
}

function countPlantStatusesForZone(mission: BackendMissionState, zoneId: string): Record<
  "watch" | "sick" | "critical" | "dead" | "replaced",
  number
> {
  return mission.plants
    .filter((plant) => plant.zoneId === zoneId)
    .reduce(
      (counts, plant) => {
        if (plant.currentStatus !== "healthy") {
          counts[plant.currentStatus] += 1;
        }
        return counts;
      },
      {
        watch: 0,
        sick: 0,
        critical: 0,
        dead: 0,
        replaced: 0,
      },
    );
}

function hasMissionIncident(
  mission: BackendMissionState,
  planner: BackendPlannerOutput | null = null,
): boolean {
  return (
    Boolean(mission.activeScenario) ||
    Boolean(planner?.nutritionRiskDetected) ||
    mission.status !== "nominal" ||
    mission.zones.some(
      (zone) => zone.stress.active || zone.status === "critical" || zone.status === "offline",
    )
  );
}

function buildMissionWatchKey(mission: BackendMissionState): string {
  const latestNonAiEvent = getLatestNonAiEvent(mission);
  const zoneStateKey = mission.zones
    .map(
      (zone) =>
        `${zone.zoneId}:${zone.status}:${zone.stress.active ? zone.stress.type : "none"}:${zone.stress.severity}`,
    )
    .join("|");
  const sensorKey = mission.zones
    .map(
      (zone) =>
        `${zone.zoneId}:t${Math.round(zone.sensors.temperature * 10) / 10}:h${Math.round(zone.sensors.humidity)}:sm${Math.round(zone.sensors.soilMoisture)}:ph${Math.round(zone.sensors.nutrientPH * 10) / 10}`,
    )
    .join("|");
  const plantKey = mission.zones
    .map((zone) => {
      const counts = countPlantStatusesForZone(mission, zone.zoneId);
      return `${zone.zoneId}:w${counts.watch}:s${counts.sick}:c${counts.critical}:d${counts.dead}:r${counts.replaced}`;
    })
    .join("|");
  const resourceKey = [
    `water:${Math.round(mission.resources.waterDaysRemaining)}`,
    `energy:${Math.round(mission.resources.energyDaysRemaining)}`,
    `recycle:${Math.round(mission.resources.waterRecyclingEfficiencyPercent)}`,
    `cal:${Math.round(mission.nutrition.caloricCoveragePercent)}`,
    `protein:${Math.round(mission.nutrition.proteinCoveragePercent)}`,
  ].join("|");

  return [
    mission.status,
    mission.activeScenario?.scenarioId ?? "no-scenario",
    latestNonAiEvent?.eventId ?? "no-event",
    zoneStateKey,
    sensorKey,
    plantKey,
    resourceKey,
  ].join("::");
}

function buildAgentAnalysisKey(
  mission: BackendMissionState,
  focus: AgentAnalysisFocus,
): string {
  const latestMissionEvent = getLatestMissionIncidentEvent(mission);

  return [
    focus,
    mission.status,
    mission.activeScenario?.scenarioId ?? "no-scenario",
    latestMissionEvent?.eventId ?? mission.lastUpdated,
  ].join("::");
}

function buildAutoAnalysisKey(
  mission: BackendMissionState,
  planner: BackendPlannerOutput | null,
  focus?: AgentAnalysisFocus,
): string {
  const analysisFocus = focus ?? deriveAgentAnalysisFocus(mission, planner);
  const latestMissionEvent = getLatestMissionIncidentEvent(mission);
  const hasIncident = hasMissionIncident(mission, planner);

  if (!hasIncident) {
    return "";
  }

  return [
    analysisFocus,
    mission.activeScenario?.scenarioId ?? "no-scenario",
    latestMissionEvent?.eventId ?? mission.lastUpdated,
  ].join("::");
}

function buildAutoAnalysisLogItems(
  agent: BackendAgentAnalysis,
  focus: AgentAnalysisFocus,
): CompanionLogItem[] {
  const tone = toneFromRiskLevel(agent.riskLevel);
  const explanation = agent.explanation.trim() || agent.riskSummary.trim();

  return [
    {
      id: `auto-analysis-${Date.now()}`,
      kind: "cmd",
      line: `auto_analyze_${normalizeCommandLabel(focus)}`,
      body: explanation,
      tone,
    },
  ];
}

function buildAutoAnalysisMessage(
  agent: BackendAgentAnalysis,
  focus: AgentAnalysisFocus,
): CompanionMessage {
  return {
    id: `auto-brief-${Date.now()}`,
    role: "agent",
    text: agent.explanation.trim() || agent.riskSummary.trim(),
    meta: `auto incident brief · ${focus.replaceAll("_", " ")}`,
  };
}

function findPendingPlantWorkflowTarget(
  mission: BackendMissionState,
): PlantWorkflowTarget | null {
  const diseasedPlants = mission.plants
    .filter((plant) => plant.zoneId === "zone-A" && plant.currentStatus === "sick")
    .sort((left, right) => {
      if (left.rowNo !== right.rowNo) {
        return left.rowNo - right.rowNo;
      }

      return left.plantNo - right.plantNo;
    });

  for (const plant of diseasedPlants) {
    const latestCheck = mission.plantHealthChecks
      .filter((check) => check.plantId === plant.plantId)
      .sort((left, right) => right.capturedAt.localeCompare(left.capturedAt))[0];

    if (latestCheck) {
      return {
        plant,
        healthCheck: latestCheck,
      };
    }
  }

  return null;
}

function buildPlantWorkflowKey(target: PlantWorkflowTarget): string {
  return [
    target.plant.plantId,
    target.plant.currentStatus,
    target.healthCheck.checkId,
    target.healthCheck.severityLabel,
    target.healthCheck.recommendedAction,
  ].join("::");
}

function buildPlantWorkflowMessage(
  decision: BackendPlantDecisionResponse,
  target: PlantWorkflowTarget,
): CompanionMessage {
  return {
    id: `plant-triage-${Date.now()}`,
    role: "agent",
    text: decision.summary,
    meta: `plant triage · ${target.plant.zoneId} row ${target.plant.rowNo} plant ${target.plant.plantNo} · ${decision.decision}`,
  };
}

function buildPlantWorkflowLogItems(
  decision: BackendPlantDecisionResponse,
  target: PlantWorkflowTarget,
): CompanionLogItem[] {
  const tone = decision.decision === "replace" ? "ABT" : "CAU";
  return [
    {
      id: `plant-triage-result-${Date.now()}`,
      kind: "fact",
      line: `plant_triage_${decision.decision}_${normalizeCommandLabel(target.plant.zoneId)}_r${target.plant.rowNo}_p${target.plant.plantNo}`,
      body: decision.logMessage,
      tone,
    },
  ];
}

function buildAgentAnalysisLabel(
  mission: BackendMissionState,
  focus: AgentAnalysisFocus,
): string {
  if (focus === "scenario_response" && mission.activeScenario) {
    return `AETHER is analyzing ${mission.activeScenario.title} and computing the response plan.`;
  }

  if (focus === "nutrition_risk") {
    return "AETHER is reviewing resource pressure and nutrition continuity risk.";
  }

  return "AETHER is reviewing the latest mission state.";
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

function renderBusyStrip(message: string): string {
  return renderAlertStrip({
    level: "cau",
    label: "Sync",
    children: message,
    loading: true,
  });
}

function renderAgentBusyStrip(message: string): string {
  return renderAlertStrip({
    level: "cau",
    label: "AI Analyze",
    children: message || "AETHER is reviewing the latest mission change and preparing a grounded response.",
    loading: true,
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
  const scenarioAlert = mission?.activeScenario ? 1 : warningCount && warningCount > 0 ? warningCount : undefined;
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

function renderSensorNotification(notification: SensorNotification | null): string {
  if (!notification) {
    return "";
  }

  return `
    <div class="sensor-notification-rail" aria-live="polite">
      <article class="sensor-notification sensor-notification--${notification.level}">
        <button
          class="sensor-notification__close"
          type="button"
          aria-label="Dismiss sensor notification"
          data-sensor-notification-close
        >
          ×
        </button>
        <p class="sensor-notification__label mono">SENSOR RESPONSE</p>
        <p class="sensor-notification__title">${escapeHtml(notification.title)}</p>
        <p class="sensor-notification__body">${escapeHtml(notification.body)}</p>
        <p class="sensor-notification__detail mono">${escapeHtml(notification.detail)}</p>
      </article>
    </div>
  `;
}

function detectSensorResetPlan(
  mission: BackendMissionState,
): SensorResetPlan | null {
  for (const zone of mission.zones) {
    const thresholds = SENSOR_THRESHOLDS[zone.cropType];
    const nextZone: SensorResetPlan["tweak"]["zones"][number] = { zoneId: zone.zoneId };
    const issueParts: string[] = [];
    const targetParts: string[] = [];
    const hardwareParts: string[] = [];
    let level: AlertLevel = "cau";

    if (
      zone.sensors.temperature < thresholds.temperature.low ||
      zone.sensors.temperature > thresholds.temperature.high
    ) {
      nextZone.temperature = midpoint(thresholds.temperature.low, thresholds.temperature.high);
      issueParts.push(`temperature ${zone.sensors.temperature}°C`);
      targetParts.push(`temperature ${nextZone.temperature}°C`);
      hardwareParts.push("thermal loop");
      if (
        zone.sensors.temperature <= thresholds.temperature.criticalLow ||
        zone.sensors.temperature >= thresholds.temperature.criticalHigh
      ) {
        level = "abt";
      }
    }

    if (
      zone.sensors.humidity < thresholds.humidity.low ||
      zone.sensors.humidity > thresholds.humidity.high
    ) {
      nextZone.humidity = midpoint(thresholds.humidity.low, thresholds.humidity.high);
      issueParts.push(`humidity ${zone.sensors.humidity}%`);
      targetParts.push(`humidity ${nextZone.humidity}%`);
      hardwareParts.push(
        zone.sensors.humidity < thresholds.humidity.low
          ? "humidifier loop"
          : "dehumidifier loop",
      );
      if (
        zone.sensors.humidity <= thresholds.humidity.criticalLow ||
        zone.sensors.humidity >= thresholds.humidity.criticalHigh
      ) {
        level = "abt";
      }
    }

    if (
      zone.sensors.soilMoisture < thresholds.soilMoisture.low ||
      zone.sensors.soilMoisture > thresholds.soilMoisture.high
    ) {
      nextZone.soilMoisture = midpoint(
        thresholds.soilMoisture.low,
        thresholds.soilMoisture.high,
      );
      issueParts.push(`soil moisture ${zone.sensors.soilMoisture}%`);
      targetParts.push(`soil moisture ${nextZone.soilMoisture}%`);
      hardwareParts.push("irrigation loop");
      if (
        zone.sensors.soilMoisture <= thresholds.soilMoisture.criticalLow ||
        zone.sensors.soilMoisture >= thresholds.soilMoisture.criticalHigh
      ) {
        level = "abt";
      }
    }

    if (
      zone.sensors.nutrientPH < thresholds.nutrientPH.low ||
      zone.sensors.nutrientPH > thresholds.nutrientPH.high
    ) {
      nextZone.nutrientPH = midpoint(thresholds.nutrientPH.low, thresholds.nutrientPH.high);
      issueParts.push(`nutrient pH ${zone.sensors.nutrientPH}`);
      targetParts.push(`nutrient pH ${nextZone.nutrientPH}`);
      hardwareParts.push("pH correction loop");
      if (
        zone.sensors.nutrientPH <= thresholds.nutrientPH.criticalLow ||
        zone.sensors.nutrientPH >= thresholds.nutrientPH.criticalHigh
      ) {
        level = "abt";
      }
    }

    const affectedFields = Object.keys(nextZone).filter((key) => key !== "zoneId");

    if (affectedFields.length > 0) {
      return {
        key: `${zone.zoneId}:${affectedFields.sort().join("+")}`,
        zoneId: zone.zoneId,
        level,
        title: `Activating ${dedupeStrings(hardwareParts).join(", ")} in ${zone.zoneId}`,
        body: `${zone.zoneId} drift detected in ${issueParts.join(" · ")}.`,
        detail: `Returning ${targetParts.join(" · ")} to the nominal operating band.`,
        tweak: {
          zones: [nextZone],
        },
      };
    }
  }

  return null;
}

function deriveAgentSuggestedMission(
  mission: BackendMissionState,
  agent: BackendAgentAnalysis | null,
): BackendMissionState {
  if (
    !hasMissionIncident(mission) ||
    !agent ||
    agent.recommendedActions.length === 0 ||
    agent.riskLevel === "low"
  ) {
    return mission;
  }

  const zones = mission.zones.map((zone) => ({
    ...zone,
    sensors: {
      ...zone.sensors,
    },
    stress: {
      ...zone.stress,
      symptoms: [...zone.stress.symptoms],
    },
  }));

  const overlayMission: BackendMissionState = {
    ...mission,
    zones,
    plants: mission.plants.map((plant) => ({ ...plant })),
    plantHealthChecks: mission.plantHealthChecks.map((check) => ({ ...check })),
    resources: {
      ...mission.resources,
    },
    nutrition: {
      ...mission.nutrition,
    },
    eventLog: [...mission.eventLog],
  };

  for (const action of agent.recommendedActions) {
    for (const [rawKey, rawValue] of Object.entries(action.parameterChanges)) {
      if (typeof rawValue !== "number") {
        continue;
      }

      const match = rawKey.match(/^([^.]+)\.(.+)$/);

      if (!match) {
        continue;
      }

      const [, zoneId, field] = match;
      const zone = overlayMission.zones.find((candidate) => candidate.zoneId === zoneId);

      if (!zone) {
        continue;
      }

      applyZoneParameterChange(zone, field, rawValue);
    }
  }

  overlayMission.nutrition = {
    ...overlayMission.nutrition,
    caloricCoveragePercent: agent.comparison.after.caloricCoveragePercent,
    proteinCoveragePercent: agent.comparison.after.proteinCoveragePercent,
    nutritionalCoverageScore: agent.comparison.after.nutritionalCoverageScore,
    daysSafe: agent.comparison.after.daysSafe,
    trend:
      agent.comparison.delta.scoreDelta > 0
        ? "improving"
        : agent.comparison.delta.scoreDelta < 0
          ? "declining"
          : overlayMission.nutrition.trend,
  };

  return overlayMission;
}

function applyZoneParameterChange(
  zone: BackendCropZone,
  field: string,
  value: number,
): void {
  switch (field) {
    case "allocationPercent":
      zone.allocationPercent = value;
      return;
    case "projectedYieldKg":
      zone.projectedYieldKg = value;
      return;
    case "lightPAR":
      zone.sensors.lightPAR = value;
      return;
    case "photoperiodHours":
      zone.sensors.photoperiodHours = value;
      return;
    case "soilMoisture":
      zone.sensors.soilMoisture = value;
      return;
    case "temperature":
      zone.sensors.temperature = value;
      return;
    case "humidity":
      zone.sensors.humidity = value;
      return;
    case "nutrientPH":
      zone.sensors.nutrientPH = value;
      return;
    case "electricalConductivity":
      zone.sensors.electricalConductivity = value;
      return;
    default:
      return;
  }
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

type SensorThreshold = {
  low: number;
  high: number;
  criticalLow: number;
  criticalHigh: number;
};

const SENSOR_THRESHOLDS: Record<
  BackendCropZone["cropType"],
  {
    temperature: SensorThreshold;
    humidity: SensorThreshold;
    lightPAR: SensorThreshold;
    soilMoisture: SensorThreshold;
    nutrientPH: SensorThreshold;
    electricalConductivity: SensorThreshold;
    co2Ppm: SensorThreshold;
  }
> = {
  lettuce: {
    temperature: { low: 18, high: 24, criticalLow: 14, criticalHigh: 30 },
    humidity: { low: 50, high: 70, criticalLow: 35, criticalHigh: 85 },
    lightPAR: { low: 180, high: 280, criticalLow: 140, criticalHigh: 360 },
    soilMoisture: { low: 65, high: 80, criticalLow: 40, criticalHigh: 92 },
    nutrientPH: { low: 5.8, high: 6.4, criticalLow: 5.2, criticalHigh: 7 },
    electricalConductivity: { low: 1.4, high: 2.2, criticalLow: 0.8, criticalHigh: 3 },
    co2Ppm: { low: 700, high: 1100, criticalLow: 450, criticalHigh: 1600 },
  },
  potato: {
    temperature: { low: 17, high: 22, criticalLow: 12, criticalHigh: 29 },
    humidity: { low: 55, high: 75, criticalLow: 35, criticalHigh: 88 },
    lightPAR: { low: 250, high: 380, criticalLow: 180, criticalHigh: 460 },
    soilMoisture: { low: 60, high: 82, criticalLow: 35, criticalHigh: 95 },
    nutrientPH: { low: 5.5, high: 6.2, criticalLow: 5, criticalHigh: 6.8 },
    electricalConductivity: { low: 1.6, high: 2.4, criticalLow: 1, criticalHigh: 3.3 },
    co2Ppm: { low: 700, high: 1100, criticalLow: 450, criticalHigh: 1600 },
  },
  beans: {
    temperature: { low: 20, high: 26, criticalLow: 14, criticalHigh: 33 },
    humidity: { low: 50, high: 72, criticalLow: 35, criticalHigh: 88 },
    lightPAR: { low: 210, high: 320, criticalLow: 160, criticalHigh: 420 },
    soilMoisture: { low: 58, high: 78, criticalLow: 35, criticalHigh: 90 },
    nutrientPH: { low: 5.9, high: 6.5, criticalLow: 5.3, criticalHigh: 7.1 },
    electricalConductivity: { low: 1.5, high: 2.3, criticalLow: 1, criticalHigh: 3.2 },
    co2Ppm: { low: 700, high: 1100, criticalLow: 450, criticalHigh: 1600 },
  },
  radish: {
    temperature: { low: 18, high: 24, criticalLow: 14, criticalHigh: 31 },
    humidity: { low: 48, high: 72, criticalLow: 35, criticalHigh: 88 },
    lightPAR: { low: 150, high: 240, criticalLow: 110, criticalHigh: 320 },
    soilMoisture: { low: 55, high: 76, criticalLow: 30, criticalHigh: 90 },
    nutrientPH: { low: 5.7, high: 6.3, criticalLow: 5.1, criticalHigh: 6.9 },
    electricalConductivity: { low: 1.3, high: 2.1, criticalLow: 0.8, criticalHigh: 2.9 },
    co2Ppm: { low: 700, high: 1100, criticalLow: 450, criticalHigh: 1600 },
  },
};

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
        <span style="width:${zone.growthProgressPercent}%; background:${zoneTone(zone) === "ABT" ? "var(--abt)" : "var(--aero-blue)"}"></span>
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

function renderEmergencyLogFeed(
  mission: BackendMissionState,
  companionLog: CompanionLogItem[],
): string {
  const aetherEntries = companionLog
    .filter((item) => item.kind !== "next")
    .slice(0, 4)
    .map((item) => renderCompanionLogEntry(item));
  const missionEntries = mission.eventLog
    .slice(0, Math.max(8 - aetherEntries.length, 4))
    .map((entry) => renderMissionLogEntry(entry));

  return [...aetherEntries, ...missionEntries].join("");
}

function renderCompanionLogEntry(item: CompanionLogItem): string {
  return renderLogEntry({
    type: companionLogType(item),
    icon: "AE",
    message: item.body,
    meta: `AETHER | ${formatCompanionLogKind(item.kind)}`,
    confidence: item.line.replaceAll("_", " ").toUpperCase(),
    extra: renderStatusBadge(formatCompanionLogKind(item.kind), item.tone),
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

function companionLogType(item: CompanionLogItem): "act" | "wrn" | "alr" | "inf" {
  if (item.kind === "cmd") {
    return "act";
  }

  if (item.tone === "ABT") {
    return "alr";
  }

  if (item.tone === "CAU") {
    return "wrn";
  }

  return "inf";
}

function formatCompanionLogKind(kind: CompanionLogItem["kind"]): string {
  switch (kind) {
    case "cmd":
      return "Command";
    case "next":
      return "Follow-up";
    default:
      return "Insight";
  }
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

function midpoint(min: number, max: number): number {
  return Math.round(((min + max) / 2) * 10) / 10;
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values)];
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

function formatPlantStatus(
  status: BackendMissionState["plants"][number]["currentStatus"],
): string {
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

function resolveMissionPollMs(rawValue: string | undefined): number {
  const parsed = Number(rawValue);

  if (Number.isFinite(parsed) && parsed >= 1000) {
    return parsed;
  }

  return 5000;
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
