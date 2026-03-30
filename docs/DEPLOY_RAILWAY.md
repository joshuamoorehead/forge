# Deploying Forge to Railway

Step-by-step guide to get Forge live on a public URL.

## Prerequisites

- Railway account (sign up at railway.app with GitHub)
- Railway CLI installed
- Your Forge repo pushed to GitHub

## 1. Install Railway CLI & Login

```bash
npm install -g @railway/cli
railway login
```

## 2. Create Railway Project

```bash
cd /path/to/forge
railway init
# When prompted, name it "forge"
```

## 3. Add PostgreSQL

In the Railway dashboard (railway.app):

1. Open your "forge" project
2. Click **+ New** -> **Database** -> **PostgreSQL**
3. Wait for it to provision

Then enable pgvector:

```bash
railway connect postgres
# In the psql shell:
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

## 4. Set Environment Variables

In the Railway dashboard, click your API service -> **Variables** tab. Add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | *(auto-provided by Railway Postgres — click "Reference" to link it)* |
| `WANDB_API_KEY` | your key (or leave blank to skip W&B) |
| `AWS_ACCESS_KEY_ID` | your key (or leave blank to skip S3) |
| `AWS_SECRET_ACCESS_KEY` | your key (or leave blank) |
| `AWS_S3_BUCKET` | your bucket name (or leave blank) |
| `OPENAI_API_KEY` | your key (needed for agent embeddings) |
| `ANTHROPIC_API_KEY` | your key (optional, for agent LLM) |
| `CORS_ORIGINS` | `https://YOUR-FRONTEND.up.railway.app` (update after frontend deploys) |

## 5. Deploy the API Backend

In the Railway dashboard:

1. Click **+ New** -> **GitHub Repo** -> select your forge repo
2. In the service settings:
   - **Root Directory**: `/` (leave empty / default)
   - **Build Command**: `docker build -f Dockerfile.api -t forge-api .`
     *(or let Railway auto-detect the Dockerfile — set the Dockerfile path to `Dockerfile.api`)*
   - **Start Command**: `uvicorn forge.api.main:app --host 0.0.0.0 --port $PORT`
3. Railway auto-assigns a PORT and public URL

**Verify:**
```bash
curl https://YOUR-API-URL.up.railway.app/health
# Should return {"status":"ok"}
```

## 6. Deploy the Frontend

1. Click **+ New** -> **GitHub Repo** -> select your forge repo again
2. In the service settings:
   - **Root Directory**: `/frontend`
   - **Dockerfile Path**: `Dockerfile.prod`
3. Add environment variable:
   - `NEXT_PUBLIC_API_URL` = `https://YOUR-API-URL.up.railway.app`
4. Railway auto-assigns a URL for the frontend

**Verify:** Open the frontend URL in your browser — you should see the dashboard.

## 7. Run Alembic Migrations

Link your terminal to the API service:

```bash
railway link  # select the API service
railway run alembic upgrade head
```

Verify tables exist:
```bash
railway connect postgres
\dt
# Should see: datasets, experiments, runs, ops_logs, git_events, experiment_embeddings
\q
```

## 8. Seed Demo Data

```bash
railway run python scripts/seed_demo.py
```

This will:
- Fetch real market data for SPY, AAPL, QQQ from yfinance
- Create 3 experiments with 13 total runs (XGBoost, Random Forest, LSTM)
- Insert 26 ops log entries (including 1 anomalous cost spike)
- Insert 10 git commit events

## 9. Set Custom Subdomain (Optional)

In the Railway dashboard:
1. Click your frontend service -> **Settings** -> **Networking**
2. Under "Public Networking", edit the subdomain (e.g., `forgelab.up.railway.app`)
3. Update `CORS_ORIGINS` on the API service to include the new frontend URL

## 10. Verify the 60-Second Demo Flow

1. Open the frontend URL
2. **Dashboard** — summary cards show real numbers, activity feed shows recent events
3. **Projects** — cards for "marcus" and "forge" with health badges
4. **Project Detail** — click a project, check all 4 tabs (Activity, Logs, Cost, Experiments)
5. **Experiments** — list shows 3 experiments
6. **Experiment Detail** — efficiency frontier chart with real run data
7. **Agent** — ask "which model is most efficient?" and get a real answer

## Troubleshooting

**API returns 500**: Check Railway logs (click service -> **Deployments** -> latest -> **View Logs**). Common issues:
- `DATABASE_URL` not set — make sure Postgres is linked as a reference variable
- Missing pgvector extension — run `CREATE EXTENSION IF NOT EXISTS vector;`

**Frontend shows "API unreachable"**:
- Check `NEXT_PUBLIC_API_URL` is set to the API's Railway URL (with https://)
- Check `CORS_ORIGINS` on the API includes the frontend URL

**Seed script fails**:
- Make sure migrations ran first (`railway run alembic upgrade head`)
- If yfinance fails, check the Railway service has internet access (it should by default)
