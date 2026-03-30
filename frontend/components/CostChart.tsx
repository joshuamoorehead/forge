"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { OpsLogResponse } from "@/lib/api";

interface CostChartProps {
  logs: OpsLogResponse[];
}

interface DailyCost {
  date: string;
  cost: number;
  cumulative: number;
}

function aggregateDailyCosts(logs: OpsLogResponse[]): DailyCost[] {
  const byDate: Record<string, number> = {};

  for (const log of logs) {
    if (log.cost_usd == null || log.cost_usd === 0) continue;
    const dateStr = log.created_at
      ? new Date(log.created_at).toISOString().slice(0, 10)
      : "unknown";
    byDate[dateStr] = (byDate[dateStr] ?? 0) + log.cost_usd;
  }

  const sorted = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, cost]) => ({ date, cost }));

  let cumulative = 0;
  return sorted.map(({ date, cost }) => {
    cumulative += cost;
    return { date, cost: parseFloat(cost.toFixed(4)), cumulative: parseFloat(cumulative.toFixed(4)) };
  });
}

export default function CostChart({ logs }: CostChartProps) {
  const data = aggregateDailyCosts(logs);
  const totalCost = data.length > 0 ? data[data.length - 1].cumulative : 0;

  if (data.length === 0) {
    return <p className="text-forge-muted text-sm">No cost data available.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Total cost callout */}
      <div className="bg-forge-bg border border-forge-border rounded-lg p-4 inline-block">
        <p className="text-sm text-forge-muted">Total Cost</p>
        <p className="text-3xl font-bold text-forge-accent">${totalCost.toFixed(2)}</p>
      </div>

      {/* Cumulative cost line chart */}
      <div>
        <h3 className="text-sm font-medium text-forge-muted mb-3">Cumulative Cost</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              contentStyle={{ backgroundColor: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: "8px" }}
              labelStyle={{ color: "#e2e8f0" }}
              formatter={(value: number) => [`$${value.toFixed(4)}`, "Cumulative"]}
            />
            <Line type="monotone" dataKey="cumulative" stroke="#6366f1" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Daily cost bar chart */}
      <div>
        <h3 className="text-sm font-medium text-forge-muted mb-3">Daily Cost</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              contentStyle={{ backgroundColor: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: "8px" }}
              labelStyle={{ color: "#e2e8f0" }}
              formatter={(value: number) => [`$${value.toFixed(4)}`, "Cost"]}
            />
            <Bar dataKey="cost" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
