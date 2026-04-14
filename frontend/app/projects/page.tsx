"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import ProjectCard from "@/components/ProjectCard";
import { fetchProjects, type ProjectSummary } from "@/lib/api";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects()
      .then((data) => setProjects(data.projects))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load projects"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader title="Projects" subtitle="Tracked repositories and their health" />
        <div className="grid grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-forge-card border border-forge-border rounded-xl p-6 animate-pulse">
              <div className="h-4 w-32 bg-forge-bg-raised rounded mb-4" />
              <div className="h-3 w-20 bg-forge-bg-raised rounded mb-6" />
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-8 bg-forge-bg-raised rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Projects" subtitle="Tracked repositories and their health" />
        <div className="bg-forge-error/10 border border-forge-error/20 rounded-lg px-4 py-3 text-sm text-forge-error">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Projects" subtitle="Tracked repositories and their health" />

      {projects.length === 0 ? (
        <div className="bg-forge-card border border-forge-border rounded-xl p-10 text-center">
          <p className="text-sm font-medium text-forge-text mb-1">No projects tracked yet</p>
          <p className="text-sm text-forge-secondary">
            Send logs to <code className="text-forge-accent font-mono text-xs">/api/ops/logs</code> or
            webhooks to <code className="text-forge-accent font-mono text-xs">/api/webhooks/github</code> to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {projects.map((project) => (
            <ProjectCard key={project.name} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
