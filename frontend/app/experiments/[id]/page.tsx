"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import RunComparisonTable from "@/components/RunComparisonTable";
import EfficiencyFrontier from "@/components/EfficiencyFrontier";
import {
  fetchExperimentDetail,
  fetchModels,
  registerModelVersion,
  fetchRunEnvironment,
  fetchReproduceSpec,
  compareEnvironments,
  type ExperimentDetailResponse,
  type RunResponse,
  type ModelListItem,
  type RunEnvironmentResponse,
  type ReproduceResponse,
  type EnvironmentDiffResponse,
} from "@/lib/api";

export default function ExperimentDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [experiment, setExperiment] = useState<ExperimentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<RunResponse | null>(null);
  const [models, setModels] = useState<ModelListItem[]>([]);
  const [registerModel, setRegisterModel] = useState<string>("");
  const [registerStatus, setRegisterStatus] = useState<string | null>(null);
  const [envData, setEnvData] = useState<RunEnvironmentResponse | null>(null);
  const [envLoading, setEnvLoading] = useState(false);
  const [envExpanded, setEnvExpanded] = useState(false);
  const [reproduceData, setReproduceData] = useState<ReproduceResponse | null>(null);
  const [reproduceOpen, setReproduceOpen] = useState(false);
  const [diffData, setDiffData] = useState<EnvironmentDiffResponse | null>(null);
  const [diffRunA, setDiffRunA] = useState<string>("");
  const [diffRunB, setDiffRunB] = useState<string>("");
  const [diffLoading, setDiffLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchExperimentDetail(id)
      .then(setExperiment)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load experiment"))
      .finally(() => setLoading(false));
    fetchModels().then((res) => setModels(res.models)).catch(() => {});
  }, [id]);

  async function handleRegisterVersion(runId: string) {
    if (!registerModel) return;
    setRegisterStatus(null);
    try {
      const mv = await registerModelVersion(registerModel, runId);
      setRegisterStatus(`Registered as ${registerModel} v${mv.version}`);
    } catch (err) {
      setRegisterStatus(err instanceof Error ? err.message : "Registration failed");
    }
  }

  async function loadEnvironment(runId: string) {
    setEnvLoading(true);
    setEnvData(null);
    setReproduceData(null);
    setReproduceOpen(false);
    try {
      const env = await fetchRunEnvironment(id, runId);
      setEnvData(env);
    } catch {
      setEnvData(null);
    }
    setEnvLoading(false);
  }

  async function loadReproduce(runId: string) {
    try {
      const spec = await fetchReproduceSpec(id, runId);
      setReproduceData(spec);
      setReproduceOpen(true);
      setCopied(false);
    } catch {
      setReproduceData(null);
    }
  }

  async function handleCompareEnvs() {
    if (!diffRunA || !diffRunB || diffRunA === diffRunB) return;
    setDiffLoading(true);
    try {
      const diff = await compareEnvironments(diffRunA, diffRunB);
      setDiffData(diff);
    } catch {
      setDiffData(null);
    }
    setDiffLoading(false);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const KEY_PACKAGES = ["torch", "xgboost", "scikit-learn", "numpy", "pandas", "fastapi"];

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Experiment Detail</h1>
        <div className="flex items-center gap-3 text-forge-muted">
          <div className="w-5 h-5 border-2 border-forge-accent border-t-transparent rounded-full animate-spin" />
          Loading experiment...
        </div>
      </div>
    );
  }

  if (error || !experiment) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Experiment Detail</h1>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400">
          {error || "Experiment not found."}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <Link
          href="/experiments"
          className="text-forge-muted hover:text-forge-text transition-colors text-sm"
        >
          Experiments
        </Link>
        <span className="text-forge-muted text-sm">/</span>
      </div>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">{experiment.name}</h1>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            experiment.status === "completed"
              ? "bg-emerald-500/10 text-emerald-400"
              : experiment.status === "running"
              ? "bg-blue-500/10 text-blue-400"
              : experiment.status === "failed"
              ? "bg-red-500/10 text-red-400"
              : "bg-gray-500/10 text-gray-400"
          }`}
        >
          {experiment.status}
        </span>
      </div>

      {experiment.description && (
        <p className="text-sm text-forge-muted mb-6">{experiment.description}</p>
      )}

      {/* Run Comparison Table */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Run Comparison</h2>
        <div className="bg-forge-card border border-forge-border rounded-xl p-5">
          <RunComparisonTable
            runs={experiment.runs}
            onSelectRun={(run) => {
              setSelectedRun(run);
              setEnvExpanded(false);
              setEnvData(null);
              setReproduceData(null);
              setReproduceOpen(false);
            }}
            selectedRunId={selectedRun?.id ?? null}
          />
        </div>
      </section>

      {/* Efficiency Frontier */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Efficiency Frontier</h2>
        <div className="bg-forge-card border border-forge-border rounded-xl p-5">
          <EfficiencyFrontier runs={experiment.runs} />
        </div>
      </section>

      {/* Model Details Panel */}
      {selectedRun && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">
              Run Details: {selectedRun.run_name || selectedRun.model_type}
            </h2>
            <button
              onClick={() => setSelectedRun(null)}
              className="text-xs text-forge-muted hover:text-forge-text transition-colors"
            >
              Close
            </button>
          </div>
          <div className="bg-forge-card border border-forge-border rounded-xl p-5">
            <div className="grid grid-cols-2 gap-6">
              {/* Hyperparameters */}
              <div>
                <h3 className="text-sm font-medium text-forge-muted uppercase tracking-wider mb-3">
                  Hyperparameters
                </h3>
                {Object.keys(selectedRun.hyperparameters).length === 0 ? (
                  <p className="text-sm text-forge-muted">No hyperparameters recorded.</p>
                ) : (
                  <div className="space-y-1.5">
                    {Object.entries(selectedRun.hyperparameters).map(([key, val]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-forge-muted font-mono">{key}</span>
                        <span className="text-forge-text font-mono">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Feature Engineering Config */}
              <div>
                <h3 className="text-sm font-medium text-forge-muted uppercase tracking-wider mb-3">
                  Feature Engineering
                </h3>
                {!selectedRun.feature_engineering ||
                Object.keys(selectedRun.feature_engineering).length === 0 ? (
                  <p className="text-sm text-forge-muted">No feature config recorded.</p>
                ) : (
                  <div className="space-y-1.5">
                    {Object.entries(selectedRun.feature_engineering).map(([key, val]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-forge-muted font-mono">{key}</span>
                        <span className="text-forge-text font-mono">
                          {typeof val === "object" ? JSON.stringify(val) : String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Timing info */}
            <div className="mt-6 pt-4 border-t border-forge-border">
              <div className="flex gap-6 text-xs text-forge-muted">
                {selectedRun.training_time_seconds != null && (
                  <span>
                    Training time:{" "}
                    <span className="text-forge-text">
                      {selectedRun.training_time_seconds.toFixed(1)}s
                    </span>
                  </span>
                )}
                {selectedRun.model_size_mb != null && (
                  <span>
                    Model size:{" "}
                    <span className="text-forge-text">
                      {selectedRun.model_size_mb.toFixed(2)} MB
                    </span>
                  </span>
                )}
                {selectedRun.wandb_run_id && (
                  <span>
                    W&B run: <span className="text-forge-accent">{selectedRun.wandb_run_id}</span>
                  </span>
                )}
                {selectedRun.s3_artifact_path && (
                  <span>
                    S3: <span className="text-forge-accent font-mono">{selectedRun.s3_artifact_path}</span>
                  </span>
                )}
                {selectedRun.feature_set_id && (
                  <span>
                    Feature Set:{" "}
                    <span className="text-forge-accent font-mono">
                      {selectedRun.feature_set_id.slice(0, 8)}...
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Register as Model Version */}
            {selectedRun.status === "completed" && models.length > 0 && (
              <div className="mt-4 pt-4 border-t border-forge-border">
                <div className="flex items-center gap-3">
                  <select
                    value={registerModel}
                    onChange={(e) => setRegisterModel(e.target.value)}
                    className="bg-forge-bg border border-forge-border rounded px-3 py-1.5 text-xs text-forge-text"
                  >
                    <option value="">Select model...</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleRegisterVersion(selectedRun.id)}
                    disabled={!registerModel}
                    className="bg-forge-accent text-white px-3 py-1.5 rounded text-xs font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
                  >
                    Register as Model Version
                  </button>
                  {registerStatus && (
                    <span className="text-xs text-forge-muted">{registerStatus}</span>
                  )}
                </div>
              </div>
            )}

            {/* Environment Section */}
            <div className="mt-4 pt-4 border-t border-forge-border">
              <button
                onClick={() => {
                  const next = !envExpanded;
                  setEnvExpanded(next);
                  if (next && !envData && !envLoading) {
                    loadEnvironment(selectedRun.id);
                  }
                }}
                className="flex items-center gap-2 text-sm font-medium text-forge-muted hover:text-forge-text transition-colors"
              >
                <svg className={`w-4 h-4 transition-transform ${envExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                Environment
                {envData?.git_dirty && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 font-medium">DIRTY</span>
                )}
              </button>

              {envExpanded && (
                <div className="mt-3 ml-6">
                  {envLoading ? (
                    <div className="flex items-center gap-2 text-xs text-forge-muted">
                      <div className="w-3 h-3 border border-forge-accent border-t-transparent rounded-full animate-spin" />
                      Loading environment...
                    </div>
                  ) : envData ? (
                    <div className="space-y-3">
                      {/* Git info */}
                      <div>
                        <h4 className="text-xs font-medium text-forge-muted uppercase mb-1.5">Git</h4>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                          <span>
                            SHA: <span className="font-mono text-forge-accent">{envData.git_sha?.slice(0, 12) ?? "N/A"}</span>
                          </span>
                          <span>
                            Branch: <span className="font-mono text-forge-text">{envData.git_branch ?? "N/A"}</span>
                          </span>
                          {envData.git_dirty && (
                            <span className="text-yellow-400">uncommitted changes</span>
                          )}
                        </div>
                      </div>

                      {/* Python & Key Packages */}
                      <div>
                        <h4 className="text-xs font-medium text-forge-muted uppercase mb-1.5">Runtime</h4>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                          <span>Python: <span className="font-mono text-forge-text">{envData.python_version ?? "N/A"}</span></span>
                          {envData.package_versions && KEY_PACKAGES.map((pkg) =>
                            envData.package_versions![pkg] ? (
                              <span key={pkg}>
                                {pkg}: <span className="font-mono text-forge-text">{envData.package_versions![pkg]}</span>
                              </span>
                            ) : null
                          )}
                        </div>
                      </div>

                      {/* Data & Seed */}
                      <div>
                        <h4 className="text-xs font-medium text-forge-muted uppercase mb-1.5">Reproducibility</h4>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                          <span>Seed: <span className="font-mono text-forge-text">{envData.random_seed ?? "N/A"}</span></span>
                          {selectedRun.data_version_hash && (
                            <span>Data: <span className="font-mono text-forge-text">{selectedRun.data_version_hash.slice(0, 12)}...</span></span>
                          )}
                          {selectedRun.feature_set_id && (
                            <span>Feature Set: <span className="font-mono text-forge-accent">{selectedRun.feature_set_id.slice(0, 8)}...</span></span>
                          )}
                          <span>Env: <span className="font-mono text-forge-text">{envData.env_hash?.slice(0, 12) ?? "N/A"}...</span></span>
                        </div>
                      </div>

                      {/* Reproduce button */}
                      <div className="pt-2">
                        <button
                          onClick={() => loadReproduce(selectedRun.id)}
                          className="bg-forge-bg border border-forge-border px-3 py-1.5 rounded text-xs text-forge-text hover:border-forge-accent/50 transition-colors"
                        >
                          Reproduce
                        </button>
                      </div>

                      {/* Reproduce command */}
                      {reproduceOpen && reproduceData && (
                        <div className="mt-2">
                          {reproduceData.warnings.length > 0 && (
                            <div className="mb-2 space-y-1">
                              {reproduceData.warnings.map((w, i) => (
                                <p key={i} className="text-[11px] text-yellow-400">! {w}</p>
                              ))}
                            </div>
                          )}
                          <div className="relative">
                            <pre className="bg-forge-bg border border-forge-border rounded-lg p-3 text-xs font-mono text-forge-text overflow-x-auto whitespace-pre-wrap">
                              {reproduceData.command}
                            </pre>
                            <button
                              onClick={() => copyToClipboard(reproduceData.command)}
                              className="absolute top-2 right-2 text-[10px] px-2 py-1 rounded bg-forge-card border border-forge-border text-forge-muted hover:text-forge-text transition-colors"
                            >
                              {copied ? "Copied!" : "Copy"}
                            </button>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 text-[11px] text-forge-muted">
                            {reproduceData.data_version && <span>Data: {reproduceData.data_version.slice(0, 20)}...</span>}
                            {reproduceData.feature_set && <span>Features: {reproduceData.feature_set}</span>}
                            {reproduceData.environment_hash && <span>Env: {reproduceData.environment_hash.slice(0, 20)}...</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-forge-muted">No environment data captured for this run.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Environment Diff */}
      {experiment.runs.length >= 2 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Environment Diff</h2>
          <div className="bg-forge-card border border-forge-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <select
                value={diffRunA}
                onChange={(e) => setDiffRunA(e.target.value)}
                className="bg-forge-bg border border-forge-border rounded px-3 py-1.5 text-xs text-forge-text flex-1"
              >
                <option value="">Run A...</option>
                {experiment.runs.map((r) => (
                  <option key={r.id} value={r.id}>{r.run_name || r.model_type} ({r.id.slice(0, 8)})</option>
                ))}
              </select>
              <span className="text-forge-muted text-xs">vs</span>
              <select
                value={diffRunB}
                onChange={(e) => setDiffRunB(e.target.value)}
                className="bg-forge-bg border border-forge-border rounded px-3 py-1.5 text-xs text-forge-text flex-1"
              >
                <option value="">Run B...</option>
                {experiment.runs.map((r) => (
                  <option key={r.id} value={r.id}>{r.run_name || r.model_type} ({r.id.slice(0, 8)})</option>
                ))}
              </select>
              <button
                onClick={handleCompareEnvs}
                disabled={!diffRunA || !diffRunB || diffRunA === diffRunB || diffLoading}
                className="bg-forge-accent text-white px-3 py-1.5 rounded text-xs font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {diffLoading ? "Comparing..." : "Compare"}
              </button>
            </div>

            {diffData && (
              <div className="space-y-4">
                {/* Verdict */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    diffData.reproducibility?.verdict === "reproducible"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : diffData.reproducibility?.verdict === "reproducible_with_warnings"
                      ? "bg-yellow-500/10 text-yellow-400"
                      : "bg-red-500/10 text-red-400"
                  }`}>
                    {diffData.reproducibility?.verdict?.replace(/_/g, " ") ?? "unknown"}
                  </span>
                  {diffData.environments_identical && (
                    <span className="text-xs text-emerald-400">Environments identical</span>
                  )}
                </div>

                {/* Warnings */}
                {diffData.reproducibility?.warnings && diffData.reproducibility.warnings.length > 0 && (
                  <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
                    {diffData.reproducibility.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-yellow-400">! {w}</p>
                    ))}
                  </div>
                )}

                {/* Factor comparison */}
                {diffData.reproducibility?.factors && (
                  <div>
                    <h4 className="text-xs font-medium text-forge-muted uppercase mb-2">Reproducibility Factors</h4>
                    <div className="space-y-1">
                      {Object.entries(diffData.reproducibility.factors).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-3 text-xs">
                          <span className={`w-2 h-2 rounded-full ${val.match ? "bg-emerald-400" : "bg-red-400"}`} />
                          <span className="text-forge-muted w-32">{key.replace(/_/g, " ")}</span>
                          {!val.match && (
                            <span className="font-mono text-forge-text">
                              {String(val.run_a)?.slice(0, 16)} → {String(val.run_b)?.slice(0, 16)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Package changes */}
                {(Object.keys(diffData.packages_changed).length > 0 ||
                  Object.keys(diffData.packages_added).length > 0 ||
                  Object.keys(diffData.packages_removed).length > 0) && (
                  <div>
                    <h4 className="text-xs font-medium text-forge-muted uppercase mb-2">Package Changes</h4>
                    <div className="space-y-1 font-mono text-xs">
                      {Object.entries(diffData.packages_changed).map(([pkg, v]) => (
                        <div key={pkg} className="flex gap-2">
                          <span className="text-yellow-400">~</span>
                          <span className="text-forge-text">{pkg}:</span>
                          <span className="text-red-400">{v.run_a}</span>
                          <span className="text-forge-muted">&rarr;</span>
                          <span className="text-emerald-400">{v.run_b}</span>
                        </div>
                      ))}
                      {Object.entries(diffData.packages_added).map(([pkg, ver]) => (
                        <div key={pkg} className="flex gap-2">
                          <span className="text-emerald-400">+</span>
                          <span className="text-forge-text">{pkg}: {ver}</span>
                        </div>
                      ))}
                      {Object.entries(diffData.packages_removed).map(([pkg, ver]) => (
                        <div key={pkg} className="flex gap-2">
                          <span className="text-red-400">-</span>
                          <span className="text-forge-text">{pkg}: {ver}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Field diffs */}
                {Object.keys(diffData.field_diffs).length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-forge-muted uppercase mb-2">Field Differences</h4>
                    <div className="space-y-1 text-xs">
                      {Object.entries(diffData.field_diffs).map(([field, v]) => (
                        <div key={field} className="flex gap-2">
                          <span className="text-forge-muted w-32">{field.replace(/_/g, " ")}:</span>
                          <span className="font-mono text-red-400">{String(v.run_a)?.slice(0, 20)}</span>
                          <span className="text-forge-muted">&rarr;</span>
                          <span className="font-mono text-emerald-400">{String(v.run_b)?.slice(0, 20)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
