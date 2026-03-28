"""SQLAlchemy database engine, session factory, models, and FastAPI dependency."""

import os
import uuid
from collections.abc import Generator

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    ARRAY,
    BigInteger,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    create_engine,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Session, declarative_base, sessionmaker
from sqlalchemy.sql import func

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://forge:forge@localhost:5432/forge"
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session and closes it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> bool:
    """Run a simple query to verify the database is reachable."""
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return True


# ---------------------------------------------------------------------------
# Models — match SPEC.md Section 4 exactly
# ---------------------------------------------------------------------------


class Dataset(Base):
    """Financial datasets ingested from APIs."""

    __tablename__ = "datasets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    name = Column(String(255), nullable=False)
    source = Column(String(50), nullable=False)
    tickers = Column(ARRAY(Text))
    start_date = Column(Date)
    end_date = Column(Date)
    num_records = Column(Integer)
    feature_columns = Column(ARRAY(Text))
    s3_path = Column(String(500))
    created_at = Column(DateTime, server_default=func.now())


class Experiment(Base):
    """Experiment definitions grouping multiple training runs."""

    __tablename__ = "experiments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    name = Column(String(255), nullable=False)
    description = Column(Text)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"))
    status = Column(String(20), server_default="pending")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now())


class Run(Base):
    """Individual training runs within an experiment."""

    __tablename__ = "runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    experiment_id = Column(UUID(as_uuid=True), ForeignKey("experiments.id"))
    run_name = Column(String(255))
    model_type = Column(String(50), nullable=False)
    hyperparameters = Column(JSONB, nullable=False)
    feature_engineering = Column(JSONB)

    # ML Metrics
    train_loss = Column(Float)
    val_loss = Column(Float)
    test_loss = Column(Float)
    accuracy = Column(Float)
    precision_score = Column(Float)
    recall = Column(Float)
    f1 = Column(Float)
    custom_metrics = Column(JSONB)

    # Hardware-Aware Profiling
    inference_latency_ms = Column(Float)
    inference_latency_p95_ms = Column(Float)
    peak_memory_mb = Column(Float)
    model_size_mb = Column(Float)
    throughput_samples_per_sec = Column(Float)
    flops_estimate = Column(BigInteger)
    training_time_seconds = Column(Float)

    # Deployment tradeoff score
    efficiency_score = Column(Float)

    wandb_run_id = Column(String(100))
    s3_artifact_path = Column(String(500))
    status = Column(String(20), server_default="pending")
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())


class OpsLog(Base):
    """Ops monitoring: agent/project logs."""

    __tablename__ = "ops_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    project_name = Column(String(100), nullable=False)
    log_level = Column(String(10))
    message = Column(Text)
    metadata_ = Column("metadata", JSONB)
    source = Column(String(100))
    cost_usd = Column(Float)
    created_at = Column(DateTime, server_default=func.now())


class GitEvent(Base):
    """Git events from webhooks."""

    __tablename__ = "git_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    repo = Column(String(255), nullable=False)
    event_type = Column(String(50))
    branch = Column(String(100))
    commit_sha = Column(String(40))
    commit_message = Column(Text)
    author = Column(String(100))
    files_changed = Column(Integer)
    additions = Column(Integer)
    deletions = Column(Integer)
    payload = Column(JSONB)
    created_at = Column(DateTime, server_default=func.now())


class ExperimentEmbedding(Base):
    """pgvector embeddings for semantic search over experiments."""

    __tablename__ = "experiment_embeddings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    run_id = Column(UUID(as_uuid=True), ForeignKey("runs.id"))
    content_type = Column(String(50))
    content_text = Column(Text)
    embedding = Column(Vector(1536))
    created_at = Column(DateTime, server_default=func.now())


# IVFFlat index for vector similarity search
ix_experiment_embeddings_embedding = Index(
    "ix_experiment_embeddings_embedding",
    ExperimentEmbedding.embedding,
    postgresql_using="ivfflat",
    postgresql_with={"lists": 100},
    postgresql_ops={"embedding": "vector_cosine_ops"},
)
