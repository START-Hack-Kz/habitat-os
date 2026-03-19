import type { HeaderModel } from "../types";

export function renderHeader(model: HeaderModel): string {
  return `
    <header class="app-header">
      <div class="app-header__inner">
        <div class="header-brand">
          <span class="header-brand__icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
              <path
                d="M8 1.5c2.9 1.2 5 4.1 5 7.5 0 3.1-1.7 5.3-5 5.5-3.3-.2-5-2.4-5-5.5 0-3.4 2.1-6.3 5-7.5Zm-.6 3.1C5.8 5.7 5 7.3 5 8.9c0 2 .9 3.3 3 3.6V4.6c-.2 0-.4 0-.6 0Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <div class="header-brand__copy">
            <span class="header-brand__title">${model.title}</span>
            <span class="header-brand__subtext">${model.subtitle}</span>
          </div>
        </div>

        <div class="header-sol">
          <span class="header-sol__value mono">SOL ${String(model.missionDay).padStart(3, "0")}</span>
          <span class="header-sol__context">OF ${model.missionDurationTotal} &middot; Surface Mission</span>
        </div>

        <div class="header-status">
          <div class="header-agent mono">
            <span>Agent: ${model.agentState}</span>
            <span>Last action: ${model.lastAction}</span>
          </div>
          <div class="sys-status sys-status--${model.systemTone.toLowerCase()}">
            <span class="header-system__led" aria-hidden="true"></span>
            <span>${model.systemLabel}</span>
          </div>
        </div>
      </div>
    </header>
  `;
}
