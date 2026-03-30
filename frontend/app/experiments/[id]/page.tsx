"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import RunComparisonTable from "@/components/RunComparisonTable";
import EfficiencyFrontier from "@/components/EfficiencyFrontier";
import { fetchExperimentDetail, type ExperimentDetailResponse, type RunResponse } from "@/lib/api";

export default function ExperimentDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [experiment, setExperiment] = useState<ExperimentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<RunResponse | null>(null);

  useEffect(() => {
    fetchExperimentDetail(id)
      .then(setExperiment)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load experiment"))
      .finally(() => setLoading(false));
  }, [id]);

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
            onSelectRun={setSelectedRun}
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
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
