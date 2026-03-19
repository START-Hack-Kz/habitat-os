import type {
  AlertLevel,
  ButtonTone,
  LogEntryType,
  NoticeLevel,
  StatusTone,
} from "../types";

interface PanelProps {
  title: string;
  dotColor?: string;
  rightSlot?: string;
  children: string;
  noPad?: boolean;
}

interface KpiTileProps {
  label: string;
  value: string;
  sub?: string;
  level?: StatusTone;
  progress?: number;
  progressColor?: string;
}

interface GaugeBarProps {
  name: string;
  value: string;
  fillPct: number;
  fillColor: string;
  label?: string;
  valueMuted?: string;
}

interface TableProps {
  columns: string[];
  rows: string[][];
}

interface AeroButtonProps {
  label: string;
  tone?: ButtonTone;
}

interface NoticeProps {
  children: string;
  level?: NoticeLevel;
  title?: string;
}

interface AlertStripProps {
  level: AlertLevel;
  label: string;
  children: string;
  onDismiss?: boolean;
}

interface LogLineProps {
  type: LogEntryType;
  icon: string;
  message: string;
  meta: string;
  confidence?: string;
  extra?: string;
}

interface AllocBarProps {
  zoneName: string;
  detail: string;
  fillPct: number;
  fillColor: string;
  offline?: boolean;
}

interface SparklineProps {
  points: number[];
  stroke?: string;
}

export function renderPanel({
  title,
  dotColor = "var(--aero-blue)",
  rightSlot = "",
  children,
  noPad = false,
}: PanelProps): string {
  return `
    <article class="panel ${noPad ? "" : "panel-pad"} ui-panel">
      <header class="ui-panel__header">
        <div class="ui-panel__title-row">
          <span class="ui-panel__dot" style="color: ${dotColor}"></span>
          <h3 class="ui-panel__title">${title}</h3>
        </div>
        ${rightSlot ? `<div class="ui-panel__right">${rightSlot}</div>` : ""}
      </header>
      ${children}
    </article>
  `;
}

export function renderKpiTile({
  label,
  value,
  sub = "",
  level,
  progress,
  progressColor = "var(--aero-blue)",
}: KpiTileProps): string {
  const levelClass = level ? ` ui-kpi--${level.toLowerCase()}` : "";
  const progressBar =
    typeof progress === "number"
      ? `<div class="ui-kpi__bar"><span style="width:${progress}%; background:${progressColor}"></span></div>`
      : "";

  return `
    <div class="ui-kpi${levelClass}">
      <p class="ui-kpi__label">${label}</p>
      <div class="ui-kpi__value mono">${value}</div>
      ${sub ? `<p class="ui-kpi__sub">${sub}</p>` : ""}
      ${progressBar}
    </div>
  `;
}

export function renderGaugeBar({
  name,
  value,
  fillPct,
  fillColor,
  label = "",
  valueMuted = "",
}: GaugeBarProps): string {
  return `
    <div class="ui-gauge">
      <div class="ui-gauge__head">
        <span class="ui-gauge__name">${name}</span>
        <span class="ui-gauge__value mono">${value}</span>
      </div>
      <div class="ui-gauge__track">
        <span class="ui-gauge__fill" style="width:${fillPct}%; background:${fillColor}"></span>
      </div>
      <div class="ui-gauge__foot">
        <span>${label}</span>
        <span class="mono">${valueMuted}</span>
      </div>
    </div>
  `;
}

export function renderDataTable({ columns, rows }: TableProps): string {
  return `
    <div class="table-wrap">
      <table class="data-table ui-data-table">
        <thead>
          <tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  ${row.map((cell) => `<td>${cell}</td>`).join("")}
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderAeroButton({ label, tone = "default" }: AeroButtonProps): string {
  const toneClass =
    tone === "primary" ? "btn-primary" : tone === "danger" ? "btn-danger" : "btn-ghost";

  return `<button class="btn ${toneClass}" type="button">${label}</button>`;
}

export function renderNotice({
  children,
  level = "info",
  title = "",
}: NoticeProps): string {
  return `
    <div class="ui-notice ui-notice--${level}">
      ${title ? `<p class="ui-notice__title">${title}</p>` : ""}
      <p class="ui-notice__body">${children}</p>
    </div>
  `;
}

export function renderAlertStrip({
  level,
  label,
  children,
  onDismiss = false,
}: AlertStripProps): string {
  return `
    <div class="ui-alert ui-alert--${level}">
      <div class="ui-alert__left">
        <span class="ui-alert__label">${label}</span>
        <span class="ui-alert__body">${children}</span>
      </div>
      ${
        onDismiss
          ? '<button class="ui-alert__dismiss" type="button" aria-label="Dismiss alert">&times;</button>'
          : ""
      }
    </div>
  `;
}

export function renderLogEntry({
  type,
  icon,
  message,
  meta,
  confidence = "",
  extra = "",
}: LogLineProps): string {
  return `
    <div class="ui-log ui-log--${type}">
      <div class="ui-log__icon">${icon}</div>
      <div class="ui-log__body">
        <p class="ui-log__message">${message}</p>
        <p class="ui-log__meta">${meta}</p>
      </div>
      <div class="ui-log__right">
        ${confidence ? `<span class="ui-log__confidence">${confidence}</span>` : ""}
        ${extra ? `<span class="ui-log__extra">${extra}</span>` : ""}
      </div>
    </div>
  `;
}

export function renderAllocBar({
  zoneName,
  detail,
  fillPct,
  fillColor,
  offline = false,
}: AllocBarProps): string {
  return `
    <div class="ui-alloc ${offline ? "is-offline" : ""}">
      <div class="ui-alloc__row">
        <span class="ui-alloc__zone">${zoneName}</span>
        <span class="ui-alloc__detail mono">${detail}</span>
      </div>
      <div class="ui-alloc__track">
        <span class="ui-alloc__fill" style="width:${fillPct}%; background:${fillColor}"></span>
      </div>
    </div>
  `;
}

export function renderSparkline({ points, stroke = "var(--aero-blue)" }: SparklineProps): string {
  if (points.length === 0) {
    return '<svg class="ui-sparkline" viewBox="0 0 80 20" aria-hidden="true"></svg>';
  }

  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const path = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * 80;
      const y = 18 - ((point - min) / range) * 16;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return `
    <svg class="ui-sparkline" viewBox="0 0 80 20" aria-hidden="true">
      <path d="${path}" fill="none" stroke="${stroke}" stroke-width="1.5" />
    </svg>
  `;
}

export function renderConfPill(value: string, level: StatusTone = "NOM"): string {
  return `<span class="ui-conf ui-conf--${level.toLowerCase()}">${value}</span>`;
}

export function renderStatusBadge(value: string, level: StatusTone = "NOM"): string {
  return `<span class="ui-status ui-status--${level.toLowerCase()}">[ ${value} ]</span>`;
}
