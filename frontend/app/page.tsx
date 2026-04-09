"use client";

import { useEffect, useState } from "react";
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

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
        <div className="flex items-center gap-3 text-forge-muted">
          <div className="w-5 h-5 border-2 border-forge-accent border-t-transparent rounded-full animate-spin" />
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <SummaryCard
          title="Projects Tracked"
          value={summary?.total_projects ?? 0}
        />
        <SummaryCard
          title="Active Experiments"
          value={summary?.active_experiments ?? 0}
          accent
        />
        <SummaryCard
          title="Ops Alerts (24h)"
          value={summary?.ops_alerts_24h ?? 0}
          subtitle={summary?.ops_alerts_24h ? "errors detected" : "all clear"}
        />
        <SummaryCard
          title="Weekly LLM Cost"
          value={`$${(summary?.weekly_llm_cost ?? 0).toFixed(2)}`}
        />
        <SummaryCard
          title="Drift Alerts (7d)"
          value={summary?.drift_alerts_7d ?? 0}
          accent={!!summary?.drift_alerts_7d}
          subtitle={summary?.drift_alerts_7d ? "datasets drifted" : "all stable"}
        />
      </div>

      {/* API Health mini-card */}
      {metrics && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-forge-card border border-forge-border rounded-xl p-4">
            <p className="text-xs text-forge-muted uppercase tracking-wide">Total Requests</p>
            <p className="text-2xl font-bold mt-1">{Math.round(metrics.total_requests).toLocaleString()}</p>
          </div>
          <div className="bg-forge-card border border-forge-border rounded-xl p-4">
            <p className="text-xs text-forge-muted uppercase tracking-wide">Error Rate</p>
            <p className={`text-2xl font-bold mt-1 ${
              metrics.error_rate_pct > 5 ? "text-red-400" : metrics.error_rate_pct > 1 ? "text-yellow-400" : "text-green-400"
            }`}>
              {metrics.error_rate_pct.toFixed(1)}%
            </p>
          </div>
          <a
            href={process.env.NEXT_PUBLIC_GRAFANA_URL || "http://localhost:3001"}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-forge-card border border-forge-border rounded-xl p-4 hover:border-forge-accent/50 transition-colors"
          >
            <p className="text-xs text-forge-muted uppercase tracking-wide">API Health</p>
            <p className="text-sm text-forge-accent mt-2">Open Grafana Dashboard &rarr;</p>
          </a>
        </div>
      )}

      {/* Activity feed */}
      <div className="bg-forge-card border border-forge-border rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <ActivityTimeline items={feed} />
      </div>
    </div>
  );
}
