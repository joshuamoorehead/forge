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

## Contract 8A: Backend Endpoints + Projects Hub Frontend
**Goal:** New API endpoints for projects aggregation, Next.js setup, dashboard home, and Projects Hub pages.

**Prerequisite:** Contracts 5 and 7 are complete.

**Acceptance Criteria:**

### Backend additions
- [ ] New router: `projects.py` with endpoints:
  - `GET /api/projects` — returns list of unique projects with aggregated stats (commit count last 7d, total cost last 7d, error count last 7d, last activity timestamp, health status: green/yellow/red)
  - `GET /api/projects/{name}` — returns project detail: recent logs (limit 50), git events (limit 50), linked experiments
  - `GET /api/activity/feed` — returns interleaved timeline of recent git commits + ops logs + experiment completions across all projects, most recent first (limit 20)
- [ ] Health status logic: green = no errors last 24h, yellow = warnings but no errors, red = any errors last 24h

### Frontend setup
- [ ] Next.js app initialized with Tailwind CSS in /frontend directory
- [ ] Added to docker-compose with hot reload
- [ ] API client in /frontend/lib/api.ts
- [ ] Sidebar navigation layout with links: Dashboard, Projects, Experiments, Agent

### Dashboard Home (`/`)
- [ ] Summary cards: total projects tracked, active experiments, ops alerts (error count last 24h), weekly LLM cost
- [ ] Recent activity feed — interleaved timeline from /api/activity/feed
- [ ] Components: SummaryCard, ActivityTimeline

### Projects Hub (`/projects`)
- [ ] Card grid of all projects from /api/projects
- [ ] Each ProjectCard shows: name, HealthBadge (green/yellow/red), last activity, commit count, cost, error count
- [ ] Click card → project detail page

### Project Detail (`/projects/[name]`)
- [ ] Tabbed interface with 4 tabs:
- [ ] **Activity Tab:** Git commit timeline (vertical timeline with dots, most recent at top)
- [ ] **Logs Tab:** Ops logs table with severity color coding (INFO=gray, WARN=yellow, ERROR=red), anomaly badge, cost column, severity filter dropdown
- [ ] **Cost Tab:** Cumulative cost line chart + daily cost bar chart + total cost callout (use recharts)
- [ ] **Experiments Tab:** List of linked experiments (can be empty with placeholder text)

### Components:
- [ ] ProjectCard, HealthBadge, SummaryCard
- [ ] ActivityTimeline (git events)
- [ ] LogTable (filterable, color-coded)
- [ ] CostChart (recharts line + bar)

**What NOT to do:**
- Don't build the experiments detail page yet (that's 8B)
- Don't build the agent chat yet (that's 8B)
- Don't add authentication
- Don't use a component library — Tailwind only
- Don't try mobile-responsive — desktop-first

**Verify:**
1. `docker-compose up` — frontend loads at :3000
2. Dashboard shows real summary stats and activity feed
3. `/projects` shows project cards with real data from ops_logs and git_events
4. `/projects/marcus` (or whatever project name exists) shows all 4 tabs with real data
5. Cost chart renders with real cost data
6. Health badges show correct colors based on recent error activity

## Contract 8B: Experiments Pages + Agent Chat + Frontend Polish
**Goal:** Experiment detail with efficiency frontier, agent chat interface, and overall frontend polish.

**Prerequisite:** Contract 8A is complete with working Projects Hub.

**Acceptance Criteria:**

### Experiments List (`/experiments`)
- [ ] Table/list of all experiments with: name, status, dataset name, model types used, created date
- [ ] Click row → experiment detail page

### Experiment Detail (`/experiments/[id]`)
- [ ] Run comparison table: all runs with columns for accuracy, precision, recall, F1, inference_latency_ms, peak_memory_mb, throughput, efficiency_score — all sortable
- [ ] Efficiency frontier scatter chart (recharts):
  - X-axis: inference_latency_ms
  - Y-axis: accuracy
  - Each dot is a run, labeled with model type
  - Pareto-optimal runs highlighted in a different color and connected by a line
  - Hover tooltip shows: run name, accuracy, latency, efficiency score
- [ ] Model details panel: click a run to see full hyperparameters and feature engineering config

### Agent Chat (`/agent`)
- [ ] Chat interface with text input and send button
- [ ] Message history displayed as conversation bubbles
- [ ] Agent responses show tool calls transparently (which tool, what it returned)
- [ ] Suggested starter questions shown when chat is empty:
  - "Which model is most efficient?"
  - "Show ops anomalies from today"
  - "Compare my last two runs"
- [ ] Loading indicator while agent is thinking

### Components:
- [ ] RunComparisonTable (sortable)
- [ ] EfficiencyFrontier (recharts scatter + Pareto line)
- [ ] AgentChat (input + messages + tool call display)

### Polish
- [ ] All sidebar links work and highlight active page
- [ ] Empty states: show helpful messages when no data exists (e.g., "No experiments yet — create one via the API")
- [ ] Loading states: show spinner/skeleton while API calls are in flight
- [ ] Error states: show friendly error message if API is unreachable
- [ ] Consistent spacing and typography across all pages

**What NOT to do:**
- Don't modify any backend code from 8A
- Don't add new API endpoints — work with what exists
- Don't over-animate — clean and functional beats fancy
- Don't add dark mode — not worth the time

**Verify:**
1. `/experiments` lists real experiments
2. `/experiments/[id]` shows run comparison table with real metrics AND profiling data
3. Efficiency frontier chart renders with real data, Pareto runs highlighted
4. `/agent` sends a question, shows loading state, displays response with tool calls
5. All pages have proper empty/loading/error states
6. Full navigation flow works: Dashboard → Projects → Project Detail → Experiments Tab → Experiment Detail

## Contract 9: CI/CD + K8s + Polish
**Goal:** GitHub Actions, Kubernetes manifests, README, final testing.

**Prerequisite:** All prior contracts complete.

**Acceptance Criteria:**
- [ ] `.github/workflows/ci.yml`: lint (ruff), test (pytest), build Docker images
- [ ] `.github/workflows/docker-build.yml`: build and tag containers on push to main
- [ ] `k8s/` directory with:
  - deployment.yaml (API + frontend deployments with resource limits)
  - service.yaml (ClusterIP services)
  - configmap.yaml (non-secret config)
  - ingress.yaml (basic ingress definition)
- [ ] Dockerfiles optimized (multi-stage builds, .dockerignore)
- [ ] README.md with:
  - Project description and motivation
  - Architecture diagram (can be ASCII or mermaid)
  - Tech stack table
  - Setup instructions (docker-compose up)
  - Screenshot/gif of dashboard
  - API documentation link (FastAPI /docs)
- [ ] All existing tests pass
- [ ] `docker-compose up` brings up entire stack cleanly from scratch

**What NOT to do:**
- Don't actually deploy to a K8s cluster — manifests are for demonstrating knowledge
- Don't add Terraform — it's a stretch goal if you have extra time
- Don't refactor working code — polish only

**Verify:**
1. `git push` triggers CI — all checks pass
2. K8s manifests are valid YAML (use `kubectl apply --dry-run=client`)
3. README renders properly on GitHub
4. Fresh clone → `docker-compose up` → everything works

---

## Contract 10: Deploy to Railway + Seed Demo Data
**Goal:** Get Forge live on a public URL with enough real data to demo in 60 seconds during an interview.

**Prerequisite:** Contracts 0-9 complete, code review fixes applied, Railway account created (sign up at railway.app with GitHub).

**Acceptance Criteria:**

### Railway Setup
- [ ] Install Railway CLI: `npm install -g @railway/cli`
- [ ] Login: `railway login`
- [ ] Create new project: `railway init` (name it "forge")
- [ ] Add PostgreSQL service via Railway dashboard (Railway provides managed Postgres — no Docker needed)
- [ ] Add pgvector extension to Railway Postgres (run `CREATE EXTENSION IF NOT EXISTS vector;` via `railway connect postgres`)

### Environment Variables
- [ ] Set all env vars in Railway dashboard (Settings → Variables):
  - DATABASE_URL (auto-provided by Railway's Postgres)
  - WANDB_API_KEY
  - AWS_ACCESS_KEY_ID
  - AWS_SECRET_ACCESS_KEY
  - AWS_S3_BUCKET
  - OPENAI_API_KEY
  - ANTHROPIC_API_KEY
  - CORS_ORIGINS (set to the Railway frontend URL once known)
- [ ] Remove any localhost references from env vars

### Deploy API Backend
- [ ] Create a Railway service for the API from the GitHub repo
- [ ] Set root directory to `/` and build command to use `Dockerfile.api`
- [ ] Set start command: `uvicorn forge.api.main:app --host 0.0.0.0 --port $PORT`
- [ ] Railway auto-assigns a PORT — make sure FastAPI reads from `$PORT` env var
- [ ] Update `forge/api/main.py` to read PORT from environment: `port = int(os.getenv("PORT", 8000))`
- [ ] Verify: API health endpoint returns 200 at the Railway URL

### Deploy Frontend
- [ ] Create a separate Railway service for the frontend
- [ ] Set root directory to `/frontend`
- [ ] Set NEXT_PUBLIC_API_URL to the Railway API service URL
- [ ] Verify: frontend loads at its Railway URL

### Run Alembic Migrations
- [ ] Run migrations against Railway Postgres: `railway run alembic upgrade head`
- [ ] Verify all tables exist

### Seed Demo Data
- [ ] Create a seed script: `scripts/seed_demo.py` that populates the database with:
  - 2-3 datasets (SPY, AAPL, QQQ — ingest real data via yfinance)
  - 2-3 experiments with 4-6 total runs across XGBoost, Random Forest, LSTM
  - 20-30 ops log entries across 2-3 projects (marcus, forge) with varying severity
  - 5-10 fake git events (commits to marcus and forge repos)
  - At least 1 anomalous ops log entry (high cost spike) so anomaly detection has something to flag
- [ ] Run seed script against Railway: `railway run python scripts/seed_demo.py`
- [ ] Verify: all dashboard pages show real data

### Custom Subdomain
- [ ] Set custom subdomain on the frontend service (e.g., forgelab.up.railway.app or similar)
- [ ] Update CORS_ORIGINS to include the final frontend URL

### Verify End-to-End
- [ ] Frontend loads at public URL — no errors
- [ ] Dashboard home shows summary cards with real numbers
- [ ] Projects page shows project cards with health indicators
- [ ] Project detail shows logs, git events, and cost charts
- [ ] Experiments page lists seeded experiments
- [ ] Experiment detail shows efficiency frontier chart with real run data
- [ ] Agent chat answers a question using real data
- [ ] W&B dashboard shows the seeded experiment runs

**What NOT to do:**
- Don't set up Airflow on Railway (too heavy for a demo — Airflow is a local dev tool)
- Don't add authentication (personal tool, not multi-tenant)
- Don't optimize for production scale — this is a demo deployment
- Don't spend time on custom domains — the .up.railway.app subdomain is fine

**Verify the 60-second demo flow:**
1. Open the URL on your phone or laptop
2. "This is Forge, my ML systems platform. Here's the projects hub — I'm tracking Marcus and Forge."
3. Click a project → "I can see git activity, ops logs with anomaly detection, and LLM cost tracking."
4. Go to experiments → "Here's where I compare models. XGBoost vs Random Forest vs LSTM on financial data."
5. Click experiment → "This efficiency frontier shows the accuracy-to-latency tradeoff — my ECE differentiator."
6. Go to agent → ask "which model is most efficient?" → "And I can query everything with natural language via LangChain."
7. Done. Under 60 seconds.