"use client";

import PageHeader from "@/components/PageHeader";
import AgentChat from "@/components/AgentChat";

export default function AgentPage() {
  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Agent" subtitle="Query your data with natural language" />
      <AgentChat />
    </div>
  );
}
