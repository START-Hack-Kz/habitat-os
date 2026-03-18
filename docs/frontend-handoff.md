# Frontend Handoff — Mars Greenhouse Mission Control

This document tells the frontend team exactly what to build, what data drives each panel, what to mock, and what to treat as dynamic.

---

## UI Panel Map

### Panel 1 — Mission Header Bar
**Schema:** `MissionState` (top-level fields)
**Fields used:** `missionDay`, `missionDurationTotal`, `crewSize`, `status`, `lastUpdated`

What to build:
- Mission name + day counter: "Day 87 / 450"
- Status badge: color-coded by `status` enum (green=nominal, yellow=warning, red=critical, purple=nutrition_preservation_mode)
- Crew size indicator
- Last updated timestamp

Mock first: yes — hardcode day 87, status "warning"

---

### Panel 2 — Crop Zone Cards (×4)
**Schema:** `CropZone` (inside `MissionState.zones`)
**Fields used:** `zoneId`, `cropType`, `growthProgressPercent`, `status`, `stress`, `projectedYieldKg`, `allocationPercent`, `sensors`

What to build:
- One card per zone (A–D)
- Crop name + icon
- Progress bar: `growthProgressPercent`
- Status badge: color by `status`
- Stress indicator: show `stress.type` and `stress.severity` if `stress.active`
- Bolting risk flag for lettuce
- Key sensor readings: temperature, humidity, lightPAR
- Resource allocation %: `allocationPercent`
- Projected yield

Mock first: yes — use `shared/examples/missionState.example.json` zones array

Dynamic: `stress`, `sensors`, `allocationPercent`, `projectedYieldKg` all change after scenario inject or agent apply

---

### Panel 3 — Resource State Panel
**Schema:** `ResourceState` (inside `MissionState.resources`)
**Fields used:** all fields

What to build:
- Water: reservoir level bar + recycling efficiency % + days remaining
- Energy: available kWh + consumption vs generation + days remaining
- Nutrients: N / P / K levels as simple indicators (normal / low / critical)

Color thresholds (suggested):
- Water recycling < 85%: yellow; < 70%: red
- Energy days remaining < 14: yellow; < 7: red
- Water days remaining < 30: yellow; < 14: red

Mock first: yes — use `shared/examples/missionState.example.json` resources object

Dynamic: everything changes after scenario inject

---

### Panel 4 — Nutrition Status Panel
**Schema:** `NutritionStatus` (inside `MissionState.nutrition`)
**Fields used:** all fields

What to build:
- "Days Safe" counter — this is the hero metric, make it big
- Caloric coverage % with progress bar (target: 100%)
- Protein coverage % with progress bar
- Micronutrient adequacy: 4 boolean indicators (Vitamin A, C, K, Folate)
- Nutritional coverage score (0–100) as a gauge or score card
- Trend arrow: improving / stable / declining

Color thresholds:
- daysSafe > 60: green; 30–60: yellow; < 30: red
- nutritionalCoverageScore > 80: green; 60–80: yellow; < 60: red

Mock first: yes — use `shared/examples/missionState.example.json` nutrition object

Dynamic: this is the most important panel to keep live — re-fetch after every action

---

### Panel 5 — Active Scenario Banner
**Schema:** `FailureScenario` (inside `MissionState.activeScenario`)
**Fields used:** `scenarioType`, `severity`, `description`, `affectedZones`

What to build:
- Only visible when `activeScenario !== null`
- Red/orange banner at top of dashboard
- Shows scenario name, severity badge, description
- "Analyze with AI" button → calls `POST /agent/analyze`
- "Reset Mission" button → calls `POST /simulation/reset`

Mock first: yes — use `shared/examples/missionState.example.json` activeScenario object

---

### Panel 6 — Scenario Injection Panel
**Schema:** `ScenarioCatalogEntry[]` from `GET /scenarios`, `ScenarioInjectRequest` for submission

What to build:
- Dropdown: select scenario type (3 options)
- Severity selector: mild / moderate / critical (radio or segmented control)
- "Inject Scenario" button → calls `POST /simulation/scenario/inject`
- Show `nutritionRisk` label from catalog entry as a warning

Mock first: hardcode the 3 scenario options from `shared/examples/cropProfiles.example.json` — no need to fetch catalog for MVP

---

### Panel 7 — AI Decision Panel
**Schema:** `AIDecision` (from `POST /agent/analyze`)
**Fields used:** all fields

What to build:
- Loading state while waiting for agent (3–8s)
- `nutritionPreservationMode: true` → show "NUTRITION PRESERVATION MODE ACTIVE" banner
- `riskSummary` → risk assessment card
- `explanation` → main AI narrative (this is the money text — make it prominent)
- `recommendedActions` → action list with checkboxes (user can deselect before applying)
  - Each action: `description`, `urgency` badge, `tradeoff` text, `nutritionImpact` text
- "Apply Selected Actions" button → calls `POST /agent/apply`

Mock first: yes — use `shared/examples/aiDecision.example.json`

Dynamic: only populated after user triggers analysis

---

### Panel 8 — Before/After Comparison
**Schema:** `BeforeAfterComparison` (inside `AIDecision.comparison`)
**Fields used:** `before`, `after`, `delta`, `summary`

What to build:
- Side-by-side or toggle view
- Show 4 metrics: caloric coverage, protein coverage, score, daysSafe
- Delta indicators: green if positive, red if negative
- `summary` text below the comparison

This is a key demo moment — make it visually clear.

Mock first: yes — use `shared/examples/aiDecision.example.json` comparison object

---

### Panel 9 — Event Log / Timeline
**Schema:** `EventLogEntry[]` (inside `MissionState.eventLog`)
**Fields used:** `missionDay`, `type`, `message`, `zoneId`

What to build:
- Scrollable list, newest first
- Color-coded by `type`: info=gray, warning=yellow, critical=red, ai_action=purple, scenario_injected=orange
- Show mission day + message
- Optional: zone badge if `zoneId` is set

Mock first: yes — use `shared/examples/missionState.example.json` eventLog array

---

## What to Mock vs What Must Be Dynamic

| Data | Mock OK? | Notes |
|---|---|---|
| Initial mission state | Yes | Use `missionState.example.json` |
| Crop profiles | Yes | Use `cropProfiles.example.json` — static data |
| Scenario catalog | Yes | Hardcode 3 scenarios |
| AI decision | Yes (for layout) | Must be real for demo — LLM call |
| Before/after comparison | Yes (for layout) | Must be real for demo |
| Post-scenario mission state | No | Must come from backend after inject |
| Post-apply mission state | No | Must come from backend after apply |
| Event log | Yes (initial) | Must update after actions |

---

## Key Assumptions for Frontend

1. Single session, single mission — no user accounts, no mission selection screen
2. Backend URL is configurable via env var (`VITE_API_BASE_URL` or equivalent)
3. All timestamps are ISO 8601 UTC strings
4. `allocationPercent` across all zones always sums to 100
5. `nutritionalCoverageScore` formula: `0.5 × caloricCoveragePercent + 0.3 × proteinCoveragePercent + 0.2 × micronutrientScore` — frontend doesn't need to compute this, it comes from backend
6. The AI agent call (`POST /agent/analyze`) is the slowest operation — always show a loading state
7. `POST /agent/apply` replaces the current mission state — there is no undo except reset
8. The demo starts at day 87 of 450 — this is intentional (mid-mission feels more dramatic)

---

## Recommended Build Order

1. Static dashboard with mocked `missionState.example.json` — all panels visible
2. Wire up `GET /mission/state` polling
3. Wire up scenario injection panel + `POST /simulation/scenario/inject`
4. Wire up AI decision panel + `POST /agent/analyze`
5. Wire up before/after comparison from AI response
6. Wire up `POST /agent/apply` + state refresh
7. Wire up `POST /simulation/reset`
8. Polish: animations, color thresholds, NPM banner

---

## Files to Read First

1. `shared/examples/missionState.example.json` — start here, this is your mock data
2. `shared/examples/aiDecision.example.json` — build the AI panel from this
3. `docs/api-contract.md` — all endpoints with request/response shapes
4. `shared/schemas/missionState.schema.ts` — TypeScript types you can import directly
5. `shared/schemas/aiDecision.schema.ts` — TypeScript types for the AI panel
