"use client";

import type { ActivityFeedItem } from "@/lib/api";

const typeConfig: Record<string, { color: string; label: string }> = {
  git_commit: { color: "bg-blue-500", label: "Commit" },
  ops_log: { color: "bg-amber-500", label: "Log" },
  experiment_completion: { color: "bg-emerald-500", label: "Experiment" },
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
    <div className="space-y-0">
      {items.map((item, idx) => {
        const config = typeConfig[item.type] ?? { color: "bg-gray-500", label: item.type };
        return (
          <div key={idx} className="flex gap-4 py-3 border-b border-forge-border last:border-b-0">
            {/* Dot */}
            <div className="flex flex-col items-center pt-1">
              <div className={`w-2.5 h-2.5 rounded-full ${config.color}`} />
              {idx < items.length - 1 && <div className="w-px flex-1 bg-forge-border mt-1" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${config.color} bg-opacity-20 text-forge-text`}>
                  {config.label}
                </span>
                {item.project && (
                  <span className="text-xs text-forge-muted">{item.project}</span>
                )}
                <span className="text-xs text-forge-muted ml-auto flex-shrink-0">
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
