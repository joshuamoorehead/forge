"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
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
        <PageHeader title="Experiments" subtitle="Track and compare ML experiment runs" />
        <div className="bg-forge-card border border-forge-border rounded-xl overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-6 px-5 py-3.5 border-b border-forge-border last:border-b-0 animate-pulse">
              <div className="h-4 w-40 bg-forge-bg-raised rounded" />
              <div className="h-4 w-16 bg-forge-bg-raised rounded" />
              <div className="h-4 w-20 bg-forge-bg-raised rounded" />
              <div className="h-4 w-24 bg-forge-bg-raised rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Experiments" subtitle="Track and compare ML experiment runs" />
        <div className="bg-forge-error/10 border border-forge-error/20 rounded-lg px-4 py-3 text-sm text-forge-error">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Experiments" subtitle="Track and compare ML experiment runs" />

      {experiments.length === 0 ? (
        <div className="bg-forge-card border border-forge-border rounded-xl p-10 text-center">
          <p className="text-sm font-medium text-forge-text mb-1">No experiments yet</p>
          <p className="text-sm text-forge-secondary">
            Create one via the API:{" "}
            <code className="text-forge-accent font-mono text-xs">POST /api/experiments</code>
          </p>
        </div>
      ) : (
        <div className="bg-forge-card border border-forge-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-forge-border bg-forge-bg-raised sticky top-0 z-10">
                <th className="px-5 py-3 text-left text-2xs font-medium text-forge-muted uppercase tracking-widest">
                  Name
                </th>
                <th className="px-5 py-3 text-left text-2xs font-medium text-forge-muted uppercase tracking-widest">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-2xs font-medium text-forge-muted uppercase tracking-widest">
                  Dataset
                </th>
                <th className="px-5 py-3 text-left text-2xs font-medium text-forge-muted uppercase tracking-widest">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {experiments.map((exp) => (
                <tr
                  key={exp.id}
                  onClick={() => router.push(`/experiments/${exp.id}`)}
                  className="border-b border-forge-border last:border-b-0 hover:bg-white/[0.02] transition-colors duration-150 cursor-pointer"
                >
                  <td className="px-5 py-3.5">
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
                  <td className="px-5 py-3.5">
                    <StatusBadge status={exp.status} />
                  </td>
                  <td className="px-5 py-3.5 text-forge-muted text-xs font-mono">
                    {exp.dataset_id ? exp.dataset_id.slice(0, 8) + "..." : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-forge-muted text-xs">
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
