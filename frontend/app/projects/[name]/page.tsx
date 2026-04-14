"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import HealthBadge from "@/components/HealthBadge";
import LogTable from "@/components/LogTable";
import CostChart from "@/components/CostChart";
import PageHeader from "@/components/PageHeader";
import {
  fetchProjectDetail,
  fetchProjects,
  type ProjectDetailResponse,
  type ProjectSummary,
} from "@/lib/api";

const tabs = ["Activity", "Logs", "Cost", "Experiments"] as const;
type Tab = (typeof tabs)[number];

export default function ProjectDetailPage() {
  const params = useParams();
  const name = decodeURIComponent(params.name as string);

  const [detail, setDetail] = useState<ProjectDetailResponse | null>(null);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("Activity");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchProjectDetail(name),
      fetchProjects().then((r) => r.projects.find((p) => p.name === name) ?? null),
    ])
      .then(([d, s]) => {
        setDetail(d);
        setSummary(s);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [name]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Project Detail" />
        <div className="bg-forge-card border border-forge-border rounded-xl p-6 animate-pulse">
          <div className="h-5 w-40 bg-forge-bg-raised rounded mb-4" />
          <div className="h-3 w-64 bg-forge-bg-raised rounded" />
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div>
        <PageHeader title="Project Detail" />
        <div className="bg-forge-error/10 border border-forge-error/20 rounded-lg px-4 py-3 text-sm text-forge-error">
          Project not found.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <h1 className="text-2xl font-semibold">{name}</h1>
        {summary && <HealthBadge status={summary.health} />}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-forge-border mb-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-150 ${
              activeTab === tab
                ? "border-forge-accent text-forge-text"
                : "border-transparent text-forge-muted hover:text-forge-secondary"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-forge-card border border-forge-border rounded-xl p-6">
        {activeTab === "Activity" && <ActivityTab events={detail.git_events} />}
        {activeTab === "Logs" && <LogTable logs={detail.recent_logs} />}
        {activeTab === "Cost" && <CostChart logs={detail.recent_logs} />}
        {activeTab === "Experiments" && <ExperimentsTab experiments={detail.linked_experiments} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity Tab — vertical git commit timeline
// ---------------------------------------------------------------------------

function ActivityTab({ events }: { events: ProjectDetailResponse["git_events"] }) {
  if (events.length === 0) {
    return <p className="text-forge-muted text-sm">No git activity recorded.</p>;
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-3 top-2 bottom-2 w-px bg-forge-border" />

      <div className="space-y-4">
        {events.map((evt) => (
          <div key={evt.id} className="flex gap-4 relative">
            {/* Dot */}
            <div className="w-6 flex-shrink-0 flex justify-center pt-1.5 z-10">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-forge-card" />
            </div>

            {/* Content */}
            <div className="flex-1 pb-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-forge-muted font-mono">{evt.commit_sha?.slice(0, 7)}</span>
                <span className="text-xs text-forge-muted">{evt.branch}</span>
                <span className="text-xs text-forge-muted ml-auto">
                  {evt.created_at ? new Date(evt.created_at).toLocaleString() : "—"}
                </span>
              </div>
              <p className="text-sm text-forge-text">{evt.commit_message || "No message"}</p>
              <div className="flex gap-3 mt-1 text-xs text-forge-muted">
                {evt.author && <span>by {evt.author}</span>}
                {evt.files_changed != null && <span>{evt.files_changed} files</span>}
                {evt.additions != null && <span className="text-forge-success">+{evt.additions}</span>}
                {evt.deletions != null && <span className="text-forge-error">-{evt.deletions}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Experiments Tab
// ---------------------------------------------------------------------------

function ExperimentsTab({ experiments }: { experiments: ProjectDetailResponse["linked_experiments"] }) {
  if (experiments.length === 0) {
    return (
      <p className="text-forge-muted text-sm">
        No experiments linked to this project. Experiments are matched by name.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {experiments.map((exp) => (
        <div
          key={exp.id}
          className="flex items-center justify-between border border-forge-border rounded-lg p-3"
        >
          <div>
            <p className="text-sm font-medium text-forge-text">{exp.name}</p>
            {exp.description && (
              <p className="text-xs text-forge-muted mt-0.5">{exp.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-2xs font-medium ${
                exp.status === "completed"
                  ? "text-forge-success"
                  : exp.status === "running"
                  ? "text-forge-accent"
                  : exp.status === "failed"
                  ? "text-forge-error"
                  : "text-forge-muted"
              }`}
            >
              {exp.status}
            </span>
            <span className="text-xs text-forge-muted">
              {exp.created_at ? new Date(exp.created_at).toLocaleDateString() : ""}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
