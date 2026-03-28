# Forge — CLAUDE.md

## First Things First (Read This After Every Compaction)
1. Re-read this file (CLAUDE.md)
2. Re-read the current TASK_CONTRACT.md
3. Re-read any files you're about to modify before editing them
4. If you don't have a task plan yet, create one and show me before coding

## Project Overview
Forge is an ML experimentation and agent operations platform for financial time-series.
Full architecture spec is in SPEC.md — read relevant sections before implementing, don't memorize the whole thing.

## Tech Stack
- Backend: FastAPI (Python 3.11)
- Frontend: Next.js + React + Tailwind CSS
- Database: PostgreSQL 16 + pgvector extension
- Pipeline: Apache Airflow
- Experiment Tracking: Weights & Biases
- ML: PyTorch, scikit-learn, XGBoost
- Agent: LangChain + LangGraph
- Cloud: AWS S3
- Container: Docker + docker-compose
- CI/CD: GitHub Actions

## Task Flow (Follow This Every Time)
1. Read TASK_CONTRACT.md — understand what needs to be built
2. Read SPEC.md sections relevant to the current contract
3. Create a step-by-step plan and show it to me — do NOT start coding until I approve
4. Implement in small increments, testing after each one
5. Run all tests after implementation
6. Go through every acceptance criteria checkbox in TASK_CONTRACT.md
7. Do NOT mark the task as complete until ALL checkboxes pass
8. Do NOT edit test files unless I explicitly tell you to

## Architecture Rules
- All services go in forge/api/services/
- All routers go in forge/api/routers/
- All Pydantic schemas go in forge/api/models/schemas.py
- Database models go in forge/api/models/database.py
- Agent code goes in forge/api/agent/
- Airflow DAGs go in airflow/dags/
- Frontend code goes in frontend/
- Use SQLAlchemy for all database operations
- Use Pydantic for all request/response validation
- Use dependency injection for database sessions in FastAPI

## Coding Rules
- Never implement stubs, placeholders, or TODO functions. Every function must have real logic.
- Never use `pass` as a function body in production code.
- Always add type hints to function signatures.
- Always add docstrings to classes and public functions.
- Use descriptive variable names — no single-letter variables except loop counters.
- Handle errors explicitly — no bare `except:` clauses.
- Use `async` for FastAPI endpoints, regular functions for services unless IO-bound.
- Import order: stdlib → third-party → local (enforced by ruff).

## Testing Rules
- Tests go in tests/ directory, mirroring the source structure
- Use pytest with pytest-asyncio for async tests
- Name test files test_*.py
- Every service should have corresponding unit tests
- Test edge cases: empty data, invalid inputs, missing env vars
- Never mock the database in integration tests — use the real PostgreSQL from docker-compose
- Do NOT modify test files unless I explicitly tell you to

## Docker Rules
- All services defined in docker-compose.yml at project root
- Use pgvector/pgvector:pg16 for PostgreSQL (not plain postgres)
- FastAPI runs on port 8000
- Frontend runs on port 3000
- Airflow webserver on port 8080
- PostgreSQL on port 5432
- All env vars loaded from .env file
- Use volumes for persistent data and hot reload in development

## What NOT To Do
- Don't install packages globally — use requirements.txt / package.json
- Don't hardcode API keys, database URLs, or secrets anywhere
- Don't add features not specified in the current TASK_CONTRACT.md
- Don't refactor working code unless the current contract asks for it
- Don't create separate files for things that belong together (e.g., don't split schemas into 10 files)
- Don't add authentication — this is a personal tool
- Don't over-engineer — working and simple beats clever and complex
- Don't use ORMs for complex queries — raw SQL via SQLAlchemy text() is fine when appropriate

## File Naming Conventions
- Python: snake_case for files and functions, PascalCase for classes
- TypeScript/React: PascalCase for components, camelCase for utilities
- SQL: snake_case for tables and columns
- Environment variables: UPPER_SNAKE_CASE

## When Confused
- Re-read SPEC.md for the relevant section
- Re-read TASK_CONTRACT.md for acceptance criteria
- Ask me — don't guess or assume