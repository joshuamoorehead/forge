/**
 * Typed API client for the Forge FastAPI backend.
 *
 * All functions hit the backend at NEXT_PUBLIC_API_URL (default http://localhost:8000).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Generic fetch helper
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Shared types (mirrors Pydantic schemas)
// ---------------------------------------------------------------------------

export interface ProjectSummary {
  name: string;
  commit_count_7d: number;
  total_cost_7d: number;
  error_count_7d: number;
  last_activity: string | null;
  health: "green" | "yellow" | "red";
}

export interface ProjectListResponse {
  projects: ProjectSummary[];
  count: number;
}

export interface OpsLogResponse {
  id: string;
  project_name: string;
  log_level: string | null;
  message: string | null;
  metadata: Record<string, unknown> | null;
  source: string | null;
  cost_usd: number | null;
  is_anomaly: boolean;
  created_at: string | null;
}

export interface GitEventResponse {
  id: string;
  repo: string;
  event_type: string | null;
  branch: string | null;
  commit_sha: string | null;
  commit_message: string | null;
  author: string | null;
  files_changed: number | null;
  additions: number | null;
  deletions: number | null;
  created_at: string | null;
}

export interface ExperimentResponse {
  id: string;
  name: string;
  description: string | null;
  dataset_id: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface RunResponse {
  id: string;
  experiment_id: string;
  run_name: string | null;
  model_type: string;
  hyperparameters: Record<string, unknown>;
  feature_engineering: Record<string, unknown> | null;
  accuracy: number | null;
  precision_score: number | null;
  recall: number | null;
  f1: number | null;
  train_loss: number | null;
  val_loss: number | null;
  test_loss: number | null;
  custom_metrics: Record<string, unknown> | null;
  inference_latency_ms: number | null;
  inference_latency_p95_ms: number | null;
  peak_memory_mb: number | null;
  model_size_mb: number | null;
  throughput_samples_per_sec: number | null;
  training_time_seconds: number | null;
  efficiency_score: number | null;
  wandb_run_id: string | null;
  s3_artifact_path: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string | null;
}

export interface ExperimentDetailResponse extends ExperimentResponse {
  runs: RunResponse[];
}

export interface ExperimentListResponse {
  experiments: ExperimentResponse[];
  count: number;
}

export interface IntermediateResult {
  tool: string;
  result_preview: string;
}

export interface AgentQueryResponse {
  answer: string;
  tools_used: string[];
  intermediate_results: IntermediateResult[];
}

export interface ProjectDetailResponse {
  name: string;
  recent_logs: OpsLogResponse[];
  git_events: GitEventResponse[];
  linked_experiments: ExperimentResponse[];
}

export interface ActivityFeedItem {
  type: "git_commit" | "ops_log" | "experiment_completion";
  timestamp: string;
  project: string | null;
  summary: string;
  detail: Record<string, unknown> | null;
}

export interface ActivityFeedResponse {
  items: ActivityFeedItem[];
  count: number;
}

export interface DashboardSummaryResponse {
  total_projects: number;
  active_experiments: number;
  ops_alerts_24h: number;
  weekly_llm_cost: number;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export function fetchProjects(): Promise<ProjectListResponse> {
  return apiFetch<ProjectListResponse>("/api/projects");
}

export function fetchProjectDetail(name: string): Promise<ProjectDetailResponse> {
  return apiFetch<ProjectDetailResponse>(`/api/projects/${encodeURIComponent(name)}`);
}

export function fetchActivityFeed(limit = 20): Promise<ActivityFeedResponse> {
  return apiFetch<ActivityFeedResponse>(`/api/activity/feed?limit=${limit}`);
}

export function fetchDashboardSummary(): Promise<DashboardSummaryResponse> {
  return apiFetch<DashboardSummaryResponse>("/api/dashboard/summary");
}

export function fetchExperiments(): Promise<ExperimentListResponse> {
  return apiFetch<ExperimentListResponse>("/api/experiments");
}

export function fetchExperimentDetail(id: string): Promise<ExperimentDetailResponse> {
  return apiFetch<ExperimentDetailResponse>(`/api/experiments/${encodeURIComponent(id)}`);
}

export function sendAgentQuery(question: string): Promise<AgentQueryResponse> {
  return apiFetch<AgentQueryResponse>("/api/agent/query", {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}
