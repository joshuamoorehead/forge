"use client";

const healthColors: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  green:  { dot: "bg-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Healthy" },
  yellow: { dot: "bg-amber-500",   bg: "bg-amber-500/10",   text: "text-amber-400",   label: "Warning" },
  red:    { dot: "bg-red-500",     bg: "bg-red-500/10",     text: "text-red-400",     label: "Error" },
};

interface HealthBadgeProps {
  status: "green" | "yellow" | "red";
}

export default function HealthBadge({ status }: HealthBadgeProps) {
  const config = healthColors[status] ?? healthColors.green;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
