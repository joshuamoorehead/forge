"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchDriftReport, type DriftReportResponse } from "@/lib/api";

interface FeatureScore {
  ks_statistic?: number;
  p_value?: number;
  psi?: number;
  is_drifted?: boolean;
  drift_level?: string;
  ref_mean?: number;
  cur_mean?: number;
  ref_std?: number;
  cur_std?: number;
}

export default function DriftReportDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [report, setReport] = useState<DriftReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDriftReport(id)
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Drift Report</h1>
        <div className="flex items-center gap-3 text-forge-muted">
          <div className="w-5 h-5 border-2 border-forge-accent border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Drift Report</h1>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400">
          {error || "Report not found."}
        </div>
      </div>
    );
  }

  // Extract per-feature scores
  const featureScores: Record<string, FeatureScore> = report.report_type === "feature_drift"
    ? ((report.feature_scores as Record<string, unknown>)?.per_feature as Record<string, FeatureScore>) || {}
    : (report.feature_scores as Record<string, FeatureScore>) || {};

  // Filter out non-feature entries
  const featureEntries = Object.entries(featureScores).filter(
    ([key, val]) => typeof val === "object" && val !== null && !Array.isArray(val) && key !== "per_feature" && key !== "top_drifted" && key !== "model_accuracy_at_training" && key !== "model_type"
  );

  // Sort by drift severity
  const sortedFeatures = featureEntries.sort((a, b) => {
    const scoreA = (a[1] as FeatureScore).psi ?? (1 - ((a[1] as FeatureScore).p_value ?? 1));
    const scoreB = (b[1] as FeatureScore).psi ?? (1 - ((b[1] as FeatureScore).p_value ?? 1));
    return scoreB - scoreA;
  });

  // Top 3 drifted
  const topDrifted = (report.feature_scores as Record<string, unknown>)?.top_drifted as Array<{ feature: string; psi?: number; p_value?: number }> | undefined;

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Link href="/drift" className="text-forge-muted hover:text-forge-text transition-colors text-sm">
          Drift
        </Link>
        <span className="text-forge-muted text-sm">/</span>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold capitalize">{report.report_type.replace("_", " ")}</h1>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            report.is_drifted === "true" ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
          }`}
        >
          {report.is_drifted === "true" ? "Drifted" : "Stable"}
        </span>
        <span className="text-sm text-forge-muted">
          Score: {report.overall_drift_score != null ? (report.overall_drift_score * 100).toFixed(1) + "%" : "—"}
        </span>
      </div>

      {/* Info */}
      <div className="grid grid-cols-3 gap-4 mb-6 text-xs text-forge-muted">
        <div className="bg-forge-card border border-forge-border rounded-lg p-3">
          <span className="block text-forge-muted uppercase mb-1">Current Dataset</span>
          <span className="text-forge-text font-mono">{report.dataset_id.slice(0, 12)}...</span>
        </div>
        <div className="bg-forge-card border border-forge-border rounded-lg p-3">
          <span className="block text-forge-muted uppercase mb-1">Reference Dataset</span>
          <span className="text-forge-text font-mono">{report.reference_dataset_id.slice(0, 12)}...</span>
        </div>
        <div className="bg-forge-card border border-forge-border rounded-lg p-3">
          <span className="block text-forge-muted uppercase mb-1">Created</span>
          <span className="text-forge-text">{report.created_at ? new Date(report.created_at).toLocaleString() : "—"}</span>
        </div>
      </div>

      {/* Top drifted features callout */}
      {topDrifted && topDrifted.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-yellow-400 mb-2">Top Drifted Features</h3>
          <div className="flex gap-4">
            {topDrifted.map((t, i) => (
              <div key={i} className="text-xs">
                <span className="text-forge-text font-mono">{t.feature}</span>
                <span className="text-forge-muted ml-2">
                  PSI: {t.psi != null ? t.psi.toFixed(4) : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature drift heatmap (table-based) */}
      {sortedFeatures.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Per-Feature Drift Scores</h2>
          <div className="bg-forge-card border border-forge-border rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-forge-border">
                  <th className="px-4 py-2 text-left text-forge-muted uppercase">Feature</th>
                  <th className="px-4 py-2 text-right text-forge-muted uppercase">
                    {report.report_type === "feature_drift" ? "PSI" : "KS Stat"}
                  </th>
                  <th className="px-4 py-2 text-right text-forge-muted uppercase">
                    {report.report_type === "feature_drift" ? "Level" : "p-value"}
                  </th>
                  <th className="px-4 py-2 text-right text-forge-muted uppercase">Ref Mean</th>
                  <th className="px-4 py-2 text-right text-forge-muted uppercase">Cur Mean</th>
                  <th className="px-4 py-2 text-left text-forge-muted uppercase">Drift</th>
                </tr>
              </thead>
              <tbody>
                {sortedFeatures.map(([name, scores]) => {
                  const s = scores as FeatureScore;
                  const driftScore = s.psi ?? s.ks_statistic ?? 0;
                  // Color intensity based on drift severity
                  const intensity = Math.min(driftScore * (report.report_type === "feature_drift" ? 4 : 3), 1);
                  const bgColor = `rgba(239, 68, 68, ${intensity * 0.3})`;

                  return (
                    <tr key={name} className="border-b border-forge-border/30" style={{ backgroundColor: bgColor }}>
                      <td className="px-4 py-2 text-forge-text font-mono">{name}</td>
                      <td className="px-4 py-2 text-right text-forge-text font-mono">
                        {s.psi != null ? s.psi.toFixed(4) : s.ks_statistic != null ? s.ks_statistic.toFixed(4) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right text-forge-text font-mono">
                        {s.drift_level ?? (s.p_value != null ? s.p_value.toFixed(4) : "—")}
                      </td>
                      <td className="px-4 py-2 text-right text-forge-muted font-mono">
                        {s.ref_mean != null ? s.ref_mean.toFixed(4) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right text-forge-muted font-mono">
                        {s.cur_mean != null ? s.cur_mean.toFixed(4) : "—"}
                      </td>
                      <td className="px-4 py-2">
                        {(s.is_drifted || s.drift_level === "significant") ? (
                          <span className="text-red-400 font-medium">drifted</span>
                        ) : s.drift_level === "moderate" ? (
                          <span className="text-yellow-400 font-medium">moderate</span>
                        ) : (
                          <span className="text-emerald-400">stable</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Distribution comparison — show ref vs cur mean/std as bar-like display */}
      {sortedFeatures.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Distribution Comparison (Top Features)</h2>
          <div className="bg-forge-card border border-forge-border rounded-xl p-5 space-y-4">
            {sortedFeatures.slice(0, 3).map(([name, scores]) => {
              const s = scores as FeatureScore;
              const maxVal = Math.max(Math.abs(s.ref_mean ?? 0), Math.abs(s.cur_mean ?? 0)) || 1;
              const refWidth = Math.abs((s.ref_mean ?? 0) / maxVal) * 100;
              const curWidth = Math.abs((s.cur_mean ?? 0) / maxVal) * 100;

              return (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-forge-text">{name}</span>
                    <span className="text-xs text-forge-muted">
                      {s.psi != null ? `PSI: ${s.psi.toFixed(4)}` : s.ks_statistic != null ? `KS: ${s.ks_statistic.toFixed(4)}` : ""}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-forge-muted w-12">Ref</span>
                      <div className="flex-1 bg-forge-bg rounded h-4 overflow-hidden">
                        <div className="bg-blue-500/50 h-full rounded" style={{ width: `${Math.min(refWidth, 100)}%` }} />
                      </div>
                      <span className="text-xs text-forge-muted w-20 text-right font-mono">{s.ref_mean?.toFixed(4) ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-forge-muted w-12">Cur</span>
                      <div className="flex-1 bg-forge-bg rounded h-4 overflow-hidden">
                        <div className="bg-orange-500/50 h-full rounded" style={{ width: `${Math.min(curWidth, 100)}%` }} />
                      </div>
                      <span className="text-xs text-forge-muted w-20 text-right font-mono">{s.cur_mean?.toFixed(4) ?? "—"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Config */}
      {report.config && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Detection Config</h2>
          <pre className="bg-forge-card border border-forge-border rounded-xl p-4 text-xs text-forge-muted overflow-x-auto">
            {JSON.stringify(report.config, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}
