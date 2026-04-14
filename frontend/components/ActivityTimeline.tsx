"use client";

import type { ActivityFeedItem } from "@/lib/api";

const typeConfig: Record<string, { color: string; label: string }> = {
  git_commit: { color: "bg-forge-accent", label: "Commit" },
  ops_log: { color: "bg-forge-warning", label: "Log" },
  experiment_completion: { color: "bg-forge-success", label: "Experiment" },
};

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface ActivityTimelineProps {
  items: ActivityFeedItem[];
}

export default function ActivityTimeline({ items }: ActivityTimelineProps) {
  if (items.length === 0) {
    return <p className="text-forge-muted text-sm">No recent activity.</p>;
  }

  return (
    <div>
      {items.map((item, idx) => {
        const config = typeConfig[item.type] ?? { color: "bg-forge-muted", label: item.type };
        return (
          <div key={idx} className="flex gap-4 py-3.5 border-b border-forge-border last:border-b-0">
            {/* Dot */}
            <div className="flex flex-col items-center pt-1.5">
              <div className={`w-2 h-2 rounded-full ${config.color}`} />
              {idx < items.length - 1 && <div className="w-px flex-1 bg-forge-border mt-1.5" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xs font-medium text-forge-secondary">
                  {config.label}
                </span>
                {item.project && (
                  <span className="text-2xs text-forge-muted font-mono">{item.project}</span>
                )}
                <span className="text-2xs text-forge-muted ml-auto flex-shrink-0">
                  {timeAgo(item.timestamp)}
                </span>
              </div>
              <p className="text-sm text-forge-text truncate">{item.summary}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
