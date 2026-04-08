"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
        <h1 className="text-2xl font-bold mb-6">Model Registry</h1>
        <div className="flex items-center gap-3 text-forge-muted">
          <div className="w-5 h-5 border-2 border-forge-accent border-t-transparent rounded-full animate-spin" />
          Loading models...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Model Registry</h1>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Model Registry</h1>

      {models.length === 0 ? (
        <div className="bg-forge-card border border-forge-border rounded-xl p-8 text-center">
          <p className="text-forge-muted mb-1">No models registered yet</p>
          <p className="text-forge-muted text-sm">
            Register one via the API:{" "}
            <code className="text-forge-accent text-xs">POST /api/models/register</code>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map((m) => (
            <Link
              key={m.id}
              href={`/models/${encodeURIComponent(m.name)}`}
              className="bg-forge-card border border-forge-border rounded-xl p-5 hover:border-forge-accent/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-forge-text truncate">{m.name}</h2>
                {m.production_version != null && (
                  <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-0.5 rounded-full font-medium">
                    v{m.production_version} prod
                  </span>
                )}
              </div>
              {m.description && (
                <p className="text-xs text-forge-muted mb-3 truncate">{m.description}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-forge-muted">
                <span>{m.version_count} version{m.version_count !== 1 && "s"}</span>
                {m.production_accuracy != null && (
                  <span>Accuracy: {(m.production_accuracy * 100).toFixed(1)}%</span>
                )}
                {m.updated_at && (
                  <span>Updated {new Date(m.updated_at).toLocaleDateString()}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
