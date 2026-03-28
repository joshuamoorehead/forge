## Contract 0: Project Skeleton
**Goal:** Empty project with Docker, database, and one working endpoint.

**Acceptance Criteria:**
- [ ] Project directory structure created (see SPEC.md section 5 for layout)
- [ ] docker-compose.yml with PostgreSQL (pgvector/pgvector:pg16) + FastAPI service
- [ ] `docker-compose up` starts both services without errors
- [ ] FastAPI app has a single `/health` endpoint that returns `{"status": "ok"}`
- [ ] SQLAlchemy database connection works (health endpoint queries DB)
- [ ] Pydantic schemas file exists (can be empty with base model)
- [ ] requirements.txt with: fastapi, uvicorn, sqlalchemy, psycopg2-binary, pydantic, alembic
- [ ] .env.example file with all expected environment variables
- [ ] .gitignore appropriate for Python + Node + Docker project

**What NOT to do:**
- Don't build any real features yet
- Don't set up the frontend yet
- Don't install Airflow yet
- Don't create any tables beyond a basic connection test

**Verify:** `docker-compose up`, then `curl http://localhost:8000/health` returns 200.


## Contract 1: Database Schema + Migrations
**Goal:** All core tables created with Alembic migrations.

**Prerequisite:** Contract 0 is complete and docker-compose runs.

**Acceptance Criteria:**
- [ ] Alembic initialized and configured to use DATABASE_URL from env
- [ ] SQLAlchemy models created for: datasets, experiments, runs, ops_logs, git_events
- [ ] All columns match SPEC.md section 4 schema exactly
- [ ] pgvector extension enabled: `CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] experiment_embeddings table with vector(1536) column
- [ ] IVFFlat index on embedding column
- [ ] Initial Alembic migration generated and applies cleanly
- [ ] `alembic upgrade head` runs without errors in Docker

**What NOT to do:**
- Don't build API endpoints yet (those are next contract)
- Don't add seed data yet
- Don't worry about the Airflow database — that's separate

**Verify:** Connect to PostgreSQL, run `\dt` and see all 6 tables. 
Run `SELECT * FROM pg_extension WHERE extname = 'vector';` and see pgvector.


## Contract 2: Data Ingestion Pipeline
**Goal:** Fetch financial data from yfinance, compute features, store in DB.

**Prerequisite:** Contract 1 is complete with all tables.

**Acceptance Criteria:**
- [ ] Service: `data_ingestion.py` — fetches OHLCV data via yfinance for given tickers + date range
- [ ] Service: `feature_eng.py` — signal processing features:
  - FFT spectral decomposition (dominant frequencies, spectral entropy, SNR)
  - Rolling autocorrelation at lags [1, 5, 10, 21]
  - RSI, MACD, Bollinger Bands (standard technical indicators)
  - All features computed using numpy/scipy (NOT external TA libraries)
- [ ] FastAPI router: `datasets.py` with endpoints:
  - `POST /api/datasets/ingest` — triggers data fetch + feature computation
  - `GET /api/datasets` — list all datasets
  - `GET /api/datasets/{id}` — get dataset details with feature summary
- [ ] Pydantic request/response schemas for all endpoints
- [ ] Dataset metadata stored in `datasets` table
- [ ] Processed feature data stored (in DB or as parquet — your choice)
- [ ] Unit tests for feature_eng.py (test FFT on a known sine wave, etc.)

**What NOT to do:**
- Don't integrate S3 yet (that comes later)
- Don't build the experiment runner yet
- Don't touch the frontend

**Verify:** 
```bash
curl -X POST http://localhost:8000/api/datasets/ingest \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "source": "yfinance", "tickers": ["SPY"], "start_date": "2024-01-01", "end_date": "2024-12-31"}'
```
Should return dataset ID. `GET /api/datasets/{id}` should show metadata + feature columns.
Run `pytest tests/test_feature_eng.py` — all tests pass.

## Contract 3: Experiment Runner + Hardware Profiler
**Goal:** Train ML models on ingested data, profile performance, store results.

**Prerequisite:** Contract 2 is complete with working data ingestion.

**Acceptance Criteria:**
- [ ] Service: `training.py` — supports training these model types:
  - XGBoost (via xgboost library)
  - Random Forest (via scikit-learn)
  - LSTM (via PyTorch) — simple 2-layer LSTM for time-series
- [ ] Time-series aware train/val/test split (NO future data leakage — chronological split)
- [ ] Service: `profiler.py` — hardware-aware profiling (see SPEC.md section 6.3):
  - Mean inference latency (ms)
  - P95 inference latency (ms)
  - Peak memory usage (MB) via tracemalloc
  - Model size (MB) — serialized
  - Throughput (samples/sec)
  - Efficiency score: accuracy / (normalized_latency * normalized_memory)
- [ ] FastAPI router: `experiments.py` with endpoints:
  - `POST /api/experiments` — create experiment with run configs
  - `GET /api/experiments` — list experiments
  - `GET /api/experiments/{id}` — experiment detail with all runs + metrics
  - `POST /api/experiments/{id}/run` — trigger a specific run
- [ ] All metrics + profiling results stored in `runs` table
- [ ] Unit tests for profiler (test on a dummy sklearn model)
- [ ] Unit tests for time-series split (verify no leakage)

**What NOT to do:**
- Don't integrate W&B yet (next contract)
- Don't build Airflow DAGs yet
- Don't worry about async/background execution — synchronous is fine for now

**Verify:**
1. Ingest SPY data (from Contract 2)
2. Create experiment with XGBoost + Random Forest runs
3. Trigger runs
4. `GET /api/experiments/{id}` shows both runs with accuracy metrics AND profiling metrics
5. All tests pass
