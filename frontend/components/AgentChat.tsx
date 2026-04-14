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
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <h3 className="text-lg font-medium text-forge-text mb-2">Ask the Agent</h3>
            <p className="text-sm text-forge-secondary mb-6 max-w-md">
              Query your experiment data and ops logs using natural language.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {STARTER_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="px-4 py-2 text-sm bg-forge-card border border-forge-border rounded-lg text-forge-secondary hover:text-forge-text hover:border-forge-border-light transition-colors duration-150"
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
              className={`max-w-[75%] rounded-lg px-4 py-3 ${
                msg.role === "user"
                  ? "bg-forge-accent text-white"
                  : "bg-forge-card border border-forge-border text-forge-text"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

              {/* Tool calls display */}
              {msg.intermediate_results && msg.intermediate_results.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-forge-border pt-3">
                  <p className="text-2xs font-medium text-forge-muted uppercase tracking-widest">
                    Tools Used
                  </p>
                  {msg.intermediate_results.map((ir, j) => (
                    <div
                      key={j}
                      className="bg-forge-bg rounded-md p-2.5 text-xs"
                    >
                      <span className="text-forge-accent font-mono text-2xs font-medium">
                        {ir.tool}
                      </span>
                      <p className="text-forge-muted whitespace-pre-wrap break-words mt-1">
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
            <div className="bg-forge-card border border-forge-border rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-forge-muted">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-forge-accent rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-forge-accent rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-forge-accent rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
                Thinking...
              </div>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="flex justify-center">
            <div className="bg-forge-error/10 border border-forge-error/20 rounded-lg px-4 py-2 text-sm text-forge-error">
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
            className="flex-1 bg-forge-card border border-forge-border rounded-lg px-4 py-3 text-sm text-forge-text placeholder-forge-muted focus:outline-none focus:border-forge-border-light transition-colors duration-150 disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="px-5 py-3 bg-forge-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
