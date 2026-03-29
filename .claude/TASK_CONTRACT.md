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

## Contract 4: W&B Integration + S3 Artifacts
**Goal:** Experiment runs log to W&B and save model artifacts to S3.

**Prerequisite:** Contract 3 is complete with working experiment runner.

**Acceptance Criteria:**
- [ ] Service: `wandb_tracker.py` — wraps W&B logging:
  - Initialize run with experiment name + hyperparameters
  - Log training metrics per epoch (for PyTorch models)
  - Log final metrics + profiling results
  - Log hyperparameters as W&B config
- [ ] Service: `s3_client.py` — AWS S3 integration:
  - Upload model artifacts (serialized models) to S3
  - Upload dataset artifacts to S3
  - Generate presigned URLs for download
  - S3 path stored in `runs.s3_artifact_path`
- [ ] W&B run ID stored in `runs.wandb_run_id`
- [ ] Both integrations are optional — if API keys not set, gracefully skip (don't crash)
- [ ] Update training.py to call both services after training completes

**What NOT to do:**
- Don't build Airflow yet
- Don't modify the experiment API — just add integrations to existing training flow
- If you don't have AWS credentials, use localstack or mock S3

**Verify:**
1. Set WANDB_API_KEY in .env
2. Run an experiment
3. Check W&B dashboard — run appears with metrics
4. Check S3 (or localstack) — model artifact exists
5. `runs` table has wandb_run_id and s3_artifact_path populated

## Contract 5: Ops Monitoring (Logs + Git Webhooks)
**Goal:** Ingest and store operational logs and GitHub events.

**Prerequisite:** Contract 1 is complete (needs ops_logs and git_events tables).

**Acceptance Criteria:**
- [ ] FastAPI router: `ops.py`:
  - `POST /api/ops/logs` — ingest a log entry (project_name, level, message, metadata, cost_usd)
  - `GET /api/ops/logs` — query logs with filters (project, level, date range)
  - `GET /api/ops/summary` — aggregate stats (error count, total cost, events by project)
- [ ] FastAPI router: `webhooks.py`:
  - `POST /api/webhooks/github` — receive GitHub webhook payload
  - Parse push events: extract repo, branch, commit SHA, message, author, files changed
  - Store parsed events in git_events table
- [ ] Service: `anomaly.py` — simple anomaly detection:
  - Rolling z-score on ops metrics (cost, error rate)
  - Flag entries where z-score > 2.5 as anomalous
  - Add `is_anomaly` field to log query responses
- [ ] Unit tests for anomaly detection (test with known anomalous data)

**What NOT to do:**
- Don't build the frontend dashboard yet
- Don't set up actual GitHub webhook delivery yet (test with curl)
- Don't try to parse every GitHub event type — just push events for now

**Verify:**
```bash
# Send a test log
curl -X POST http://localhost:8000/api/ops/logs \
  -H "Content-Type: application/json" \
  -d '{"project_name": "marcus", "log_level": "INFO", "message": "test", "cost_usd": 0.05}'

# Send 20 normal logs then one expensive one
# GET /api/ops/logs should flag the expensive one as anomalous

# Send a fake GitHub webhook
curl -X POST http://localhost:8000/api/webhooks/github \
  -H "Content-Type: application/json" \
  -d '{"ref": "refs/heads/main", "commits": [{"id": "abc123", "message": "test commit"}]}'
```
## Contract 6: LangChain/LangGraph Analysis Agent
**Goal:** Natural language query interface over experiment and ops data.

**Prerequisite:** Contracts 3 and 5 are complete (needs experiment data + ops data in DB).

**Acceptance Criteria:**
- [ ] Service: `agent/graph.py` — LangGraph agent with these tools:
  - `query_experiments` — runs SQL against experiments/runs tables, returns formatted results
  - `compare_runs` — takes two run IDs, returns side-by-side comparison
  - `search_similar` — semantic search over experiment embeddings via pgvector
  - `get_ops_summary` — summarize ops activity for a time period
  - `compute_efficiency_frontier` — find Pareto-optimal runs (accuracy vs. latency)
- [ ] Service: `agent/tools.py` — tool implementations with proper error handling
- [ ] Service: `embeddings.py` — generate OpenAI embeddings for run summaries, store in pgvector
- [ ] Embeddings generated automatically when a run completes (update training.py)
- [ ] FastAPI router: `analysis.py`:
  - `POST /api/agent/query` — send question, get response with tool calls shown
  - Response includes: answer text, tools used, intermediate results
- [ ] Agent can answer questions like:
  - "Which model had the best accuracy on SPY?"
  - "Compare run X and run Y"
  - "What's the most efficient model (best accuracy per latency)?"
  - "Show me ops anomalies from the last 24 hours"

**What NOT to do:**
- Don't build a chat UI yet (that's the frontend contract)
- Don't add streaming — simple request/response is fine
- Don't over-engineer the agent — 5 tools is plenty

**Verify:**
1. Have at least 3-4 completed experiment runs in DB
2. Have some ops logs in DB
3. Test agent queries via curl and verify responses are sensible
4. Verify embeddings exist in experiment_embeddings table

## Contract 7: Airflow DAGs
**Goal:** Orchestrate data ingestion and experiment training via Airflow.

**Prerequisite:** Contracts 2 and 3 are complete.

**Acceptance Criteria:**
- [ ] Airflow added to docker-compose (webserver + scheduler + separate airflow DB)
- [ ] DAG: `ingest_market_data.py`:
  - Scheduled daily (but can be triggered manually)
  - Fetches latest data for configured tickers
  - Calls the /api/datasets/ingest endpoint
- [ ] DAG: `run_experiment.py`:
  - Triggered manually (not scheduled)
  - Accepts experiment config as DAG params
  - Calls /api/experiments endpoints to create and run experiments
- [ ] DAG: `ops_digest.py`:
  - Scheduled daily
  - Calls /api/ops/summary to get daily summary
  - Stores digest (optional: send to agent for analysis)
- [ ] Airflow webserver accessible at localhost:8080
- [ ] All DAGs appear in Airflow UI without import errors

**What NOT to do:**
- Don't rewrite the training logic inside Airflow — DAGs should call the FastAPI endpoints
- Don't spend time on Airflow auth — use default admin/admin
- Don't add complex retry logic — simple is fine

**Verify:**
1. `docker-compose up` — Airflow webserver loads at :8080
2. All 3 DAGs visible in UI
3. Manually trigger `ingest_market_data` — data appears in DB
4. Manually trigger `run_experiment` with params — experiment runs