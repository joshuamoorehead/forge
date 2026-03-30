"use client";

import { useState, useRef, useEffect } from "react";
import { sendAgentQuery, type IntermediateResult } from "@/lib/api";

interface ChatMessage {
  role: "user" | "agent";
  content: string;
  tools_used?: string[];
  intermediate_results?: IntermediateResult[];
}

const STARTER_QUESTIONS = [
  "Which model is most efficient?",
  "Show ops anomalies from today",
  "Compare my last two runs",
];

export default function AgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(question?: string) {
    const text = question ?? input.trim();
    if (!text || loading) return;

    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await sendAgentQuery(text);
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content: res.answer,
          tools_used: res.tools_used,
          intermediate_results: res.intermediate_results,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach agent");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-forge-accent/10 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-forge-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-forge-text mb-2">Ask the Agent</h3>
            <p className="text-sm text-forge-muted mb-6 max-w-md">
              Query your experiment data and ops logs using natural language. The agent uses tools to search, compare, and analyze.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {STARTER_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="px-4 py-2 text-sm bg-forge-card border border-forge-border rounded-lg text-forge-muted hover:text-forge-text hover:border-forge-accent/50 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-forge-accent text-white"
                  : "bg-forge-card border border-forge-border text-forge-text"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

              {/* Tool calls display */}
              {msg.intermediate_results && msg.intermediate_results.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-forge-border/50 pt-3">
                  <p className="text-xs font-medium text-forge-muted uppercase tracking-wider">
                    Tools Used
                  </p>
                  {msg.intermediate_results.map((ir, j) => (
                    <div
                      key={j}
                      className="bg-forge-bg rounded-lg p-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-1.5 py-0.5 rounded bg-forge-accent/10 text-forge-accent font-mono font-medium">
                          {ir.tool}
                        </span>
                      </div>
                      <p className="text-forge-muted whitespace-pre-wrap break-words">
                        {ir.result_preview}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-forge-card border border-forge-border rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-forge-muted">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-forge-accent rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-forge-accent rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-forge-accent rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
                Agent is thinking...
              </div>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="flex justify-center">
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">
              {error}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-forge-border pt-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about experiments, runs, or ops data..."
            disabled={loading}
            className="flex-1 bg-forge-card border border-forge-border rounded-lg px-4 py-3 text-sm text-forge-text placeholder-forge-muted focus:outline-none focus:border-forge-accent transition-colors disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="px-5 py-3 bg-forge-accent text-white rounded-lg text-sm font-medium hover:bg-forge-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
