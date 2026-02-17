"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, X, Send, AlertCircle } from "lucide-react";
import { TripRoute, TeslaModel, ChatMessage } from "@/lib/types";

interface AskAIProps {
  trip: TripRoute;
  selectedModel: TeslaModel;
  startCharge: number;
}

/** Simple inline markdown: **bold**, [links](url), and bullet points */
function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const content = trimmed.slice(2);
      elements.push(
        <li key={i} className="ml-4 list-disc text-xs leading-relaxed">
          {renderInline(content)}
        </li>
      );
    } else if (trimmed === "") {
      elements.push(<br key={i} />);
    } else {
      elements.push(
        <p key={i} className="text-xs leading-relaxed break-words">
          {renderInline(trimmed)}
        </p>
      );
    }
  }

  return elements;
}

/** Parse inline markdown: [links](url) and **bold** */
function renderInline(text: string): React.ReactNode[] {
  // Split on markdown links [text](url) and bold **text**
  const tokens = text.split(/(\[([^\]]+)\]\(([^)]+)\)|\*\*[^*]+\*\*)/g);
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];
    // The regex with capturing groups produces: [before, fullMatch, linkText, linkUrl, ...]
    // Check if this token is a full markdown link match
    if (token && /^\[([^\]]+)\]\(([^)]+)\)$/.test(token)) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        nodes.push(
          <a
            key={i}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#e31937] underline underline-offset-2 break-all hover:opacity-80 transition-opacity"
          >
            {linkMatch[1]}
          </a>
        );
        i++;
        continue;
      }
    }

    if (token && token.startsWith("**") && token.endsWith("**")) {
      nodes.push(
        <strong key={i} className="font-semibold">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token) {
      nodes.push(<span key={i}>{token}</span>);
    }
    i++;
  }

  return nodes;
}

function BouncingDots() {
  return (
    <div className="flex items-center gap-1 py-1 px-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-muted-fg"
          style={{
            animation: "bounce 1.2s infinite",
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default function AskAI({ trip, selectedModel, startCharge }: AskAIProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const firstStopName = trip.chargingStops[0]?.station.name ?? "your first stop";

  const suggestionChips = [
    `Best food near ${firstStopName}`,
    `Coffee shops near ${firstStopName}`,
    "Hidden gems between stops",
    "Fun road trip games for the drive",
    "Most Instagrammable spots on this route",
    "Make me a road trip playlist vibe",
  ];

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  const tripContext = {
    origin: trip.origin,
    destination: trip.destination,
    vehicle: selectedModel.name,
    distance: trip.distance,
    duration: trip.duration,
    totalChargeTime: trip.totalChargeTime,
    arrivalCharge: trip.arrivalCharge,
    stops: trip.chargingStops.map((s) => ({
      name: s.station.name,
      address: s.station.address,
      chargeTime: s.chargeTime,
      distanceFromStart: s.distanceFromStart,
    })),
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || streaming) return;

    setError(null);
    const userMessage: ChatMessage = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    // Add placeholder assistant message
    const assistantMessage: ChatMessage = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMessage]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, tripContext }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to get response");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: accumulated,
                };
                return updated;
              });
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      const errorMsg =
        err instanceof Error ? err.message : "Something went wrong";
      setError(errorMsg);
      // Remove empty assistant message on error
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Collapsed state
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full mt-4 flex items-center gap-3 py-3 px-4 bg-gradient-to-br from-elevated/80 to-surface/80 border border-transparent rounded-2xl transition-all group ask-ai-glow"
      >
        <div className="w-8 h-8 rounded-xl bg-[#e31937]/10 flex items-center justify-center shrink-0 group-hover:bg-[#e31937]/20 transition-colors">
          <Sparkles size={16} className="text-[#e31937]" />
        </div>
        <div className="text-left flex-1 min-w-0">
          <span className="text-xs font-semibold text-foreground">Ask AI</span>
          <p className="text-[10px] text-muted-fg leading-tight mt-0.5 truncate">
            Find food, fun &amp; hidden gems along your route
          </p>
        </div>
      </button>
    );
  }

  // Expanded state
  return (
    <div className="mt-4 bg-gradient-to-br from-elevated/80 to-surface/80 border border-transparent rounded-2xl overflow-hidden ask-ai-glow">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-edge/30">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[#e31937]" />
          <span className="text-xs font-semibold text-foreground">Ask AI</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-elevated border border-edge/50 text-dim-fg">
            powered by Grok
          </span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-accent-surface/80 transition-colors"
        >
          <X size={13} className="text-muted-fg" />
        </button>
      </div>

      {/* Messages area */}
      <div className="max-h-[234px] md:max-h-[312px] overflow-y-auto scrollbar-none px-3 py-2 space-y-2">
        {messages.length === 0 && !error && (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-fg text-center mb-2">
              Ask me anything about your trip!
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestionChips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  className="text-[10px] px-2.5 py-1.5 rounded-full bg-elevated/80 border border-edge/40 text-secondary-fg hover:border-[#e31937]/30 hover:text-foreground transition-all"
                >
                  {chip}
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
              className={`max-w-[85%] rounded-xl px-3 py-2 overflow-hidden ${
                msg.role === "user"
                  ? "bg-[#e31937] text-white"
                  : "bg-elevated/80 border border-edge/30 text-secondary-fg"
              }`}
            >
              {msg.role === "user" ? (
                <p className="text-xs leading-relaxed">{msg.content}</p>
              ) : msg.content ? (
                <div
                  className={
                    streaming && i === messages.length - 1
                      ? "streaming-cursor"
                      : ""
                  }
                >
                  {renderMarkdown(msg.content)}
                </div>
              ) : (
                <BouncingDots />
              )}
            </div>
          </div>
        ))}

        {messages.length > 0 && !streaming && (
          <div className="flex justify-center pt-1">
            <button
              onClick={() =>
                sendMessage(
                  "Give me more example questions I could ask you about this trip"
                )
              }
              className="text-[10px] px-2.5 py-1.5 rounded-full bg-elevated/80 border border-edge/40 text-muted-fg hover:border-[#e31937]/30 hover:text-foreground transition-all"
            >
              Give me more examples
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertCircle size={12} className="text-red-400 shrink-0" />
            <p className="text-[10px] text-red-400">{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-3 py-2.5 border-t border-edge/30"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your trip..."
          disabled={streaming}
          className="flex-1 bg-transparent text-xs text-foreground placeholder:text-dim-fg outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || streaming}
          className="w-7 h-7 rounded-lg bg-[#e31937] flex items-center justify-center disabled:opacity-30 hover:bg-[#ff2d4b] transition-colors shrink-0"
        >
          <Send size={12} className="text-white" />
        </button>
      </form>
    </div>
  );
}
