"use client";

import { useState } from "react";
import type { OpsLogResponse } from "@/lib/api";

const levelColors: Record<string, string> = {
  DEBUG:    "text-forge-muted",
  INFO:     "text-forge-secondary",
  WARN:     "text-forge-warning",
  ERROR:    "text-forge-error",
  CRITICAL: "text-forge-error font-semibold",
};

const levelBg: Record<string, string> = {
  DEBUG:    "",
  INFO:     "",
  WARN:     "",
  ERROR:    "bg-forge-error/[0.04]",
  CRITICAL: "bg-forge-error/[0.06]",
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
        <label className="text-2xs font-medium uppercase tracking-widest text-forge-muted">Severity</label>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="bg-forge-bg border border-forge-border rounded px-2.5 py-1.5 text-sm text-forge-text"
        >
          <option value="ALL">All</option>
          <option value="DEBUG">Debug</option>
          <option value="INFO">Info</option>
          <option value="WARN">Warn</option>
          <option value="ERROR">Error</option>
          <option value="CRITICAL">Critical</option>
        </select>
        <span className="text-xs text-forge-muted ml-auto font-mono">{filtered.length}</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-forge-border text-left">
              <th className="pb-2.5 pr-4 text-2xs font-medium text-forge-muted uppercase tracking-widest">Time</th>
              <th className="pb-2.5 pr-4 text-2xs font-medium text-forge-muted uppercase tracking-widest">Level</th>
              <th className="pb-2.5 pr-4 text-2xs font-medium text-forge-muted uppercase tracking-widest">Message</th>
              <th className="pb-2.5 pr-4 text-right text-2xs font-medium text-forge-muted uppercase tracking-widest">Cost</th>
              <th className="pb-2.5 text-2xs font-medium text-forge-muted uppercase tracking-widest">Anomaly</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((log) => (
              <tr
                key={log.id}
                className={`border-b border-forge-border last:border-b-0 ${levelBg[log.log_level ?? "INFO"]}`}
              >
                <td className="py-2.5 pr-4 text-forge-muted whitespace-nowrap text-xs font-mono">
                  {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                </td>
                <td className={`py-2.5 pr-4 text-xs font-medium ${levelColors[log.log_level ?? "INFO"]}`}>
                  {log.log_level}
                </td>
                <td className="py-2.5 pr-4 text-forge-text max-w-md truncate text-sm">
                  {log.message}
                </td>
                <td className="py-2.5 pr-4 text-right text-forge-muted font-mono text-xs">
                  {log.cost_usd != null ? `$${log.cost_usd.toFixed(4)}` : "—"}
                </td>
                <td className="py-2.5">
                  {log.is_anomaly && (
                    <span className="text-2xs text-forge-error font-medium">
                      ANOMALY
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-forge-muted text-sm">
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
