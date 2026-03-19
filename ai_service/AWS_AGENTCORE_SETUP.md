# AWS Setup Guide

This project now supports the AWS-aligned split recommended by the workshop:

1. `ai_service/app.py`
   - separate AI service
   - model via Bedrock
   - KB explanations via AgentCore Gateway MCP

2. `ai_service/ops_mcp_server.py`
   - operational MCP server
   - exposes read-only mission/planner/scenario tools over MCP

## What each layer does

- Backend (`backend/`)
  - source of truth for mission state, nutrition, planner, and scenarios
- AI service (`ai_service/app.py`)
  - reasoning and explanation
- KB MCP (`KB_MCP_URL`)
  - domain explanation only
- Ops MCP (`OPS_MCP_URL`)
  - optional operational tool access through MCP

## Local test flow

1. Start backend:

```bash
PORT=3001 npm run backend:start
```

2. Start operational MCP server:

```bash
cd ai_service
source .venv/bin/activate
BACKEND_URL=http://127.0.0.1:3001 OPS_MCP_PORT=9000 python ops_mcp_server.py
```

3. Start AI service with Bedrock + KB MCP + ops MCP:

```bash
cd ai_service
source .venv/bin/activate
unset ANTHROPIC_API_KEY
unset OPENAI_API_KEY
export AWS_REGION=us-east-2
export BEDROCK_MODEL_ID=anthropic.claude-haiku-4-5-20251001-v1:0
export BACKEND_URL=http://127.0.0.1:3001
export KB_MCP_URL=https://kb-start-hack-gateway-buyjtibfpg.gateway.bedrock-agentcore.us-east-2.amazonaws.com/mcp
export OPS_MCP_URL=http://127.0.0.1:9000/mcp
uvicorn app:app --host 0.0.0.0 --port 8000
```

## Docker images

AI service:

```bash
docker build -t mars-ai-service -f ai_service/Dockerfile ai_service
```

Ops MCP server:

```bash
docker build -t mars-ops-mcp -f ai_service/Dockerfile.ops-mcp ai_service
```

## AWS deployment sequence

### Step A: Push the AI service image

Push `mars-ai-service` to ECR, then deploy it to AgentCore Runtime or another AWS runtime.

### Step B: Push the ops MCP image

Push `mars-ops-mcp` to ECR, then expose it behind AgentCore Gateway if the workshop expects agent tools to be Gateway-mediated.

### Step C: Configure runtime environment

AI service runtime:

- `AWS_REGION`
- `BEDROCK_MODEL_ID`
- `BACKEND_URL`
- `KB_MCP_URL`
- `OPS_MCP_URL`

Ops MCP runtime:

- `BACKEND_URL`
- `OPS_MCP_HOST=0.0.0.0`
- `OPS_MCP_PORT=8000`
- `OPS_MCP_PATH=/mcp`

## Architecture rule

- Backend facts win for live operational truth.
- KB MCP is explanation-only.
- Ops MCP is for operational tool access, not scientific explanation.

## Public exposure guidance

For hackathon use, expose the ops MCP server through Gateway only if you keep it read-only.
The current server is read-only by design and does not expose scenario injection, reset, or tweak tools.
