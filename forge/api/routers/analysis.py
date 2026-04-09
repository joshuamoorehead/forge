"""Router for the LangGraph analysis agent — natural language queries over data."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from forge.api.agent.graph import run_agent_query
from forge.api.models.database import get_db
from forge.api.models.schemas import AgentQueryRequest, AgentQueryResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agent", tags=["agent"])


@router.post("/query", response_model=AgentQueryResponse)
async def agent_query(
    request: AgentQueryRequest,
    db: Session = Depends(get_db),
) -> AgentQueryResponse:
    """Send a natural language question and get a response with tool calls shown.

    The agent can answer questions about experiments, run comparisons,
    ops anomalies, and efficiency frontiers by querying the database
    through its tool set.
    """
    try:
        result = run_agent_query(request.question, db)
    except Exception as exc:
        logger.exception("Agent query failed: %s", request.question)
        error_msg = str(exc).lower()
        if "insufficient_quota" in error_msg or "rate_limit" in error_msg or "429" in error_msg:
            detail = "OpenAI API quota exceeded — the agent requires a funded API key to operate."
        elif "api_key" in error_msg or "authentication" in error_msg or "401" in error_msg:
            detail = "OpenAI API key is missing or invalid — configure OPENAI_API_KEY."
        else:
            detail = f"Agent query failed: {exc}"
        raise HTTPException(status_code=502, detail=detail) from exc

    return AgentQueryResponse(
        answer=result["answer"],
        tools_used=result["tools_used"],
        intermediate_results=result["intermediate_results"],
    )
