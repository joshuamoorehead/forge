"""GitHub webhook endpoints — receive and store push events."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from forge.api.models.database import GitEvent, get_db
from forge.api.models.schemas import (
    GitEventListResponse,
    GitEventResponse,
    GitHubPushPayload,
)

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.post("/github", response_model=GitEventListResponse, status_code=201)
async def receive_github_webhook(
    payload: GitHubPushPayload, db: Session = Depends(get_db)
) -> GitEventListResponse:
    """Receive a GitHub push webhook, parse commits, and store as git events."""
    # Extract repo name — fall back to "unknown" if repository block missing
    repo = "unknown"
    if payload.repository and "full_name" in payload.repository:
        repo = payload.repository["full_name"]

    # Extract branch from ref (e.g., "refs/heads/main" -> "main")
    branch = payload.ref
    if branch.startswith("refs/heads/"):
        branch = branch[len("refs/heads/"):]

    stored_events = []
    for commit in payload.commits:
        # Count files changed across added, removed, modified lists
        files_changed = len(commit.added) + len(commit.removed) + len(commit.modified)

        # Extract author name from the author dict
        author = None
        if commit.author:
            author = commit.author.get("name") or commit.author.get("username")

        git_event = GitEvent(
            repo=repo,
            event_type="push",
            branch=branch,
            commit_sha=commit.id,
            commit_message=commit.message,
            author=author,
            files_changed=files_changed,
            additions=None,
            deletions=None,
            payload=payload.model_dump(),
        )
        db.add(git_event)
        stored_events.append(git_event)

    db.commit()
    for event in stored_events:
        db.refresh(event)

    return GitEventListResponse(
        events=[GitEventResponse.model_validate(e) for e in stored_events],
        count=len(stored_events),
    )
