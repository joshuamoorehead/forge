# Forge — Code Review Issues

Audit date: 2026-03-29

Work through these iteratively. Check off each item as you fix it.

---

## CRITICAL

- [x] **1. Real API keys in `.env`** — `.env:5-16`
  - File contains real production keys: W&B, AWS (`AKIAZPND4RHICZQEODPD`), OpenAI, Anthropic
  - `.env` is gitignored but keys were visible in a conversation — rotate ALL of them
  - Use `.env.example` with dummy values only; consider AWS SSM or a secrets manager
  - AWS credentials are especially dangerous (S3 access, billing)

- [x] **2. LIKE pattern injection in project search** — `forge/api/routers/projects.py:189`
  ```python
  .filter(Experiment.name.ilike(f"%{name}%"))
  ```
  - `name` comes from URL path, unescaped `%` and `_` wildcards pass through
  - An attacker can use `%` as the name to match all experiments
  - Fix: escape wildcards before interpolation:
    ```python
    escaped = name.replace("%", r"\%").replace("_", r"\_")
    .filter(Experiment.name.ilike(f"%{escaped}%"))
    ```

- [x] **3. Pickle serialization for model storage** — `forge/api/services/s3_client.py:85`
  ```python
  pickle.dump(model, buffer)
  ```
  - Pickle is an RCE vector if you ever add a "load model from S3" path
  - For sklearn/xgboost use `joblib` or native `.save_model()`
  - For PyTorch you already use `state_dict()` which is fine
  - At minimum, document that pickle is intentionally write-only

---

## MEDIUM

- [x] **4. Sync ML training blocks HTTP thread** — `forge/api/routers/experiments.py:156-160`
  ```python
  for run in pending_runs:
      run_experiment_run(run.id, db)
  ```
  - LSTM training can take minutes; the uvicorn worker is frozen the entire time
  - Client HTTP connection will time out; other requests are blocked
  - Fix: use `BackgroundTasks`, Celery, or `asyncio.to_thread()`

- [x] **5. Exception details leaked to clients** — `forge/api/routers/analysis.py:32-34`, `forge/api/routers/health.py:21`
  ```python
  detail=f"Agent query failed: {exc}"
  detail=f"Database unreachable: {exc}"
  ```
  - Raw Python exception messages sent to API consumers
  - Can leak internal paths, DB errors, library stack traces
  - Fix: return generic error message; the `logger.exception()` already logs the full trace server-side

- [x] **6. No GitHub webhook signature verification** — `forge/api/routers/webhooks.py:17-18`
  - Anyone can POST fake webhook events to `/api/webhooks/github`
  - GitHub sends `X-Hub-Signature-256` HMAC header for verification
  - Fix: add a webhook secret env var and verify the HMAC in a FastAPI dependency

- [x] **7. `updated_at` never auto-updates** — `forge/api/models/database.py:85`
  ```python
  updated_at = Column(DateTime, server_default=func.now())
  ```
  - Only sets on INSERT; never updates on row changes
  - You manually set it in the experiments router but other code paths will leave it stale
  - Fix: add `onupdate=func.now()` to the column definition

- [x] **8. DB credentials in Kubernetes ConfigMap** — `k8s/configmap.yaml:9`
  ```yaml
  DATABASE_URL: "postgresql://forge:forge@forge-db:5432/forge"
  ```
  - ConfigMaps are not encrypted at rest
  - Fix: move to a Kubernetes `Secret` resource, reference via `secretKeyRef`

- [x] **9. PostgreSQL port exposed to host** — `docker-compose.yml:23-24`
  ```yaml
  ports:
    - "5432:5432"
  ```
  - DB accessible on `localhost:5432` with password `forge`
  - Fine for local dev but dangerous if compose runs on a server with a public IP
  - Fix: remove the port mapping or bind to `127.0.0.1:5432:5432`

- [x] **10. Airflow insecure defaults** — `docker-compose.yml:60, 68`
  ```yaml
  AIRFLOW__WEBSERVER__EXPOSE_CONFIG=True
  ```
  - Full Airflow config (including connection strings) exposed via web UI
  - Admin user has password `admin`
  - Fix: set `EXPOSE_CONFIG=False`, use a stronger password or env-based secret

- [x] **11. Env vars read at module import time** — `forge/api/services/embeddings.py:19`, `s3_client.py:30`, `wandb_tracker.py:23`
  ```python
  OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
  ```
  - Read once at import; if key is set/rotated after process start, it's never picked up
  - Fix: read lazily inside function calls, or document as intentional design tradeoff

---

## LOW

- [x] **12. Experiment status can get stuck at "running"** — `forge/api/routers/experiments.py:167-170`
  ```python
  if statuses == {"completed"}:
      experiment.status = "completed"
  elif "failed" in statuses:
      experiment.status = "failed"
  # no else — stays "running" if mix of completed + pending
  ```
  - If a run throws and the loop continues, remaining pending runs leave status stuck
  - Fix: add fallback like `else: experiment.status = "partial"` or recheck pending count

- [x] **13. N+1 query in `list_projects`** — `forge/api/routers/projects.py:63-132`
  - 5-6 separate COUNT/SUM queries per project name
  - 20 projects = ~120 DB round trips per request
  - Fix: rewrite as 2-3 aggregate queries with GROUP BY or CTEs

- [x] **14. Activity feed sorts in Python, not SQL** — `forge/api/routers/projects.py:284`
  ```python
  items.sort(key=lambda x: x.timestamp, reverse=True)
  ```
  - Fetches `limit` items from 3 tables, merges and sorts in Python
  - Fix: use SQL UNION with ORDER BY + LIMIT to push to the database

- [x] **15. `tracemalloc` is process-global** — `forge/api/services/profiler.py:89-99`
  - If two runs profile simultaneously, memory measurements interfere
  - Currently unlikely due to sync design but will break if you add concurrency
  - Fix: use a threading lock or per-process isolation

- [x] **16. Missing `__init__.py` check** — `forge/api/agent/`
  - Verify all Python packages have `__init__.py` files
  - Missing ones can cause import failures depending on Python path resolution

- [x] **17. CI references nonexistent `Dockerfile.prod`** — `.github/workflows/ci.yml:70`
  ```yaml
  run: docker build -f frontend/Dockerfile.prod -t forge-frontend:ci ./frontend
  ```
  - Frontend has `Dockerfile`, not `Dockerfile.prod` — CI build step will fail
  - Fix: rename to match or create the production Dockerfile

- [x] **18. Shadows Python builtin `slice`** — `forge/api/services/anomaly.py:26`
  ```python
  slice = values[max(0, i-window):i]
  ```
  - Not a bug but bad practice; rename to `window_slice` or `window_values`

- [x] **19. CORS origin hardcoded** — `forge/api/main.py:16`
  ```python
  allow_origins=["http://localhost:3000"],
  ```
  - Breaks if frontend runs on different host/port (demos, staging)
  - Fix: read from env var like `CORS_ORIGINS`

- [x] **20. Efficiency score unbounded** — `forge/api/services/profiler.py:128-138`
  - Formula: `accuracy / (latency_sec * memory_gb)`
  - Fast/small models produce scores in the millions; not comparable across runs
  - Fix: normalize or cap the score range for meaningful display
