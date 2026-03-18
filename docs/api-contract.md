# API Contract — Mars Greenhouse Mission Control

Base URL: `http://localhost:3001/api` (dev) | `https://api.mars-greenhouse.demo/api` (prod)

All responses are JSON. No auth required. No pagination (data sets are small).

---

## Endpoint Surface

### 1. GET /mission/state
**Purpose:** Fetch the current full mission state. The dashboard's primary data source.

**Request:** None

**Response:** `MissionState` (see `shared/schemas/missionState.schema.ts`)

**MVP:** Required

**Frontend notes:**
- Poll this every 5s during active simulation, or on-demand after user actions
- Use `status` field to drive dashboard color/alert state
- Use `activeScenario` to show/hide the scenario banner
- `eventLog` is newest-first, show top 5–8 entries

---

### 2. POST /simulation/tick
**Purpose:** Advance the simulation by N days. Updates mission state in-place.

**Request:**
```json
{ "days": 1 }
```

**Response:** `PlannerOutput` (see `shared/schemas/plannerOutput.schema.ts`)

**MVP:** Required

**Frontend notes:**
- Call this when user clicks "Advance Day" button
- Use `changes` array to animate what changed
- If `nutritionRiskDetected: true`, prompt user to run AI analysis

---

### 3. POST /simulation/scenario/inject
**Purpose:** Inject a predefined failure scenario into the simulation. Immediately updates mission state.

**Request:** `ScenarioInjectRequest` (see `shared/schemas/scenarioInput.schema.ts`)
```json
{
  "scenarioType": "water_recycling_decline",
  "severity": "critical",
  "affectedZones": ["zone-A", "zone-B", "zone-C", "zone-D"]
}
```

**Response:** `PlannerOutput`

**MVP:** Required

**Frontend notes:**
- Triggered by the scenario injection panel
- After response, re-fetch `/mission/state` to refresh dashboard
- If `nutritionRiskDetected: true` in response, auto-trigger AI analysis or prompt user

---

### 4. POST /simulation/reset
**Purpose:** Reset simulation to baseline mission state (day 87, no active scenario).

**Request:** `{}` (empty body)

**Response:** `MissionState` (the reset baseline state)

**MVP:** Required

**Frontend notes:**
- Triggered by "Reset Mission" button
- Replace entire dashboard state with response

---

### 5. GET /scenarios
**Purpose:** Fetch the catalog of available predefined scenarios with descriptions and severity effects.

**Request:** None

**Response:**
```json
{
  "scenarios": [ScenarioCatalogEntry, ...]
}
```
See `ScenarioCatalogEntry` in `shared/schemas/scenarioInput.schema.ts`

**MVP:** Required

**Frontend notes:**
- Used to populate the scenario selector dropdown
- Show `nutritionRisk` field as a warning label in the UI
- Show `defaultSeverityEffects` to help user understand what each severity does

---

### 6. POST /agent/analyze
**Purpose:** Trigger the AI agent to analyze current mission state and return a decision with recommendations and explanation.

**Request:**
```json
{
  "includeKbContext": true,
  "focusArea": "nutrition"
}
```
- `includeKbContext`: whether to inject KB crop profile context into the agent prompt (default: true)
- `focusArea`: hint to the agent — always "nutrition" for MVP

**Response:** `AIDecision` (see `shared/schemas/aiDecision.schema.ts`)

**MVP:** Required

**Frontend notes:**
- This is the most important endpoint for the demo story
- Show a loading state — LLM call may take 3–8 seconds
- On response, display:
  - `explanation` as the main AI narrative card
  - `recommendedActions` as an action list
  - `comparison` as the before/after panel
  - `nutritionPreservationMode: true` triggers the NPM banner
- Do NOT auto-call this — require user to click "Analyze" or trigger after scenario inject

---

### 7. POST /agent/apply
**Purpose:** Apply the AI agent's recommended actions to the simulation state.

**Request:**
```json
{
  "decisionId": "dec-001",
  "actionIds": ["act-001", "act-002"]
}
```
- `actionIds`: subset of actions from the decision to apply (user can deselect some)

**Response:** `PlannerOutput` (updated mission state after applying actions)

**MVP:** Required

**Frontend notes:**
- Triggered by "Apply Recommendations" button in the AI decision panel
- After response, refresh dashboard with new mission state
- This is the "after" state in the before/after comparison

---

### 8. GET /crops/profiles
**Purpose:** Fetch static crop profile data (thresholds, nutritional values, mission roles).

**Request:** None

**Response:**
```json
{
  "profiles": [CropProfile, ...]
}
```
See `shared/schemas/cropProfile.schema.ts` and `shared/examples/cropProfiles.example.json`

**MVP:** Optional (frontend can hardcode from example file for hackathon)

**Frontend notes:**
- Used to show crop detail tooltips/modals
- Used to render optimal range indicators on sensor readings
- Can be mocked from `shared/examples/cropProfiles.example.json`

---

### 9. POST /simulation/tweak
**Purpose:** Manually override specific simulation parameters without injecting a full scenario. For demo fine-tuning.

**Request:** `ManualTweakParams` (partial — only include fields to override)
```json
{
  "waterRecyclingEfficiency": 55,
  "temperatureZoneA": 26.5
}
```

**Response:** `PlannerOutput`

**MVP:** Optional (nice-to-have for demo flexibility)

**Frontend notes:**
- Advanced panel, can be hidden behind a "Dev Controls" toggle
- Useful for judges who want to push the system harder

---

## Error Shape

All errors return:
```json
{
  "error": true,
  "code": "SIMULATION_NOT_INITIALIZED",
  "message": "Human-readable error description"
}
```

HTTP status codes: 400 (bad input), 500 (server/agent error), 503 (agent unavailable)

---

## Assumptions

1. Backend maintains a single in-memory mission state per server instance (no multi-session)
2. `/agent/analyze` calls the LLM — expect 3–8s latency; frontend should show a spinner
3. `/simulation/tick` is synchronous and fast (<100ms)
4. Scenario injection is idempotent — injecting the same scenario twice replaces the previous one
5. `/agent/apply` mutates simulation state; there is no undo (use `/simulation/reset`)
