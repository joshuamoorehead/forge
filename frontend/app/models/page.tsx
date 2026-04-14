"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { fetchModels, type ModelListItem } from "@/lib/api";

export default function ModelsPage() {
  const [models, setModels] = useState<ModelListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchModels()
      .then((res) => setModels(res.models))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader title="Model Registry" subtitle="Registered models and their versions" />
        <div className="grid grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-forge-card border border-forge-border rounded-xl p-6 animate-pulse">
              <div className="h-4 w-28 bg-forge-bg-raised rounded mb-3" />
              <div className="h-3 w-full bg-forge-bg-raised rounded mb-4" />
              <div className="h-3 w-40 bg-forge-bg-raised rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Model Registry" subtitle="Registered models and their versions" />
        <div className="bg-forge-error/10 border border-forge-error/20 rounded-lg px-4 py-3 text-sm text-forge-error">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Model Registry" subtitle="Registered models and their versions" />

      {models.length === 0 ? (
        <div className="bg-forge-card border border-forge-border rounded-xl p-10 text-center">
          <p className="text-sm font-medium text-forge-text mb-1">No models registered yet</p>
          <p className="text-sm text-forge-secondary">
            Register one via the API:{" "}
            <code className="text-forge-accent font-mono text-xs">POST /api/models/register</code>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {models.map((m) => (
            <Link
              key={m.id}
              href={`/models/${encodeURIComponent(m.name)}`}
              className="bg-forge-card border border-forge-border rounded-xl p-6 hover:bg-forge-card-hover hover:border-forge-border-light transition-colors duration-150"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-medium text-forge-text truncate">{m.name}</h2>
                {m.production_version != null && (
                  <span className="text-2xs font-medium text-forge-success">
                    v{m.production_version} prod
                  </span>
                )}
              </div>
              {m.description && (
                <p className="text-xs text-forge-secondary mb-4 truncate">{m.description}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-forge-muted">
                <span>{m.version_count} version{m.version_count !== 1 && "s"}</span>
                {m.production_accuracy != null && (
                  <span className="font-mono">{(m.production_accuracy * 100).toFixed(1)}%</span>
                )}
                {m.updated_at && (
                  <span>{new Date(m.updated_at).toLocaleDateString()}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
