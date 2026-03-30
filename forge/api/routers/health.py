"""Health check endpoint that verifies database connectivity."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from forge.api.models.database import get_db
from forge.api.models.schemas import HealthResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check(db: Session = Depends(get_db)) -> HealthResponse:
    """Return service health status after verifying database connectivity."""
    try:
        db.execute(text("SELECT 1"))
        return HealthResponse(status="ok")
    except Exception as exc:
        logger.exception("Health check failed — database unreachable")
        raise HTTPException(
            status_code=503, detail="Database unreachable"
        ) from exc
