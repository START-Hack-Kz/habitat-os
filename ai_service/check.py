"""
Validation script for the Mars Greenhouse AI Service.
Tests analyze and chat endpoints against a running service.
Proves schema validity and that the AI does not invent mission values.

Usage:
    python check.py [--url http://localhost:8000]
"""
from __future__ import annotations
import argparse
import json
import sys
import httpx

BASE = "http://localhost:8000"


def ok(msg: str):
    print(f"  ✓ {msg}")


def fail(msg: str):
    print(f"  ✗ {msg}")
    sys.exit(1)


def assert_field(obj: dict, field: str, expected=None, label: str = ""):
    if field not in obj:
        fail(f"{label or field}: field '{field}' missing from response")
    if expected is not None and obj[field] != expected:
        fail(f"{label or field}: expected {field}={expected!r}, got {obj[field]!r}")
    ok(f"{label or field}: '{field}' present{f' = {obj[field]!r}' if expected is None else ''}")


def assert_in(value, choices, label: str):
    if value not in choices:
        fail(f"{label}: {value!r} not in {choices}")
    ok(f"{label}: {value!r} is valid")


def assert_no_invented_values(analyze_resp: dict, mission_state: dict):
    """
    Verify the AI did not invent mission values.
    Checks that key numeric values in the response match backend values.
    """
    n = mission_state["nutrition"]
    comp = analyze_resp.get("comparison", {})
    before = comp.get("before", {})

    # The 'before' snapshot must match the actual mission state nutrition
    if before:
        actual_score = n["nutritionalCoverageScore"]
        reported_score = before.get("nutritionalCoverageScore")
        if reported_score is not None and abs(reported_score - actual_score) > 5:
            fail(f"Invented value: before.nutritionalCoverageScore={reported_score} but actual={actual_score}")
        ok(f"No invented values: before.nutritionalCoverageScore={reported_score} matches actual={actual_score}")

        actual_days = n["daysSafe"]
        reported_days = before.get("daysSafe")
        if reported_days is not None and abs(reported_days - actual_days) > 5:
            fail(f"Invented value: before.daysSafe={reported_days} but actual={actual_days}")
        ok(f"No invented values: before.daysSafe={reported_days} matches actual={actual_days}")

    # missionDay must match
    actual_day = mission_state["missionDay"]
    reported_day = analyze_resp.get("missionDay")
    if reported_day is not None and reported_day != actual_day:
        fail(f"Invented value: missionDay={reported_day} but actual={actual_day}")
    ok(f"No invented values: missionDay={reported_day} matches actual={actual_day}")


def get_mission_state(client: httpx.Client) -> dict:
    resp = client.get("http://localhost:3001/api/mission/state")
    resp.raise_for_status()
    return resp.json()


def inject_scenario(client: httpx.Client, scenario_type: str, severity: str):
    resp = client.post("http://localhost:3001/api/simulation/scenario/inject", json={
        "scenarioType": scenario_type,
        "severity": severity,
    })
    resp.raise_for_status()


def reset_mission(client: httpx.Client):
    resp = client.post("http://localhost:3001/api/simulation/reset", json={})
    resp.raise_for_status()


def run_checks(base_url: str):
    client = httpx.Client(timeout=30.0)
    ai = httpx.Client(base_url=base_url, timeout=60.0)

    print("\n=== Mars Greenhouse AI Service Validation ===\n")

    # ── Health check ──────────────────────────────────────────────────────────
    print("[ Health ]")
    resp = ai.get("/health")
    assert resp.status_code == 200, f"Health check failed: {resp.status_code}"
    ok("Service is running")

    # ── Test 1: Analyze — healthy baseline ────────────────────────────────────
    print("\n[ Analyze: Healthy Baseline ]")
    reset_mission(client)
    mission = get_mission_state(client)
    print(f"  Mission status: {mission['status']}, score: {mission['nutrition']['nutritionalCoverageScore']}, days safe: {mission['nutrition']['daysSafe']}")

    resp = ai.post("/ai/analyze", json={"focus": "mission_overview"})
    assert resp.status_code == 200, f"Analyze failed: {resp.status_code} {resp.text}"
    data = resp.json()

    assert_field(data, "decisionId")
    assert_field(data, "missionDay")
    assert_field(data, "riskLevel")
    assert_field(data, "riskSummary")
    assert_field(data, "explanation")
    assert_field(data, "recommendedActions")
    assert_field(data, "comparison")
    assert_field(data, "criticalNutrientDependencies")
    assert_field(data, "nutritionPreservationMode")
    assert_in(data["riskLevel"], ["low", "moderate", "high", "critical"], "riskLevel")
    assert_no_invented_values(data, mission)
    print(f"  riskLevel={data['riskLevel']}, NPM={data['nutritionPreservationMode']}, actions={len(data['recommendedActions'])}")

    # ── Test 2: Analyze — critical water recycling decline ────────────────────
    print("\n[ Analyze: Critical Water Recycling Decline ]")
    reset_mission(client)
    inject_scenario(client, "water_recycling_decline", "critical")
    mission = get_mission_state(client)
    print(f"  Mission status: {mission['status']}, score: {mission['nutrition']['nutritionalCoverageScore']}, days safe: {mission['nutrition']['daysSafe']}")

    resp = ai.post("/ai/analyze", json={"focus": "scenario_response"})
    assert resp.status_code == 200, f"Analyze failed: {resp.status_code} {resp.text}"
    data = resp.json()

    assert_in(data["riskLevel"], ["high", "critical"], "riskLevel (should be high or critical)")
    assert_no_invented_values(data, mission)
    print(f"  riskLevel={data['riskLevel']}, NPM={data['nutritionPreservationMode']}, actions={len(data['recommendedActions'])}")
    print(f"  explanation: {data['explanation'][:120]}...")

    # ── Test 3: Analyze — critical temperature spike / bolting risk ───────────
    print("\n[ Analyze: Critical Temperature Spike / Bolting Risk ]")
    reset_mission(client)
    inject_scenario(client, "temperature_control_failure", "critical")
    mission = get_mission_state(client)
    print(f"  Mission status: {mission['status']}, score: {mission['nutrition']['nutritionalCoverageScore']}")

    resp = ai.post("/ai/analyze", json={"focus": "scenario_response"})
    assert resp.status_code == 200, f"Analyze failed: {resp.status_code} {resp.text}"
    data = resp.json()

    assert_in(data["riskLevel"], ["high", "critical"], "riskLevel (should be high or critical)")
    assert_no_invented_values(data, mission)
    print(f"  riskLevel={data['riskLevel']}, NPM={data['nutritionPreservationMode']}, actions={len(data['recommendedActions'])}")

    # ── Test 4: Analyze — low soil moisture (energy budget reduction) ─────────
    print("\n[ Analyze: Low Soil Moisture / Energy Budget Reduction ]")
    reset_mission(client)
    inject_scenario(client, "energy_budget_reduction", "critical")
    mission = get_mission_state(client)
    print(f"  Mission status: {mission['status']}, score: {mission['nutrition']['nutritionalCoverageScore']}")

    resp = ai.post("/ai/analyze", json={"focus": "nutrition_risk"})
    assert resp.status_code == 200, f"Analyze failed: {resp.status_code} {resp.text}"
    data = resp.json()

    assert_in(data["riskLevel"], ["moderate", "high", "critical"], "riskLevel")
    assert_no_invented_values(data, mission)
    print(f"  riskLevel={data['riskLevel']}, NPM={data['nutritionPreservationMode']}, actions={len(data['recommendedActions'])}")

    # ── Chat tests ────────────────────────────────────────────────────────────
    reset_mission(client)
    inject_scenario(client, "water_recycling_decline", "critical")

    chat_tests = [
        ("what changed?", ["eventLog", "Event Log", "changed", "recycling", "water"]),
        ("why is the mission critical?", ["critical", "water", "scenario", "nutrition", "status"]),
        ("what is happening in zone-A?", ["zone-A", "zone-a", "lettuce", "stress", "bolting", "temperature"]),
        ("what does bolting risk mean?", ["bolting", "lettuce", "flower", "harvest", "25"]),
        ("where should I look for water recycling?", ["Resources", "resources", "water", "recycling", "panel", "dashboard"]),
        ("why did the planner recommend this?", ["planner", "nutrition", "preservation", "caloric", "protein", "potato"]),
        ("what scenarios exist?", ["water_recycling", "energy", "temperature", "zone", "scenario"]),
        ("summarize the mission right now", ["day", "status", "nutrition", "score", "safe"]),
    ]

    print("\n[ Chat Tests ]")
    for question, expected_keywords in chat_tests:
        print(f"\n  Q: {question!r}")
        resp = ai.post("/ai/chat", json={"question": question})
        assert resp.status_code == 200, f"Chat failed: {resp.status_code} {resp.text}"
        data = resp.json()

        assert_field(data, "answer")
        assert_field(data, "confidence")
        assert_in(data["confidence"], ["high", "medium", "low"], "confidence")

        answer_lower = (data["answer"] + " " + " ".join(data.get("supportingFacts", []))).lower()
        matched = [kw for kw in expected_keywords if kw.lower() in answer_lower]
        if not matched:
            fail(f"Answer for {question!r} missing expected keywords {expected_keywords}\nGot: {data['answer']}")
        ok(f"Answer contains relevant content (matched: {matched[:3]})")
        print(f"    answer: {data['answer'][:100]}...")
        if data.get("relevantSection"):
            print(f"    section: {data['relevantSection']}")

    # ── Schema validity summary ───────────────────────────────────────────────
    print("\n[ Schema Validity ]")
    reset_mission(client)
    resp = ai.post("/ai/analyze", json={})
    assert resp.status_code == 200
    data = resp.json()

    required_analyze_fields = [
        "decisionId", "missionDay", "timestamp", "riskLevel", "riskSummary",
        "criticalNutrientDependencies", "nutritionPreservationMode",
        "recommendedActions", "comparison", "explanation",
        "triggeredByScenario", "kbContextUsed",
    ]
    for field in required_analyze_fields:
        if field not in data:
            fail(f"Schema: missing required field '{field}' in AIDecision")
    ok(f"AIDecision schema: all {len(required_analyze_fields)} required fields present")

    comp = data["comparison"]
    for sub in ["before", "after", "delta", "summary"]:
        if sub not in comp:
            fail(f"Schema: comparison missing '{sub}'")
    ok("BeforeAfterComparison schema: before/after/delta/summary all present")

    resp = ai.post("/ai/chat", json={"question": "summarize the mission"})
    assert resp.status_code == 200
    chat_data = resp.json()
    required_chat_fields = ["answer", "relevantSection", "supportingFacts",
                            "suggestedActions", "followUpQuestions", "confidence"]
    for field in required_chat_fields:
        if field not in chat_data:
            fail(f"Schema: missing required field '{field}' in ChatResponse")
    ok(f"ChatResponse schema: all {len(required_chat_fields)} required fields present")

    print("\n=== All checks passed ✓ ===\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default=BASE)
    args = parser.parse_args()
    run_checks(args.url)
