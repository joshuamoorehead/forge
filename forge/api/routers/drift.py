"""Drift detection router — run drift checks and view reports."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from forge.api.models.database import DriftReport, get_db
from forge.api.models.schemas import (
    DriftDetectRequest,
    DriftReportListResponse,
    DriftReportResponse,
    DriftSummaryResponse,
)
from forge.api.services.drift_detection import (
    compute_data_drift,
    compute_feature_drift,
    compute_prediction_drift,
    get_drift_summary,
    list_drift_reports,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/drift", tags=["drift"])


@router.post("/detect", response_model=DriftReportResponse, status_code=status.HTTP_201_CREATED)
def detect_drift(
    request: DriftDetectRequest,
    db: Session = Depends(get_db),
) -> DriftReportResponse:
    """Run drift detection between a reference and current dataset."""
    try:
        if request.report_type == "data_drift":
            report = compute_data_drift(
                db, request.reference_dataset_id, request.current_dataset_id,
                features=request.features,
                threshold=request.threshold or 0.05,
            )
        elif request.report_type == "feature_drift":
            report = compute_feature_drift(
                db, request.reference_dataset_id, request.current_dataset_id,
                features=request.features,
                threshold=request.threshold or 0.25,
            )
        elif request.report_type == "prediction_drift":
            if request.model_version_id is None:
                raise ValueError("model_version_id required for prediction_drift")
            report = compute_prediction_drift(
                db, request.model_version_id,
                request.reference_dataset_id, request.current_dataset_id,
            )
        else:
            raise ValueError(f"Unknown report type: {request.report_type}")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return DriftReportResponse.model_validate(report)


@router.get("/reports", response_model=DriftReportListResponse)
def list_reports(
    dataset_id: UUID | None = Query(None),
    report_type: str | None = Query(None),
    is_drifted: bool | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> DriftReportListResponse:
    """List drift reports with optional filters."""
    reports = list_drift_reports(db, dataset_id, report_type, is_drifted, limit)
    return DriftReportListResponse(
        reports=[DriftReportResponse.model_validate(r) for r in reports],
        count=len(reports),
    )


@router.get("/reports/{report_id}", response_model=DriftReportResponse)
def get_report(
    report_id: UUID,
    db: Session = Depends(get_db),
) -> DriftReportResponse:
    """Get a single drift report with full per-feature breakdown."""
    report = db.query(DriftReport).filter(DriftReport.id == report_id).first()
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Drift report {report_id} not found")
    return DriftReportResponse.model_validate(report)


@router.get("/summary", response_model=DriftSummaryResponse)
def drift_summary(
    dataset_id: UUID | None = Query(None),
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
) -> DriftSummaryResponse:
    """High-level drift status across all monitored datasets."""
    summary = get_drift_summary(db, dataset_id, days)
    return DriftSummaryResponse(**summary)
