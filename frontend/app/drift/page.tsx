"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SummaryCard from "@/components/SummaryCard";
import {
  fetchDriftReports,
  fetchDriftSummary,
  type DriftReportResponse,
  type DriftSummaryResponse,
} from "@/lib/api";

export default function DriftPage() {
  const [reports, setReports] = useState<DriftReportResponse[]>([]);
  const [summary, setSummary] = useState<DriftSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchDriftReports(), fetchDriftSummary()])
      .then(([r, s]) => {
        setReports(r.reports);
        setSummary(s);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Drift Detection</h1>
        <div className="flex items-center gap-3 text-forge-muted">
          <div className="w-5 h-5 border-2 border-forge-accent border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Drift Detection</h1>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Drift Detection</h1>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <SummaryCard title="Total Reports" value={summary.total_reports} />
          <SummaryCard
            title="Datasets with Drift"
            value={summary.datasets_with_drift}
            accent={summary.datasets_with_drift > 0}
          />
          <SummaryCard title="Drifted Reports" value={summary.drifted_count} />
          <SummaryCard
            title="Last Check"
            value={summary.last_check ? new Date(summary.last_check).toLocaleDateString() : "Never"}
          />
        </div>
      )}

      {/* Reports table */}
      {reports.length === 0 ? (
        <div className="bg-forge-card border border-forge-border rounded-xl p-8 text-center">
          <p className="text-forge-muted mb-1">No drift reports yet</p>
          <p className="text-forge-muted text-sm">
            Run drift detection via:{" "}
            <code className="text-forge-accent text-xs">POST /api/drift/detect</code>
          </p>
        </div>
      ) : (
        <div className="bg-forge-card border border-forge-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-forge-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-forge-muted uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-forge-muted uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-forge-muted uppercase">Dataset</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-forge-muted uppercase">Score</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-forge-muted uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-forge-border/50 hover:bg-forge-bg transition-colors">
                  <td className="px-4 py-3 text-forge-muted text-xs">
                    {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/drift/${r.id}`}
                      className="text-forge-text hover:text-forge-accent transition-colors text-xs font-mono"
                    >
                      {r.report_type}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-forge-muted text-xs font-mono">
                    {r.dataset_id.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3 text-forge-text text-xs font-mono">
                    {r.overall_drift_score != null ? (r.overall_drift_score * 100).toFixed(1) + "%" : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.is_drifted === "true"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-emerald-500/10 text-emerald-400"
                      }`}
                    >
                      {r.is_drifted === "true" ? "Drifted" : "Stable"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
