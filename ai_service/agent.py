"""
Mars Greenhouse AI Agent.
Wraps a Strands Agent with the tool set and model configuration.
Provides two entry points: analyze() and chat().
"""
from __future__ import annotations
from contextlib import contextmanager
import json
import os
import re
from datetime import datetime, timezone

from mcp.client.streamable_http import streamablehttp_client
from strands import Agent
from strands.models import BedrockModel
from strands.tools.mcp.mcp_client import MCPClient

from models import (
    AIDecision, AnalyzeRequest, BeforeAfterComparison, BeforeAfterDelta,
    ChatRequest, ChatResponse, MissionState, NutritionSnapshot,
    PlannerOutput, RecommendedAction,
)
from tools import (
    getMissionState, getRecentMissionLog, runPlannerAnalysis,
    getScenarioCatalog, locateDashboardSection, searchKnowledgeBase,
    kb_was_used, reset_kb_usage,
    _client,
)

# ── Model setup ───────────────────────────────────────────────────────────────

def _get_model_limits() -> tuple[int, float]:
    """Read shared generation settings from env."""
    max_tokens = int(os.getenv("AI_MAX_TOKENS", "1200"))
    temperature = float(os.getenv("AI_TEMPERATURE", "0.2"))
    return max_tokens, temperature


def _get_model_provider() -> str:
    """
    Resolve the preferred model provider.

    Priority:
    1. explicit MODEL_PROVIDER
    2. Bedrock if AWS-oriented env is present
    3. direct provider fallbacks
    """
    explicit = os.getenv("MODEL_PROVIDER")
    if explicit:
        return explicit.strip().lower()

    if os.getenv("BEDROCK_MODEL_ID") or os.getenv("AWS_REGION"):
        return "bedrock"
    if os.getenv("ANTHROPIC_API_KEY"):
        return "anthropic"
    if os.getenv("OPENAI_API_KEY"):
        return "openai"
    return "bedrock"


def _build_model():
    """Build the Strands model from environment config."""
    max_tokens, temperature = _get_model_limits()
    provider = _get_model_provider()

    if provider == "anthropic":
        if not os.getenv("ANTHROPIC_API_KEY"):
            raise RuntimeError("MODEL_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set")
        from strands.models import AnthropicModel  # type: ignore
        return AnthropicModel(
            client_args={
                "api_key": os.getenv("ANTHROPIC_API_KEY"),
            },
            model_id=os.getenv("ANTHROPIC_MODEL_ID", "claude-haiku-4-5-20251001"),
            max_tokens=max_tokens,
            params={
                "temperature": temperature,
            },
        )

    if provider == "openai":
        if not os.getenv("OPENAI_API_KEY"):
            raise RuntimeError("MODEL_PROVIDER=openai but OPENAI_API_KEY is not set")
        from strands.models import OpenAIModel  # type: ignore
        return OpenAIModel(
            model_id=os.getenv("OPENAI_MODEL_ID", "gpt-4o-mini"),
            client_args={
                "api_key": os.getenv("OPENAI_API_KEY"),
            },
            params={
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
        )

    if provider != "bedrock":
        raise RuntimeError(f"Unsupported MODEL_PROVIDER={provider}")

    region = os.getenv("AWS_REGION", "us-east-1")
    model_id = os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-haiku-4-5-20251001-v1:0")
    return BedrockModel(
        model_id=model_id,
        region_name=region,
        max_tokens=max_tokens,
        temperature=temperature,
    )


_LOCAL_TOOLS = [
    getMissionState,
    getRecentMissionLog,
    runPlannerAnalysis,
    getScenarioCatalog,
    locateDashboardSection,
    searchKnowledgeBase,
]
_LOCAL_NON_OPERATIONAL_TOOLS = [locateDashboardSection, searchKnowledgeBase]
OPS_MCP_URL = os.getenv("OPS_MCP_URL")
OPS_MCP_AUTH_TOKEN = os.getenv("OPS_MCP_AUTH_TOKEN")

_RISK_LEVELS = {"low", "moderate", "high", "critical"}

_SYSTEM_PROMPT = """You are the Mars Greenhouse Mission Control AI assistant.

Your role:
- Analyze mission state and explain what is happening, why it matters, and what to do
- Answer operator questions about the dashboard concisely and accurately
- Ground every statement in tool outputs — never invent sensor values or nutrition numbers
- The backend owns all math (nutrition formulas, stress calculations, planner logic)
- You own reasoning, explanation, prioritization, and dashboard guidance

Rules:
- Always call getMissionState() before any analysis
- Never invent mission values not present in tool outputs
- Backend tools own live operational truth: current sensors, nutrition, planner output, mission status
- searchKnowledgeBase() is explanation-only: use it for crop science, thresholds, Mars constraints, and mitigation rationale
- If KB context conflicts with live backend values, backend values win
- Be concise and operational — operators are under pressure
- When pointing to dashboard sections, use locateDashboardSection()
- For KB questions, use searchKnowledgeBase()
"""


def _ops_mcp_headers() -> dict[str, str]:
    headers = {"Accept": "application/json, text/event-stream"}
    if OPS_MCP_AUTH_TOKEN:
        headers["Authorization"] = f"Bearer {OPS_MCP_AUTH_TOKEN}"
    return headers


def _load_all_mcp_tools(mcp_client: MCPClient):
    tools = []
    pagination_token = None
    while True:
        page = mcp_client.list_tools_sync(pagination_token)
        tools.extend(list(page))
        pagination_token = getattr(page, "pagination_token", None)
        if pagination_token is None:
            break
    return tools


@contextmanager
def _agent_tool_context():
    """
    Use MCP for operational tools when available.
    Local backend tools remain the fallback and the source of deterministic truth.
    """
    if not OPS_MCP_URL:
        yield _LOCAL_TOOLS
        return

    client = MCPClient(lambda: streamablehttp_client(OPS_MCP_URL, headers=_ops_mcp_headers()))
    try:
        client.start()
        mcp_tools = _load_all_mcp_tools(client)
        yield [*mcp_tools, *_LOCAL_NON_OPERATIONAL_TOOLS]
    finally:
        client.stop(None, None, None)


def _make_agent(tools) -> Agent:
    """Create a fresh Strands agent instance."""
    model = _build_model()
    return Agent(
        model=model,
        system_prompt=_SYSTEM_PROMPT,
        tools=tools,
    )


# ── Analyze ───────────────────────────────────────────────────────────────────

_ANALYZE_PROMPT = """Analyze the current Mars Greenhouse mission state.

Steps:
<<<<<<< HEAD
1. Call getMissionState() to get current state
2. Call runPlannerAnalysis() to get planner recommendations
3. Produce a JSON object matching this exact schema:
=======
1. Call getMissionState()
2. Call runPlannerAnalysis()
3. If agronomy or mission rationale would improve the explanation, call searchKnowledgeBase() with a focused query
4. Return ONLY this compact JSON object:
>>>>>>> 3d97219 (feat: amazon bedrock)

{{
  "decisionId": "<string>",
  "missionDay": <int>,
  "timestamp": "<ISO datetime>",
  "riskLevel": "low" | "moderate" | "high" | "critical",
  "riskSummary": "<1-2 sentences: what is at risk and why>",
  "criticalNutrientDependencies": ["<string>", ...],
  "nutritionPreservationMode": <bool>,
  "recommendedActions": [
    {{
      "actionId": "<string>",
      "actionType": "<ActionType>",
      "urgency": "immediate" | "within_24h" | "strategic",
      "targetZoneId": "<string or null>",
      "description": "<human-readable description>",
      "parameterChanges": {{}},
      "nutritionImpact": "<string>",
      "tradeoff": "<string>"
    }}
  ],
  "comparison": {{
    "before": {{"caloricCoveragePercent": <n>, "proteinCoveragePercent": <n>, "nutritionalCoverageScore": <n>, "daysSafe": <n>}},
    "after": {{"caloricCoveragePercent": <n>, "proteinCoveragePercent": <n>, "nutritionalCoverageScore": <n>, "daysSafe": <n>}},
    "delta": {{"caloricCoverageDelta": <n>, "proteinCoverageDelta": <n>, "scoreDelta": <n>, "daysSafeDelta": <n>}},
    "summary": "<string>"
  }},
  "explanation": "<2-4 sentences a judge can read in 10 seconds>",
  "triggeredByScenario": "<scenarioId or null>",
  "kbContextUsed": <bool>
}}

<<<<<<< HEAD
CRITICAL: Use ONLY values from getMissionState() and runPlannerAnalysis() outputs.
Do NOT invent sensor readings, nutrition numbers, or zone values.
Return ONLY the JSON object, no markdown, no extra text.
=======
Rules:
- Ground every statement in getMissionState() and runPlannerAnalysis()
- Use searchKnowledgeBase() only for explanation, thresholds, or mitigation rationale
- Do not use searchKnowledgeBase() as the source of live mission values
- Do not invent sensor values, nutrition values, planner actions, or before/after numbers
- Do not restate the full tool payload
- Keep the output concise and operational
- Return ONLY JSON, no markdown
>>>>>>> 3d97219 (feat: amazon bedrock)
"""


def _extract_json(text: str) -> dict:
    """Extract JSON from agent response text."""
    # Try direct parse first
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to find JSON block
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not extract JSON from agent response: {text[:500]}")


def _get_backend_stub_decision() -> dict | None:
    """
    Call the existing TypeScript backend agent stub to get recommended actions.
    The stub owns the deterministic planner execution — we reuse it rather than
    reimplementing the action logic in Python.
    """
    try:
        resp = _client.post("/api/agent/analyze", json={})
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return None


def _fallback_analyze(mission: MissionState, planner: PlannerOutput) -> AIDecision:
    """
    Deterministic fallback when the LLM is unavailable.
    Reads directly from backend tool outputs — no invented values.
    Delegates recommended actions to the existing TypeScript backend stub.
    """
    n = mission.nutrition
    status = mission.status
    scenario = mission.activeScenario

    # Determine risk level from mission state
    if status in ("critical", "nutrition_preservation_mode") or n.nutritionalCoverageScore < 50 or n.daysSafe < 30:
        risk = "critical"
    elif status == "warning" or n.nutritionalCoverageScore < 70 or n.daysSafe < 90 or scenario:
        risk = "high"
    elif any(z.stress.active for z in mission.zones):
        risk = "moderate"
    else:
        risk = "low"

    # Build nutrient dependencies from actual zone data
    deps = []
    for z in mission.zones:
        if z.cropType == "potato":
            deps.append(f"{z.zoneId} (potato) is the caloric backbone — status: {z.status}")
        elif z.cropType == "beans":
            deps.append(f"{z.zoneId} (beans) provides plant protein — status: {z.status}")
        elif z.cropType == "lettuce":
            deps.append(f"{z.zoneId} (lettuce) provides Vitamin A, K, folate — status: {z.status}, bolting risk: {z.stress.boltingRisk}")

    # Build explanation from real values
    if scenario:
        explanation = (
            f"{scenario.scenarioType} is active (severity: {scenario.severity}). "
            f"Nutrition score: {n.nutritionalCoverageScore}, days safe: {n.daysSafe}. "
            f"Caloric coverage: {n.caloricCoveragePercent}%, protein: {n.proteinCoveragePercent}%. "
            f"{'Planner has activated Nutrition Preservation Mode.' if planner.nutritionRiskDetected else 'Planner is monitoring — no NPM threshold breached yet.'}"
        )
    elif risk == "low":
        explanation = (
            f"Mission is nominal on day {mission.missionDay}. "
            f"Nutrition score: {n.nutritionalCoverageScore}/100, days safe: {n.daysSafe}. "
            f"All zones healthy. No intervention required."
        )
    else:
        stressed = [z for z in mission.zones if z.stress.active]
        zone_summary = ", ".join(f"{z.zoneId} ({z.stress.type} {z.stress.severity})" for z in stressed)
        explanation = (
            f"Mission status: {status}. "
            f"Nutrition score: {n.nutritionalCoverageScore}, days safe: {n.daysSafe}. "
            f"{'Stressed zones: ' + zone_summary + '.' if zone_summary else ''} "
            f"{'Planner recommends intervention.' if planner.nutritionRiskDetected else 'Monitor closely.'}"
        )

    # Get recommended actions from the backend stub (it owns the planner execution)
    actions: list[RecommendedAction] = []
    npm_active = planner.nutritionRiskDetected
    stub_data = _get_backend_stub_decision()
    if stub_data and stub_data.get("recommendedActions"):
        try:
            actions = [RecommendedAction.model_validate(a) for a in stub_data["recommendedActions"]]
            npm_active = stub_data.get("nutritionPreservationMode", npm_active)
        except Exception:
            pass

    # Build before/after from planner output (actual backend values)
    before_snap = NutritionSnapshot(
        caloricCoveragePercent=n.caloricCoveragePercent,
        proteinCoveragePercent=n.proteinCoveragePercent,
        nutritionalCoverageScore=n.nutritionalCoverageScore,
        daysSafe=n.daysSafe,
    )
    after_n = planner.missionState.nutrition
    after_snap = NutritionSnapshot(
        caloricCoveragePercent=after_n.caloricCoveragePercent,
        proteinCoveragePercent=after_n.proteinCoveragePercent,
        nutritionalCoverageScore=after_n.nutritionalCoverageScore,
        daysSafe=after_n.daysSafe,
    )

    ts = datetime.now(timezone.utc).isoformat()
    return AIDecision(
        decisionId=f"dec-{mission.missionDay}-fallback-{int(datetime.now(timezone.utc).timestamp())}",
        missionDay=mission.missionDay,
        timestamp=ts,
        riskLevel=risk,
        riskSummary=f"Mission status is {status}. Nutrition score: {n.nutritionalCoverageScore}, days safe: {n.daysSafe}.",
        criticalNutrientDependencies=deps,
        nutritionPreservationMode=npm_active,
        recommendedActions=actions,
        comparison=BeforeAfterComparison(
            before=before_snap,
            after=after_snap,
            delta=BeforeAfterDelta(
                caloricCoverageDelta=round(after_snap.caloricCoveragePercent - before_snap.caloricCoveragePercent, 1),
                proteinCoverageDelta=round(after_snap.proteinCoveragePercent - before_snap.proteinCoveragePercent, 1),
                scoreDelta=round(after_snap.nutritionalCoverageScore - before_snap.nutritionalCoverageScore, 1),
                daysSafeDelta=round(after_snap.daysSafe - before_snap.daysSafe, 1),
            ),
            summary=explanation,
        ),
        explanation=explanation,
        triggeredByScenario=scenario.scenarioId if scenario else None,
        kbContextUsed=False,
    )


def _overlay_llm_fields(
    *,
    base: AIDecision,
    llm_data: dict,
    kb_context_used: bool,
    preserve_emergency_narrative: bool = False,
) -> AIDecision:
    """
    Merge LLM-authored narrative fields onto the deterministic base decision.

    The backend/planner remains the source of truth for:
    - recommendedActions
    - comparison numbers
    - nutritionPreservationMode
    - triggeredByScenario

    The LLM is allowed to improve:
    - riskSummary
    - explanation
    - criticalNutrientDependencies
    - riskLevel when it remains within the canonical enum
    """
    payload = base.model_dump()

    if isinstance(llm_data.get("decisionId"), str) and llm_data["decisionId"].strip():
      payload["decisionId"] = llm_data["decisionId"].strip()

    if isinstance(llm_data.get("missionDay"), int):
      payload["missionDay"] = llm_data["missionDay"]

    if isinstance(llm_data.get("timestamp"), str) and llm_data["timestamp"].strip():
      payload["timestamp"] = llm_data["timestamp"].strip()

    if isinstance(llm_data.get("riskLevel"), str) and llm_data["riskLevel"] in _RISK_LEVELS:
      payload["riskLevel"] = llm_data["riskLevel"]

    if isinstance(llm_data.get("riskSummary"), str) and llm_data["riskSummary"].strip():
      payload["riskSummary"] = llm_data["riskSummary"].strip()

    dependencies = llm_data.get("criticalNutrientDependencies")
    if isinstance(dependencies, list):
      normalized_dependencies = [item.strip() for item in dependencies if isinstance(item, str) and item.strip()]
      if normalized_dependencies:
        payload["criticalNutrientDependencies"] = normalized_dependencies

    if isinstance(llm_data.get("explanation"), str) and llm_data["explanation"].strip():
      payload["explanation"] = llm_data["explanation"].strip()

    payload["kbContextUsed"] = kb_context_used

    return AIDecision.model_validate(payload)


def analyze(request: AnalyzeRequest) -> AIDecision:
    """
    Run incident analysis on the current mission state.
    Uses the Strands agent with tools; falls back to deterministic analysis if LLM fails.
    """
    # Always fetch current state for fallback
    raw_mission = json.loads(getMissionState._tool_func())
    raw_planner = json.loads(runPlannerAnalysis._tool_func())
    mission = MissionState.model_validate(raw_mission)
    planner = PlannerOutput.model_validate(raw_planner)

    focus_hint = ""
    if request.focus == "nutrition_risk":
        focus_hint = "\nFocus especially on nutrition coverage and days-safe metrics."
    elif request.focus == "scenario_response":
        focus_hint = "\nFocus especially on the active scenario and its impact."

    prompt = _ANALYZE_PROMPT + focus_hint
    fallback_decision = _fallback_analyze(mission, planner)
    reset_kb_usage()

    try:
        with _agent_tool_context() as tools:
            agent = _make_agent(tools)
            result = agent(prompt)
        # Strands returns an AgentResult; get the text content
        response_text = str(result)
        data = _extract_json(response_text)
        return _overlay_llm_fields(base=fallback_decision, llm_data=data)
        preserve_emergency_narrative = (
            mission.status != "nominal"
            or mission.activeScenario is not None
            or fallback_decision.riskLevel in {"high", "critical"}
        )
        return _overlay_llm_fields(
            base=fallback_decision,
            llm_data=data,
            kb_context_used=kb_was_used(),
            preserve_emergency_narrative=preserve_emergency_narrative,
        )
    except Exception as e:
        # Fallback: deterministic analysis from tool outputs
        print(f"[agent] LLM unavailable ({type(e).__name__}: {e}), using deterministic fallback")
        return fallback_decision


# ── Chat ──────────────────────────────────────────────────────────────────────

_CHAT_SYSTEM = """You are the Mars Greenhouse Mission Control AI assistant answering operator questions.

Answer format — respond with ONLY a JSON object:
{{
  "answer": "<direct answer, 1-4 sentences>",
  "relevantSection": "<dashboard section name or null>",
  "supportingFacts": ["<fact from mission state>", ...],
  "suggestedActions": ["<action if applicable>", ...],
  "followUpQuestions": ["<useful follow-up>", ...],
  "confidence": "high" | "medium" | "low"
}}

Rules:
- Use getMissionState() for current values — never invent numbers
- Use locateDashboardSection() to find where to look on the dashboard
- Use getScenarioCatalog() for scenario questions
- Use searchKnowledgeBase() for crop science questions
- Use getRecentMissionLog() for 'what changed' questions
- Keep answers concise and operational
- supportingFacts must come from tool outputs, not invented
- Return ONLY the JSON object
"""


def _fallback_chat(question: str, mission: MissionState) -> ChatResponse:
    """Deterministic fallback for chat when LLM is unavailable."""
    q = question.lower()
    n = mission.nutrition
    status = mission.status
    scenario = mission.activeScenario

    # Crop science / nutrition questions — check BEFORE zone status check
    # so "vitamins in zone A" doesn't get swallowed by the zone status branch
    _CROP_VITAMINS = {
        "lettuce": ["Vitamin A", "Vitamin K", "Folate"],
        "potato": ["Vitamin C", "Potassium", "Vitamin B6"],
        "beans": ["Iron", "Folate", "Magnesium", "Protein"],
        "radish": ["Vitamin C", "Folate"],
    }
    _CROP_ROLES = {
        "lettuce": "micronutrient stabilizer — primary source of Vitamin A, K, and folate for the crew",
        "potato": "caloric backbone — provides ~60% of daily crew calories plus Vitamin C and potassium",
        "beans": "protein security — sole source of plant protein, plus iron, folate, and magnesium",
        "radish": "fast buffer — quick 25-day cycle providing Vitamin C and morale support",
    }
    if any(w in q for w in ["vitamin", "nutrient", "mineral", "protein", "calori", "folate",
                             "iron", "potassium", "provide", "contribut", "role", "output"]):
        # Try to narrow to a specific zone/crop
        zone_id = next((f"zone-{c.upper()}" for c in ["a", "b", "c", "d"] if f"zone-{c}" in q or f"zone {c}" in q), None)
        zone = next((z for z in mission.zones if z.zoneId == zone_id), None) if zone_id else None
        crop = next((c for c in _CROP_VITAMINS if c in q), None)
        if not zone and crop:
            zone = next((z for z in mission.zones if z.cropType == crop), None)

        if zone:
            vitamins = _CROP_VITAMINS.get(zone.cropType, [])
            role = _CROP_ROLES.get(zone.cropType, "")
            return ChatResponse(
                answer=f"{zone.zoneId} ({zone.cropType}) is the {role}. Key nutrients: {', '.join(vitamins)}. Current yield: {zone.projectedYieldKg}kg (status: {zone.status}).",
                relevantSection=f"Crop Zones → {zone.zoneId}",
                supportingFacts=[
                    f"Vitamins/minerals: {', '.join(vitamins)}",
                    f"Projected yield: {zone.projectedYieldKg}kg",
                    f"Status: {zone.status}",
                ],
                confidence="high",
            )

        # General nutrition question
        return ChatResponse(
            answer=(
                f"Lettuce (zone-A) provides Vitamin A, K, folate. "
                f"Potato (zone-B) provides calories ({n.caloricCoveragePercent}% coverage) and Vitamin C. "
                f"Beans (zone-C) provide all plant protein ({n.proteinCoveragePercent}% coverage) plus iron and magnesium. "
                f"Radish (zone-D) provides Vitamin C."
            ),
            relevantSection="Nutrition Panel",
            supportingFacts=[
                f"Caloric coverage: {n.caloricCoveragePercent}%",
                f"Protein coverage: {n.proteinCoveragePercent}%",
                f"Nutrition score: {n.nutritionalCoverageScore}/100",
            ],
            confidence="high",
        )

    if any(w in q for w in ["changed", "happened", "recent", "new"]):
        recent = mission.eventLog[:3]
        facts = [e.message for e in recent]
        return ChatResponse(
            answer=f"Recent events: {facts[0] if facts else 'No recent events'}.",
            relevantSection="Event Log Panel",
            supportingFacts=facts,
            confidence="high",
        )

    if any(w in q for w in ["critical", "wrong", "why", "problem"]):
        issues = []
        if scenario:
            issues.append(f"Active scenario: {scenario.scenarioType} ({scenario.severity})")
        for z in mission.zones:
            if z.stress.active:
                issues.append(f"{z.zoneId} has {z.stress.severity} {z.stress.type} stress")
        return ChatResponse(
            answer=f"Mission status is {status}. {'; '.join(issues) if issues else 'Check nutrition and zone panels.'}",
            relevantSection="Mission Status Banner",
            supportingFacts=[f"Nutrition score: {n.nutritionalCoverageScore}", f"Days safe: {n.daysSafe}"],
            confidence="high",
        )

    # Zone status — only fires for pure status/sensor questions, not nutrition questions
    if "zone" in q and any(f"zone-{c}" in q or f"zone {c}" in q or q.endswith(f" {c}") for c in ["a", "b", "c", "d"]):
        zone_id = next((f"zone-{c.upper()}" for c in ["a", "b", "c", "d"] if f"zone-{c}" in q or f"zone {c}" in q), None)
        zone = next((z for z in mission.zones if z.zoneId == zone_id), None) if zone_id else None
        if zone:
            return ChatResponse(
                answer=f"{zone.zoneId} ({zone.cropType}) is {zone.status}. Temp: {zone.sensors.temperature}°C, moisture: {zone.sensors.soilMoisture}%. Stress: {zone.stress.type} ({zone.stress.severity}).",
                relevantSection=f"Crop Zones → {zone.zoneId}",
                supportingFacts=[
                    f"Status: {zone.status}",
                    f"Allocation: {zone.allocationPercent}%",
                    f"Projected yield: {zone.projectedYieldKg}kg",
                ],
                confidence="high",
            )

    if "bolting" in q:
        return ChatResponse(
            answer="Bolting is when lettuce prematurely flowers due to heat or long photoperiod. It destroys the harvest — the plant becomes bitter and inedible. Triggered above 25°C or 16h photoperiod.",
            relevantSection="Crop Zones → Zone A → Bolting Risk Indicator",
            supportingFacts=["Lettuce heat stress threshold: 25°C", "Bolting destroys micronutrient supply"],
            confidence="high",
        )

    if "scenario" in q:
        return ChatResponse(
            answer="4 scenarios are available: water_recycling_decline, energy_budget_reduction, temperature_control_failure, single_zone_control_failure. Each has mild/moderate/critical severity.",
            relevantSection="Scenario Panel",
            supportingFacts=["Use the Scenario panel to inject a failure and observe system response"],
            confidence="high",
        )

    if any(w in q for w in ["water recycling", "water"]):
        r = mission.resources
        return ChatResponse(
            answer=f"Water recycling efficiency is {r.waterRecyclingEfficiency}%. Reservoir: {r.waterReservoirL}L, {r.waterDaysRemaining} days remaining.",
            relevantSection="Resources Panel → Water Recycling",
            supportingFacts=[f"Target: >85%", f"Daily consumption: {r.waterDailyConsumptionL}L/day"],
            confidence="high",
        )

    if any(w in q for w in ["summarize", "summary", "overview", "right now"]):
        stressed = [z for z in mission.zones if z.stress.active]
        return ChatResponse(
            answer=f"Day {mission.missionDay}: Mission is {status}. Nutrition score {n.nutritionalCoverageScore}/100, {n.daysSafe} days safe. {'Active scenario: ' + scenario.scenarioType if scenario else 'No active scenario.'}",
            relevantSection="Mission Status Banner",
            supportingFacts=[
                f"Caloric coverage: {n.caloricCoveragePercent}%",
                f"Protein coverage: {n.proteinCoveragePercent}%",
                f"Stressed zones: {len(stressed)}",
            ],
            confidence="high",
        )

    if "planner" in q or "recommend" in q:
        return ChatResponse(
            answer="The planner uses deterministic rules to protect caloric crops (potato) first, then protein (beans), then accepts cuts to lower-priority zones. It activates Nutrition Preservation Mode when score < 70 or days-safe < 30.",
            relevantSection="AI Analysis Panel",
            supportingFacts=["NPM threshold: score < 70 or days-safe < 30"],
            suggestedActions=["Click 'Analyze' to run the AI and see current recommendations"],
            confidence="high",
        )

    # Generic fallback
    return ChatResponse(
        answer=f"Mission day {mission.missionDay}, status: {status}. Nutrition score: {n.nutritionalCoverageScore}/100, days safe: {n.daysSafe}.",
        relevantSection="Mission Status Banner",
        supportingFacts=[f"Status: {status}"],
        confidence="medium",
    )


def chat(request: ChatRequest) -> ChatResponse:
    """
    Answer a dashboard question using the Strands agent.
    Falls back to deterministic answers if LLM is unavailable.
    """
    raw_mission = json.loads(getMissionState._tool_func())
    mission = MissionState.model_validate(raw_mission)

    prompt = f"""Operator question: {request.question}

Use the available tools to answer accurately. Ground all facts in tool outputs.
Return ONLY a JSON object matching the ChatResponse schema."""
    reset_kb_usage()

    try:
        with _agent_tool_context() as tools:
            agent = Agent(
                model=_build_model(),
                system_prompt=_CHAT_SYSTEM,
                tools=tools,
            )
            result = agent(prompt)
        response_text = str(result)
        data = _extract_json(response_text)
        return ChatResponse.model_validate(data)
    except Exception as e:
        print(f"[agent] LLM unavailable ({type(e).__name__}: {e}), using deterministic fallback")
        return _fallback_chat(request.question, mission)
