"use client";

import { useEffect, useState } from "react";
import SummaryCard from "@/components/SummaryCard";
import ActivityTimeline from "@/components/ActivityTimeline";
import {
  fetchDashboardSummary,
  fetchActivityFeed,
  type DashboardSummaryResponse,
  type ActivityFeedItem,
} from "@/lib/api";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [feed, setFeed] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchDashboardSummary(), fetchActivityFeed()])
      .then(([s, f]) => {
        setSummary(s);
        setFeed(f.items);
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
      <div className="grid grid-cols-4 gap-4 mb-8">
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
      </div>

      {/* Activity feed */}
      <div className="bg-forge-card border border-forge-border rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <ActivityTimeline items={feed} />
      </div>
    </div>
  );
}
