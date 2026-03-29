"""DAG: Daily ops digest via Forge API.

Fetches the daily operational summary (error counts, costs, events
by project) from the Forge API and logs it. Scheduled daily.
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


def fetch_ops_summary(**context):
    """Fetch the ops summary from the Forge API and log it."""
    response = requests.get(
        f"{FORGE_API_BASE}/api/ops/summary",
        timeout=30,
    )
    response.raise_for_status()

    summary = response.json()
    execution_date = context["ds"]

    print(f"=== Ops Digest for {execution_date} ===")
    print(f"Total logs:    {summary.get('total_logs', 0)}")
    print(f"Error count:   {summary.get('error_count', 0)}")
    print(f"Total cost:    ${summary.get('total_cost_usd', 0):.4f}")

    projects = summary.get("by_project", {})
    if projects:
        print("\nBy Project:")
        for project_name, stats in projects.items():
            print(f"  {project_name}: {stats}")

    return summary


with DAG(
    dag_id="ops_digest",
    default_args=DEFAULT_ARGS,
    description="Daily ops summary digest via Forge API",
    schedule="@daily",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=["forge", "ops"],
) as dag:
    digest_task = PythonOperator(
        task_id="fetch_ops_summary",
        python_callable=fetch_ops_summary,
    )
