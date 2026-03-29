"""LangChain tool implementations for the Forge analysis agent.

Five tools that query experiments, runs, ops logs, and embeddings
in the PostgreSQL database and return formatted results.
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from langchain_core.tools import tool
from sqlalchemy import text
from sqlalchemy.orm import Session

from forge.api.models.database import Experiment, OpsLog, Run
from forge.api.services.embeddings import search_similar_runs

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _format_run_row(run: Run) -> dict:
    """Convert a Run ORM object into a serialisable dict of key fields."""
    return {
        "run_id": str(run.id),
        "experiment_id": str(run.experiment_id),
        "run_name": run.run_name,
        "model_type": run.model_type,
        "accuracy": run.accuracy,
        "f1": run.f1,
        "precision": run.precision_score,
        "recall": run.recall,
        "inference_latency_ms": run.inference_latency_ms,
        "inference_latency_p95_ms": run.inference_latency_p95_ms,
        "peak_memory_mb": run.peak_memory_mb,
        "model_size_mb": run.model_size_mb,
        "throughput_samples_per_sec": run.throughput_samples_per_sec,
        "efficiency_score": run.efficiency_score,
        "training_time_seconds": run.training_time_seconds,
        "status": run.status,
        "hyperparameters": run.hyperparameters,
    }


# ---------------------------------------------------------------------------
# Tool factories — each returns a closure bound to a db session
# ---------------------------------------------------------------------------


def make_query_experiments_tool(db: Session):
    """Create the query_experiments tool bound to a DB session."""

    @tool
    def query_experiments(query: str) -> str:
        """Search experiments and their runs. The query can be a model type
        (e.g. 'xgboost'), experiment name keyword, or 'all' to list everything.
        Returns experiment names with their runs and key metrics."""
        experiments = db.query(Experiment).all()

        results = []
        for exp in experiments:
            if query.lower() not in ("all", "") and query.lower() not in (exp.name or "").lower():
                # Check if query matches any run model_type in this experiment
                runs = db.query(Run).filter(Run.experiment_id == exp.id).all()
                matching_runs = [r for r in runs if query.lower() in (r.model_type or "").lower()]
                if not matching_runs:
                    continue
            else:
                runs = db.query(Run).filter(Run.experiment_id == exp.id).all()
                matching_runs = runs

            exp_info = {
                "experiment_id": str(exp.id),
                "name": exp.name,
                "description": exp.description,
                "status": exp.status,
                "runs": [_format_run_row(r) for r in matching_runs],
            }
            results.append(exp_info)

        if not results:
            return f"No experiments found matching '{query}'."

        return json.dumps(results, indent=2, default=str)

    return query_experiments


def make_compare_runs_tool(db: Session):
    """Create the compare_runs tool bound to a DB session."""

    @tool
    def compare_runs(run_id_1: str, run_id_2: str) -> str:
        """Compare two runs side-by-side. Takes two run UUIDs and returns
        a detailed comparison of their metrics, profiling, and configuration."""
        try:
            run1 = db.query(Run).filter(Run.id == UUID(run_id_1)).first()
            run2 = db.query(Run).filter(Run.id == UUID(run_id_2)).first()
        except ValueError:
            return "Error: invalid run ID format. Provide valid UUIDs."

        if run1 is None:
            return f"Error: run {run_id_1} not found."
        if run2 is None:
            return f"Error: run {run_id_2} not found."

        r1 = _format_run_row(run1)
        r2 = _format_run_row(run2)

        comparison = {
            "run_1": r1,
            "run_2": r2,
            "differences": {},
        }

        # Highlight metric differences
        metric_keys = [
            "accuracy", "f1", "precision", "recall",
            "inference_latency_ms", "peak_memory_mb",
            "efficiency_score", "throughput_samples_per_sec",
        ]
        for key in metric_keys:
            v1 = r1.get(key)
            v2 = r2.get(key)
            if v1 is not None and v2 is not None:
                diff = v1 - v2
                winner = "run_1" if (diff > 0 if key != "inference_latency_ms" else diff < 0) else "run_2"
                comparison["differences"][key] = {
                    "run_1": v1,
                    "run_2": v2,
                    "delta": round(diff, 6),
                    "better": winner,
                }

        return json.dumps(comparison, indent=2, default=str)

    return compare_runs


def make_search_similar_tool(db: Session):
    """Create the search_similar tool bound to a DB session."""

    @tool
    def search_similar(query: str) -> str:
        """Semantic search over experiment run summaries using pgvector embeddings.
        Returns the most similar runs to the natural language query."""
        results = search_similar_runs(query, db, limit=5)
        if not results:
            return "No embeddings found. Embeddings may not have been generated yet (requires OPENAI_API_KEY)."
        return json.dumps(results, indent=2, default=str)

    return search_similar


def make_get_ops_summary_tool(db: Session):
    """Create the get_ops_summary tool bound to a DB session."""

    @tool
    def get_ops_summary(hours: int = 24) -> str:
        """Summarize ops activity for the given time period (default: last 24 hours).
        Returns log counts by project and level, total cost, and any anomalies."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

        logs = db.query(OpsLog).filter(OpsLog.created_at >= cutoff).all()

        if not logs:
            return f"No ops logs found in the last {hours} hours."

        total_cost = sum(log.cost_usd or 0 for log in logs)
        by_project: dict[str, int] = {}
        by_level: dict[str, int] = {}
        errors = []

        for log in logs:
            by_project[log.project_name] = by_project.get(log.project_name, 0) + 1
            level = log.log_level or "UNKNOWN"
            by_level[level] = by_level.get(level, 0) + 1
            if level in ("ERROR", "CRITICAL"):
                errors.append({
                    "project": log.project_name,
                    "message": log.message,
                    "cost_usd": log.cost_usd,
                    "created_at": str(log.created_at),
                })

        # Simple anomaly detection on costs
        costs = [log.cost_usd for log in logs if log.cost_usd is not None]
        anomalous_costs = []
        if len(costs) > 5:
            import numpy as np
            mean_cost = np.mean(costs)
            std_cost = np.std(costs)
            if std_cost > 0:
                for log in logs:
                    if log.cost_usd is not None:
                        zscore = abs((log.cost_usd - mean_cost) / std_cost)
                        if zscore > 2.5:
                            anomalous_costs.append({
                                "project": log.project_name,
                                "cost_usd": log.cost_usd,
                                "z_score": round(zscore, 2),
                                "message": log.message,
                            })

        summary = {
            "time_period_hours": hours,
            "total_logs": len(logs),
            "total_cost_usd": round(total_cost, 4),
            "by_project": by_project,
            "by_level": by_level,
            "error_details": errors[:10],
            "cost_anomalies": anomalous_costs,
        }

        return json.dumps(summary, indent=2, default=str)

    return get_ops_summary


def make_compute_efficiency_frontier_tool(db: Session):
    """Create the compute_efficiency_frontier tool bound to a DB session."""

    @tool
    def compute_efficiency_frontier(top_n: int = 10) -> str:
        """Find Pareto-optimal runs on the accuracy vs. latency frontier.
        A run is Pareto-optimal if no other run is both more accurate AND
        faster. Returns the frontier runs sorted by accuracy descending."""
        runs = (
            db.query(Run)
            .filter(
                Run.status == "completed",
                Run.accuracy.isnot(None),
                Run.inference_latency_ms.isnot(None),
            )
            .all()
        )

        if not runs:
            return "No completed runs with both accuracy and latency data found."

        # Build Pareto frontier: keep runs where no other run dominates
        run_data = [
            {
                "run_id": str(r.id),
                "run_name": r.run_name,
                "model_type": r.model_type,
                "accuracy": r.accuracy,
                "inference_latency_ms": r.inference_latency_ms,
                "efficiency_score": r.efficiency_score,
                "peak_memory_mb": r.peak_memory_mb,
            }
            for r in runs
        ]

        frontier = []
        for candidate in run_data:
            dominated = False
            for other in run_data:
                if other is candidate:
                    continue
                # other dominates candidate if it's better or equal on both axes
                # and strictly better on at least one
                better_acc = other["accuracy"] >= candidate["accuracy"]
                better_lat = other["inference_latency_ms"] <= candidate["inference_latency_ms"]
                strictly_better = (
                    other["accuracy"] > candidate["accuracy"]
                    or other["inference_latency_ms"] < candidate["inference_latency_ms"]
                )
                if better_acc and better_lat and strictly_better:
                    dominated = True
                    break
            if not dominated:
                frontier.append(candidate)

        frontier.sort(key=lambda r: r["accuracy"], reverse=True)
        frontier = frontier[:top_n]

        result = {
            "total_completed_runs": len(run_data),
            "frontier_size": len(frontier),
            "pareto_frontier": frontier,
        }

        return json.dumps(result, indent=2, default=str)

    return compute_efficiency_frontier


def build_tools(db: Session) -> list:
    """Build all five agent tools bound to the given database session."""
    return [
        make_query_experiments_tool(db),
        make_compare_runs_tool(db),
        make_search_similar_tool(db),
        make_get_ops_summary_tool(db),
        make_compute_efficiency_frontier_tool(db),
    ]
