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


# ---------------------------------------------------------------------------
# Experiment / Run schemas
# ---------------------------------------------------------------------------


class RunConfigRequest(BaseModel):
    """Configuration for a single training run within an experiment."""

    run_name: str | None = None
    model_type: str = Field(..., pattern="^(xgboost|random_forest|lstm)$")
    hyperparameters: dict = Field(default_factory=dict)
    feature_engineering: dict | None = None


class ExperimentCreateRequest(BaseModel):
    """Request body for POST /api/experiments."""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    dataset_id: UUID
    runs: list[RunConfigRequest] = Field(..., min_length=1)


class RunResponse(BaseModel):
    """Response model for a single run with metrics and profiling."""

    id: UUID
    experiment_id: UUID
    run_name: str | None
    model_type: str
    hyperparameters: dict
    feature_engineering: dict | None

    # ML metrics
    accuracy: float | None = None
    precision_score: float | None = None
    recall: float | None = None
    f1: float | None = None
    train_loss: float | None = None
    val_loss: float | None = None
    test_loss: float | None = None
    custom_metrics: dict | None = None

    # Hardware profiling
    inference_latency_ms: float | None = None
    inference_latency_p95_ms: float | None = None
    peak_memory_mb: float | None = None
    model_size_mb: float | None = None
    throughput_samples_per_sec: float | None = None
    training_time_seconds: float | None = None
    efficiency_score: float | None = None

    # External integrations
    wandb_run_id: str | None = None
    s3_artifact_path: str | None = None

    status: str
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class ExperimentResponse(BaseModel):
    """Response model for an experiment (without runs)."""

    id: UUID
    name: str
    description: str | None
    dataset_id: UUID | None
    status: str
    created_at: datetime | None
    updated_at: datetime | None

    model_config = {"from_attributes": True}


class ExperimentDetailResponse(ExperimentResponse):
    """Experiment response with all associated runs."""

    runs: list[RunResponse] = []


class ExperimentListResponse(BaseModel):
    """Response model for listing experiments."""

    experiments: list[ExperimentResponse]
    count: int
