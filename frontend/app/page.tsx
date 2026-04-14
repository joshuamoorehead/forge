"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import SummaryCard from "@/components/SummaryCard";
import ActivityTimeline from "@/components/ActivityTimeline";
import {
  fetchDashboardSummary,
  fetchActivityFeed,
  fetchMetricsSummary,
  type DashboardSummaryResponse,
  type ActivityFeedItem,
  type MetricsSummaryResponse,
} from "@/lib/api";

function DashboardSkeleton() {
  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview of your ML operations" />
      <div className="grid grid-cols-4 gap-5 mb-10">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-forge-card border border-forge-border rounded-xl p-6 animate-pulse">
            <div className="h-3 w-24 bg-forge-bg-raised rounded mb-3" />
            <div className="h-7 w-16 bg-forge-bg-raised rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 bg-forge-card border border-forge-border rounded-xl p-6 animate-pulse">
          <div className="h-4 w-32 bg-forge-bg-raised rounded mb-6" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4 py-3">
              <div className="w-2.5 h-2.5 rounded-full bg-forge-bg-raised mt-1" />
              <div className="flex-1">
                <div className="h-3 w-48 bg-forge-bg-raised rounded mb-2" />
                <div className="h-3 w-72 bg-forge-bg-raised rounded" />
              </div>
            </div>
          ))}
        </div>
        <div className="bg-forge-card border border-forge-border rounded-xl p-6 animate-pulse">
          <div className="h-4 w-28 bg-forge-bg-raised rounded mb-6" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="mb-5">
              <div className="h-3 w-20 bg-forge-bg-raised rounded mb-2" />
              <div className="h-6 w-16 bg-forge-bg-raised rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [feed, setFeed] = useState<ActivityFeedItem[]>([]);
  const [metrics, setMetrics] = useState<MetricsSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchDashboardSummary(),
      fetchActivityFeed(),
      fetchMetricsSummary().catch(() => null),
    ])
      .then(([s, f, m]) => {
        setSummary(s);
        setFeed(f.items);
        setMetrics(m);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Overview of your ML operations" />
        <div className="bg-forge-error/10 border border-forge-error/20 rounded-lg px-4 py-3 text-sm text-forge-error">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview of your ML operations" />

      {/* Summary cards — 4 columns */}
      <div className="grid grid-cols-4 gap-5 mb-10">
        <SummaryCard
          title="Projects"
          value={summary?.total_projects ?? 0}
        />
        <SummaryCard
          title="Active Experiments"
          value={summary?.active_experiments ?? 0}
          accent
        />
        <SummaryCard
          title="Ops Alerts"
          value={summary?.ops_alerts_24h ?? 0}
          subtitle="last 24 hours"
        />
        <SummaryCard
          title="Drift Alerts"
          value={summary?.drift_alerts_7d ?? 0}
          subtitle="last 7 days"
        />
      </div>

      {/* Two-column layout: activity feed + system health */}
      <div className="grid grid-cols-3 gap-5">
        {/* Activity feed — 2/3 */}
        <div className="col-span-2 bg-forge-card border border-forge-border rounded-xl p-6">
          <h2 className="text-lg font-medium mb-5">Recent Activity</h2>
          <ActivityTimeline items={feed} />
        </div>

        {/* System health — 1/3 */}
        <div className="bg-forge-card border border-forge-border rounded-xl p-6">
          <h2 className="text-lg font-medium mb-5">System</h2>

          {/* LLM Cost */}
          <div className="mb-5">
            <p className="text-2xs font-medium uppercase tracking-widest text-forge-muted mb-1">Weekly LLM Cost</p>
            <p className="text-xl font-semibold font-mono">
              ${(summary?.weekly_llm_cost ?? 0).toFixed(2)}
            </p>
          </div>

          {/* API Metrics */}
          {metrics && (
            <>
              <div className="mb-5">
                <p className="text-2xs font-medium uppercase tracking-widest text-forge-muted mb-1">Total Requests</p>
                <p className="text-xl font-semibold font-mono">
                  {Math.round(metrics.total_requests).toLocaleString()}
                </p>
              </div>

              <div className="mb-5">
                <p className="text-2xs font-medium uppercase tracking-widest text-forge-muted mb-1">Error Rate</p>
                <p className={`text-xl font-semibold font-mono ${
                  metrics.error_rate_pct > 5
                    ? "text-forge-error"
                    : metrics.error_rate_pct > 1
                    ? "text-forge-warning"
                    : "text-forge-success"
                }`}>
                  {metrics.error_rate_pct.toFixed(1)}%
                </p>
              </div>

              <div>
                <p className="text-2xs font-medium uppercase tracking-widest text-forge-muted mb-1">Experiment Runs</p>
                <p className="text-xl font-semibold font-mono">
                  {Math.round(metrics.experiments_total).toLocaleString()}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
