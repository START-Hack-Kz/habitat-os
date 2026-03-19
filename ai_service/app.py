"""
Mars Greenhouse AI Service — FastAPI application.
Provides /ai/analyze and /ai/chat endpoints.
"""
from __future__ import annotations
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from models import AIDecision, AnalyzeRequest, ChatRequest, ChatResponse
import agent as ai_agent


def _parse_cors_origins() -> list[str]:
    configured = os.getenv("AI_CORS_ORIGINS", "")
    origins = [origin.strip() for origin in configured.split(",") if origin.strip()]
    return origins or [
        "http://localhost:3000",
        "http://localhost:4176",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:4176",
        "http://127.0.0.1:5173",
    ]


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"[ai-service] starting — backend: {os.getenv('BACKEND_URL', 'http://localhost:3001')}")
    yield
    print("[ai-service] shutdown")


app = FastAPI(
    title="Mars Greenhouse AI Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors_origins(),
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "mars-greenhouse-ai"}


@app.post("/ai/analyze", response_model=AIDecision)
def analyze(request: AnalyzeRequest = AnalyzeRequest()):
    """
    Analyze the current mission state.
    Reads mission state and planner output via tools, then produces a structured
    incident analysis with risk level, recommended actions, before/after comparison,
    and a plain-language explanation.
    """
    try:
        return ai_agent.analyze(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    """
    Answer a dashboard question.
    Uses mission state, planner output, scenario catalog, and KB stub to answer
    operator questions about the current dashboard state.
    """
    try:
        return ai_agent.chat(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
