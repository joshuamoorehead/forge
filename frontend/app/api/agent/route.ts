/**
 * Server-side proxy for the agent query endpoint.
 *
 * The browser calls this Next.js API route, which attaches the AGENT_API_KEY
 * Bearer token and forwards to the FastAPI backend. This keeps the key
 * server-side only — it never ships to the client bundle.
 */

import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const AGENT_API_KEY = process.env.AGENT_API_KEY ?? "";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (AGENT_API_KEY) {
    headers["Authorization"] = `Bearer ${AGENT_API_KEY}`;
  }

  const upstream = await fetch(`${API_BASE}/api/agent/query`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
