"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems: { href: string; label: string; icon: string; external?: boolean }[] = [
  { href: "/", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" },
  { href: "/projects", label: "Projects", icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" },
  { href: "/experiments", label: "Experiments", icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" },
  { href: "/features", label: "Features", icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" },
  { href: "/models", label: "Models", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { href: "/drift", label: "Drift", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
  { href: "/agent", label: "Agent", icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" },
  { href: process.env.NEXT_PUBLIC_GRAFANA_URL || "http://localhost:3001", label: "Monitoring", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", external: true },
];

export default function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside className="w-60 bg-forge-card border-r border-forge-border flex flex-col fixed top-0 left-0 h-full z-30">
      <div className="p-5 border-b border-forge-border">
        <h1 className="text-xl font-bold text-forge-accent tracking-wide">FORGE</h1>
        <p className="text-xs text-forge-muted mt-1">ML Ops Platform</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const active = !item.external && isActive(item.href);
          const className = `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            active
              ? "bg-forge-accent/10 text-forge-accent"
              : "text-forge-muted hover:text-forge-text hover:bg-forge-bg"
          }`;
          const icon = (
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
            </svg>
          );

          if (item.external) {
            return (
              <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer" className={className}>
                {icon}
                {item.label}
                <svg className="w-3 h-3 ml-auto opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            );
          }

          return (
            <Link key={item.href} href={item.href} className={className}>
              {icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
