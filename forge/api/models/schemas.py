"""Pydantic models for request/response validation."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Response model for the /health endpoint."""

    status: str


# ---------------------------------------------------------------------------
# Dataset schemas
# ---------------------------------------------------------------------------


class DatasetIngestRequest(BaseModel):
    """Request body for POST /api/datasets/ingest."""

    name: str = Field(..., min_length=1, max_length=255)
    source: str = Field(default="yfinance", pattern="^(yfinance|fred|csv_upload)$")
    tickers: list[str] = Field(..., min_length=1)
    start_date: date
    end_date: date


class DatasetResponse(BaseModel):
    """Response model for a single dataset."""

    id: UUID
    name: str
    source: str
    tickers: list[str] | None
    start_date: date | None
    end_date: date | None
    num_records: int | None
    feature_columns: list[str] | None
    created_at: datetime | None

    model_config = {"from_attributes": True}


class DatasetDetailResponse(DatasetResponse):
    """Dataset response with feature summary statistics."""

    feature_summary: dict | None = None


class DatasetListResponse(BaseModel):
    """Response model for listing datasets."""

    datasets: list[DatasetResponse]
    count: int
