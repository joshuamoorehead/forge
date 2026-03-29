"""DAG: Run ML experiments via Forge API.

Manually triggered DAG that creates an experiment and triggers
training runs by calling the FastAPI endpoints. Accepts experiment
configuration as DAG parameters.
"""

from datetime import datetime, timedelta

import requests
from airflow import DAG
from airflow.operators.python import PythonOperator

FORGE_API_BASE = "http://api:8000"

DEFAULT_ARGS = {
    "owner": "forge",
    "retries": 1,
    "retry_delay": timedelta(minutes=2),
}

DEFAULT_PARAMS = {
    "experiment_name": "airflow_experiment",
    "description": "Experiment triggered via Airflow",
    "dataset_id": "",
    "runs": [
        {"model_type": "xgboost", "hyperparameters": {}},
        {"model_type": "random_forest", "hyperparameters": {}},
    ],
}


def create_experiment(**context):
    """Create an experiment via the Forge API and return its ID."""
    params = context["params"]

    dataset_id = params.get("dataset_id", "")
    if not dataset_id:
        raise ValueError("dataset_id is required — pass it as a DAG parameter")

    payload = {
        "name": params.get("experiment_name", DEFAULT_PARAMS["experiment_name"]),
        "description": params.get("description", DEFAULT_PARAMS["description"]),
        "dataset_id": dataset_id,
        "runs": params.get("runs", DEFAULT_PARAMS["runs"]),
    }

    response = requests.post(
        f"{FORGE_API_BASE}/api/experiments",
        json=payload,
        timeout=60,
    )
    response.raise_for_status()

    result = response.json()
    experiment_id = result["id"]
    print(f"Created experiment {experiment_id}: {payload['name']}")
    return experiment_id


def trigger_runs(**context):
    """Trigger training runs for the created experiment."""
    task_instance = context["ti"]
    experiment_id = task_instance.xcom_pull(task_ids="create_experiment")

    if not experiment_id:
        raise ValueError("No experiment_id from create_experiment task")

    response = requests.post(
        f"{FORGE_API_BASE}/api/experiments/{experiment_id}/run",
        timeout=600,
    )
    response.raise_for_status()

    result = response.json()
    runs = result.get("runs", [])
    print(f"Triggered {len(runs)} runs for experiment {experiment_id}")
    for run in runs:
        print(f"  Run {run.get('id')}: {run.get('model_type')} — status: {run.get('status')}")
    return experiment_id


with DAG(
    dag_id="run_experiment",
    default_args=DEFAULT_ARGS,
    description="Manually triggered ML experiment runner via Forge API",
    schedule=None,
    start_date=datetime(2024, 1, 1),
    catchup=False,
    params=DEFAULT_PARAMS,
    tags=["forge", "experiments"],
) as dag:
    create_task = PythonOperator(
        task_id="create_experiment",
        python_callable=create_experiment,
    )

    run_task = PythonOperator(
        task_id="trigger_runs",
        python_callable=trigger_runs,
    )

    create_task >> run_task
