"use client";

import { useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
  Cell,
} from "recharts";
import type { RunResponse } from "@/lib/api";

interface Props {
  runs: RunResponse[];
}

interface PlotPoint {
  id: string;
  run_name: string;
  model_type: string;
  latency: number;
  accuracy: number;
  efficiency_score: number | null;
  isPareto: boolean;
}

/**
 * Compute the Pareto front: runs where no other run has both higher accuracy
 * AND lower latency. Sort by latency ascending, sweep tracking max accuracy.
 */
function computePareto(points: PlotPoint[]): Set<string> {
  const sorted = [...points].sort((a, b) => a.latency - b.latency);
  const paretoIds = new Set<string>();
  let maxAcc = -Infinity;

  // Sweep from lowest latency to highest — a point is Pareto-optimal
  // if its accuracy is >= the best accuracy seen so far at lower latency
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].accuracy >= maxAcc) {
      paretoIds.add(sorted[i].id);
      maxAcc = sorted[i].accuracy;
    }
  }
  return paretoIds;
}

const PARETO_COLOR = "#6366f1"; // forge-accent (indigo)
const NORMAL_COLOR = "#475569"; // slate-600

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: PlotPoint }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-forge-card border border-forge-border rounded-lg p-3 text-xs shadow-xl">
      <p className="font-semibold text-forge-text mb-1">{d.run_name || d.model_type}</p>
      <p className="text-forge-muted">
        Accuracy: <span className="text-forge-text">{(d.accuracy * 100).toFixed(2)}%</span>
      </p>
      <p className="text-forge-muted">
        Latency: <span className="text-forge-text">{d.latency.toFixed(2)} ms</span>
      </p>
      {d.efficiency_score != null && (
        <p className="text-forge-muted">
          Efficiency: <span className="text-forge-text">{d.efficiency_score.toFixed(3)}</span>
        </p>
      )}
      {d.isPareto && (
        <p className="text-forge-accent font-medium mt-1">Pareto-optimal</p>
      )}
    </div>
  );
}

export default function EfficiencyFrontier({ runs }: Props) {
  const { points, paretoLine } = useMemo(() => {
    // Filter runs that have both accuracy and latency
    const valid: PlotPoint[] = runs
      .filter((r) => r.accuracy != null && r.inference_latency_ms != null)
      .map((r) => ({
        id: r.id,
        run_name: r.run_name || r.model_type,
        model_type: r.model_type,
        latency: r.inference_latency_ms!,
        accuracy: r.accuracy!,
        efficiency_score: r.efficiency_score,
        isPareto: false,
      }));

    const paretoIds = computePareto(valid);
    for (const p of valid) {
      p.isPareto = paretoIds.has(p.id);
    }

    // Build sorted Pareto line data for the connecting line
    const line = valid
      .filter((p) => p.isPareto)
      .sort((a, b) => a.latency - b.latency);

    return { points: valid, paretoLine: line };
  }, [runs]);

  if (points.length === 0) {
    return (
      <p className="text-forge-muted text-sm">
        Not enough data to render the efficiency frontier. Runs need both accuracy and latency metrics.
      </p>
    );
  }

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
          <CartesianGrid stroke="#2a2d3a" strokeDasharray="3 3" />
          <XAxis
            dataKey="latency"
            type="number"
            name="Latency (ms)"
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            label={{
              value: "Inference Latency (ms)",
              position: "insideBottom",
              offset: -10,
              fill: "#94a3b8",
              fontSize: 12,
            }}
          />
          <YAxis
            dataKey="accuracy"
            type="number"
            name="Accuracy"
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            tickFormatter={(v: number) => (v * 100).toFixed(0) + "%"}
            label={{
              value: "Accuracy",
              angle: -90,
              position: "insideLeft",
              offset: 10,
              fill: "#94a3b8",
              fontSize: 12,
            }}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Pareto connecting line */}
          {paretoLine.length > 1 && (
            <Line
              data={paretoLine}
              dataKey="accuracy"
              stroke={PARETO_COLOR}
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              legendType="none"
            />
          )}

          {/* All run points */}
          <Scatter data={points} fill={NORMAL_COLOR}>
            {points.map((point) => (
              <Cell
                key={point.id}
                fill={point.isPareto ? PARETO_COLOR : NORMAL_COLOR}
                r={point.isPareto ? 7 : 5}
              />
            ))}
          </Scatter>
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-2 text-xs text-forge-muted">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PARETO_COLOR }} />
          <span>Pareto-optimal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NORMAL_COLOR }} />
          <span>Other runs</span>
        </div>
      </div>
    </div>
  );
}
