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


# ---------------------------------------------------------------------------
# Ops Log schemas
# ---------------------------------------------------------------------------


class OpsLogCreateRequest(BaseModel):
    """Request body for POST /api/ops/logs."""

    project_name: str = Field(..., min_length=1, max_length=100)
    log_level: str = Field(default="INFO", pattern="^(DEBUG|INFO|WARN|ERROR|CRITICAL)$")
    message: str = Field(..., min_length=1)
    metadata: dict | None = None
    source: str | None = None
    cost_usd: float | None = None


class OpsLogResponse(BaseModel):
    """Response model for a single ops log entry."""

    id: UUID
    project_name: str
    log_level: str | None
    message: str | None
    metadata: dict | None = None
    source: str | None = None
    cost_usd: float | None = None
    is_anomaly: bool = False
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class OpsLogListResponse(BaseModel):
    """Response model for listing ops logs."""

    logs: list[OpsLogResponse]
    count: int


class OpsLogSummaryResponse(BaseModel):
    """Aggregate stats for ops logs."""

    total_logs: int
    error_count: int
    total_cost_usd: float
    events_by_project: dict[str, int]
    events_by_level: dict[str, int]


# ---------------------------------------------------------------------------
# GitHub Webhook schemas
# ---------------------------------------------------------------------------


class GitHubCommit(BaseModel):
    """A single commit within a GitHub push event."""

    id: str
    message: str | None = None
    author: dict | None = None
    added: list[str] = Field(default_factory=list)
    removed: list[str] = Field(default_factory=list)
    modified: list[str] = Field(default_factory=list)

    model_config = {"extra": "allow"}


class GitHubPushPayload(BaseModel):
    """GitHub push webhook payload (subset of fields we care about)."""

    ref: str
    repository: dict | None = None
    commits: list[GitHubCommit] = Field(default_factory=list)
    pusher: dict | None = None

    model_config = {"extra": "allow"}


class GitEventResponse(BaseModel):
    """Response model for a stored git event."""

    id: UUID
    repo: str
    event_type: str | None
    branch: str | None
    commit_sha: str | None
    commit_message: str | None
    author: str | None
    files_changed: int | None
    additions: int | None
    deletions: int | None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class GitEventListResponse(BaseModel):
    """Response model for listing git events."""

    events: list[GitEventResponse]
    count: int


# ---------------------------------------------------------------------------
# Agent / Analysis schemas
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Project / Activity Feed schemas
# ---------------------------------------------------------------------------


class ProjectSummary(BaseModel):
    """Summary stats for a single project (virtual aggregation over ops_logs + git_events)."""

    name: str
    commit_count_7d: int = 0
    total_cost_7d: float = 0.0
    error_count_7d: int = 0
    last_activity: datetime | None = None
    health: str = "green"  # green / yellow / red


class ProjectListResponse(BaseModel):
    """Response model for GET /api/projects."""

    projects: list[ProjectSummary]
    count: int


class ProjectDetailResponse(BaseModel):
    """Detailed view of a single project with recent logs, git events, and linked experiments."""

    name: str
    recent_logs: list["OpsLogResponse"]
    git_events: list["GitEventResponse"]
    linked_experiments: list["ExperimentResponse"]


class ActivityFeedItem(BaseModel):
    """A single item in the interleaved activity timeline."""

    type: str  # "git_commit" | "ops_log" | "experiment_completion"
    timestamp: datetime
    project: str | None = None
    summary: str
    detail: dict | None = None


class ActivityFeedResponse(BaseModel):
    """Response model for GET /api/activity/feed."""

    items: list[ActivityFeedItem]
    count: int


class DashboardSummaryResponse(BaseModel):
    """Aggregate stats for the dashboard home page."""

    total_projects: int
    active_experiments: int
    ops_alerts_24h: int
    weekly_llm_cost: float


# ---------------------------------------------------------------------------
# Agent / Analysis schemas
# ---------------------------------------------------------------------------


class AgentQueryRequest(BaseModel):
    """Request body for POST /api/agent/query."""

    question: str = Field(..., min_length=1, max_length=2000)


class IntermediateResult(BaseModel):
    """A single tool call result from the agent's reasoning chain."""

    tool: str
    result_preview: str


class AgentQueryResponse(BaseModel):
    """Response from the analysis agent including reasoning transparency."""

    answer: str
    tools_used: list[str] = Field(default_factory=list)
    intermediate_results: list[IntermediateResult] = Field(default_factory=list)
