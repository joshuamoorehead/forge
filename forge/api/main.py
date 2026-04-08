"""FastAPI application entry point."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from forge.api.routers import analysis, datasets, drift, experiments, feature_store, health, metrics, model_registry, ops, projects, webhooks

app = FastAPI(
    title="Forge",
    description="ML Experimentation & Agent Operations Platform",
    version="0.1.0",
)

_cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus auto-instrumentation: request count, latency histogram, error rate,
# in-progress requests — exposed at GET /metrics
Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

app.include_router(health.router)
app.include_router(datasets.router)
app.include_router(experiments.router)
app.include_router(ops.router)
app.include_router(webhooks.router)
app.include_router(projects.router)
app.include_router(analysis.router)
app.include_router(feature_store.router)
app.include_router(model_registry.router)
app.include_router(drift.router)
app.include_router(metrics.router)

# Railway deployment: read PORT from environment for dynamic port binding.
port = int(os.getenv("PORT", "8000"))
