import {
  chatReplies,
  crops,
  cropDependencies,
  cropMetrics,
  cropStages,
  emergencyLog,
  energyGauges,
  envParams,
  failureRealloc,
  failureImpact,
  fragility,
  fullAgentLog,
  headerModel,
  missionHero,
  missionMemory,
  missionTabs,
  nutrients,
  overviewAlert,
  overviewGridCells,
  overviewMetrics,
  npkGauges,
  pageContentByTab,
  repoSignals,
  resourceMetrics,
  riskAlert,
  riskMetrics,
  riskGauges,
  scenarioSimulations,
  scenarios,
  timeline,
  tradeoffs,
  waterAlloc,
} from "./data/missionData";
import type {
  ChatReply,
  CropData,
  CropMetric,
  CropDependencyRow,
  EmergencyEntry,
  EnvParam,
  FailureReallocColumn,
  FailureImpactColumn,
  FullAgentLogItem,
  GaugeItem,
  GridCell,
  MissionMemoryItem,
  NutrientRow,
  OverviewMetric,
  RiskMetric,
  ScenarioCard,
  StatusTone,
  TabId,
  TimelineEvent,
  Tradeoff,
} from "./types";
import { renderHeader } from "./components/header";
import { renderNavigation } from "./components/navigation";
import {
  renderAeroButton,
  renderAlertStrip,
  renderAllocBar,
  renderConfPill,
  renderDataTable,
  renderGaugeBar,
  renderKpiTile,
  renderLogEntry,
  renderNotice,
  renderPanel,
  renderSparkline,
  renderStatusBadge,
} from "./ui/primitives";

export function renderApp(root: HTMLDivElement): void {
  let activeTab: TabId = "overview";
  let overviewAlertDismissed = false;
  let selectedCropId = crops.find((crop) => crop.healthLevel !== "NOM")?.id ?? crops[0]?.id ?? "";
  let selectedScenarioId = scenarioSimulations[0]?.id ?? "";
  let expandedEmergencyId = emergencyLog[0]?.id ?? "";

  const renderPage = (): string => {
    switch (activeTab) {
      case "overview":
        return renderOverview(overviewAlertDismissed);
      case "crops":
        return renderCrops(selectedCropId);
      case "resources":
        return renderResources();
      case "nutrition":
        return renderNutrition();
      case "risk":
        return renderRisk(selectedScenarioId, expandedEmergencyId);
      case "agent":
        return renderAgent();
      default:
        return renderOverview(false);
    }
  };

  const draw = () => {
    const activePage = pageContentByTab[activeTab];
    const activeLabel =
      missionTabs.find((tab) => tab.id === activeTab)?.label ?? activePage.introTitle;
    const showOverviewChrome = activeTab !== "overview";

    root.innerHTML = `
      <div class="app-frame">
        ${renderHeader(headerModel)}
        ${renderNavigation(missionTabs, activeTab)}

        <div class="app-shell">
          ${
            showOverviewChrome
              ? `
                <header class="masthead">
                  <p class="eyebrow">${missionHero.eyebrow}</p>
                  <h1>${missionHero.title}</h1>
                  <p class="subtitle">${missionHero.subtitle}</p>
                  <div class="rule"></div>
                  <p class="dek">${missionHero.body}</p>
                </header>
              `
              : ""
          }

          <main class="workspace">
            ${
              showOverviewChrome
                ? `
                  <section class="panel panel-pad page-intro">
                    <div>
                      <p class="eyebrow">Active Page</p>
                      <h2>${activeLabel}</h2>
                      <p>${activePage.introBody}</p>
                    </div>
                    <div class="intro-meta">
                      <div>
                        <span class="meta-label">Workflow Sources</span>
                        <span class="meta-value">${repoSignals.panelCount} panels &middot; ${repoSignals.endpointCount} API endpoints</span>
                      </div>
                      <div>
                        <span class="meta-label">Schema Probe</span>
                        <span class="meta-value meta-value--mono">${repoSignals.scenarioTypeCount} scenario types parsed</span>
                      </div>
                    </div>
                  </section>
                `
                : ""
            }

            ${renderPage()}
          </main>
        </div>
      </div>
    `;
  };

  root.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest<HTMLButtonElement>("[data-tab-target]");
    const cropCard = target.closest<HTMLElement>("[data-crop-select]");
    const emergencyToggle = target.closest<HTMLElement>("[data-emergency-toggle]");
    const scenarioToggle = target.closest<HTMLElement>("[data-scenario-sim]");

    if (cropCard) {
      const nextCropId = cropCard.dataset.cropSelect;

      if (nextCropId) {
        selectedCropId = nextCropId;
        draw();
      }

      return;
    }

    if (emergencyToggle) {
      const nextEmergencyId = emergencyToggle.dataset.emergencyToggle ?? "";
      expandedEmergencyId = expandedEmergencyId === nextEmergencyId ? "" : nextEmergencyId;
      draw();
      return;
    }

    if (scenarioToggle) {
      const nextScenarioId = scenarioToggle.dataset.scenarioSim ?? "";
      selectedScenarioId = nextScenarioId;
      draw();
      return;
    }

    if (!button) {
      if (target.closest("[data-dismiss-overview-alert]")) {
        overviewAlertDismissed = true;
        draw();
      }

      return;
    }

    const nextTab = button.dataset.tabTarget as TabId | undefined;

    if (nextTab && nextTab !== activeTab) {
      activeTab = nextTab;
      draw();
    }
  });

  draw();
}

function renderOverview(overviewAlertDismissed: boolean): string {
  const nutritionMini = nutrients.slice(0, 4);

  return `
    ${
      overviewAlertDismissed
        ? ""
        : renderAlertStrip({
            level: "cau",
            label: overviewAlert.label,
            children:
              "Zone-B irrigation reduced 18%. CO2 at 950 ppm remains elevated while water recycling holds at 60%.",
            onDismiss: true,
          }).replace(
            'class="ui-alert__dismiss"',
            'class="ui-alert__dismiss" data-dismiss-overview-alert="true"',
          )
    }

    <section class="overview-home">
      <div class="overview-kpi-row">
        ${overviewMetrics.map((item) => renderOverviewMetric(item)).join("")}
      </div>

      <div class="overview-middle">
        ${renderPanel({
          title: "Digital Twin",
          dotColor: "var(--aero-blue)",
          rightSlot: renderStatusBadge("Twin Live", "NOM"),
          children: `
            <div class="overview-twin">
              <div class="overview-twin__grid">
                ${overviewGridCells.map((cell) => renderGridCell(cell)).join("")}
              </div>
              <div class="overview-twin__legend">
                <span class="mono">Solid = online</span>
                <span class="mono status-cau">cau</span>
                <span class="mono status-abt">abt</span>
                <span class="mono">dashed = offline</span>
              </div>
            </div>
          `,
        })}

        <div class="overview-stack">
          ${renderPanel({
            title: "Environmental Parameters",
            dotColor: "var(--mars-orange)",
            children: `
              <div class="overview-env-grid">
                ${envParams.map((item) => renderOverviewEnvTile(item)).join("")}
              </div>
            `,
          })}

          ${renderPanel({
            title: "Crew Nutrition",
            dotColor: "var(--nom)",
            children: `
              <div class="overview-nutrition-mini">
                ${nutritionMini.map((item) => renderNutritionMiniRow(item)).join("")}
              </div>
            `,
          })}
        </div>
      </div>

      <div class="overview-bottom">
        ${renderPanel({
          title: "AI Agent - Recent Decisions",
          dotColor: "var(--cau)",
          rightSlot:
            '<button class="overview-link-btn" type="button" data-tab-target="agent">Full log -></button>',
          children: `
            <div class="ui-log-list">
              ${fullAgentLog
                .slice(0, 4)
                .map((item) => renderAgentLog(item))
                .join("")}
            </div>
          `,
        })}

        ${renderPanel({
          title: "Mission Timeline",
          dotColor: "var(--aero-blue)",
          children: `
            <div class="overview-timeline-strip">
              ${timeline.map((item) => renderTimelineChip(item)).join("")}
            </div>
          `,
        })}
      </div>
    </section>
  `;
}

function renderCrops(selectedCropId: string): string {
  const selectedCrop = crops.find((crop) => crop.id === selectedCropId) ?? crops[0];
  const selectedStages = cropStages[selectedCrop.id] ?? [];
  const selectedDiagnostics = buildCropDiagnostics(selectedCrop);

  return `
    <section class="crop-tab">
      <div class="crop-kpi-row">
        ${cropMetrics.map((item) => renderCropMetric(item)).join("")}
      </div>

      ${renderPanel({
        title: "Crop Health Grid",
        dotColor: "var(--nom)",
        children: `
          <div class="crop-health-grid">
            ${crops.map((item) => renderCropHealthCard(item, item.id === selectedCrop.id)).join("")}
          </div>
        `,
      })}

      <div class="crop-detail-row">
        ${renderPanel({
          title: "Growth Stage Tracker",
          dotColor: "var(--aero-blue)",
          rightSlot: renderStatusBadge(selectedCrop.name, selectedCrop.healthLevel),
          children: `
            <div class="crop-stage-panel">
              <div class="crop-stage-line">
                ${selectedStages.map((item) => renderCropStageNode(item)).join("")}
              </div>
              <div class="crop-stage-gauges">
                ${selectedDiagnostics.map((item) =>
                  renderGaugeBar({
                    name: item.name,
                    value: item.value,
                    fillPct: item.fillPct,
                    fillColor: item.fillColor,
                    label: "Selected crop",
                    valueMuted: item.valueMuted,
                  }),
                ).join("")}
              </div>
            </div>
          `,
        })}

        ${renderPanel({
          title: "Yield Forecast",
          dotColor: "var(--mars-orange)",
          children: `
            <div class="crop-forecast-panel">
              <div class="crop-forecast-summary">
                <p class="crop-forecast-summary__value mono">${selectedCrop.projectedYieldKg.toFixed(1)} kg</p>
                <p class="crop-forecast-summary__meta">${selectedCrop.name} projected harvest against ${selectedCrop.targetYieldKg} kg target.</p>
              </div>
              ${renderDataTable({
                columns: ["Zone", "Crop", "Projected", "Target", "Coverage", "Trend"],
                rows: crops.map((item) => {
                  const coverage = Math.round((item.projectedYieldKg / item.targetYieldKg) * 100);

                  return [
                    `<span class="mono">${item.zone}</span>`,
                    item.name,
                    `<span class="mono">${item.projectedYieldKg.toFixed(1)} kg</span>`,
                    `<span class="mono">${item.targetYieldKg} kg</span>`,
                    renderStatusBadge(`${coverage}%`, coverage >= 75 ? "NOM" : coverage >= 60 ? "CAU" : "ABT"),
                    `<span class="mono">${getTrendGlyph(item.sparkPoints)}</span>`,
                  ];
                }),
              })}
              ${renderNotice({
                level: "warn",
                title: "Forecast Note",
                children:
                  "Radish remains the shortest-cycle buffer crop, but the active water scenario makes its recovery path less reliable than potato and beans.",
              })}
            </div>
          `,
        })}
      </div>

      <article class="panel panel-pad ui-panel crop-deps-panel">
        <header class="ui-panel__header">
          <div class="ui-panel__title-row">
            <span class="ui-panel__dot" style="color: var(--abt)"></span>
            <h3 class="ui-panel__title">Dependency Analysis</h3>
          </div>
        </header>
        ${renderDataTable({
          columns: ["Zone / System", "Function", "Dependency", "Fallback", "Impact"],
          rows: cropDependencies.map((item) => renderDependencyRow(item)),
        })}
      </article>
    </section>
  `;
}

function renderResources(): string {
  const waterNotice = "Zone F is offline while the active AI rationale protects potato and bean allocation first.";

  return `
    <section class="resources-tab">
      <div class="resource-kpi-row">
        ${resourceMetrics.map((item) => renderResourceMetric(item)).join("")}
      </div>

      <div class="resource-main-row">
        ${renderPanel({
          title: "Water Allocation",
          dotColor: "var(--aero-blue)",
          rightSlot: `
            <div class="resource-panel-actions">
              ${renderStatusBadge("Zone B adjusted", "CAU")}
              ${renderAeroButton({ label: "Override", tone: "primary" })}
            </div>
          `,
          children: `
          <div class="ui-alloc-list">
            ${waterAlloc
              .map((item) =>
                renderAllocBar({
                  zoneName: item.zoneName,
                  detail: item.detail,
                  fillPct: item.fillPct,
                  fillColor: item.fillColor,
                  offline: item.offline,
                }),
              )
              .join("")}
          </div>
          ${renderNotice({
            level: "info",
            title: "Water Allocation",
            children: waterNotice,
          })}
        `,
        })}

        <div class="resource-stack">
          ${renderPanel({
            title: "NPK Reserve",
            dotColor: "var(--abt)",
            children: `
          <div class="ui-gauge-list">
            ${npkGauges
              .map((item) =>
                renderGaugeBar({
                  name: item.label,
                  value: item.value,
                  fillPct: item.fillPct,
                  fillColor: item.fillColor,
                  label: "Reserve ratio",
                  valueMuted: item.level,
                }),
              )
              .join("")}
          </div>
          ${renderNotice({
            level: "crit",
            title: "Critical Reserve",
            children: "Phosphorus remains the limiting NPK reserve. Resupply timing is now part of the resource failure story.",
          })}
        `,
          })}

          ${renderPanel({
            title: "Energy Systems",
            dotColor: "var(--nom)",
            children: `
          <div class="ui-gauge-list">
            ${energyGauges
              .map((item) =>
                renderGaugeBar({
                  name: item.label,
                  value: item.value,
                  fillPct: item.fillPct,
                  fillColor: item.fillColor,
                  label: "System load",
                  valueMuted: item.level,
                }),
              )
              .join("")}
          </div>
          ${renderNotice({
            level: "ok",
            title: "Solar Efficiency",
            children: "Generation remains slightly under consumption, but staged loads keep pumps and sensor rails stable.",
          })}
        `,
          })}
        </div>
      </div>

      ${renderPanel({
        title: "Failure Reallocation Protocol",
        dotColor: "var(--abt)",
        children: `
          <div class="failure-realloc-grid">
            ${failureRealloc.map((column) => renderFailureReallocColumn(column)).join("")}
          </div>
        `,
      })}
    </section>
  `;
}

function renderNutrition(): string {
  return `
    <section class="content-grid">
      ${renderPanel({
        title: "NPK Gauges",
        dotColor: "var(--nom)",
        children: `
          <div class="ui-kpi-grid ui-kpi-grid--hero">
            ${riskGauges.slice(0, 1).map((item) => renderGaugeKpi(item, "Mission nutritional pressure")).join("")}
            ${npkGauges.map((item) => renderGaugeKpi(item)).join("")}
          </div>
          ${renderNotice({
            level: "ok",
            title: "Source of Truth",
            children:
              "Nutrient gauges, nutrient table rows, and risk indicators all come from missionData.ts rather than page-local constants.",
          })}
        `,
      })}

      ${renderPanel({
        title: "Nutrition Table",
        dotColor: "var(--cau)",
        noPad: true,
        children: renderDataTable({
          columns: ["Nutrient", "Current", "Target", "Coverage", "Source"],
          rows: nutrients.map((item) => [
            item.nutrient,
            `<span class="mono">${item.current}</span>`,
            `<span class="mono">${item.target}</span>`,
            renderStatusBadge(item.coverage, item.coverageLevel),
            item.source,
          ]),
        }),
      })}

      ${renderPanel({
        title: "Crew Nutrition Notes",
        dotColor: "var(--mars-orange)",
        children: `
          <div class="ui-notice-stack">
            ${nutrients
              .slice(5)
              .map((item) =>
                renderNotice({
                  level: getNoticeLevel(item.coverageLevel),
                  title: `${item.nutrient} · ${item.coverage}`,
                  children: `Primary source: ${item.source}. Target remains ${item.target}.`,
                }),
              )
              .join("")}
          </div>
        `,
      })}
    </section>
  `;
}

function renderRiskLegacy(): string {
  return `
    ${renderAlertStrip({
      level: riskAlert.level,
      label: riskAlert.label,
      children: riskAlert.body,
      onDismiss: true,
    })}

    <section class="content-grid">
      ${renderPanel({
        title: "Fragility",
        dotColor: "var(--abt)",
        children: `
          <div class="ui-notice-stack">
            ${fragility
              .map((item) =>
                renderNotice({
                  level: getNoticeLevel(item.scoreLevel),
                  title: `${item.icon} · ${item.title} · ${item.score}`,
                  children: item.detail,
                }),
              )
              .join("")}
          </div>
        `,
      })}

      ${renderPanel({
        title: "Scenario Cards",
        dotColor: "var(--cau)",
        children: `
          <div class="ui-notice-stack">
            ${scenarios.map((item) => renderScenarioCard(item)).join("")}
          </div>
        `,
      })}

      ${renderPanel({
        title: "Timeline + Memory",
        dotColor: "var(--aero-blue)",
        children: `
          <div class="ui-log-list">
            ${timeline.slice(0, 5).map((item) => renderTimelineLog(item)).join("")}
            ${missionMemory.map((item) => renderMemoryLog(item)).join("")}
          </div>
        `,
      })}
    </section>
  `;
}

function renderRisk(selectedScenarioId: string, expandedEmergencyId: string): string {
  const selectedScenario =
    scenarioSimulations.find((item) => item.id === selectedScenarioId) ?? scenarioSimulations[0];

  return `
    ${renderAlertStrip({
      level: "abt",
      label: "Emergency",
      children:
        "EMERGENCY DETECTED - Radish germination failure Zone C confirmed. Zone B moisture under investigation.",
    })}

    <section class="risk-tab">
      <div class="risk-kpi-row">
        ${riskMetrics.map((item) => renderRiskMetric(item)).join("")}
      </div>

      <div class="risk-main-row">
        ${renderPanel({
          title: "Emergency Log",
          dotColor: "var(--abt)",
          rightSlot: renderAeroButton({ label: "Declare Emergency", tone: "danger" }),
          children: `
            <div class="risk-emergency-list">
              ${emergencyLog
                .map((item) => renderEmergencyEntry(item, item.id === expandedEmergencyId))
                .join("")}
            </div>
          `,
        })}

        ${renderPanel({
          title: "Risk Gauges",
          dotColor: "var(--cau)",
          children: `
            <div class="ui-gauge-list">
              ${riskGauges
                .map((item) =>
                  renderGaugeBar({
                    name: item.label,
                    value: item.value,
                    fillPct: item.fillPct,
                    fillColor: item.fillColor,
                    label: "Risk band",
                    valueMuted: item.level,
                  }),
                )
                .join("")}
            </div>
            ${renderNotice({
              level: "warn",
              title: "Risk Note",
              children: "Top 3 gauges remain caution-fill while lower baseline gauges stay nominal for contrast.",
            })}
          `,
        })}
      </div>

      ${renderPanel({
        title: "Scenario Simulator",
        dotColor: "var(--aero-blue)",
        children: `
          <div class="scenario-sim">
            <div class="scenario-sim__actions">
              ${scenarioSimulations
                .map(
                  (item) => `
                    <button
                      type="button"
                      class="scenario-sim__btn ${item.id === selectedScenario.id ? "is-active" : ""}"
                      data-scenario-sim="${item.id}"
                    >
                      ${item.label}
                    </button>
                  `,
                )
                .join("")}
            </div>
            <p class="scenario-sim__note">${selectedScenario.note}</p>
            <div class="scenario-sim__compare">
              <div class="scenario-sim__panel">
                <p class="scenario-sim__title">Before</p>
                ${selectedScenario.before
                  .map((row) => renderKeyValueRow(row.label, row.value))
                  .join("")}
              </div>
              <div class="scenario-sim__panel">
                <p class="scenario-sim__title">After</p>
                ${selectedScenario.after
                  .map((row) => renderKeyValueRow(row.label, row.value, row.level))
                  .join("")}
              </div>
            </div>
            ${renderNotice({
              level: selectedScenario.level === "ABT" ? "crit" : "warn",
              title: "Scenario Cost",
              children: "React state only for M10. This mirrors the documented simulator flow without mutating backend state yet.",
            })}
          </div>
        `,
      })}

      ${renderPanel({
        title: "Failure Impact Forecast",
        dotColor: "var(--abt)",
        children: `
          <div class="failure-impact-grid">
            ${failureImpact.map((column) => renderFailureImpactColumn(column)).join("")}
          </div>
        `,
      })}
    </section>
  `;
}

function renderAgent(): string {
  return `
    <section class="content-grid">
      ${renderPanel({
        title: "Agent Log",
        dotColor: "var(--cau)",
        children: `
          <div class="ui-log-list">
            ${fullAgentLog.map((item) => renderAgentLog(item)).join("")}
          </div>
        `,
      })}

      ${renderPanel({
        title: "Tradeoffs",
        dotColor: "var(--nom)",
        children: `
          <div class="ui-notice-stack">
            ${tradeoffs.map((item) => renderTradeoff(item)).join("")}
          </div>
        `,
      })}

      ${renderPanel({
        title: "Chat Replies",
        dotColor: "var(--mars-orange)",
        children: `
          <div class="ui-chat-list">
            ${chatReplies.map((item) => renderChatLine(item)).join("")}
          </div>
        `,
      })}
    </section>
  `;
}

function renderEnvKpi(item: EnvParam): string {
  return renderKpiTile({
    label: item.label,
    value: `${item.value}${item.unit}`,
    sub: item.warmFlag,
    progress: item.fillPct,
    progressColor: item.fillCol,
  });
}

function renderOverviewMetric(item: OverviewMetric): string {
  return renderKpiTile({
    label: item.label,
    value: item.value,
    sub: item.sub,
    level: item.level,
    progress: item.progress,
    progressColor: item.progressColor,
  });
}

function renderCropMetric(item: CropMetric): string {
  return renderKpiTile({
    label: item.label,
    value: item.value,
    sub: item.sub,
    level: item.level,
    progress: item.progress,
    progressColor: item.progressColor,
  });
}

function renderResourceMetric(item: {
  label: string;
  value: string;
  sub: string;
  progress: number;
  progressColor: string;
  level?: StatusTone;
}): string {
  return renderKpiTile({
    label: item.label,
    value: item.value,
    sub: item.sub,
    level: item.level,
    progress: item.progress,
    progressColor: item.progressColor,
  });
}

function renderRiskMetric(item: RiskMetric): string {
  return renderKpiTile({
    label: item.label,
    value: item.value,
    sub: item.sub,
    level: item.level,
    progress: item.progress,
    progressColor: item.progressColor,
  });
}

function renderGaugeKpi(item: GaugeItem, sub = "Typed gauge item"): string {
  return renderKpiTile({
    label: item.label,
    value: item.value,
    sub,
    level: item.level,
    progress: item.fillPct,
    progressColor: item.fillColor,
  });
}

function renderCropCard(item: CropData): string {
  return `
    <div class="ui-crop-card">
      <div class="ui-crop-card__head">
        <div>
          <p class="ui-crop-card__name">${item.emoji} ${item.name}</p>
          <p class="ui-crop-card__meta">${item.zone} &middot; ${item.stage}</p>
        </div>
        ${renderStatusBadge(item.healthLevel, item.healthLevel)}
      </div>
      ${renderSparkline({ points: item.sparkPoints, stroke: item.sparkColor })}
      <div class="ui-crop-card__foot">
        <span class="mono">${item.healthScore}% health</span>
        <span class="mono">${item.harvestSol}</span>
      </div>
    </div>
  `;
}

function renderCropHealthCard(item: CropData, isSelected: boolean): string {
  return `
    <button
      type="button"
      class="crop-health-card ${isSelected ? "is-selected" : ""} crop-health-card--${item.healthLevel.toLowerCase()}"
      data-crop-select="${item.id}"
    >
      <span class="crop-health-card__bar"></span>
      <div class="crop-health-card__top">
        <span class="crop-health-card__emoji">${item.emoji}</span>
        <div>
          <p class="crop-health-card__name">${item.name}</p>
          <p class="crop-health-card__meta">${item.role} &middot; ${item.stage}</p>
        </div>
      </div>
      <div class="crop-health-card__mid">
        <span class="crop-health-card__score mono">${item.healthScore}%</span>
        <span class="crop-health-card__harvest mono">${item.harvestSol}</span>
      </div>
      ${renderSparkline({ points: item.sparkPoints, stroke: item.sparkColor })}
      <div class="crop-health-card__foot">
        <span class="mono">${item.allocationPct}% alloc</span>
        <span class="mono">${item.stressLabel}</span>
      </div>
    </button>
  `;
}

function renderCropStageNode(item: { label: string; sol: string; state: "done" | "active" | "future" }): string {
  return `
    <div class="crop-stage-node crop-stage-node--${item.state}">
      <span class="crop-stage-node__dot"></span>
      <span class="crop-stage-node__label">${item.label}</span>
      <span class="crop-stage-node__sol mono">${item.sol}</span>
    </div>
  `;
}

function renderGridCell(cell: GridCell): string {
  return `
    <div class="gh-cell ${cell.statusClass} ${cell.modifierClass ?? ""}">
      <span class="gh-cell__emoji">${cell.emoji}</span>
      <span class="gh-cell__label">${cell.label}</span>
    </div>
  `;
}

function renderDependencyRow(item: CropDependencyRow): string[] {
  return [
    `<span class="mono">${item.zoneSystem}</span>`,
    item.functionLabel,
    item.dependency,
    item.fallback,
    `<span class="dep-impact dep-impact--${item.level.toLowerCase()}">${item.impact}</span>`,
  ];
}

function renderFailureReallocColumn(column: FailureReallocColumn): string {
  return `
    <div class="failure-realloc-col">
      <p class="failure-realloc-col__title">${column.title}</p>
      <div class="failure-realloc-col__rows">
        ${column.rows
          .map(
            (row) => `
              <div class="failure-realloc-row">
                <span class="failure-realloc-row__label">${row.label}</span>
                <span class="failure-realloc-row__value ${row.level ? `status-${row.level.toLowerCase()}` : ""}">${row.value}</span>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderEmergencyEntry(item: EmergencyEntry, isExpanded: boolean): string {
  return `
    <div class="risk-emergency risk-emergency--${item.type}">
      <button
        type="button"
        class="risk-emergency__toggle"
        data-emergency-toggle="${item.id}"
      >
        <div class="risk-emergency__head">
          <span class="risk-emergency__icon">${item.icon}</span>
          <div class="risk-emergency__copy">
            <p class="risk-emergency__message">${item.message}</p>
            <p class="risk-emergency__meta">${item.meta}</p>
          </div>
        </div>
      </button>
      ${
        isExpanded && item.responsePlan
          ? `
            <div class="risk-emergency__plan mono">
              ${item.responsePlan.map((step) => `<div>${step}</div>`).join("")}
            </div>
          `
          : ""
      }
    </div>
  `;
}

function renderKeyValueRow(label: string, value: string, level?: StatusTone): string {
  return `
    <div class="scenario-kv">
      <span class="scenario-kv__label">${label}</span>
      <span class="scenario-kv__value ${level ? `status-${level.toLowerCase()}` : ""}">${value}</span>
    </div>
  `;
}

function renderFailureImpactColumn(column: FailureImpactColumn): string {
  return `
    <div class="failure-impact-col">
      <p class="failure-impact-col__title">${column.title}</p>
      <div class="failure-impact-col__body">
        ${column.rows
          .map((row) => renderKeyValueRow(row.label, row.value, row.level))
          .join("")}
      </div>
    </div>
  `;
}

function renderOverviewEnvTile(item: EnvParam): string {
  const valueClass = item.id === "co2" ? "overview-env-tile__value--cau" : "";

  return `
    <div class="overview-env-tile">
      <div class="overview-env-tile__head">
        <span class="overview-env-tile__label">${item.label}</span>
        <span class="overview-env-tile__status mono">${item.warmFlag}</span>
      </div>
      <div class="overview-env-tile__value mono ${valueClass}">${item.value} ${item.unit}</div>
      <div class="ui-kpi__bar">
        <span style="width:${item.fillPct}%; background:${item.fillCol}"></span>
      </div>
    </div>
  `;
}

function renderNutritionMiniRow(item: NutrientRow): string {
  return `
    <div class="overview-nutrition-row">
      <span>${item.nutrient}</span>
      <span class="mono">${item.current}</span>
      ${renderStatusBadge(item.coverage, item.coverageLevel)}
    </div>
  `;
}

function renderScenarioCard(item: ScenarioCard): string {
  return renderNotice({
    level: getNoticeLevel(item.level),
    title: `${item.label} · ${item.key.toUpperCase()}`,
    children: `Before: ${item.before.join(" / ")}. After: ${item.after.join(" / ")}. Response: ${item.response}`,
  });
}

function renderTimelineLog(item: TimelineEvent): string {
  return renderLogEntry({
    type: "inf",
    icon: item.sol,
    message: item.event,
    meta: `${item.label} | dot ${item.dotColor}`,
  });
}

function renderMemoryLog(item: MissionMemoryItem): string {
  return renderLogEntry({
    type: "act",
    icon: item.sol,
    message: item.text,
    meta: item.tags.join(" | "),
  });
}

function renderTimelineChip(item: TimelineEvent): string {
  const isCurrent = item.sol === `SOL ${headerModel.missionDay}`;

  return `
    <div class="overview-timeline-chip ${isCurrent ? "is-current" : ""}">
      <span class="overview-timeline-chip__sol mono">${item.sol}</span>
      <span class="overview-timeline-chip__dot" style="background:${item.dotColor}"></span>
      <span class="overview-timeline-chip__label">${item.label}</span>
      <span class="overview-timeline-chip__event">${item.event}</span>
    </div>
  `;
}

function buildCropDiagnostics(crop: CropData): Array<{
  name: string;
  value: string;
  fillPct: number;
  fillColor: string;
  valueMuted: string;
}> {
  const leafDensity = Math.min(100, crop.healthScore + 8);
  const rootDepth = Math.min(100, crop.healthScore + (crop.healthLevel === "ABT" ? -8 : 4));
  const uptake = Math.min(100, crop.allocationPct * 3);

  return [
    {
      name: "Leaf Density",
      value: `${leafDensity}%`,
      fillPct: leafDensity,
      fillColor: crop.sparkColor,
      valueMuted: crop.role,
    },
    {
      name: "Root Depth",
      value: `${rootDepth}%`,
      fillPct: rootDepth,
      fillColor: crop.healthLevel === "ABT" ? "var(--abt)" : "var(--aero-blue)",
      valueMuted: crop.stressLabel,
    },
    {
      name: "Nutrient Uptake",
      value: `${uptake}%`,
      fillPct: uptake,
      fillColor: crop.healthLevel === "NOM" ? "var(--nom)" : "var(--cau)",
      valueMuted: `${crop.allocationPct}% allocation`,
    },
  ];
}

function getTrendGlyph(points: number[]): string {
  if (points.at(-1) === undefined || points[0] === undefined) {
    return "flat";
  }

  const delta = points.at(-1)! - points[0];

  if (delta > 8) {
    return "up";
  }

  if (delta < -8) {
    return "down";
  }

  return "flat";
}

function renderAgentLog(item: FullAgentLogItem): string {
  return renderLogEntry({
    type: item.type,
    icon: item.icon,
    message: item.message,
    meta: item.meta,
    confidence: item.confidence,
    extra: renderConfPill(item.confidenceLevel, item.confidenceLevel),
  });
}

function renderTradeoff(item: Tradeoff): string {
  return renderNotice({
    level: getNoticeLevel(item.level),
    title: `${item.title} · ${item.level}`,
    children: `Benefit: ${item.benefit} Cost: ${item.cost}`,
  });
}

function renderChatLine(item: ChatReply): string {
  return `
    <div class="ui-chat ui-chat--${item.role}">
      <span class="ui-chat__role mono">${item.role}</span>
      <p class="ui-chat__text">${item.text}</p>
    </div>
  `;
}

function getNoticeLevel(level: StatusTone): "ok" | "warn" | "crit" {
  switch (level) {
    case "NOM":
      return "ok";
    case "CAU":
      return "warn";
    case "ABT":
      return "crit";
    default:
      return "warn";
  }
}

void renderRiskLegacy;
void renderEnvKpi;
void renderCropCard;
