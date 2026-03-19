"""
Tool layer for the Mars Greenhouse AI agent.
Each tool calls the existing backend HTTP API and returns structured data.
The AI owns reasoning; the backend owns truth.
"""
from __future__ import annotations
import json
import os
import httpx
from strands import tool

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3001")
_client = httpx.Client(base_url=BACKEND_URL, timeout=10.0)


def _get(path: str) -> dict:
    resp = _client.get(path)
    resp.raise_for_status()
    return resp.json()


def _post(path: str, body: dict | None = None) -> dict:
    resp = _client.post(path, json=body or {})
    resp.raise_for_status()
    return resp.json()


@tool
def getMissionState() -> str:
    """
    Fetch the current full mission state from the backend.
    Returns mission status, all crop zones with sensor readings and stress states,
    resource levels (water, energy, nutrients), nutrition coverage metrics,
    active failure scenario if any, and the recent event log.
    Always call this first before any analysis.
    """
    data = _get("/api/mission/state")
    return json.dumps(data)


@tool
def getRecentMissionLog() -> str:
    """
    Fetch the recent event log from the current mission state.
    Returns the last 20 events (newest first) including warnings, critical alerts,
    AI actions, scenario injections, and info messages.
    Use this to answer 'what changed?' or 'what happened recently?' questions.
    """
    data = _get("/api/mission/state")
    log = data.get("eventLog", [])
    summary = {
        "missionDay": data.get("missionDay"),
        "status": data.get("status"),
        "eventLog": log[:10],  # top 10 most recent
    }
    return json.dumps(summary)


@tool
def runPlannerAnalysis() -> str:
    """
    Run the deterministic planner analysis on the current mission state.
    Returns the planner's recommended actions (if Nutrition Preservation Mode is triggered),
    before/after mission state snapshots, stress flags, and whether nutrition risk was detected.
    The planner owns the math — the AI interprets and explains the results.
    """
    data = _post("/api/planner/analyze")
    return json.dumps(data)


@tool
def getScenarioCatalog() -> str:
    """
    Fetch the catalog of all available failure scenarios.
    Returns scenario types, labels, descriptions, severity effects (mild/moderate/critical),
    affected resources, and nutrition risk assessments.
    Use this to answer questions about what scenarios exist or what a scenario does.
    """
    data = _get("/api/scenarios")
    return json.dumps(data)


@tool
def locateDashboardSection(topic: str) -> str:
    """
    Map a topic or question to the relevant dashboard section.
    Use this to tell the operator where to look on the dashboard.

    Args:
        topic: The topic to locate, e.g. 'water recycling', 'zone-A', 'bolting risk',
               'nutrition score', 'planner actions', 'scenarios', 'event log'
    """
    topic_lower = topic.lower()

    section_map = {
        # Resource panel
        "water": ("Resources Panel", "resources", "Check the Resources panel — top-right of the dashboard. Shows water reservoir level, recycling efficiency, and days remaining."),
        "water recycling": ("Resources Panel → Water Recycling", "resources.waterRecyclingEfficiency", "Look at the Resources panel. The Water Recycling Efficiency gauge shows current % and trend."),
        "energy": ("Resources Panel", "resources", "Resources panel shows energy available, consumption rate, solar generation, and days remaining."),
        "nutrient": ("Resources Panel → Nutrients", "resources.nutrients", "Resources panel bottom section shows N/P/K nutrient levels."),

        # Zone panels
        "zone": ("Crop Zones Panel", "zones", "The Crop Zones panel shows all 4 bays (A–D) with status, sensors, stress indicators, and allocation bars."),
        "zone-a": ("Crop Zones → Zone A (Lettuce)", "zones.zone-A", "Zone A card in the Crop Zones panel. Shows lettuce sensors, bolting risk indicator, and stress state."),
        "zone-b": ("Crop Zones → Zone B (Potato)", "zones.zone-B", "Zone B card shows potato growth progress, soil moisture, and caloric contribution."),
        "zone-c": ("Crop Zones → Zone C (Beans)", "zones.zone-C", "Zone C card shows beans protein output, stress state, and allocation."),
        "zone-d": ("Crop Zones → Zone D (Radish)", "zones.zone-D", "Zone D card shows radish growth cycle and harvest countdown."),

        # Bolting risk
        "bolting": ("Crop Zones → Zone A → Bolting Risk Indicator", "zones.zone-A.stress.boltingRisk", "Zone A card has a Bolting Risk badge. Bolting means lettuce is about to flower prematurely, destroying the harvest."),
        "bolting risk": ("Crop Zones → Zone A → Bolting Risk Indicator", "zones.zone-A.stress.boltingRisk", "Zone A card has a Bolting Risk badge. Bolting means lettuce is about to flower prematurely, destroying the harvest."),

        # Nutrition panel
        "nutrition": ("Nutrition Panel", "nutrition", "The Nutrition panel shows caloric coverage %, protein coverage %, days-safe countdown, and micronutrient bars."),
        "calori": ("Nutrition Panel → Caloric Coverage", "nutrition.caloricCoveragePercent", "Nutrition panel top row shows daily calories produced vs target (12,000 kcal/day for 4 crew)."),
        "protein": ("Nutrition Panel → Protein Coverage", "nutrition.proteinCoveragePercent", "Nutrition panel shows daily protein produced vs target (~450g/day for 4 crew)."),
        "days safe": ("Nutrition Panel → Days Safe", "nutrition.daysSafe", "The Days Safe counter is the key metric — how many days the crew stays adequately fed at current production rates."),
        "days_safe": ("Nutrition Panel → Days Safe", "nutrition.daysSafe", "The Days Safe counter is the key metric — how many days the crew stays adequately fed at current production rates."),
        "micronutrient": ("Nutrition Panel → Micronutrients", "nutrition.micronutrients", "Nutrition panel bottom section shows vitamin A, C, K, folate, iron, potassium, and magnesium coverage bars."),

        # AI / planner panel
        "planner": ("AI Analysis Panel", "agent", "The AI Analysis panel shows the planner's recommended actions, before/after comparison, and the AI explanation narrative."),
        "ai": ("AI Analysis Panel", "agent", "Click 'Analyze' to trigger the AI. The AI Analysis panel shows risk level, recommended actions, and the explanation card."),
        "recommend": ("AI Analysis Panel → Recommended Actions", "agent.recommendedActions", "The Recommended Actions list in the AI panel shows each action with urgency, description, and tradeoffs."),
        "action": ("AI Analysis Panel → Recommended Actions", "agent.recommendedActions", "The Recommended Actions list in the AI panel shows each action with urgency, description, and tradeoffs."),
        "before": ("AI Analysis Panel → Before/After Comparison", "agent.comparison", "The Before/After panel in AI Analysis shows nutrition score and days-safe before and after applying recommendations."),
        "after": ("AI Analysis Panel → Before/After Comparison", "agent.comparison", "The Before/After panel in AI Analysis shows nutrition score and days-safe before and after applying recommendations."),
        "comparison": ("AI Analysis Panel → Before/After Comparison", "agent.comparison", "The Before/After panel in AI Analysis shows nutrition score and days-safe before and after applying recommendations."),

        # Scenario panel
        "scenario": ("Scenario Panel", "scenarios", "The Scenario panel lets you inject failure scenarios (water recycling decline, energy reduction, temperature failure, zone control failure) at mild/moderate/critical severity."),
        "inject": ("Scenario Panel", "scenarios", "Use the Scenario panel to inject a failure scenario and observe how the system responds."),

        # Event log
        "event": ("Event Log Panel", "eventLog", "The Event Log panel (bottom of dashboard) shows the last 20 events newest-first — warnings, critical alerts, AI actions, and scenario injections."),
        "log": ("Event Log Panel", "eventLog", "The Event Log panel shows recent mission events. Look here to see what changed and when."),
        "changed": ("Event Log Panel", "eventLog", "The Event Log panel shows what changed. Also check the mission status banner at the top."),

        # Mission status
        "mission": ("Mission Status Banner", "status", "The Mission Status banner at the top shows nominal / warning / critical / nutrition_preservation_mode with color coding."),
        "critical": ("Mission Status Banner + AI Analysis Panel", "status", "The Mission Status banner turns red when critical. Trigger AI Analysis to understand why and get recommendations."),
        "status": ("Mission Status Banner", "status", "The Mission Status banner at the top shows the overall mission health."),
        "stress": ("Crop Zones Panel → Zone Cards", "zones.stress", "Each zone card shows the active stress type and severity badge. Click a zone for sensor detail."),
    }

    # Find best match
    for key, (section, field, guidance) in section_map.items():
        if key in topic_lower:
            return json.dumps({
                "section": section,
                "dashboardField": field,
                "guidance": guidance,
            })

    # Fallback
    return json.dumps({
        "section": "Mission Overview",
        "dashboardField": "status",
        "guidance": f"For '{topic}', start with the Mission Status banner at the top, then check the relevant panel (Zones, Resources, Nutrition, or AI Analysis).",
    })


@tool
def searchKnowledgeBase(query: str) -> str:
    """
    Search the Mars Greenhouse knowledge base for crop science, operational procedures,
    and mission protocols. Currently returns stub data — KB integration is planned.

    Args:
        query: The knowledge base query, e.g. 'lettuce bolting threshold',
               'water recycling efficiency target', 'potato heat stress'
    """
    # Stub: return grounded static KB facts relevant to common queries
    query_lower = query.lower()

    kb_facts = {
        "bolting": "Lettuce bolts (premature flowering) when temperature exceeds 25°C or photoperiod exceeds 16h. Bolting destroys the harvest — the plant becomes bitter and inedible. Immediate temperature reduction and photoperiod adjustment are required.",
        "water recycling": "Target water recycling efficiency is >85–95%. Below 85% triggers warning; below 70% requires immediate rationing. The closed-loop system recycles irrigation runoff and transpiration condensate.",
        "lettuce": "Lettuce (zone-A) is the micronutrient stabilizer — provides Vitamin A, K, and folate. Optimal temp 18–22°C, heat stress threshold 25°C. High water demand. Growth cycle 30–35 days.",
        "potato": "Potato (zone-B) is the caloric backbone — provides ~60% of crew calories. Optimal temp 15–20°C, heat stress threshold 26°C. Moderate water demand. Growth cycle 85–95 days.",
        "beans": "Beans (zone-C) are the protein security crop — provides 100% of plant protein. Optimal temp 18–24°C, heat stress threshold 30°C. Most heat-tolerant crop. Growth cycle 55–65 days.",
        "radish": "Radish (zone-D) is the fast buffer — quick 20–28 day cycle, provides Vitamin C. Optimal temp 15–20°C. Low caloric contribution but important for morale and micronutrients.",
        "nutrition preservation": "Nutrition Preservation Mode (NPM) activates when nutritional coverage score drops below 70 or days-safe drops below 30. The planner reallocates water and energy toward caloric and protein crops first.",
        "days safe": "Days Safe is the key mission metric: how many days the crew stays adequately fed at current production rates. Target >90 days. Below 30 days triggers NPM.",
        "temperature control": "HVAC failure causes temperature drift. Heat stress thresholds: lettuce 25°C, potato 26°C, radish 26°C, beans 30°C. Gradual recovery prevents thermal shock.",
        "energy budget": "Greenhouse energy budget covers LED lighting, HVAC, irrigation pumps, and monitoring. Solar generation target covers ~95% of daily consumption. Deficit triggers lighting reduction in low-priority zones.",
    }

    for key, fact in kb_facts.items():
        if key in query_lower:
            return json.dumps({"query": query, "result": fact, "source": "Mars Greenhouse KB (stub)"})

    return json.dumps({
        "query": query,
        "result": "No specific KB entry found for this query. Use getMissionState() for current values.",
        "source": "Mars Greenhouse KB (stub)",
    })
