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
KB_MCP_URL = os.getenv(
    "KB_MCP_URL",
    "https://kb-start-hack-gateway-buyjtibfpg.gateway.bedrock-agentcore.us-east-2.amazonaws.com/mcp",
)
KB_MCP_TOOL_NAME = os.getenv(
    "KB_MCP_TOOL_NAME",
    "kb-start-hack-target___knowledge_base_retrieve",
)
KB_MCP_AUTH_TOKEN = os.getenv("KB_MCP_AUTH_TOKEN")
KB_MCP_MAX_RESULTS = int(os.getenv("KB_MCP_MAX_RESULTS", "5"))
_kb_context_used = False


def _get(path: str) -> dict:
    resp = _client.get(path)
    resp.raise_for_status()
    return resp.json()


def _post(path: str, body: dict | None = None) -> dict:
    resp = _client.post(path, json=body or {})
    resp.raise_for_status()
    return resp.json()


def reset_kb_usage() -> None:
    global _kb_context_used
    _kb_context_used = False


def kb_was_used() -> bool:
    return _kb_context_used


def _mcp_headers() -> dict[str, str]:
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    }
    if KB_MCP_AUTH_TOKEN:
        headers["Authorization"] = f"Bearer {KB_MCP_AUTH_TOKEN}"
    return headers


def _mcp_call(method: str, params: dict) -> dict:
    payload = {
        "jsonrpc": "2.0",
        "id": f"mcp-{method}",
        "method": method,
        "params": params,
    }
    with httpx.Client(timeout=20.0, headers=_mcp_headers()) as client:
        resp = client.post(KB_MCP_URL, json=payload)
        resp.raise_for_status()
        data = resp.json()
    if "error" in data:
        raise RuntimeError(f"MCP error for {method}: {data['error']}")
    return data["result"]


def _extract_mcp_text_content(result: dict) -> str:
    contents = result.get("content", [])
    text_parts: list[str] = []
    for item in contents:
        if isinstance(item, dict) and item.get("type") == "text" and isinstance(item.get("text"), str):
            text_parts.append(item["text"])
    return "\n".join(text_parts).strip()


def _parse_gateway_kb_result(result_text: str) -> dict:
    """
    AgentCore Gateway tools often wrap the useful payload as:
    {"statusCode":200,"body":"{...json...}"}
    Normalize that into the actual KB response body.
    """
    outer = json.loads(result_text)
    body = outer.get("body")
    if isinstance(body, str):
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            return {"rawBody": body}
    return outer


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
    and mission protocols.

    This tool is explanation-only:
    - use backend tools for current mission facts and live values
    - use this KB for scientific rationale, thresholds, crop behavior, and mitigation logic

    Args:
        query: The knowledge base query, e.g. 'lettuce bolting threshold',
               'water recycling efficiency target', 'potato heat stress'
    """
    global _kb_context_used
    _kb_context_used = True

    try:
        result = _mcp_call(
            "tools/call",
            {
                "name": KB_MCP_TOOL_NAME,
                "arguments": {
                    "query": query,
                    "max_results": KB_MCP_MAX_RESULTS,
                },
            },
        )
        result_text = _extract_mcp_text_content(result)
        normalized = _parse_gateway_kb_result(result_text) if result_text else {}
        chunks = normalized.get("retrieved_chunks", [])
        summarized_chunks = []
        for chunk in chunks[:KB_MCP_MAX_RESULTS]:
            if not isinstance(chunk, dict):
                continue
            content = chunk.get("content")
            if not isinstance(content, str):
                continue
            summarized_chunks.append({
                "content": content[:1500],
                "metadata": chunk.get("metadata", {}),
            })

        return json.dumps({
            "query": query,
            "toolName": KB_MCP_TOOL_NAME,
            "source": "AgentCore Gateway MCP Knowledge Base",
            "resultCount": len(summarized_chunks),
            "retrievedChunks": summarized_chunks,
        })
    except Exception as exc:
        return json.dumps({
            "query": query,
            "toolName": KB_MCP_TOOL_NAME,
            "source": "AgentCore Gateway MCP Knowledge Base",
            "error": str(exc),
            "resultCount": 0,
            "retrievedChunks": [],
        })
