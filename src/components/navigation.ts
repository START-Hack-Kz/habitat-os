import type { TabDefinition, TabId } from "../types";

export function renderNavigation(tabs: TabDefinition[], activeTab: TabId): string {
  return `
    <nav class="app-nav" aria-label="Primary sections">
      <div class="app-nav__inner">
        ${tabs
          .map(
            (tab) => `
              <button
                type="button"
                class="app-nav__tab ${tab.id === activeTab ? "is-active" : ""}"
                data-tab-target="${tab.id}"
                aria-pressed="${String(tab.id === activeTab)}"
              >
                <span class="app-nav__label">${tab.label}</span>
                ${
                  typeof tab.alertCount === "number"
                    ? `<span class="app-nav__badge">${tab.alertCount}</span>`
                    : ""
                }
              </button>
            `,
          )
          .join("")}
      </div>
    </nav>
  `;
}
