# MVP Scope Definition

## Must-Have Features

### Dashboard
- Mission header: day elapsed, days remaining, crew size, overall status
- 3–4 crop zone cards showing: crop type, growth progress, health status, stress flags
- Resource panel: water reservoir, recycling efficiency, energy, nutrient levels
- Nutrition status panel: caloric coverage %, protein coverage %, "Days Safe" forecast
- Active scenario banner when a failure is in progress
- Event/timeline log (last 5–10 events)

### Simulation
- Deterministic tick-based simulation (advance by 1 day or real-time)
- 3–4 pre-configured crop zones with realistic growth state
- Resource consumption modeled per zone per day
- Nutrition output calculated from zone yields
- Stress detection: heat, water deficit, nitrogen deficiency, energy shortage

### Failure Scenarios (3 predefined)
1. **Water Recycling Decline** — recycling efficiency drops to 60%, irrigation rationed
2. **Energy Budget Reduction** — power drops 40%, lighting and climate affected
3. **Temperature Control Failure** — zone temperature drifts above heat stress threshold

### AI Agent
- Triggered on scenario injection or manual "Analyze" call
- Inputs: current mission state + scenario context + optional KB context
- Outputs: risk assessment, recommended actions, plain-language explanation
- One structured decision object per invocation
- Before/after nutrition comparison included in response

### Scenario Injection UI
- Dropdown to select scenario
- Severity slider (mild / moderate / critical)
- "Inject" button triggers simulation update + AI analysis
- Reset button to restore baseline

### Before/After Comparison
- Side-by-side or before/after toggle showing nutrition metrics
- Highlights what changed: which zones affected, which nutrients at risk
- Shows AI-recommended reallocation

---

## Nice-to-Have Features

- Animated zone health indicators (pulsing, color transitions)
- Chart showing nutrition coverage trend over time
- Multiple AI analysis calls (re-analyze after applying recommendations)
- Scenario history (undo/redo)
- Exportable mission report
- Adjustable crew size
- Manual parameter tweaking per zone (not just scenario injection)

---

## Out of Scope

- Authentication or user accounts
- Persistent storage / database
- Mobile layout
- Multi-agent system
- Real sensor integration
- General-purpose farming platform features
- Crop disease simulation (too complex for demo)
- Radiation or gravity modeling
- Economic modeling
- Multi-mission comparison
- Admin roles or permissions
- Webhook/streaming updates (polling is fine for hackathon)

---

## Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| Simulation source of truth | Backend planner | Keeps frontend stateless, easier to demo |
| AI trigger | On-demand (not automatic) | Avoids runaway API calls during demo |
| State persistence | In-memory only | No DB setup time, sufficient for demo |
| Scenario complexity | 3 predefined only | Reliable demo > flexible system |
| KB usage | Optional context injection | Agent works without it, richer with it |
| Nutrition model | Simple weighted score | Credible enough, fast to compute |

---

## Complexity Challenges

The following were considered and rejected:

- **Real-time simulation ticks** — unnecessary; day-step simulation is sufficient and more controllable for demo
- **Multi-agent orchestration** — one agent is enough; multi-agent adds latency and failure surface
- **Dynamic crop zone creation** — 3–4 fixed zones is cleaner for the demo story
- **Streaming AI responses** — adds frontend complexity; single response is fine
- **Perchlorate/radiation modeling** — scientifically interesting, not demo-relevant
