"""FastAPI application entry point."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from forge.api.routers import analysis, datasets, experiments, health, ops, projects, webhooks

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

app.include_router(health.router)
app.include_router(datasets.router)
app.include_router(experiments.router)
app.include_router(ops.router)
app.include_router(webhooks.router)
app.include_router(projects.router)
app.include_router(analysis.router)

# Railway deployment: read PORT from environment for dynamic port binding.
port = int(os.getenv("PORT", "8000"))
