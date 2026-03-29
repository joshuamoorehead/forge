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
        raise HTTPException(
            status_code=500,
            detail=f"Agent query failed: {exc}",
        ) from exc

    return AgentQueryResponse(
        answer=result["answer"],
        tools_used=result["tools_used"],
        intermediate_results=result["intermediate_results"],
    )
