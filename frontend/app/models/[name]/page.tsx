"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import {
  fetchModelDetail,
  transitionModelStage,
  compareModelVersions,
  type ModelDetailResponse,
  type ModelVersionResponse,
  type ModelVersionCompareResponse,
} from "@/lib/api";

const STAGE_COLORS: Record<string, string> = {
  development: "text-forge-muted",
  staging: "text-forge-accent",
  production: "text-forge-success",
  archived: "text-forge-error",
};

export default function ModelDetailPage() {
  const params = useParams();
  const name = decodeURIComponent(params.name as string);

  const [model, setModel] = useState<ModelDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Compare state
  const [compareA, setCompareA] = useState<number | "">("");
  const [compareB, setCompareB] = useState<number | "">("");
  const [compareResult, setCompareResult] = useState<ModelVersionCompareResponse | null>(null);

  function loadModel() {
    setLoading(true);
    fetchModelDetail(name)
      .then(setModel)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadModel(); }, [name]);

  async function handleTransition(version: number, stage: string) {
    setActionError(null);
    setActionLoading(`${version}-${stage}`);
    try {
      await transitionModelStage(name, version, stage, `Manual promotion via UI`);
      loadModel();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Transition failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCompare() {
    if (compareA === "" || compareB === "" || compareA === compareB) return;
    try {
      const result = await compareModelVersions(name, compareA as number, compareB as number);
      setCompareResult(result);
    } catch {
      setCompareResult(null);
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Model Detail" />
        <div className="bg-forge-card border border-forge-border rounded-xl p-6 animate-pulse">
          <div className="h-5 w-40 bg-forge-bg-raised rounded mb-4" />
          <div className="h-3 w-64 bg-forge-bg-raised rounded" />
        </div>
      </div>
    );
  }

  if (error || !model) {
    return (
      <div>
        <PageHeader title="Model Detail" />
        <div className="bg-forge-error/10 border border-forge-error/20 rounded-lg px-4 py-3 text-sm text-forge-error">
          {error || "Model not found."}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Link href="/models" className="text-forge-muted hover:text-forge-secondary transition-colors text-sm">
          Models
        </Link>
        <span className="text-forge-muted text-sm">/</span>
      </div>
      <h1 className="text-2xl font-semibold mb-2">{model.name}</h1>
      {model.description && <p className="text-sm text-forge-secondary mb-8">{model.description}</p>}

      {actionError && (
        <div className="bg-forge-error/10 border border-forge-error/20 rounded-lg px-4 py-3 text-sm text-forge-error mb-4">
          {actionError}
        </div>
      )}

      {/* Version Timeline */}
      <section className="mb-8">
        <h2 className="text-lg font-medium mb-3">Versions</h2>
        <div className="bg-forge-card border border-forge-border rounded-xl p-6">
          {model.versions.length === 0 ? (
            <p className="text-forge-muted text-sm">No versions registered yet.</p>
          ) : (
            <div className="space-y-3">
              {model.versions.map((v) => (
                <div key={v.id} className="flex items-center gap-4 p-3 bg-forge-bg rounded-lg">
                  <div className="flex-shrink-0">
                    <span className="text-forge-accent font-mono text-sm font-bold">v{v.version}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_COLORS[v.stage] || STAGE_COLORS.development}`}>
                    {v.stage}
                  </span>
                  <div className="flex-1 text-xs text-forge-muted">
                    {v.metrics_snapshot && (
                      <span>
                        acc: {((v.metrics_snapshot.accuracy ?? 0) * 100).toFixed(1)}% | latency: {(v.metrics_snapshot.inference_latency_ms ?? 0).toFixed(2)}ms
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {v.stage === "development" && (
                      <button
                        onClick={() => handleTransition(v.version, "staging")}
                        disabled={actionLoading !== null}
                        className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded hover:bg-blue-500/30 transition-colors disabled:opacity-40"
                      >
                        {actionLoading === `${v.version}-staging` ? "..." : "Promote to Staging"}
                      </button>
                    )}
                    {v.stage === "staging" && (
                      <button
                        onClick={() => handleTransition(v.version, "production")}
                        disabled={actionLoading !== null}
                        className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
                      >
                        {actionLoading === `${v.version}-production` ? "..." : "Promote to Production"}
                      </button>
                    )}
                    {(v.stage === "development" || v.stage === "staging" || v.stage === "production") && (
                      <button
                        onClick={() => handleTransition(v.version, "archived")}
                        disabled={actionLoading !== null}
                        className="text-xs bg-red-500/10 text-red-400 px-2 py-1 rounded hover:bg-red-500/20 transition-colors disabled:opacity-40"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Version Compare */}
      {model.versions.length >= 2 && (
        <section className="mb-8">
          <h2 className="text-lg font-medium mb-3">Compare Versions</h2>
          <div className="bg-forge-card border border-forge-border rounded-xl p-6">
            <div className="flex items-end gap-3 mb-4">
              <div className="flex-1">
                <label className="text-xs text-forge-muted block mb-1">Version A</label>
                <select
                  value={compareA}
                  onChange={(e) => setCompareA(e.target.value ? parseInt(e.target.value) : "")}
                  className="w-full bg-forge-bg border border-forge-border rounded px-3 py-1.5 text-sm text-forge-text"
                >
                  <option value="">Select...</option>
                  {model.versions.map((v) => (
                    <option key={v.id} value={v.version}>v{v.version} ({v.stage})</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs text-forge-muted block mb-1">Version B</label>
                <select
                  value={compareB}
                  onChange={(e) => setCompareB(e.target.value ? parseInt(e.target.value) : "")}
                  className="w-full bg-forge-bg border border-forge-border rounded px-3 py-1.5 text-sm text-forge-text"
                >
                  <option value="">Select...</option>
                  {model.versions.map((v) => (
                    <option key={v.id} value={v.version}>v{v.version} ({v.stage})</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleCompare}
                disabled={compareA === "" || compareB === "" || compareA === compareB}
                className="bg-forge-accent text-white px-4 py-1.5 rounded text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                Compare
              </button>
            </div>
            {compareResult && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-forge-border">
                      <th className="px-3 py-2 text-left text-forge-muted uppercase">Metric</th>
                      <th className="px-3 py-2 text-right text-forge-muted uppercase">v{String(compareResult.version_a.version)}</th>
                      <th className="px-3 py-2 text-right text-forge-muted uppercase">v{String(compareResult.version_b.version)}</th>
                      <th className="px-3 py-2 text-right text-forge-muted uppercase">Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(compareResult.metrics).map(([key, val]) => (
                      <tr key={key} className="border-b border-forge-border/30">
                        <td className="px-3 py-1.5 text-forge-muted font-mono">{key}</td>
                        <td className="px-3 py-1.5 text-right text-forge-text">
                          {val.version_a != null ? (typeof val.version_a === "number" ? val.version_a.toFixed(4) : String(val.version_a)) : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right text-forge-text">
                          {val.version_b != null ? (typeof val.version_b === "number" ? val.version_b.toFixed(4) : String(val.version_b)) : "—"}
                        </td>
                        <td className={`px-3 py-1.5 text-right font-mono ${
                          val.delta != null && val.delta > 0 ? "text-emerald-400" : val.delta != null && val.delta < 0 ? "text-red-400" : "text-forge-muted"
                        }`}>
                          {val.delta != null ? (val.delta > 0 ? "+" : "") + val.delta.toFixed(4) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Stage History */}
      {model.stage_history.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-medium mb-3">Stage History</h2>
          <div className="bg-forge-card border border-forge-border rounded-xl p-6">
            <div className="space-y-2">
              {model.stage_history.map((h) => (
                <div key={h.id} className="flex items-center gap-3 text-xs">
                  <span className="text-forge-muted">
                    {h.changed_at ? new Date(h.changed_at).toLocaleString() : "—"}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded ${STAGE_COLORS[h.from_stage] || ""}`}>{h.from_stage}</span>
                  <span className="text-forge-muted">-&gt;</span>
                  <span className={`px-1.5 py-0.5 rounded ${STAGE_COLORS[h.to_stage] || ""}`}>{h.to_stage}</span>
                  {h.reason && <span className="text-forge-muted italic truncate max-w-xs">{h.reason}</span>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
