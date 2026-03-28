"""Health check endpoint that verifies database connectivity."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from forge.api.models.database import get_db
from forge.api.models.schemas import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check(db: Session = Depends(get_db)) -> HealthResponse:
    """Return service health status after verifying database connectivity."""
    try:
        db.execute(text("SELECT 1"))
        return HealthResponse(status="ok")
    except Exception as exc:
        raise HTTPException(
            status_code=503, detail=f"Database unreachable: {exc}"
        ) from exc
