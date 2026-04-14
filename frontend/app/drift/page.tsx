"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
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
        <PageHeader title="Drift Detection" subtitle="Monitor dataset and model drift over time" />
        <div className="grid grid-cols-4 gap-5 mb-10">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-forge-card border border-forge-border rounded-xl p-6 animate-pulse">
              <div className="h-3 w-24 bg-forge-bg-raised rounded mb-3" />
              <div className="h-7 w-16 bg-forge-bg-raised rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Drift Detection" subtitle="Monitor dataset and model drift over time" />
        <div className="bg-forge-error/10 border border-forge-error/20 rounded-lg px-4 py-3 text-sm text-forge-error">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Drift Detection" subtitle="Monitor dataset and model drift over time" />

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-5 mb-10">
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
        <div className="bg-forge-card border border-forge-border rounded-xl p-10 text-center">
          <p className="text-sm font-medium text-forge-text mb-1">No drift reports yet</p>
          <p className="text-sm text-forge-secondary">
            Run drift detection via:{" "}
            <code className="text-forge-accent font-mono text-xs">POST /api/drift/detect</code>
          </p>
        </div>
      ) : (
        <div className="bg-forge-card border border-forge-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-forge-border bg-forge-bg-raised sticky top-0 z-10">
                <th className="px-5 py-3 text-left text-2xs font-medium text-forge-muted uppercase tracking-widest">Date</th>
                <th className="px-5 py-3 text-left text-2xs font-medium text-forge-muted uppercase tracking-widest">Type</th>
                <th className="px-5 py-3 text-left text-2xs font-medium text-forge-muted uppercase tracking-widest">Dataset</th>
                <th className="px-5 py-3 text-left text-2xs font-medium text-forge-muted uppercase tracking-widest">Score</th>
                <th className="px-5 py-3 text-left text-2xs font-medium text-forge-muted uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-forge-border last:border-b-0 hover:bg-white/[0.02] transition-colors duration-150">
                  <td className="px-5 py-3.5 text-forge-muted text-xs">
                    {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/drift/${r.id}`}
                      className="text-forge-text hover:text-forge-accent transition-colors text-xs font-mono"
                    >
                      {r.report_type}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-forge-muted text-xs font-mono">
                    {r.dataset_id.slice(0, 8)}...
                  </td>
                  <td className="px-5 py-3.5 text-forge-text text-xs font-mono">
                    {r.overall_drift_score != null ? (r.overall_drift_score * 100).toFixed(1) + "%" : "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={r.is_drifted === "true" ? "drifted" : "stable"} />
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
