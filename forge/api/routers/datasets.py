"""Dataset endpoints — ingest, list, and detail."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from forge.api.models.database import get_db
from forge.api.models.schemas import (
    DatasetDetailResponse,
    DatasetIngestRequest,
    DatasetListResponse,
    DatasetResponse,
)
from forge.api.services.data_ingestion import (
    get_dataset_by_id,
    get_feature_summary,
    ingest_dataset,
    list_datasets,
)

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


@router.post("/ingest", response_model=DatasetResponse, status_code=201)
async def ingest(
    request: DatasetIngestRequest, db: Session = Depends(get_db)
) -> DatasetResponse:
    """Trigger data fetch from yfinance, compute features, and store results."""
    if request.start_date >= request.end_date:
        raise HTTPException(
            status_code=400, detail="start_date must be before end_date"
        )
    try:
        dataset = ingest_dataset(
            session=db,
            name=request.name,
            tickers=request.tickers,
            start_date=request.start_date,
            end_date=request.end_date,
            source=request.source,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return DatasetResponse.model_validate(dataset)


@router.get("", response_model=DatasetListResponse)
async def list_all(db: Session = Depends(get_db)) -> DatasetListResponse:
    """List all ingested datasets."""
    datasets = list_datasets(db)
    return DatasetListResponse(
        datasets=[DatasetResponse.model_validate(ds) for ds in datasets],
        count=len(datasets),
    )


@router.get("/{dataset_id}", response_model=DatasetDetailResponse)
async def get_detail(
    dataset_id: UUID, db: Session = Depends(get_db)
) -> DatasetDetailResponse:
    """Get dataset details including feature summary statistics."""
    dataset = get_dataset_by_id(db, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    summary = get_feature_summary(dataset)
    detail = DatasetDetailResponse.model_validate(dataset)
    detail.feature_summary = summary
    return detail
