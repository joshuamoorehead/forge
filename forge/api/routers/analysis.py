"""Router for the LangGraph analysis agent — natural language queries over data."""

import logging
import os
import time
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from forge.api.agent.graph import run_agent_query
from forge.api.models.database import get_db
from forge.api.models.schemas import AgentQueryRequest, AgentQueryResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agent", tags=["agent"])

# ---------------------------------------------------------------------------
# Auth: optional AGENT_API_KEY Bearer token gate
# ---------------------------------------------------------------------------

AGENT_API_KEY = os.getenv("AGENT_API_KEY", "")


def _verify_agent_auth(request: Request) -> None:
    """Raise 401 if AGENT_API_KEY is set and the request doesn't match."""
    if not AGENT_API_KEY:
        return  # No key configured — open access (local dev)
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer ") or auth_header[7:] != AGENT_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing AGENT_API_KEY Bearer token.")


# ---------------------------------------------------------------------------
# Rate limiting: 10 requests per minute per IP
# ---------------------------------------------------------------------------

_rate_limit_store: dict[str, list[float]] = defaultdict(list)
AGENT_RATE_LIMIT = 10
AGENT_RATE_WINDOW = 60  # seconds


def _check_rate_limit(client_ip: str) -> bool:
    """Return True if the request is allowed, False if rate-limited."""
    now = time.time()
    timestamps = _rate_limit_store[client_ip]
    _rate_limit_store[client_ip] = [t for t in timestamps if now - t < AGENT_RATE_WINDOW]
    if len(_rate_limit_store[client_ip]) >= AGENT_RATE_LIMIT:
        return False
    _rate_limit_store[client_ip].append(now)
    return True


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post("/query", response_model=AgentQueryResponse)
async def agent_query(
    request: Request,
    body: AgentQueryRequest,
    db: Session = Depends(get_db),
) -> AgentQueryResponse:
    """Send a natural language question and get a response with tool calls shown.

    Protected by optional AGENT_API_KEY Bearer token and per-IP rate limiting.
    """
    _verify_agent_auth(request)

    client_ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if not client_ip:
        client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded — max 10 requests per minute.")

    try:
        result = run_agent_query(body.question, db)
    except Exception as exc:
        logger.exception("Agent query failed: %s", body.question)
        error_msg = str(exc).lower()
        if "insufficient_quota" in error_msg or "rate_limit" in error_msg or "429" in error_msg or "overloaded" in error_msg:
            detail = "LLM API quota exceeded — the agent requires a funded API key to operate."
        elif "api_key" in error_msg or "authentication" in error_msg or "401" in error_msg:
            detail = "Anthropic API key is missing or invalid — configure ANTHROPIC_API_KEY."
        else:
            detail = f"Agent query failed: {exc}"
        raise HTTPException(status_code=502, detail=detail) from exc

    return AgentQueryResponse(
        answer=result["answer"],
        tools_used=result["tools_used"],
        intermediate_results=result["intermediate_results"],
    )
