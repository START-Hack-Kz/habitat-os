# AETHER

AETHER is a full operational system for a Mars greenhouse.

It combines:

- a live mission dashboard
- a deterministic greenhouse backend
- an AI companion for incident analysis and operator Q&A
- MCP-backed knowledge retrieval
- scenario injection, sensor remediation, and plant-health triage workflows

The system is designed to simulate how a Mars greenhouse would actually be operated under resource pressure, environmental drift, crop stress, and mission nutrition constraints.

## What The Project Does

AETHER models a four-zone controlled-environment greenhouse on Mars:

- Zone A: lettuce
- Zone B: potato
- Zone C: beans
- Zone D: radish

The platform tracks:

- environmental sensors per zone
- resource state such as water, energy, and nutrients
- projected crop yield
- crew nutrition output
- incident logs and operator notifications
- AI-generated explanations and recommended actions

It also supports:

- failure scenario injection
- deterministic planner responses
- AI companion analysis
- MCP knowledge-base grounding
- separate plant-health decisions for individual plants

## Architecture

The project is split into four main parts.

### 1. Frontend
- Vite + TypeScript
- renders the dashboard, logs, companion, and operational views

### 2. Backend
- Fastify + TypeScript
- source of truth for mission state, scenarios, sensors, planner results, and nutrition math

### 3. AI Service
- FastAPI + Python
- provides `/ai/analyze`, `/ai/chat`, and plant-health AI routes
- supports Anthropic, Bedrock, and OpenAI providers

### 4. MCP Layer
- KB MCP via AWS AgentCore Gateway
- optional local operational MCP server for mission/planner/scenario reads

## Core Features

- Live Mars greenhouse dashboard
- Deterministic mission-state engine
- Nutrition calculation based on projected yields
- AI scenario analysis and explanation
- Sensor-only auto-remediation
- Plant-level disease triage workflow
- ElevenLabs voice companion embedding

## Tech Stack

- Node.js
- TypeScript
- Vite
- Fastify
- Python 3
- FastAPI
- Strands Agents
- MCP
- Anthropic or Bedrock

## Prerequisites

Install these first:

- Node.js 20+ recommended
- npm
- Python 3.11+ recommended
- `pip`
- optional: `python3-venv`

If you want Bedrock:

- AWS credentials in your shell

If you want Anthropic direct:

- an Anthropic API key

## Installation

### 1. Install frontend/backend dependencies

From the repo root:

```bash
npm install
```

### 2. Create the Python environment

```bash
cd ai_service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Configure AI service environment

Create the AI env file:

```bash
cd /home/ezo/Documents/Projects/habitat-os/ai_service
cp .env.example .env
```

Then edit `ai_service/.env`.

Minimal Anthropic setup:

```env
BACKEND_URL=http://127.0.0.1:3001
MODEL_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_key_here
ANTHROPIC_MODEL_ID=claude-haiku-4-5-20251001

KB_MCP_URL=https://kb-start-hack-gateway-buyjtibfpg.gateway.bedrock-agentcore.us-east-2.amazonaws.com/mcp
OPS_MCP_URL=http://127.0.0.1:9000/mcp

AI_MAX_TOKENS=5000
AI_TEMPERATURE=0.2
```

Minimal Bedrock setup:

```env
BACKEND_URL=http://127.0.0.1:3001
MODEL_PROVIDER=bedrock
AWS_REGION=us-east-2
BEDROCK_MODEL_ID=amazon.nova-pro-v1:0
BEDROCK_STREAMING=false

KB_MCP_URL=https://kb-start-hack-gateway-buyjtibfpg.gateway.bedrock-agentcore.us-east-2.amazonaws.com/mcp
OPS_MCP_URL=http://127.0.0.1:9000/mcp

AI_MAX_TOKENS=5000
AI_TEMPERATURE=0.2
```

## How To Run

Use four terminals for the full local setup.

### Terminal 1: backend

```bash
cd /home/ezo/Documents/Projects/habitat-os
npm run backend:start
```

Backend default:

- `http://127.0.0.1:3001`

### Terminal 2: operational MCP server

```bash
cd /home/ezo/Documents/Projects/habitat-os/ai_service
source .venv/bin/activate
BACKEND_URL=http://127.0.0.1:3001 OPS_MCP_PORT=9000 python ops_mcp_server.py
```

Ops MCP default:

- `http://127.0.0.1:9000/mcp`

### Terminal 3: AI service

```bash
cd /home/ezo/Documents/Projects/habitat-os/ai_service
source .venv/bin/activate
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

AI service default:

- `http://127.0.0.1:8000`

### Terminal 4: frontend

```bash
cd /home/ezo/Documents/Projects/habitat-os
npm run dev
```

Frontend default:

- usually `http://127.0.0.1:5173`

## Minimal Run Modes

### Dashboard only

If you only want the dashboard and backend without AI:

```bash
npm run backend:start
npm run dev
```

### Dashboard + AI without MCP

If you do not want the ops MCP server:

- leave `OPS_MCP_URL` unset in `ai_service/.env`, or
- do not start the MCP server

The AI service will fall back to direct backend reads.

### Full recommended local mode

Run:

- backend
- ops MCP server
- AI service
- frontend

That gives you:

- live mission state
- MCP-backed operational reads
- MCP KB retrieval
- AI analysis and chat

## Health Checks

### Backend

```bash
curl http://127.0.0.1:3001/health
```

### AI service

```bash
curl http://127.0.0.1:8000/health
```

### Mission state

```bash
curl -s http://127.0.0.1:3001/api/mission/state | jq '{status, missionDay, score: .nutrition.nutritionalCoverageScore, daysSafe: .nutrition.daysSafe}'
```

### AI analyze

```bash
curl -s -X POST http://127.0.0.1:8000/ai/analyze \
  -H 'content-type: application/json' \
  -d '{"focus":"scenario_response"}' | jq '{riskLevel, riskSummary, explanation}'
```

## Useful Test Curls

### Reset the simulation

```bash
curl -s -X POST http://127.0.0.1:3001/api/simulation/reset \
  -H 'content-type: application/json' \
  -d '{}'
```

### Inject water recycling decline

```bash
curl -s -X POST http://127.0.0.1:3001/api/simulation/scenario/inject \
  -H 'content-type: application/json' \
  -d '{"scenarioType":"water_recycling_decline","severity":"critical"}'
```

### Inject energy shortage

```bash
curl -s -X POST http://127.0.0.1:3001/api/simulation/scenario/inject \
  -H 'content-type: application/json' \
  -d '{"scenarioType":"energy_budget_reduction","severity":"critical"}'
```

### Inject single-zone control failure

```bash
curl -s -X POST http://127.0.0.1:3001/api/simulation/scenario/inject \
  -H 'content-type: application/json' \
  -d '{"scenarioType":"single_zone_control_failure","severity":"critical","affectedZones":["zone-C"]}'
```

### Trigger sensor-only drift

```bash
curl -s -X POST http://127.0.0.1:3001/api/simulation/tweak \
  -H 'content-type: application/json' \
  -d '{"zones":[{"zoneId":"zone-A","temperature":32,"humidity":35}]}'
```

### Trigger plant-health scan in zone A

```bash
curl -s -X POST http://127.0.0.1:3001/api/plants/health-check/trigger \
  -H 'content-type: application/json' \
  -d '{"zoneId":"zone-A","rowNo":3,"plantNo":4,"colorStressScore":0.88,"wiltingScore":0.91,"lesionScore":0.67,"growthDeclineScore":0.85}'
```

## Build

To build the frontend:

```bash
npm run build
```

To preview the production frontend locally:

```bash
npm run preview
```

## Knowledge Base

The project includes a local knowledge-base structure for AI and voice-agent workflows under `docs/kb`.

Those files document:

- greenhouse runtime logic
- crop and stress knowledge
- nutrition model
- operational scenarios
- voice-agent behavior

## Notes

- The backend is the source of truth for live numbers.
- The planner is deterministic.
- The AI layer explains and prioritizes; it should not invent values.
- MCP is used for knowledge-base grounding and can also be used for operational tool access.

## Troubleshooting

### Port already in use

If you see `EADDRINUSE`, something is already running on that port.

Example:

```bash
lsof -ti :3001 | xargs kill -9
```

### AI service cannot import app

You are probably outside the Python virtual environment.

Use:

```bash
cd ai_service
source .venv/bin/activate
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

### AI falls back instead of using MCP

Make sure the ops MCP server is running:

```bash
cd ai_service
source .venv/bin/activate
BACKEND_URL=http://127.0.0.1:3001 OPS_MCP_PORT=9000 python ops_mcp_server.py
```

### Bedrock access denied

That is usually an AWS IAM or organization policy issue, not a code issue.

If you need fast local progress:

- use `MODEL_PROVIDER=anthropic`

## Project Status

This repository is an operational Mars greenhouse simulation and control interface, not a static mockup.

It already includes:

- mission-state computation
- planner logic
- nutrition forecasting
- AI incident explanation
- plant-level intervention workflow
- dashboard and operator UX
