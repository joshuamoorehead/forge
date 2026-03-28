# Forge — ML Experimentation & Agent Operations Platform

## Technical Specification v1.0

**Author:** Joshua Moorehead  
**Date:** March 2026  
**Purpose:** Personal ML systems platform for financial time-series experimentation and agent project monitoring. Built to learn ML systems engineering and fill resume gaps for ML/Data Engineering internship applications.

---

## 1. Project Overview

Forge is a two-part platform:

### Forge Lab (ML Experimentation Workbench)
A system for running, tracking, and comparing ML experiments on financial time-series data. The key differentiator is **hardware-aware profiling** — every experiment tracks not just accuracy/loss, but inference latency, memory usage, and throughput, enabling deployment tradeoff analysis.

### Forge Ops (Agent & Project Observatory)  
A monitoring system that ingests logs, Git activity, and API call traces from personal AI projects (e.g., Marcus). Surfaces anomalies, tracks costs, and provides a dashboard of agent activity. Includes a LangChain-powered analysis agent for natural language queries over experiment and ops data.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Next.js Frontend                   │
│         (Dashboard: experiments, ops, agent chat)     │
└──────────────────────┬──────────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────────┐
│                  FastAPI Backend                      │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ Experiments  │  │  Ops/Monitor │  │  Analysis    │ │
│  │   Router     │  │    Router    │  │  Agent Router│ │
│  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘ │
└─────────┼────────────────┼─────────────────┼────────┘
          │                │                 │
┌─────────▼────────┐ ┌────▼───────┐  ┌──────▼────────┐
│  Airflow DAGs    │ │  Webhook   │  │  LangChain/   │
│  (orchestrate    │ │  Listener  │  │  LangGraph    │
│   training)      │ │  (Git,logs)│  │  Agent        │
└─────────┬────────┘ └────┬───────┘  └──────┬────────┘
          │                │                 │
┌─────────▼────────────────▼─────────────────▼────────┐
│              PostgreSQL + pgvector                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │
│  │ experiments │  │  ops_logs  │  │  embeddings    │  │
│  │ runs       │  │  git_events│  │  (pgvector)    │  │
│  │ metrics    │  │  costs     │  │                │  │
│  └────────────┘  └────────────┘  └────────────────┘  │
└──────────────────────────────────────────────────────┘
          │                │
┌─────────▼────────┐ ┌────▼───────┐
│   W&B             │ │  AWS S3    │
│  (experiment      │ │  (artifacts│
│   tracking)       │ │   storage) │
└──────────────────┘ └────────────┘
```

---

## 3. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **API Backend** | FastAPI (Python) | REST API, WebSocket for live updates |
| **Frontend** | Next.js + React + Tailwind CSS | Dashboard UI |
| **Database** | PostgreSQL + pgvector | Structured data + vector similarity search |
| **Pipeline Orchestration** | Apache Airflow | DAGs for training pipelines, data ingestion |
| **Experiment Tracking** | Weights & Biases (W&B) | Metrics logging, run comparison |
| **ML Frameworks** | PyTorch, scikit-learn, XGBoost | Model training |
| **Agent/Intelligence** | LangChain + LangGraph | Natural language query agent over experiments |
| **Cloud Storage** | AWS S3 | Model checkpoints, dataset artifacts |
| **Containerization** | Docker + docker-compose | Full stack orchestration |
| **CI/CD** | GitHub Actions | Automated testing, linting, container builds |
| **Deployment Configs** | Kubernetes manifests | Production-ready deployment definitions |
| **Data Sources** | Yahoo Finance (yfinance), FRED API | Financial time-series data |

---

## 4. Database Schema

### Core Tables

```sql
-- Financial datasets ingested from APIs
CREATE TABLE datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    source VARCHAR(50) NOT NULL,  -- 'yfinance', 'fred', 'csv_upload'
    tickers TEXT[],                -- e.g., ['AAPL', 'GOOGL', 'SPY']
    start_date DATE,
    end_date DATE,
    num_records INTEGER,
    feature_columns TEXT[],
    s3_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Experiment definitions
CREATE TABLE experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    dataset_id UUID REFERENCES datasets(id),
    status VARCHAR(20) DEFAULT 'pending',  -- pending, running, completed, failed
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Individual training runs within an experiment
CREATE TABLE runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID REFERENCES experiments(id),
    run_name VARCHAR(255),
    model_type VARCHAR(50) NOT NULL,  -- 'xgboost', 'lstm', 'transformer', 'random_forest'
    hyperparameters JSONB NOT NULL,
    feature_engineering JSONB,  -- DSP params: window_size, fft_bins, etc.
    
    -- ML Metrics
    train_loss FLOAT,
    val_loss FLOAT,
    test_loss FLOAT,
    accuracy FLOAT,
    precision_score FLOAT,
    recall FLOAT,
    f1 FLOAT,
    custom_metrics JSONB,  -- sharpe_ratio, max_drawdown, etc.
    
    -- Hardware-Aware Profiling (ECE differentiator)
    inference_latency_ms FLOAT,       -- mean inference time
    inference_latency_p95_ms FLOAT,   -- 95th percentile
    peak_memory_mb FLOAT,             -- peak RAM usage during inference
    model_size_mb FLOAT,              -- serialized model size
    throughput_samples_per_sec FLOAT,  -- inference throughput
    flops_estimate BIGINT,            -- estimated FLOPs per inference
    training_time_seconds FLOAT,
    
    -- Deployment tradeoff score (custom metric)
    efficiency_score FLOAT,  -- accuracy / (latency * memory) normalized
    
    wandb_run_id VARCHAR(100),
    s3_artifact_path VARCHAR(500),
    status VARCHAR(20) DEFAULT 'pending',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Ops monitoring: agent/project logs
CREATE TABLE ops_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name VARCHAR(100) NOT NULL,  -- 'marcus', 'forge', etc.
    log_level VARCHAR(10),  -- 'INFO', 'WARN', 'ERROR', 'CRITICAL'
    message TEXT,
    metadata JSONB,  -- structured context
    source VARCHAR(100),  -- 'github_webhook', 'agent_log', 'api_trace'
    cost_usd FLOAT,  -- for LLM API calls
    created_at TIMESTAMP DEFAULT NOW()
);

-- Git events from webhooks
CREATE TABLE git_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo VARCHAR(255) NOT NULL,
    event_type VARCHAR(50),  -- 'push', 'pr_opened', 'pr_merged', 'issue'
    branch VARCHAR(100),
    commit_sha VARCHAR(40),
    commit_message TEXT,
    author VARCHAR(100),
    files_changed INTEGER,
    additions INTEGER,
    deletions INTEGER,
    payload JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- pgvector embeddings for semantic search over experiments
CREATE TABLE experiment_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES runs(id),
    content_type VARCHAR(50),  -- 'run_summary', 'error_log', 'config'
    content_text TEXT,
    embedding vector(1536),  -- OpenAI ada-002 dimension
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for vector similarity search
CREATE INDEX ON experiment_embeddings USING ivfflat (embedding vector_cosine_ops);
```

---

## 5. FastAPI Backend Structure

```
forge/
├── api/
│   ├── main.py                 # FastAPI app, CORS, lifespan
│   ├── routers/
│   │   ├── experiments.py      # CRUD for experiments and runs
│   │   ├── datasets.py         # Data ingestion endpoints
│   │   ├── ops.py              # Ops log ingestion and querying
│   │   ├── webhooks.py         # Git webhook receiver
│   │   ├── analysis.py         # LangChain agent query endpoint
│   │   └── health.py           # Health check
│   ├── models/
│   │   ├── schemas.py          # Pydantic models
│   │   └── database.py         # SQLAlchemy models + connection
│   ├── services/
│   │   ├── training.py         # Model training orchestration
│   │   ├── profiler.py         # Hardware-aware profiling module
│   │   ├── data_ingestion.py   # yfinance, FRED data fetchers
│   │   ├── feature_eng.py      # Signal processing feature engineering
│   │   ├── wandb_tracker.py    # W&B integration
│   │   ├── s3_client.py        # AWS S3 artifact storage
│   │   ├── embeddings.py       # pgvector embedding generation
│   │   └── anomaly.py          # Ops log anomaly detection
│   └── agent/
│       ├── graph.py            # LangGraph agent definition
│       ├── tools.py            # Agent tools (query DB, compare runs, etc.)
│       └── prompts.py          # System prompts for analysis agent
├── airflow/
│   └── dags/
│       ├── ingest_market_data.py    # Daily market data ingestion
│       ├── run_experiment.py        # Triggered experiment training
│       └── ops_digest.py           # Daily ops summary generation
├── frontend/
│   ├── app/
│   │   ├── page.tsx                # Dashboard home
│   │   ├── experiments/
│   │   │   ├── page.tsx            # Experiment list
│   │   │   └── [id]/page.tsx       # Experiment detail + run comparison
│   │   ├── ops/
│   │   │   └── page.tsx            # Ops monitoring dashboard
│   │   └── agent/
│   │       └── page.tsx            # Chat interface for analysis agent
│   ├── components/
│   │   ├── RunComparisonChart.tsx   # Side-by-side run metrics
│   │   ├── EfficiencyFrontier.tsx   # Accuracy vs latency scatter plot
│   │   ├── OpsTimeline.tsx         # Log timeline with anomaly highlights
│   │   ├── CostTracker.tsx         # LLM API spend over time
│   │   └── AgentChat.tsx           # Chat UI for LangChain agent
│   └── lib/
│       └── api.ts                  # API client
├── k8s/
│   ├── deployment.yaml             # K8s deployment manifests
│   ├── service.yaml
│   ├── configmap.yaml
│   └── ingress.yaml
├── docker-compose.yml              # Full stack: API, DB, Airflow, frontend
├── Dockerfile.api
├── Dockerfile.frontend
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Lint, test, type-check
│       └── docker-build.yml       # Build and push containers
├── pyproject.toml
├── requirements.txt
└── README.md
```

---

## 6. Key Features — Detailed Specs

### 6.1 Data Ingestion Pipeline

**Endpoint:** `POST /api/datasets/ingest`

```json
{
  "name": "SP500 2020-2025",
  "source": "yfinance",
  "tickers": ["SPY", "AAPL", "GOOGL", "MSFT", "AMZN"],
  "start_date": "2020-01-01",
  "end_date": "2025-12-31",
  "features": ["close", "volume", "rsi", "macd", "bollinger"]
}
```

**Pipeline steps:**
1. Fetch raw OHLCV data via yfinance
2. Compute technical indicators (RSI, MACD, Bollinger Bands)
3. Apply signal processing features (ECE differentiator):
   - FFT spectral decomposition (frequency-domain features)
   - Wavelet transform for multi-scale pattern detection
   - Rolling autocorrelation for momentum signals
   - Signal-to-noise ratio estimation
4. Store raw data to S3, processed features to PostgreSQL
5. Log dataset metadata to database

### 6.2 Experiment Runner

**Endpoint:** `POST /api/experiments/create`

```json
{
  "name": "LSTM vs XGBoost on SPY volatility",
  "dataset_id": "uuid-here",
  "runs": [
    {
      "model_type": "lstm",
      "hyperparameters": {
        "hidden_size": 128,
        "num_layers": 2,
        "dropout": 0.2,
        "learning_rate": 0.001,
        "epochs": 50,
        "batch_size": 32
      },
      "feature_engineering": {
        "window_size": 30,
        "use_fft_features": true,
        "fft_top_k": 5,
        "normalize": "z-score"
      }
    },
    {
      "model_type": "xgboost",
      "hyperparameters": {
        "n_estimators": 500,
        "max_depth": 6,
        "learning_rate": 0.1
      },
      "feature_engineering": {
        "window_size": 30,
        "use_fft_features": true,
        "fft_top_k": 5,
        "normalize": "z-score"
      }
    }
  ]
}
```

**Execution flow (Airflow DAG):**
1. Load dataset from PostgreSQL/S3
2. Apply feature engineering pipeline
3. Train/val/test split (time-series aware — no future leakage)
4. Train model
5. Evaluate metrics (MSE, MAE, directional accuracy, Sharpe ratio)
6. **Run hardware profiling** (see 6.3)
7. Log everything to W&B
8. Save model artifact to S3
9. Generate embedding of run summary → pgvector
10. Update database with results

### 6.3 Hardware-Aware Profiling (ECE Differentiator)

This is the module that separates this project from generic ML pipeline projects. For every trained model, Forge automatically measures:

```python
# forge/api/services/profiler.py

import time
import tracemalloc
import torch
import numpy as np
from dataclasses import dataclass

@dataclass
class ProfileResult:
    inference_latency_ms: float        # Mean over N samples
    inference_latency_p95_ms: float    # 95th percentile
    peak_memory_mb: float              # Peak memory during inference
    model_size_mb: float               # Serialized model size
    throughput_samples_per_sec: float   # Samples processed per second
    flops_estimate: int                # Estimated FLOPs (for PyTorch models)
    efficiency_score: float            # accuracy / (normalized_latency * normalized_memory)

def profile_model(model, sample_input, n_iterations=100):
    """
    Run hardware-aware profiling on a trained model.
    Measures latency distribution, memory footprint, and throughput.
    """
    latencies = []
    
    # Warmup
    for _ in range(10):
        _ = model.predict(sample_input) if hasattr(model, 'predict') else model(sample_input)
    
    # Latency profiling
    tracemalloc.start()
    for _ in range(n_iterations):
        start = time.perf_counter_ns()
        _ = model.predict(sample_input) if hasattr(model, 'predict') else model(sample_input)
        end = time.perf_counter_ns()
        latencies.append((end - start) / 1e6)  # Convert to ms
    
    current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    
    latencies = np.array(latencies)
    
    return ProfileResult(
        inference_latency_ms=float(np.mean(latencies)),
        inference_latency_p95_ms=float(np.percentile(latencies, 95)),
        peak_memory_mb=peak / 1024 / 1024,
        model_size_mb=get_model_size(model),
        throughput_samples_per_sec=1000.0 / float(np.mean(latencies)),
        flops_estimate=estimate_flops(model, sample_input),
        efficiency_score=0.0  # Computed after accuracy is known
    )
```

**Resume bullet:** "Designed hardware-aware ML profiling module measuring inference latency distributions, memory footprint, and throughput, enabling accuracy-vs-compute tradeoff analysis for deployment decisions."

### 6.4 Signal Processing Feature Engineering (ECE Differentiator)

```python
# forge/api/services/feature_eng.py

import numpy as np
from scipy import signal as sig
from scipy.fft import fft, fftfreq

def extract_spectral_features(price_series: np.ndarray, top_k: int = 5):
    """
    Extract frequency-domain features from financial time-series.
    ECE approach: treat price data as a discrete-time signal.
    """
    # Detrend to remove DC component
    detrended = sig.detrend(price_series)
    
    # FFT - extract dominant frequency components
    N = len(detrended)
    yf = fft(detrended)
    xf = fftfreq(N, d=1.0)
    
    # Power spectral density
    psd = np.abs(yf[:N//2])**2
    
    # Top-K dominant frequencies and their magnitudes
    top_indices = np.argsort(psd)[-top_k:]
    dominant_freqs = xf[top_indices]
    dominant_powers = psd[top_indices]
    
    # Signal-to-noise ratio
    signal_power = np.sum(dominant_powers)
    noise_power = np.sum(psd) - signal_power
    snr = 10 * np.log10(signal_power / noise_power) if noise_power > 0 else float('inf')
    
    return {
        'dominant_frequencies': dominant_freqs.tolist(),
        'dominant_powers': dominant_powers.tolist(),
        'spectral_entropy': compute_spectral_entropy(psd),
        'snr_db': snr,
        'spectral_centroid': np.sum(xf[:N//2] * psd) / np.sum(psd),
    }

def extract_wavelet_features(price_series: np.ndarray):
    """Multi-scale decomposition for capturing patterns at different time horizons."""
    # Implementation using pywt
    pass

def compute_rolling_autocorrelation(series: np.ndarray, lags: list = [1, 5, 10, 21]):
    """Momentum signal via autocorrelation at different lags."""
    return {f'autocorr_lag_{lag}': np.corrcoef(series[lag:], series[:-lag])[0,1] for lag in lags}
```

### 6.5 Forge Ops — Agent Monitoring

**Git Webhook Receiver:**
`POST /api/webhooks/github`

Receives GitHub webhook payloads, extracts structured events, stores in `git_events` table.

**Log Ingestion:**
`POST /api/ops/logs`

```json
{
  "project_name": "marcus",
  "log_level": "INFO",
  "message": "Research digest agent completed daily run",
  "metadata": {
    "articles_processed": 15,
    "tokens_used": 12500,
    "cost_usd": 0.03,
    "duration_seconds": 45
  }
}
```

**Anomaly Detection:**
Simple statistical anomaly detection on ops metrics — flag when cost spikes, error rates increase, or agent behavior deviates from baseline. Uses rolling z-score approach.

### 6.6 LangChain/LangGraph Analysis Agent

An agent that can answer natural language questions about your experiments and ops data by querying the database and performing analysis.

**Endpoint:** `POST /api/agent/query`

```json
{
  "question": "Which model had the best accuracy-to-latency ratio on the SPY dataset?"
}
```

**Agent tools:**
1. `query_experiments` — SQL queries against experiment/run tables
2. `compare_runs` — Side-by-side comparison of two runs
3. `search_similar` — pgvector semantic search over run summaries
4. `get_ops_summary` — Summarize ops activity for a time period
5. `compute_efficiency_frontier` — Find Pareto-optimal runs (accuracy vs. latency)

**LangGraph structure:**
```
User Query → Router → [SQL Tool | Vector Search | Comparison Tool] → Synthesize → Response
```

---

## 7. Frontend Pages

### Dashboard Home (`/`)
- Summary cards: total experiments, active runs, ops alerts, weekly cost
- Recent experiment results (mini table)
- Ops health indicator

### Experiments (`/experiments`)
- List of experiments with status, dataset, date
- Create new experiment form
- Click to view experiment detail

### Experiment Detail (`/experiments/[id]`)
- **Run comparison table:** All runs with metrics + profiling side by side
- **Efficiency frontier chart:** Scatter plot of accuracy vs. inference latency (Pareto curve highlighted)
- **Training curves:** Loss over epochs (from W&B data)
- **Feature importance:** For tree models

### Ops Dashboard (`/ops`)
- **Timeline:** Log events with severity coloring
- **Cost tracker:** Cumulative LLM API spend over time
- **Git activity:** Commits, PRs by project
- **Anomaly alerts:** Flagged events

### Agent Chat (`/agent`)
- Chat interface to query the LangChain agent
- Shows tool calls and reasoning transparently
- Can reference experiments by name

---

## 8. Docker Compose

```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://forge:forge@db:5432/forge
      - WANDB_API_KEY=${WANDB_API_KEY}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - S3_BUCKET=forge-artifacts
    depends_on:
      - db
    volumes:
      - ./forge:/app/forge

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
    depends_on:
      - api

  db:
    image: pgvector/pgvector:pg16
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=forge
      - POSTGRES_PASSWORD=forge
      - POSTGRES_DB=forge
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql

  airflow-webserver:
    image: apache/airflow:2.8.1
    ports:
      - "8080:8080"
    environment:
      - AIRFLOW__CORE__EXECUTOR=LocalExecutor
      - AIRFLOW__DATABASE__SQL_ALCHEMY_CONN=postgresql://forge:forge@db:5432/airflow
    volumes:
      - ./airflow/dags:/opt/airflow/dags
    depends_on:
      - db
    command: >
      bash -c "airflow db init && airflow webserver"

  airflow-scheduler:
    image: apache/airflow:2.8.1
    environment:
      - AIRFLOW__CORE__EXECUTOR=LocalExecutor
      - AIRFLOW__DATABASE__SQL_ALCHEMY_CONN=postgresql://forge:forge@db:5432/airflow
    volumes:
      - ./airflow/dags:/opt/airflow/dags
    depends_on:
      - db
    command: airflow scheduler

volumes:
  pgdata:
```

---

## 9. GitHub Actions CI/CD

```yaml
# .github/workflows/ci.yml
name: Forge CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: forge
          POSTGRES_PASSWORD: forge
          POSTGRES_DB: forge_test
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -r requirements.txt
      - run: pytest tests/ -v --cov=forge
      - run: ruff check forge/

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -f Dockerfile.api -t forge-api .
      - run: docker build -f Dockerfile.frontend -t forge-frontend ./frontend
```

---

## 10. Kubernetes Manifests

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: forge-api
  labels:
    app: forge
    component: api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: forge
      component: api
  template:
    metadata:
      labels:
        app: forge
        component: api
    spec:
      containers:
        - name: forge-api
          image: forge-api:latest
          ports:
            - containerPort: 8000
          envFrom:
            - configMapRef:
                name: forge-config
            - secretRef:
                name: forge-secrets
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          readinessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 5
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 10
```

---

## 11. Build Plan (3 Sessions)

### Session 1: Foundation (3-4 hours)
**Goal:** API skeleton + database + data ingestion + basic experiment runner

1. Initialize project structure (see directory layout above)
2. Set up docker-compose with PostgreSQL (pgvector) + FastAPI
3. Create SQLAlchemy models and Alembic migrations
4. Build data ingestion service (yfinance integration)
5. Build signal processing feature engineering module
6. Create basic experiment runner (train XGBoost on financial data)
7. Add hardware profiler module
8. Create FastAPI endpoints for datasets and experiments
9. Test: ingest SPY data, run one experiment, see results in DB

### Session 2: Infrastructure + Intelligence (3-4 hours)  
**Goal:** Airflow, W&B, LangChain agent, ops monitoring

1. Add Airflow to docker-compose
2. Create DAGs: data ingestion, experiment runner
3. Integrate W&B tracking into training pipeline
4. Set up AWS S3 for artifact storage
5. Build webhook receiver for GitHub events
6. Build ops log ingestion endpoint
7. Create LangChain/LangGraph agent with tools
8. Add pgvector embeddings for semantic search
9. Test: trigger experiment via Airflow, query agent about results

### Session 3: Frontend + Polish (3-4 hours)
**Goal:** Dashboard, K8s configs, CI/CD, documentation

1. Create Next.js app with Tailwind
2. Build dashboard pages (experiments, ops, agent chat)
3. Add efficiency frontier visualization (accuracy vs. latency scatter)
4. Add run comparison charts
5. Create Kubernetes manifests
6. Set up GitHub Actions CI/CD
7. Write README with architecture diagram
8. Add API documentation (FastAPI auto-docs)
9. Final testing and polish

---

## 12. Resume Bullet Templates

### For Data Engineering Resume:
- "Built Forge, a financial time-series ML platform with automated ETL from market APIs, Airflow-orchestrated training pipelines, PostgreSQL + pgvector storage, and W&B experiment tracking."
- "Designed signal processing feature engineering pipeline applying FFT spectral decomposition and wavelet transforms to financial time-series data, differentiating from standard ML approaches."

### For ML/AI Resume:
- "Architected an ML experimentation platform with hardware-aware profiling (latency, memory, throughput), LangChain/LangGraph analysis agent, and efficiency frontier visualization for deployment tradeoff analysis."
- "Implemented multi-model comparison system across XGBoost, LSTM, and Transformer architectures on financial data, with automated hyperparameter tracking via W&B and artifact versioning on S3."

### For SWE/Systems Resume:
- "Designed and deployed a containerized ML systems platform (FastAPI, Next.js, PostgreSQL, Airflow) with Docker Compose orchestration, GitHub Actions CI/CD, and Kubernetes deployment manifests."

---

## 13. Keywords Covered

This project adds the following to your resume that you currently don't have:

**Tier 1-2 gaps filled:** FastAPI, RAG/vector databases (pgvector), Airflow, W&B experiment tracking

**Tier 3 gaps filled:** Kubernetes manifests, monitoring/observability, data quality/validation, Terraform (stretch)

**ECE differentiators:** Signal processing (FFT, wavelets), hardware-aware profiling, systems-level thinking about compute-accuracy tradeoffs

**Domain signal:** Financial time-series, technical indicators, market data APIs

---

## 14. Environment Variables Needed

```env
# .env
DATABASE_URL=postgresql://forge:forge@localhost:5432/forge
WANDB_API_KEY=your_wandb_key
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_S3_BUCKET=forge-artifacts
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key  # for LangChain agent
```

**Free tier notes:**
- W&B: Free for personal use
- AWS S3: Free tier includes 5GB
- yfinance: Free, no API key needed
- OpenAI: You'll need some credits for embeddings + agent (minimal cost)
- PostgreSQL + pgvector: Local via Docker (free)
- Airflow: Local via Docker (free)