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
      className="block bg-forge-card border border-forge-border rounded-xl p-6 hover:bg-forge-card-hover hover:border-forge-border-light transition-colors duration-150"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-medium text-forge-text">{project.name}</h3>
        <HealthBadge status={project.health} />
      </div>

      <p className="text-xs text-forge-muted mb-5">Last active {timeAgo(project.last_activity)}</p>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-base font-semibold font-mono text-forge-text">{project.commit_count_7d}</p>
          <p className="text-2xs text-forge-muted uppercase tracking-wider">Commits</p>
        </div>
        <div>
          <p className="text-base font-semibold font-mono text-forge-text">${project.total_cost_7d.toFixed(2)}</p>
          <p className="text-2xs text-forge-muted uppercase tracking-wider">Cost</p>
        </div>
        <div>
          <p className={`text-base font-semibold font-mono ${project.error_count_7d > 0 ? "text-forge-error" : "text-forge-text"}`}>
            {project.error_count_7d}
          </p>
          <p className="text-2xs text-forge-muted uppercase tracking-wider">Errors</p>
        </div>
      </div>
    </Link>
  );
}
