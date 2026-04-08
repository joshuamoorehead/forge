"use client";

import { useEffect, useState } from "react";
import {
  fetchFeatureSets,
  fetchFeatureSetDetail,
  compareFeatureSets,
  type FeatureSetResponse,
  type FeatureSetDetailResponse,
  type FeatureSetCompareResponse,
} from "@/lib/api";

export default function FeaturesPage() {
  const [featureSets, setFeatureSets] = useState<FeatureSetResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] =
    useState<FeatureSetDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Compare state
  const [compareA, setCompareA] = useState<string>("");
  const [compareB, setCompareB] = useState<string>("");
  const [compareResult, setCompareResult] =
    useState<FeatureSetCompareResponse | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  useEffect(() => {
    fetchFeatureSets()
      .then((res) => setFeatureSets(res.feature_sets))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load")
      )
      .finally(() => setLoading(false));
  }, []);

  function handleSelectFeatureSet(id: string) {
    if (selectedDetail?.id === id) {
      setSelectedDetail(null);
      return;
    }
    setDetailLoading(true);
    fetchFeatureSetDetail(id)
      .then(setSelectedDetail)
      .catch(() => setSelectedDetail(null))
      .finally(() => setDetailLoading(false));
  }

  function handleCompare() {
    if (!compareA || !compareB || compareA === compareB) return;
    setCompareLoading(true);
    compareFeatureSets(compareA, compareB)
      .then(setCompareResult)
      .catch(() => setCompareResult(null))
      .finally(() => setCompareLoading(false));
  }

  // Group feature sets by name
  const grouped: Record<string, FeatureSetResponse[]> = {};
  for (const fs of featureSets) {
    if (!grouped[fs.name]) grouped[fs.name] = [];
    grouped[fs.name].push(fs);
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Feature Store</h1>
        <div className="flex items-center gap-3 text-forge-muted">
          <div className="w-5 h-5 border-2 border-forge-accent border-t-transparent rounded-full animate-spin" />
          Loading feature sets...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Feature Store</h1>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Feature Store</h1>

      {featureSets.length === 0 ? (
        <div className="bg-forge-card border border-forge-border rounded-xl p-8 text-center">
          <p className="text-forge-muted mb-1">No feature sets registered yet</p>
          <p className="text-forge-muted text-sm">
            Register one via the API:{" "}
            <code className="text-forge-accent text-xs">
              POST /api/features/register
            </code>
          </p>
        </div>
      ) : (
        <>
          {/* Feature sets grouped by name */}
          <div className="space-y-6 mb-8">
            {Object.entries(grouped).map(([name, versions]) => (
              <div
                key={name}
                className="bg-forge-card border border-forge-border rounded-xl overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-forge-border">
                  <h2 className="text-sm font-semibold text-forge-text">
                    {name}
                  </h2>
                  <p className="text-xs text-forge-muted">
                    {versions.length} version{versions.length !== 1 && "s"}
                  </p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-forge-border/50">
                      <th className="px-4 py-2 text-left text-xs font-medium text-forge-muted uppercase">
                        Version
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-forge-muted uppercase">
                        Description
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-forge-muted uppercase">
                        Columns
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-forge-muted uppercase">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((fs) => (
                      <tr
                        key={fs.id}
                        onClick={() => handleSelectFeatureSet(fs.id)}
                        className={`border-b border-forge-border/30 cursor-pointer transition-colors ${
                          selectedDetail?.id === fs.id
                            ? "bg-forge-accent/10"
                            : "hover:bg-forge-bg"
                        }`}
                      >
                        <td className="px-4 py-2">
                          <span className="text-forge-accent font-mono text-xs">
                            v{fs.version}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-forge-muted text-xs truncate max-w-xs">
                          {fs.description || "—"}
                        </td>
                        <td className="px-4 py-2 text-forge-muted text-xs">
                          {fs.feature_columns?.length ?? 0} features
                        </td>
                        <td className="px-4 py-2 text-forge-muted text-xs">
                          {fs.created_at
                            ? new Date(fs.created_at).toLocaleDateString()
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* Detail panel */}
          {detailLoading && (
            <div className="flex items-center gap-3 text-forge-muted mb-4">
              <div className="w-4 h-4 border-2 border-forge-accent border-t-transparent rounded-full animate-spin" />
              Loading detail...
            </div>
          )}
          {selectedDetail && !detailLoading && (
            <div className="bg-forge-card border border-forge-border rounded-xl p-4 mb-8">
              <h3 className="text-sm font-semibold mb-3">
                {selectedDetail.name} v{selectedDetail.version} — Config
              </h3>
              <pre className="bg-forge-bg rounded-lg p-3 text-xs text-forge-muted overflow-x-auto mb-4">
                {JSON.stringify(selectedDetail.feature_config, null, 2)}
              </pre>

              {selectedDetail.feature_columns &&
                selectedDetail.feature_columns.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-medium text-forge-muted mb-2 uppercase">
                      Output Columns
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedDetail.feature_columns.map((col) => (
                        <span
                          key={col}
                          className="bg-forge-bg text-forge-accent text-xs px-2 py-0.5 rounded font-mono"
                        >
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {selectedDetail.registry_entries.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-forge-muted mb-2 uppercase">
                    Computed Datasets
                  </h4>
                  <div className="space-y-1">
                    {selectedDetail.registry_entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-3 text-xs"
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            entry.status === "ready"
                              ? "bg-emerald-400"
                              : entry.status === "computing"
                              ? "bg-blue-400"
                              : "bg-red-400"
                          }`}
                        />
                        <span className="text-forge-muted font-mono">
                          {entry.dataset_id.slice(0, 8)}...
                        </span>
                        <span className="text-forge-muted">
                          {entry.row_count ?? 0} rows
                        </span>
                        <span className="text-forge-muted">
                          {entry.computed_at
                            ? new Date(entry.computed_at).toLocaleString()
                            : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Compare section */}
          {featureSets.length >= 2 && (
            <div className="bg-forge-card border border-forge-border rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">
                Compare Feature Sets
              </h3>
              <div className="flex items-end gap-3 mb-4">
                <div className="flex-1">
                  <label className="text-xs text-forge-muted block mb-1">
                    Feature Set A
                  </label>
                  <select
                    value={compareA}
                    onChange={(e) => setCompareA(e.target.value)}
                    className="w-full bg-forge-bg border border-forge-border rounded px-3 py-1.5 text-sm text-forge-text"
                  >
                    <option value="">Select...</option>
                    {featureSets.map((fs) => (
                      <option key={fs.id} value={fs.id}>
                        {fs.name} v{fs.version}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-forge-muted block mb-1">
                    Feature Set B
                  </label>
                  <select
                    value={compareB}
                    onChange={(e) => setCompareB(e.target.value)}
                    className="w-full bg-forge-bg border border-forge-border rounded px-3 py-1.5 text-sm text-forge-text"
                  >
                    <option value="">Select...</option>
                    {featureSets.map((fs) => (
                      <option key={fs.id} value={fs.id}>
                        {fs.name} v{fs.version}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleCompare}
                  disabled={
                    !compareA || !compareB || compareA === compareB || compareLoading
                  }
                  className="bg-forge-accent text-white px-4 py-1.5 rounded text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  {compareLoading ? "Comparing..." : "Compare"}
                </button>
              </div>

              {compareResult && (
                <div className="bg-forge-bg rounded-lg p-3 text-xs space-y-2">
                  {compareResult.columns_added.length > 0 && (
                    <div>
                      <span className="text-emerald-400 font-medium">
                        + Added columns:{" "}
                      </span>
                      <span className="text-forge-muted font-mono">
                        {compareResult.columns_added.join(", ")}
                      </span>
                    </div>
                  )}
                  {compareResult.columns_removed.length > 0 && (
                    <div>
                      <span className="text-red-400 font-medium">
                        - Removed columns:{" "}
                      </span>
                      <span className="text-forge-muted font-mono">
                        {compareResult.columns_removed.join(", ")}
                      </span>
                    </div>
                  )}
                  {Object.keys(compareResult.config_changed).length > 0 && (
                    <div>
                      <span className="text-yellow-400 font-medium">
                        ~ Changed config:{" "}
                      </span>
                      <pre className="text-forge-muted mt-1 ml-2">
                        {JSON.stringify(compareResult.config_changed, null, 2)}
                      </pre>
                    </div>
                  )}
                  {compareResult.columns_added.length === 0 &&
                    compareResult.columns_removed.length === 0 &&
                    Object.keys(compareResult.config_changed).length === 0 &&
                    Object.keys(compareResult.config_added).length === 0 &&
                    Object.keys(compareResult.config_removed).length === 0 && (
                      <p className="text-forge-muted">
                        No differences found between these feature sets.
                      </p>
                    )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
