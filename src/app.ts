import { renderHeader } from "./components/header";
import { renderNavigation } from "./components/navigation";
import {
  fetchMissionState,
  fetchPlannerAnalysis,
  fetchScenarioCatalog,
  injectScenario,
  resetSimulation,
} from "./data/api";
import type {
  AlertLevel,
  BackendCropZone,
  BackendEventLogEntry,
  BackendMissionState,
  BackendPlannerOutput,
  BackendScenarioCatalogItem,
  BackendScenarioSeverity,
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
  renderPanel,
  renderStatusBadge,
} from "./ui/primitives";

interface AppState {
  activeTab: TabId;
  selectedZoneId: string;
  selectedScenarioType: BackendScenarioCatalogItem["scenarioType"] | "";
  mission: BackendMissionState | null;
  scenarios: BackendScenarioCatalogItem[];
  planner: BackendPlannerOutput | null;
  booting: boolean;
  busy: boolean;
  syncMessage: string;
  error: string;
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

interface MicronutrientMiniData {
  id: string;
  label: string;
  produced: string;
  target: string;
  coveragePercent: number;
  tone: StatusTone;
}

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "I. Overview" },
  { id: "crops", label: "II. Crops & Growth" },
  { id: "resources", label: "III. Resources" },
  { id: "nutrition", label: "IV. Nutrition" },
  { id: "risk", label: "V. Risk & Scenarios" },
  { id: "agent", label: "VI. AI Intelligence" },
];

export function renderApp(root: HTMLDivElement): void {
  const state: AppState = {
    activeTab: "overview",
    selectedZoneId: "",
    selectedScenarioType: "",
    mission: null,
    scenarios: [],
    planner: null,
    booting: true,
    busy: false,
    syncMessage: "Connecting to backend mission state.",
    error: "",
  };

  const draw = () => {
    const headerModel = createHeaderModel(state.mission, state.planner);
    const navTabs = createNavigationTabs(state.mission, state.planner);

    root.innerHTML = `
      <div class="app-frame">
        ${renderHeader(headerModel)}
        ${renderNavigation(navTabs, state.activeTab)}

        <div class="app-shell">
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
        </div>
      </div>
    `;
  };

  root.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const tabButton = target.closest<HTMLElement>("[data-tab-target]");
    const zoneTrigger = target.closest<HTMLElement>("[data-zone-select]");
    const injectTrigger = target.closest<HTMLElement>("[data-scenario-inject]");
    const resetTrigger = target.closest<HTMLElement>("[data-scenario-reset]");
    const plannerRefresh = target.closest<HTMLElement>("[data-planner-refresh]");

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

        if (zoneTrigger.closest(".overview-zone-ops")) {
          state.activeTab = "crops";
        }

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
    }
  });

  void bootstrap();

  async function bootstrap(): Promise<void> {
    state.booting = true;
    state.busy = true;
    state.syncMessage = "Loading mission, scenario catalog, and planner state.";
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
      state.scenarios = scenariosResult.status === "fulfilled" ? scenariosResult.value : [];
      state.planner = plannerResult.status === "fulfilled" ? plannerResult.value : null;
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

  async function runScenarioInject(
    scenarioType: BackendScenarioCatalogItem["scenarioType"],
    severity: BackendScenarioSeverity,
  ): Promise<void> {
    state.busy = true;
    state.syncMessage = `Injecting ${formatScenarioType(scenarioType)} (${severity}).`;
    draw();

    try {
      state.mission = await injectScenario({ scenarioType, severity });
      state.selectedScenarioType = scenarioType;
      syncSelections(state);

      try {
        state.planner = await fetchPlannerAnalysis();
      } catch {
        state.planner = null;
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
      syncSelections(state);

      try {
        state.planner = await fetchPlannerAnalysis();
      } catch {
        state.planner = null;
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
}

function renderPage(state: AppState): string {
  if (!state.mission) {
    return renderBootState();
  }

  switch (state.activeTab) {
    case "overview":
      return renderOverview(state.mission, state.planner, state.selectedZoneId);
    case "crops":
      return renderCrops(state.mission, state.selectedZoneId);
    case "resources":
      return renderResources(state.mission, state.planner);
    case "nutrition":
      return renderNutrition(state.mission, state.planner);
    case "risk":
      return renderRisk(state.mission, state.scenarios, state.selectedScenarioType);
    case "agent":
      return renderAgent(state.mission, state.planner);
    default:
      return renderOverview(state.mission, state.planner, state.selectedZoneId);
  }
}

function renderOverview(
  mission: BackendMissionState,
  planner: BackendPlannerOutput | null,
  selectedZoneId: string,
): string {
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
                  .map((zone) => renderZoneOperationsCard(zone, zone.zoneId === selectedZoneId))
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
            title: "Incident / Planner",
            dotColor: "var(--cau)",
            children: renderIncidentPanel(mission, planner),
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
                    children: `Backend planner is currently operating in ${formatPlannerMode(planner.mode)} mode.`,
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
                    children: "Backend mission state reports this zone as stable with no active stress flag.",
                  })}
            `,
          })}
        </div>

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
              <div class="failure-realloc-grid">
                <div class="failure-realloc-col">
                  <p class="failure-realloc-col__title">Mode</p>
                  <div class="failure-realloc-col__rows">
                    <div class="failure-realloc-row">
                      <span class="failure-realloc-row__label">Planner mode</span>
                      <span class="failure-realloc-row__value">${formatPlannerMode(planner.mode)}</span>
                    </div>
                    <div class="failure-realloc-row">
                      <span class="failure-realloc-row__label">Current scenario</span>
                      <span class="failure-realloc-row__value">${mission.activeScenario ? escapeHtml(mission.activeScenario.title) : "No active scenario"}</span>
                    </div>
                  </div>
                  ${renderNotice({
                    level: "warn",
                    title: "Planner explanation",
                    children: planner.explanation,
                  })}
                </div>

                <div class="failure-realloc-col">
                  <p class="failure-realloc-col__title">Recommended Actions</p>
                  <div class="failure-realloc-col__rows">
                    ${planner.recommendedActions
                      .map(
                        (action) => `
                          <div class="failure-realloc-row">
                            <span class="failure-realloc-row__label">${formatPlannerActionType(action.type)}</span>
                            <span class="failure-realloc-row__value">
                              ${escapeHtml(action.description)}
                              ${action.targetZoneId ? `<br><span class="mono">${escapeHtml(action.targetZoneId)}</span>` : ""}
                            </span>
                          </div>
                        `,
                      )
                      .join("")}
                  </div>
                </div>

                <div class="failure-realloc-col">
                  <p class="failure-realloc-col__title">Nutrition Forecast</p>
                  <div class="failure-realloc-col__rows">
                    ${renderForecastRow("Calories", planner.nutritionForecast.before.caloricCoveragePercent, planner.nutritionForecast.after.caloricCoveragePercent)}
                    ${renderForecastRow("Protein", planner.nutritionForecast.before.proteinCoveragePercent, planner.nutritionForecast.after.proteinCoveragePercent)}
                    ${renderForecastRow("Micronutrients", planner.nutritionForecast.before.micronutrientAdequacyPercent, planner.nutritionForecast.after.micronutrientAdequacyPercent)}
                    ${renderForecastRow("Coverage score", planner.nutritionForecast.before.nutritionalCoverageScore, planner.nutritionForecast.after.nutritionalCoverageScore)}
                  </div>
                </div>
              </div>
            `
          : renderNotice({
              level: "warn",
              title: "Planner unavailable",
              children: "Mission and resource state are live, but the backend planner response was not available on this refresh.",
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
          children: planner
            ? `
                ${renderDataTable({
                  columns: ["Metric", "Before", "After"],
                  rows: buildPlannerForecastRows(planner),
                })}
                ${renderNotice({
                  level: "info",
                  title: "Backend-only note",
                  children: "Per-nutrient vitamin rows were removed because the backend does not expose that runtime breakdown yet.",
                })}
              `
            : renderNotice({
                level: "warn",
                title: "Forecast unavailable",
                children: "The backend planner is required for before/after nutrition forecasting.",
              }),
        })}
      </div>
    </section>
  `;
}

function renderRisk(
  mission: BackendMissionState,
  scenarios: BackendScenarioCatalogItem[],
  selectedScenarioType: AppState["selectedScenarioType"],
): string {
  const selectedScenario =
    scenarios.find((item) => item.scenarioType === selectedScenarioType) ??
    scenarios.find((item) => item.scenarioType === mission.activeScenario?.type) ??
    scenarios[0];

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
              ${mission.eventLog.slice(0, 8).map((entry) => renderMissionLogEntry(entry)).join("")}
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

      ${renderPanel({
        title: "Scenario Catalog",
        dotColor: "var(--aero-blue)",
        children:
          scenarios.length > 0
            ? `
                <div class="backend-scenario-grid">
                  ${scenarios.map((scenario) => renderScenarioCard(scenario, mission, selectedScenario?.scenarioType)).join("")}
                </div>
              `
            : renderNotice({
                level: "warn",
                title: "Catalog unavailable",
                children: "The frontend removed the mock simulator. Scenario control now depends entirely on the backend catalog endpoint.",
              }),
      })}
    </section>
  `;
}

function renderAgent(mission: BackendMissionState, planner: BackendPlannerOutput | null): string {
  return `
    <section class="agent-tab">
      <div class="agent-kpi-row">
        ${buildAgentMetrics(mission, planner).map((item) => renderMetricTile(item)).join("")}
      </div>

      ${renderPanel({
        title: "Planner Recommendation",
        dotColor: "var(--cau)",
        rightSlot:
          '<button class="btn btn-ghost" type="button" data-planner-refresh="true">Refresh analysis</button>',
        children: planner
          ? `
              <div class="ui-notice-stack">
                ${renderNotice({
                  level: planner.mode === "nutrition_preservation" ? "warn" : "ok",
                    title: `Mode - ${formatPlannerMode(planner.mode)}`,
                  children: planner.explanation,
                })}
                ${planner.recommendedActions.map((action) =>
                  renderNotice({
                    level: "info",
                    title: `${formatPlannerActionType(action.type)}${action.targetZoneId ? ` - ${action.targetZoneId}` : ""}`,
                    children: `${action.description} Reason: ${action.reason}`,
                  }),
                ).join("")}
              </div>
            `
          : renderNotice({
              level: "warn",
              title: "Planner unavailable",
              children: "This tab now shows only backend analysis. No local tradeoff or confidence mocks remain.",
            }),
      })}

      <div class="agent-detail-row">
        ${renderPanel({
          title: "Full Decision Log",
          dotColor: "var(--nom)",
          children: `
            <div class="agent-log-panel">
              <div class="agent-log-toolbar">
                <span class="mono">Backend event stream</span>
                <span class="mono">${mission.eventLog.length} entries</span>
              </div>
              <div class="agent-log-scroll">
                ${mission.eventLog.map((entry) => renderMissionLogEntry(entry)).join("")}
              </div>
            </div>
          `,
        })}

        <div class="agent-side-stack">
          ${renderPanel({
            title: "Nutrition Forecast",
            dotColor: "var(--mars-orange)",
            children: planner
              ? renderDataTable({
                  columns: ["Metric", "Before", "After"],
                  rows: buildPlannerForecastRows(planner),
                })
              : renderNotice({
                  level: "warn",
                  title: "No forecast",
                  children: "Run planner analysis to retrieve a backend nutrition forecast snapshot.",
                }),
          })}

          ${renderPanel({
            title: "Mission Snapshot",
            dotColor: "var(--aero-blue)",
            children: `
              <div class="ui-notice-stack">
                ${renderNotice({
                  level: "info",
                  title: `Mission day ${mission.missionDay}`,
                  children: `Status: ${formatMissionStatus(mission.status)}. Crew size: ${mission.crewSize}. Last updated: ${formatTimestamp(mission.lastUpdated)}.`,
                })}
                ${renderNotice({
                  level: mission.activeScenario ? noticeFromTone(severityTone(mission.activeScenario.severity)) : "ok",
                  title: mission.activeScenario ? mission.activeScenario.title : "No active scenario",
                  children: mission.activeScenario
                    ? mission.activeScenario.description
                    : "The backend mission snapshot currently reports nominal operations with no injected failure scenario.",
                })}
              </div>
            `,
          })}
        </div>
      </div>
    </section>
  `;
}

function renderBootState(): string {
  return renderPanel({
    title: "Backend Sync",
    dotColor: "var(--aero-blue)",
    children: renderNotice({
      level: "info",
      title: "Loading runtime state",
      children: "The dashboard is waiting for /api/mission/state and related backend endpoints before rendering mission data.",
    }),
  });
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
    children: `Mission control is synced to backend state. Overall status is ${formatMissionStatus(mission.status)}.`,
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
    children: "Risk tab is now driven by the backend scenario catalog and live mission log only.",
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
    label: "Backend Error",
    children: message,
  });
}

function createHeaderModel(
  mission: BackendMissionState | null,
  planner: BackendPlannerOutput | null,
): HeaderModel {
  if (!mission) {
    return {
      title: "AETHER",
      subtitle: "Mars Autonomous Greenhouse",
      missionDay: 0,
      missionDurationTotal: 0,
      agentState: "SYNCING",
      lastAction: "Connecting",
      systemTone: "CAU",
      systemLabel: "Backend pending",
    };
  }

  return {
    title: "AETHER",
    subtitle: "Mars Autonomous Greenhouse",
    missionDay: mission.missionDay,
    missionDurationTotal: mission.missionDurationDays,
    agentState: planner ? formatPlannerMode(planner.mode) : "Planner unavailable",
    lastAction: mission.eventLog[0] ? formatEventStamp(mission.eventLog[0]) : "No events",
    systemTone: missionTone(mission),
    systemLabel: formatMissionStatus(mission.status),
  };
}

function createNavigationTabs(
  mission: BackendMissionState | null,
  planner: BackendPlannerOutput | null,
): TabDefinition[] {
  const warningCount = mission
    ? mission.eventLog.filter((entry) => entry.level !== "info").length
    : undefined;
  const nutritionAlert = mission && mission.nutrition.caloricCoveragePercent < 100 ? 1 : undefined;
  const scenarioAlert = mission?.activeScenario ? 1 : warningCount;
  const plannerAlert = planner && planner.recommendedActions.length > 0 ? planner.recommendedActions.length : undefined;

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
            ? plannerAlert
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
      sub: "Zones reported by backend",
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
  const stressedZones = mission.zones.filter((zone) => zone.stress.active).length;

  return [
    {
      label: "Mission Status",
      value: formatMissionStatus(mission.status),
      sub: "Backend system flag",
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
      label: "Warning Events",
      value: `${warningEvents}`,
      sub: `${criticalEvents} critical events`,
      progress: clampPercent((warningEvents + criticalEvents) * 18),
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

function buildAgentMetrics(
  mission: BackendMissionState,
  planner: BackendPlannerOutput | null,
): MetricTileData[] {
  const before = planner?.nutritionForecast.before;
  const after = planner?.nutritionForecast.after;
  const actionCount = planner?.recommendedActions.length ?? 0;

  return [
    {
      label: "Planner Mode",
      value: planner ? formatPlannerMode(planner.mode) : "Unavailable",
      sub: "Backend planner status",
      progress: planner?.mode === "nutrition_preservation" ? 72 : 32,
      progressColor: planner?.mode === "nutrition_preservation" ? "var(--cau)" : "var(--nom)",
      level: planner?.mode === "nutrition_preservation" ? "CAU" : "NOM",
    },
    {
      label: "Actions",
      value: `${actionCount}`,
      sub: "Recommended next steps",
      progress: clampPercent(actionCount * 20),
      progressColor: "var(--aero-blue)",
      level: actionCount > 0 ? "CAU" : "NOM",
    },
    {
      label: "Calorie Delta",
      value: before && after ? `${after.caloricCoveragePercent - before.caloricCoveragePercent}%` : "--",
      sub: "Planner forecast change",
      progress: before && after ? clampPercent(after.caloricCoveragePercent) : 0,
      progressColor: "var(--mars-orange)",
      level: before && after ? toneFromPercent(after.caloricCoveragePercent, 95, 75) : "CAU",
    },
    {
      label: "Protein Delta",
      value: before && after ? `${after.proteinCoveragePercent - before.proteinCoveragePercent}%` : "--",
      sub: `Last updated ${formatTimestamp(mission.lastUpdated)}`,
      progress: before && after ? clampPercent(after.proteinCoveragePercent) : 0,
      progressColor: "var(--nom)",
      level: before && after ? toneFromPercent(after.proteinCoveragePercent, 95, 75) : "CAU",
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
      sub: "Current backend estimate",
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
      coveragePercent: mission.nutrition.vitaminA.coveragePercent,
      tone: toneFromPercent(mission.nutrition.vitaminA.coveragePercent, 95, 75),
    },
    {
      id: "vitc",
      label: "Vit C",
      produced: `${mission.nutrition.vitaminC.produced}${mission.nutrition.vitaminC.unit}`,
      target: `${mission.nutrition.vitaminC.target}${mission.nutrition.vitaminC.unit}`,
      coveragePercent: mission.nutrition.vitaminC.coveragePercent,
      tone: toneFromPercent(mission.nutrition.vitaminC.coveragePercent, 95, 75),
    },
    {
      id: "fol",
      label: "Folate",
      produced: `${mission.nutrition.folate.produced}${mission.nutrition.folate.unit}`,
      target: `${mission.nutrition.folate.target}${mission.nutrition.folate.unit}`,
      coveragePercent: mission.nutrition.folate.coveragePercent,
      tone: toneFromPercent(mission.nutrition.folate.coveragePercent, 95, 75),
    },
    {
      id: "iron",
      label: "Iron",
      produced: `${mission.nutrition.iron.produced}${mission.nutrition.iron.unit}`,
      target: `${mission.nutrition.iron.target}${mission.nutrition.iron.unit}`,
      coveragePercent: mission.nutrition.iron.coveragePercent,
      tone: toneFromPercent(mission.nutrition.iron.coveragePercent, 95, 75),
    },
    {
      id: "pot",
      label: "Potassium",
      produced: `${mission.nutrition.potassium.produced}${mission.nutrition.potassium.unit}`,
      target: `${mission.nutrition.potassium.target}${mission.nutrition.potassium.unit}`,
      coveragePercent: mission.nutrition.potassium.coveragePercent,
      tone: toneFromPercent(mission.nutrition.potassium.coveragePercent, 95, 75),
    },
    {
      id: "mag",
      label: "Magnesium",
      produced: `${mission.nutrition.magnesium.produced}${mission.nutrition.magnesium.unit}`,
      target: `${mission.nutrition.magnesium.target}${mission.nutrition.magnesium.unit}`,
      coveragePercent: mission.nutrition.magnesium.coveragePercent,
      tone: toneFromPercent(mission.nutrition.magnesium.coveragePercent, 95, 75),
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
      sub: "Backend chemistry flag",
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

function evaluateSensorThreshold(
  value: number,
  threshold: SensorThreshold,
): { tone: StatusTone; state: string } {
  if (value <= threshold.criticalLow) {
    return { tone: "ABT", state: "critical low" };
  }

  if (value >= threshold.criticalHigh) {
    return { tone: "ABT", state: "critical high" };
  }

  if (value < threshold.low) {
    return { tone: "CAU", state: "low" };
  }

  if (value > threshold.high) {
    return { tone: "CAU", state: "high" };
  }

  return { tone: "NOM", state: "nominal" };
}

function buildSensorReadings(zone: BackendCropZone): SensorReadingData[] {
  const thresholds = SENSOR_THRESHOLDS[zone.cropType];

  return [
    {
      label: "Temp",
      value: `${zone.sensors.temperature} C`,
      ...evaluateSensorThreshold(zone.sensors.temperature, thresholds.temperature),
    },
    {
      label: "Humidity",
      value: `${zone.sensors.humidity}%`,
      ...evaluateSensorThreshold(zone.sensors.humidity, thresholds.humidity),
    },
    {
      label: "PAR",
      value: `${zone.sensors.lightPAR}`,
      ...evaluateSensorThreshold(zone.sensors.lightPAR, thresholds.lightPAR),
    },
    {
      label: "Moisture",
      value: `${zone.sensors.soilMoisture}%`,
      ...evaluateSensorThreshold(zone.sensors.soilMoisture, thresholds.soilMoisture),
    },
    {
      label: "pH",
      value: `${zone.sensors.nutrientPH}`,
      ...evaluateSensorThreshold(zone.sensors.nutrientPH, thresholds.nutrientPH),
    },
    {
      label: "EC",
      value: `${zone.sensors.electricalConductivity} mS`,
      ...evaluateSensorThreshold(
        zone.sensors.electricalConductivity,
        thresholds.electricalConductivity,
      ),
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

function renderZoneOperationsCard(zone: BackendCropZone, isSelected: boolean): string {
  const sensorReadings = buildSensorReadings(zone);
  const symptoms = zone.stress.symptoms.slice(0, 3);

  return `
    <button
      type="button"
      class="zone-ops-card ${zoneStatusClass(zone)} ${isSelected ? "is-selected" : ""}"
      data-zone-select="${escapeHtml(zone.zoneId)}"
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
              <div class="zone-sensor">
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
    </button>
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
): string {
  const primaryAction = planner?.recommendedActions[0];
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
        <span class="incident-panel__label">Actions queued</span>
        <span class="incident-panel__value mono">${planner?.recommendedActions.length ?? 0}</span>
      </div>
      <div class="incident-panel__row">
        <span class="incident-panel__label">Priority response</span>
        <span class="incident-panel__value incident-panel__value--wrap">
          ${primaryAction ? escapeHtml(primaryAction.description) : "No planner action required."}
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
  return status.replaceAll("_", " ");
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
  return (mode ?? "normal").replaceAll("_", " ");
}

function formatPlannerActionType(type: NonNullable<BackendPlannerOutput>["recommendedActions"][number]["type"]): string {
  return type.replaceAll("_", " ");
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "The frontend could not reach the backend runtime endpoints.";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
