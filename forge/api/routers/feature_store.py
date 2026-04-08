"""Feature store router — register, compute, list, and compare feature sets."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from forge.api.models.database import get_db
from forge.api.models.schemas import (
    FeatureComputeRequest,
    FeatureRegistryResponse,
    FeatureSetCompareResponse,
    FeatureSetCreateRequest,
    FeatureSetDetailResponse,
    FeatureSetListResponse,
    FeatureSetResponse,
)
from forge.api.services.feature_store import (
    compare_feature_sets,
    compute_features,
    get_feature_set_detail,
    list_feature_sets,
    register_feature_set,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/features", tags=["features"])


@router.post(
    "/register",
    response_model=FeatureSetResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_feature_set(
    request: FeatureSetCreateRequest,
    db: Session = Depends(get_db),
) -> FeatureSetResponse:
    """Register a new feature set version."""
    fs = register_feature_set(
        db,
        name=request.name,
        feature_config=request.feature_config,
        description=request.description,
    )
    return FeatureSetResponse.model_validate(fs)


@router.get("", response_model=FeatureSetListResponse)
def list_feature_sets_endpoint(
    name: str | None = Query(None, description="Filter by feature set name"),
    db: Session = Depends(get_db),
) -> FeatureSetListResponse:
    """List all feature sets, optionally filtered by name."""
    feature_sets = list_feature_sets(db, name=name)
    return FeatureSetListResponse(
        feature_sets=[FeatureSetResponse.model_validate(fs) for fs in feature_sets],
        count=len(feature_sets),
    )


@router.get("/compare", response_model=FeatureSetCompareResponse)
def compare_feature_sets_endpoint(
    a: UUID = Query(..., description="Feature set A ID"),
    b: UUID = Query(..., description="Feature set B ID"),
    db: Session = Depends(get_db),
) -> FeatureSetCompareResponse:
    """Diff two feature sets — show added, removed, and changed config/columns."""
    try:
        result = compare_feature_sets(db, a, b)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return FeatureSetCompareResponse(**result)


@router.get("/{feature_set_id}", response_model=FeatureSetDetailResponse)
def get_feature_set(
    feature_set_id: UUID,
    db: Session = Depends(get_db),
) -> FeatureSetDetailResponse:
    """Get a feature set with its registry entries."""
    try:
        fs, registry_entries = get_feature_set_detail(db, feature_set_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return FeatureSetDetailResponse(
        **FeatureSetResponse.model_validate(fs).model_dump(),
        registry_entries=[FeatureRegistryResponse.model_validate(r) for r in registry_entries],
    )


@router.post(
    "/{feature_set_id}/compute",
    response_model=FeatureRegistryResponse,
)
def compute_features_endpoint(
    feature_set_id: UUID,
    request: FeatureComputeRequest,
    db: Session = Depends(get_db),
) -> FeatureRegistryResponse:
    """Compute features for a dataset using the specified feature set config."""
    try:
        registry = compute_features(db, feature_set_id, request.dataset_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return FeatureRegistryResponse.model_validate(registry)
