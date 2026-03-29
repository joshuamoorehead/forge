"""DAG: Daily market data ingestion via Forge API.

Fetches latest OHLCV data for configured tickers by calling the
FastAPI /api/datasets/ingest endpoint. Scheduled daily but can
be triggered manually with custom parameters.
"""

from datetime import datetime, timedelta

import requests
from airflow import DAG
from airflow.operators.python import PythonOperator

FORGE_API_BASE = "http://api:8000"

DEFAULT_ARGS = {
    "owner": "forge",
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

DEFAULT_PARAMS = {
    "tickers": ["SPY", "QQQ", "AAPL"],
    "lookback_days": 1,
}


def ingest_market_data(**context):
    """Call the Forge API to ingest market data for configured tickers."""
    params = context["params"]
    tickers = params.get("tickers", DEFAULT_PARAMS["tickers"])
    lookback_days = int(params.get("lookback_days", DEFAULT_PARAMS["lookback_days"]))

    execution_date = context["ds"]
    end_date = datetime.strptime(execution_date, "%Y-%m-%d").date()
    start_date = end_date - timedelta(days=lookback_days)

    payload = {
        "name": f"daily_ingest_{execution_date}",
        "source": "yfinance",
        "tickers": tickers,
        "start_date": str(start_date),
        "end_date": str(end_date),
    }

    response = requests.post(
        f"{FORGE_API_BASE}/api/datasets/ingest",
        json=payload,
        timeout=120,
    )
    response.raise_for_status()

    result = response.json()
    dataset_id = result.get("id")
    print(f"Ingested dataset {dataset_id} for tickers {tickers} ({start_date} to {end_date})")
    return dataset_id


with DAG(
    dag_id="ingest_market_data",
    default_args=DEFAULT_ARGS,
    description="Daily market data ingestion via Forge API",
    schedule="@daily",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    params=DEFAULT_PARAMS,
    tags=["forge", "ingestion"],
) as dag:
    ingest_task = PythonOperator(
        task_id="ingest_market_data",
        python_callable=ingest_market_data,
    )
