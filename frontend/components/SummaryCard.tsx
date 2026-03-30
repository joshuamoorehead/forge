"use client";

interface SummaryCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  accent?: boolean;
}

export default function SummaryCard({ title, value, subtitle, accent }: SummaryCardProps) {
  return (
    <div className="bg-forge-card border border-forge-border rounded-xl p-5">
      <p className="text-sm text-forge-muted">{title}</p>
      <p className={`text-3xl font-bold mt-1 ${accent ? "text-forge-accent" : "text-forge-text"}`}>
        {value}
      </p>
      {subtitle && <p className="text-xs text-forge-muted mt-1">{subtitle}</p>}
    </div>
  );
}
