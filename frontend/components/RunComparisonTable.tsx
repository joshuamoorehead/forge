"use client";

import { useState, useMemo } from "react";
import type { RunResponse } from "@/lib/api";

type SortKey =
  | "run_name"
  | "model_type"
  | "accuracy"
  | "precision_score"
  | "recall"
  | "f1"
  | "inference_latency_ms"
  | "peak_memory_mb"
  | "throughput_samples_per_sec"
  | "efficiency_score";

interface Props {
  runs: RunResponse[];
  onSelectRun?: (run: RunResponse) => void;
  selectedRunId?: string | null;
}

const columns: { key: SortKey; label: string; format?: (v: number | null) => string }[] = [
  { key: "run_name", label: "Run" },
  { key: "model_type", label: "Model" },
  { key: "accuracy", label: "Accuracy", format: (v) => (v != null ? (v * 100).toFixed(2) + "%" : "—") },
  { key: "precision_score", label: "Precision", format: (v) => (v != null ? (v * 100).toFixed(2) + "%" : "—") },
  { key: "recall", label: "Recall", format: (v) => (v != null ? (v * 100).toFixed(2) + "%" : "—") },
  { key: "f1", label: "F1", format: (v) => (v != null ? (v * 100).toFixed(2) + "%" : "—") },
  { key: "inference_latency_ms", label: "Latency (ms)", format: (v) => (v != null ? v.toFixed(2) : "—") },
  { key: "peak_memory_mb", label: "Memory (MB)", format: (v) => (v != null ? v.toFixed(1) : "—") },
  { key: "throughput_samples_per_sec", label: "Throughput", format: (v) => (v != null ? v.toFixed(0) + " s/s" : "—") },
  { key: "efficiency_score", label: "Efficiency", format: (v) => (v != null ? v.toFixed(3) : "—") },
];

export default function RunComparisonTable({ runs, onSelectRun, selectedRunId }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("accuracy");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...runs];
    copy.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      return sortAsc ? aNum - bNum : bNum - aNum;
    });
    return copy;
  }, [runs, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  if (runs.length === 0) {
    return <p className="text-forge-muted text-sm">No runs recorded for this experiment.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-forge-border">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className="px-3 py-2.5 text-left text-xs font-medium text-forge-muted uppercase tracking-wider cursor-pointer hover:text-forge-text transition-colors select-none whitespace-nowrap"
              >
                {col.label}
                {sortKey === col.key && (
                  <span className="ml-1 text-forge-accent">{sortAsc ? "▲" : "▼"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((run) => (
            <tr
              key={run.id}
              onClick={() => onSelectRun?.(run)}
              className={`border-b border-forge-border/50 cursor-pointer transition-colors ${
                selectedRunId === run.id
                  ? "bg-forge-accent/10"
                  : "hover:bg-forge-bg"
              }`}
            >
              {columns.map((col) => {
                const raw = run[col.key];
                const display =
                  col.format && typeof raw === "number"
                    ? col.format(raw as number)
                    : col.format && raw == null
                    ? col.format(null)
                    : raw ?? "—";
                return (
                  <td key={col.key} className="px-3 py-2.5 whitespace-nowrap text-forge-text">
                    {String(display)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
