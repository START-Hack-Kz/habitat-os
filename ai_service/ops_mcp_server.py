"""
Operational MCP server for Mars Greenhouse Mission Control.

This exposes read-only mission tools over MCP so the AI service can access
operational state through an MCP endpoint instead of direct backend calls.
"""
from __future__ import annotations

import os
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

load_dotenv()

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3001")


def _resolve_ops_binding() -> tuple[str, int, str]:
    configured_url = (os.getenv("OPS_MCP_URL") or "").strip()
    if configured_url:
        parsed = urlparse(configured_url)
        host = os.getenv("OPS_MCP_HOST") or parsed.hostname or "0.0.0.0"
        port = int(os.getenv("OPS_MCP_PORT") or parsed.port or 8000)
        path = os.getenv("OPS_MCP_PATH") or parsed.path or "/mcp"
        return host, port, path

    host = os.getenv("OPS_MCP_HOST", "0.0.0.0")
    port = int(os.getenv("OPS_MCP_PORT", "8000"))
    path = os.getenv("OPS_MCP_PATH", "/mcp")
    return host, port, path


MCP_HOST, MCP_PORT, MCP_PATH = _resolve_ops_binding()

_client = httpx.Client(base_url=BACKEND_URL, timeout=10.0)

mcp = FastMCP(
    name="mars-greenhouse-ops",
    instructions=(
        "Read-only operational tools for Mars Greenhouse Mission Control. "
        "Use these for current mission state, planner output, scenario catalog, "
        "and recent event history. Do not treat these tools as scientific KB."
    ),
    host=MCP_HOST,
    port=MCP_PORT,
    streamable_http_path=MCP_PATH,
    stateless_http=True,
)


def _get(path: str):
    resp = _client.get(path)
    resp.raise_for_status()
    return resp.json()


def _post(path: str, body: dict | None = None):
    resp = _client.post(path, json=body or {})
    resp.raise_for_status()
    return resp.json()


@mcp.tool(
    description=(
        "Fetch the current full mission state from the backend. "
        "Returns mission status, crop zones with sensors and stress, resources, nutrition, "
        "active scenario, and event log."
    )
)
def getMissionState() -> dict:
    return _get("/api/mission/state")


@mcp.tool(
    description=(
        "Fetch the recent mission event log summary. "
        "Returns mission day, mission status, and the most recent event log entries."
    )
)
def getRecentMissionLog() -> dict:
    data = _get("/api/mission/state")
    return {
        "missionDay": data.get("missionDay"),
        "status": data.get("status"),
        "eventLog": data.get("eventLog", [])[:10],
    }


@mcp.tool(
    description=(
        "Run the deterministic planner analysis on the current mission state. "
        "Returns planner changes, stress flags, nutrition risk detection, and projected mission state."
    )
)
def runPlannerAnalysis() -> dict:
    return _post("/api/planner/analyze")


@mcp.tool(
    description=(
        "Fetch the predefined scenario catalog for the Mars greenhouse simulation. "
        "Returns available scenarios, severities, affected resources, and risk descriptions."
    )
)
def getScenarioCatalog() -> dict | list:
    return _get("/api/scenarios")


if __name__ == "__main__":
    print(f"[ops-mcp] starting — backend: {BACKEND_URL} — listen: http://{MCP_HOST}:{MCP_PORT}{MCP_PATH}")
    mcp.run(transport="streamable-http")
