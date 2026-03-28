"""AWS S3 artifact storage service.

Handles uploading model artifacts and datasets to S3, and generating
presigned URLs for download. Gracefully degrades if AWS credentials
are not configured — all operations return None instead of crashing.
"""

import io
import logging
import os
import pickle
from uuid import UUID

import torch

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Check availability at import time
# ---------------------------------------------------------------------------

_S3_AVAILABLE = False
_s3_client = None
_S3_BUCKET: str | None = None

try:
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError

    if os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("AWS_SECRET_ACCESS_KEY"):
        _S3_BUCKET = os.getenv("AWS_S3_BUCKET", "forge-artifacts")

        # Support custom endpoint for localstack or S3-compatible storage
        endpoint_url = os.getenv("AWS_ENDPOINT_URL")
        region = os.getenv("AWS_REGION", "us-east-1")

        session_kwargs: dict = {"region_name": region}
        client_kwargs: dict = {}
        if endpoint_url:
            client_kwargs["endpoint_url"] = endpoint_url

        _s3_client = boto3.client("s3", **session_kwargs, **client_kwargs)
        _S3_AVAILABLE = True
        logger.info("S3 client initialized — bucket=%s", _S3_BUCKET)
    else:
        logger.info("AWS credentials not set — S3 storage disabled")
except ImportError:
    logger.info("boto3 package not installed — S3 storage disabled")


def is_enabled() -> bool:
    """Return True if S3 storage is available and configured."""
    return _S3_AVAILABLE


# ---------------------------------------------------------------------------
# Upload operations
# ---------------------------------------------------------------------------


def upload_model_artifact(
    model: object,
    run_id: UUID,
    model_type: str,
) -> str | None:
    """Serialize and upload a trained model to S3.

    Args:
        model: Trained model (sklearn, xgboost, or PyTorch nn.Module).
        run_id: The run UUID, used in the S3 key path.
        model_type: Model type identifier (e.g. 'xgboost', 'lstm').

    Returns:
        The S3 path (s3://bucket/key) where the artifact was stored,
        or None if S3 is disabled or the upload failed.
    """
    if not _S3_AVAILABLE:
        return None

    buffer = io.BytesIO()
    if isinstance(model, torch.nn.Module):
        torch.save(model.state_dict(), buffer)
        extension = "pt"
    else:
        pickle.dump(model, buffer)
        extension = "pkl"

    buffer.seek(0)
    s3_key = f"models/{run_id}/{model_type}.{extension}"

    try:
        _s3_client.put_object(
            Bucket=_S3_BUCKET,
            Key=s3_key,
            Body=buffer.getvalue(),
            ContentType="application/octet-stream",
        )
        s3_path = f"s3://{_S3_BUCKET}/{s3_key}"
        logger.info("Uploaded model artifact to %s", s3_path)
        return s3_path
    except (ClientError, NoCredentialsError):
        logger.exception("Failed to upload model artifact for run %s", run_id)
        return None


def upload_dataset_artifact(
    file_path: str,
    dataset_id: UUID,
) -> str | None:
    """Upload a dataset file (e.g. parquet) to S3.

    Args:
        file_path: Local path to the dataset file.
        dataset_id: The dataset UUID, used in the S3 key path.

    Returns:
        The S3 path, or None if S3 is disabled or the upload failed.
    """
    if not _S3_AVAILABLE:
        return None

    filename = os.path.basename(file_path)
    s3_key = f"datasets/{dataset_id}/{filename}"

    try:
        _s3_client.upload_file(file_path, _S3_BUCKET, s3_key)
        s3_path = f"s3://{_S3_BUCKET}/{s3_key}"
        logger.info("Uploaded dataset artifact to %s", s3_path)
        return s3_path
    except (ClientError, NoCredentialsError):
        logger.exception("Failed to upload dataset artifact for dataset %s", dataset_id)
        return None


def generate_presigned_url(
    s3_path: str,
    expiry_seconds: int = 3600,
) -> str | None:
    """Generate a presigned download URL for an S3 object.

    Args:
        s3_path: Full S3 path (s3://bucket/key).
        expiry_seconds: URL expiry time in seconds (default 1 hour).

    Returns:
        The presigned URL string, or None if S3 is disabled or generation failed.
    """
    if not _S3_AVAILABLE:
        return None

    # Parse s3://bucket/key format
    path = s3_path.removeprefix("s3://")
    bucket, _, key = path.partition("/")

    try:
        url = _s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=expiry_seconds,
        )
        return url
    except (ClientError, NoCredentialsError):
        logger.exception("Failed to generate presigned URL for %s", s3_path)
        return None
