"""
AWS Lambda entrypoint for the operational MCP server.

This exposes the FastMCP streamable HTTP app through Lambda so the AI service
can use a real deployed OPS_MCP_URL instead of local fallback tools.
"""
from __future__ import annotations

from mangum import Mangum

from ops_mcp_server import mcp


app = mcp.streamable_http_app()
handler = Mangum(app, lifespan="auto")
