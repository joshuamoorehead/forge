"use client";

const healthColors: Record<string, { dot: string; text: string; label: string }> = {
  green:  { dot: "bg-forge-success", text: "text-forge-success", label: "Healthy" },
  yellow: { dot: "bg-forge-warning", text: "text-forge-warning", label: "Warning" },
  red:    { dot: "bg-forge-error",   text: "text-forge-error",   label: "Error" },
};

interface HealthBadgeProps {
  status: "green" | "yellow" | "red";
}

export default function HealthBadge({ status }: HealthBadgeProps) {
  const config = healthColors[status] ?? healthColors.green;
  return (
    <span className={`inline-flex items-center gap-1.5 text-2xs font-medium ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
