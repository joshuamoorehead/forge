const statusStyles: Record<string, string> = {
  completed:   "bg-forge-success/10 text-forge-success",
  running:     "bg-forge-accent/10 text-forge-accent",
  failed:      "bg-forge-error/10 text-forge-error",
  drifted:     "bg-forge-error/10 text-forge-error",
  stable:      "bg-forge-success/10 text-forge-success",
  development: "bg-forge-muted/10 text-forge-secondary",
  staging:     "bg-forge-accent/10 text-forge-accent",
  production:  "bg-forge-success/10 text-forge-success",
  archived:    "bg-forge-error/10 text-forge-error",
  ready:       "bg-forge-success/10 text-forge-success",
  computing:   "bg-forge-accent/10 text-forge-accent",
  pending:     "bg-forge-muted/10 text-forge-secondary",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const style = statusStyles[status] ?? "bg-forge-muted/10 text-forge-secondary";
  return (
    <span className={`inline-block text-2xs font-medium px-2 py-0.5 rounded ${style} ${className}`}>
      {status}
    </span>
  );
}
