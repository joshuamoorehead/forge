# Forge

**Live Demo:** [forgelab.up.railway.app](https://forgelab.up.railway.app)

**ML Experimentation & Agent Operations Platform for Financial Time-Series**

Forge is a full-stack platform for running, tracking, and analyzing machine learning experiments on financial data. It combines automated data ingestion, hardware-aware model profiling, operational monitoring, and a natural language analysis agent — all orchestrated through Airflow and exposed via a modern dashboard.

Built as a portfolio project to demonstrate end-to-end ML engineering: from raw market data to trained models with production-grade profiling, CI/CD, and Kubernetes-ready infrastructure.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                   │
│            Dashboard · Projects · Experiments · Agent       │
│                        localhost:3000                        │
└────────────────────────────┬────────────────────────────────┘
                             │ REST API
┌────────────────────────────▼────────────────────────────────┐
│                     FastAPI Backend                          │
│  ┌──────────┐ ┌────────────┐ ┌──────┐ ┌─────────────────┐  │
│  │ Datasets │ │ Experiments│ │ Ops  │ │ Analysis Agent  │  │
│  │ Ingest   │ │ Training   │ │ Logs │ │ (LangGraph)     │  │
│  │ Features │ │ Profiling  │ │ Git  │ │ NL Queries      │  │
│  └────┬─────┘ └─────┬──────┘ └──┬───┘ └────────┬────────┘  │
│       │              │           │               │           │
│  ┌────▼──────────────▼───────────▼───────────────▼────────┐ │
│  │              PostgreSQL 16 + pgvector                  │ │
│  └────────────────────────────────────────────────────────┘ │
│                        localhost:8000                        │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                   Apache Airflow                            │
│         DAGs: ingest_market_data · run_experiment           │
│                  ops_digest                                  │
│                   localhost:8080                             │
└─────────────────────────────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         ┌────────┐   ┌──────────┐   ┌──────────┐
         │  W&B   │   │  AWS S3  │   │ OpenAI   │
         │Tracking│   │Artifacts │   │Embeddings│
         └────────┘   └──────────┘   └──────────┘
```

## Tech Stack

| Layer          | Technology                            |
|----------------|---------------------------------------|
| Backend        | FastAPI (Python 3.11)                 |
| Frontend       | Next.js 14 + React + Tailwind CSS     |
| Database       | PostgreSQL 16 + pgvector              |
| ML Models      | PyTorch, scikit-learn, XGBoost        |
| Agent          | LangChain + LangGraph                 |
| Orchestration  | Apache Airflow                        |
| Tracking       | Weights & Biases                      |
| Cloud Storage  | AWS S3                                |
| Containers     | Docker + docker-compose               |
| CI/CD          | GitHub Actions                        |
| Infrastructure | Kubernetes manifests                  |

## Features

- **Data Ingestion** — Fetch OHLCV data from yfinance, compute signal processing features (FFT, spectral entropy, autocorrelation) and technical indicators (RSI, MACD, Bollinger Bands)
- **Experiment Runner** — Train XGBoost, Random Forest, and LSTM models with time-series aware splits (no future data leakage)
- **Hardware Profiler** — Measure inference latency (mean/P95), peak memory, throughput, and compute an efficiency score
- **Ops Monitoring** — Ingest operational logs, GitHub webhook events, and detect anomalies via rolling z-score
- **Analysis Agent** — Natural language queries over experiment and ops data using LangGraph with semantic search via pgvector
- **Airflow DAGs** — Orchestrate daily data ingestion, experiment runs, and ops digests
- **Dashboard** — Projects hub, experiment comparison, efficiency frontier charts, and agent chat interface

## Quick Start

### Prerequisites

- Docker and docker-compose
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/joshuamoorehead/forge.git
cd forge

# Copy environment variables
cp .env.example .env
# Edit .env with your API keys (W&B, AWS, OpenAI — all optional)

# Start all services
docker-compose up --build
```

### Access

| Service           | URL                          |
|-------------------|------------------------------|
| Dashboard         | http://localhost:3000         |
| API               | http://localhost:8000         |
| API Docs (Swagger)| http://localhost:8000/docs    |
| Airflow           | http://localhost:8080         |

Default Airflow credentials: `admin` / `admin`

## API Overview

The FastAPI backend exposes a comprehensive REST API. Full interactive documentation is available at [`/docs`](http://localhost:8000/docs) when the server is running.

Key endpoint groups:

| Prefix              | Description                                    |
|----------------------|------------------------------------------------|
| `/health`            | Health check                                   |
| `/api/datasets`      | Data ingestion and dataset management          |
| `/api/experiments`   | Experiment creation and run management         |
| `/api/ops`           | Operational log ingestion and querying         |
| `/api/webhooks`      | GitHub webhook receiver                        |
| `/api/projects`      | Project aggregation and health status          |
| `/api/activity`      | Cross-project activity feed                    |
| `/api/agent`         | Natural language analysis queries              |

## Project Structure

```
forge/
├── forge/api/              # FastAPI backend
│   ├── main.py             # App entry point
│   ├── routers/            # API route handlers
│   ├── services/           # Business logic
│   ├── models/             # SQLAlchemy + Pydantic models
│   └── agent/              # LangGraph analysis agent
├── frontend/               # Next.js dashboard
├── airflow/dags/           # Airflow DAG definitions
├── alembic/                # Database migrations
├── tests/                  # pytest test suite
├── k8s/                    # Kubernetes manifests
├── .github/workflows/      # CI/CD pipelines
├── docker-compose.yml      # Development stack
└── Dockerfile.api          # API container (multi-stage)
```

## License

MIT
