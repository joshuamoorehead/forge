"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from forge.api.routers import analysis, datasets, experiments, health, ops, webhooks

app = FastAPI(
    title="Forge",
    description="ML Experimentation & Agent Operations Platform",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(datasets.router)
app.include_router(experiments.router)
app.include_router(ops.router)
app.include_router(webhooks.router)
app.include_router(analysis.router)
