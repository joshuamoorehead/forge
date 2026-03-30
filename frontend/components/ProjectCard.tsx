"use client";

import Link from "next/link";
import HealthBadge from "./HealthBadge";
import type { ProjectSummary } from "@/lib/api";

function timeAgo(timestamp: string | null): string {
  if (!timestamp) return "No activity";
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface ProjectCardProps {
  project: ProjectSummary;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      href={`/projects/${encodeURIComponent(project.name)}`}
      className="block bg-forge-card border border-forge-border rounded-xl p-5 hover:border-forge-accent/50 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-base font-semibold text-forge-text">{project.name}</h3>
        <HealthBadge status={project.health} />
      </div>

      <p className="text-xs text-forge-muted mb-4">Last active {timeAgo(project.last_activity)}</p>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-lg font-bold text-forge-text">{project.commit_count_7d}</p>
          <p className="text-xs text-forge-muted">Commits</p>
        </div>
        <div>
          <p className="text-lg font-bold text-forge-text">${project.total_cost_7d.toFixed(2)}</p>
          <p className="text-xs text-forge-muted">Cost</p>
        </div>
        <div>
          <p className={`text-lg font-bold ${project.error_count_7d > 0 ? "text-red-400" : "text-forge-text"}`}>
            {project.error_count_7d}
          </p>
          <p className="text-xs text-forge-muted">Errors</p>
        </div>
      </div>
    </Link>
  );
}
