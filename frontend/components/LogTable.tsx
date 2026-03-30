"use client";

import { useState } from "react";
import type { OpsLogResponse } from "@/lib/api";

const levelColors: Record<string, string> = {
  DEBUG:    "text-gray-400",
  INFO:     "text-gray-300",
  WARN:     "text-amber-400",
  ERROR:    "text-red-400",
  CRITICAL: "text-red-500 font-bold",
};

const levelBg: Record<string, string> = {
  DEBUG:    "bg-gray-500/10",
  INFO:     "bg-gray-500/10",
  WARN:     "bg-amber-500/10",
  ERROR:    "bg-red-500/10",
  CRITICAL: "bg-red-500/20",
};

interface LogTableProps {
  logs: OpsLogResponse[];
}

export default function LogTable({ logs }: LogTableProps) {
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");

  const filtered = severityFilter === "ALL"
    ? logs
    : logs.filter((l) => l.log_level === severityFilter);

  return (
    <div>
      {/* Filter dropdown */}
      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm text-forge-muted">Severity:</label>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="bg-forge-bg border border-forge-border rounded px-2 py-1 text-sm text-forge-text"
        >
          <option value="ALL">All</option>
          <option value="DEBUG">Debug</option>
          <option value="INFO">Info</option>
          <option value="WARN">Warn</option>
          <option value="ERROR">Error</option>
          <option value="CRITICAL">Critical</option>
        </select>
        <span className="text-xs text-forge-muted ml-auto">{filtered.length} entries</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-forge-border text-left text-forge-muted">
              <th className="pb-2 pr-4">Time</th>
              <th className="pb-2 pr-4">Level</th>
              <th className="pb-2 pr-4">Message</th>
              <th className="pb-2 pr-4 text-right">Cost</th>
              <th className="pb-2">Anomaly</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((log) => (
              <tr
                key={log.id}
                className={`border-b border-forge-border/50 ${levelBg[log.log_level ?? "INFO"]}`}
              >
                <td className="py-2 pr-4 text-forge-muted whitespace-nowrap text-xs">
                  {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                </td>
                <td className={`py-2 pr-4 font-medium ${levelColors[log.log_level ?? "INFO"]}`}>
                  {log.log_level}
                </td>
                <td className="py-2 pr-4 text-forge-text max-w-md truncate">
                  {log.message}
                </td>
                <td className="py-2 pr-4 text-right text-forge-muted">
                  {log.cost_usd != null ? `$${log.cost_usd.toFixed(4)}` : "—"}
                </td>
                <td className="py-2">
                  {log.is_anomaly && (
                    <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-medium">
                      ANOMALY
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-forge-muted">
                  No logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
