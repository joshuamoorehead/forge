"use client";

interface SummaryCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  accent?: boolean;
}

export default function SummaryCard({ title, value, subtitle, accent }: SummaryCardProps) {
  return (
    <div className="bg-forge-card border border-forge-border rounded-xl p-6">
      <p className="text-2xs font-medium uppercase tracking-widest text-forge-muted mb-2">{title}</p>
      <p className={`text-2xl font-semibold font-mono ${accent ? "text-forge-accent" : "text-forge-text"}`}>
        {value}
      </p>
      {subtitle && <p className="text-xs text-forge-secondary mt-1.5">{subtitle}</p>}
    </div>
  );
}
