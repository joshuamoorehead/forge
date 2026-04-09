"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchExperiments, type ExperimentResponse } from "@/lib/api";

export default function ExperimentsPage() {
  const router = useRouter();
  const [experiments, setExperiments] = useState<ExperimentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchExperiments()
      .then((res) => setExperiments(res.experiments))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load experiments"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Experiments</h1>
        <div className="flex items-center gap-3 text-forge-muted">
          <div className="w-5 h-5 border-2 border-forge-accent border-t-transparent rounded-full animate-spin" />
          Loading experiments...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Experiments</h1>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Experiments</h1>

      {experiments.length === 0 ? (
        <div className="bg-forge-card border border-forge-border rounded-xl p-8 text-center">
          <p className="text-forge-muted mb-1">No experiments yet</p>
          <p className="text-forge-muted text-sm">
            Create one via the API:{" "}
            <code className="text-forge-accent text-xs">POST /api/experiments</code>
          </p>
        </div>
      ) : (
        <div className="bg-forge-card border border-forge-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-forge-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-forge-muted uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-forge-muted uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-forge-muted uppercase tracking-wider">
                  Dataset
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-forge-muted uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {experiments.map((exp) => (
                <tr
                  key={exp.id}
                  onClick={() => router.push(`/experiments/${exp.id}`)}
                  className="border-b border-forge-border/50 hover:bg-forge-bg transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/experiments/${exp.id}`}
                      className="text-forge-text font-medium hover:text-forge-accent transition-colors"
                    >
                      {exp.name}
                    </Link>
                    {exp.description && (
                      <p className="text-xs text-forge-muted mt-0.5 truncate max-w-sm">
                        {exp.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        exp.status === "completed"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : exp.status === "running"
                          ? "bg-blue-500/10 text-blue-400"
                          : exp.status === "failed"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-gray-500/10 text-gray-400"
                      }`}
                    >
                      {exp.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-forge-muted text-xs font-mono">
                    {exp.dataset_id ? exp.dataset_id.slice(0, 8) + "..." : "—"}
                  </td>
                  <td className="px-4 py-3 text-forge-muted text-xs">
                    {exp.created_at
                      ? new Date(exp.created_at).toLocaleDateString()
                      : "—"}
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
