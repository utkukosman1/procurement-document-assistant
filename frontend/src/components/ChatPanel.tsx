"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { ApiError, askQuestion, type Citation } from "@/lib/api";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  citations?: Citation[];
  isSummary?: boolean;
}

interface ChatPanelProps {
  documentId: string;
  filename: string;
  documentType: string;
}

const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  Contract: [
    "What are the payment terms?",
    "When does this agreement expire or renew?",
    "What are the termination conditions?",
  ],
  "RFP/RFQ": [
    "What is the submission deadline?",
    "What are the evaluation criteria?",
    "What is the scope of work requested?",
  ],
  "Quote/Proposal": [
    "What is the total quoted price?",
    "What is the delivery or completion timeline?",
    "What are the payment terms?",
  ],
  Invoice: [
    "What is the total amount due?",
    "When is the payment due date?",
    "What line items are included?",
  ],
  SLA: [
    "What are the uptime or performance guarantees?",
    "What happens if service levels are missed?",
    "How are service credits calculated?",
  ],
  Amendment: [
    "What terms does this amendment change?",
    "Which original agreement does this amend?",
    "When does this amendment take effect?",
  ],
  NDA: [
    "What are the receiving party's obligations?",
    "How long does confidentiality last?",
    "What information is excluded from confidentiality?",
  ],
  "Purchase Order": [
    "What items or quantities are being ordered?",
    "What is the total order value?",
    "What is the expected delivery date?",
  ],
  Other: [
    "What is this document about?",
    "What are the key dates or deadlines?",
    "Are there any financial terms mentioned?",
  ],
};

const SUMMARY_PROMPT =
  "In 2-3 short sentences total (under 15 words each), describe this document: its type, its main purpose, and the parties or entities involved. If there is one business detail worth calling out (a date, amount, or term), put it in its own short second paragraph separated by a blank line — otherwise keep it to a single paragraph. Prioritize brevity and readability over completeness — do not list multiple clauses or provisions.";

// Chunks are built by joining a heading line with its body text on one line
// (see backend chunker.py), so a heading only shows up as a short leading
// run before the first real sentence begins — e.g. "7. Integration. This
// Agreement..." or "PAYMENT TERMS This section...". Match only that leading
// pattern so we never surface anything that isn't literally in the chunk.
// The separator after the section number is optional because the backend
// accepts headings both with and without it ("7." and "2.3" alike).
const NUMBERED_HEADING_RE =
  /^(\d+(?:\.\d+)*[.)]?)\s+([A-Za-z][A-Za-z0-9 ,&()/-]{1,42}?)[.:]\s+[A-Z]/;
const CAPS_HEADING_RE = /^([A-Z][A-Z0-9 ,&()/-]{3,42})\s+[A-Z][a-z]/;

function extractHeading(snippet: string): string | null {
  for (const segment of snippet.split(/\n\n+/)) {
    const trimmed = segment.trim();
    const numbered = NUMBERED_HEADING_RE.exec(trimmed);
    if (numbered) {
      return `${numbered[1]} ${numbered[2]}`.trim();
    }
    const caps = CAPS_HEADING_RE.exec(trimmed);
    if (caps) {
      return caps[1].trim();
    }
  }
  return null;
}

// Collapse citations that point at the same page and add no distinguishing
// section reference — keeps the raw citations array untouched (still fully
// available on the message) and only affects what's rendered.
function dedupeCitationsForDisplay(citations: Citation[]) {
  const seen = new Map<string, { citation: Citation; heading: string | null }>();
  for (const citation of citations) {
    const heading = extractHeading(citation.snippet);
    const key = `${citation.page_number}::${heading ?? ""}`;
    if (!seen.has(key)) {
      seen.set(key, { citation, heading });
    }
  }
  return Array.from(seen.values());
}

function AssistantAvatar() {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
        <path d="M8 1.5c.3 2.9 2.6 5.2 5.5 5.5v2c-2.9.3-5.2 2.6-5.5 5.5h-.1C7.6 11.6 5.3 9.3 2.4 9v-2c2.9-.3 5.2-2.6 5.5-5.5H8Z" />
      </svg>
    </span>
  );
}

export default function ChatPanel({ documentId, filename, documentType }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);
  const suggestions = SUGGESTED_QUESTIONS[documentType] ?? SUGGESTED_QUESTIONS.Other;

  useEffect(() => {
    const list = listRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages, pending]);

  function addMessage(message: Omit<Message, "id">) {
    setMessages((current) => [...current, { ...message, id: nextId.current++ }]);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      try {
        const response = await askQuestion(documentId, SUMMARY_PROMPT);
        if (!cancelled) {
          addMessage({
            role: "assistant",
            text: response.answer,
            citations: response.citations,
            isSummary: true,
          });
        }
      } catch {
        // Auto-summary is a confidence-building enhancement, not a required
        // function — fail silently and fall back to the plain empty state.
      } finally {
        if (!cancelled) {
          setPending(false);
        }
      }
    }

    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  async function sendQuestion(question: string) {
    if (pending) {
      return;
    }

    setError("");
    addMessage({ role: "user", text: question });
    setPending(true);
    try {
      const response = await askQuestion(documentId, question);
      addMessage({ role: "assistant", text: response.answer, citations: response.citations });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `The question could not be answered: ${err.message} Please try again.`
          : "Something went wrong. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || pending) {
      return;
    }
    setInput("");
    void sendQuestion(question);
  }

  const hasAskedQuestion = messages.some((message) => message.role === "user");
  const suggestionChips = (
    <div className="flex w-full max-w-md flex-col gap-2">
      {suggestions.map((question) => (
        <button
          key={question}
          type="button"
          onClick={() => void sendQuestion(question)}
          className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left text-sm text-zinc-700 transition-colors hover:border-blue-300 hover:bg-blue-50/40"
        >
          <span>{question}</span>
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5 shrink-0 text-zinc-400"
            fill="none"
            aria-hidden
          >
            <path
              d="M6 3.5 10.5 8 6 12.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ))}
    </div>
  );

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm md:h-full md:flex-1">
      <div className="shrink-0 border-b border-zinc-200 px-6 py-4">
        <h2 className="text-sm font-semibold text-zinc-900">Conversation</h2>
        <p className="mt-0.5 truncate text-xs text-zinc-500">
          Answers come only from “{filename}”, with page citations.
        </p>
      </div>

      <div
        ref={listRef}
        className="flex min-h-[320px] flex-1 flex-col gap-6 overflow-y-auto px-6 py-6 md:min-h-0"
      >
        {messages.length === 0 && !pending && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 py-6 text-center">
            <div>
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
                <svg viewBox="0 0 20 20" className="h-5 w-5 text-zinc-400" fill="none" aria-hidden>
                  <path
                    d="M17 9.5a6.5 6.5 0 0 1-9.6 5.7L3 16.5l1.3-4.4A6.5 6.5 0 1 1 17 9.5Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <p className="mt-4 text-sm font-medium text-zinc-900">Ask your first question</p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-zinc-500">
                Answers are grounded in “{filename}” and cite the pages they come from.
              </p>
            </div>
            {suggestionChips}
          </div>
        )}

        {messages.map((message) =>
          message.role === "user" ? (
            <div
              key={message.id}
              className="max-w-[75%] self-end rounded-2xl rounded-br-md bg-zinc-900 px-4 py-2.5 text-sm leading-6 whitespace-pre-wrap text-white"
            >
              {message.text}
            </div>
          ) : (
            <div key={message.id} className="flex max-w-[85%] gap-3 self-start">
              <AssistantAvatar />
              <div className="min-w-0 pt-0.5">
                {message.isSummary && (
                  <p className="mb-1 text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
                    Overview
                  </p>
                )}
                <p className="text-sm leading-6 whitespace-pre-wrap text-zinc-800">
                  {message.text}
                </p>
                {message.citations && message.citations.length > 0 && (
                  <div className="mt-5">
                    <p className="text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
                      Sources
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {dedupeCitationsForDisplay(message.citations).map(({ citation, heading }) => (
                        <li
                          key={`${citation.page_number}::${heading ?? ""}`}
                          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2 py-1"
                        >
                          <span className="font-mono text-[11px] font-medium text-zinc-500">
                            p. {citation.page_number}
                          </span>
                          {heading && (
                            <>
                              <span className="text-zinc-300">·</span>
                              <span className="max-w-[160px] truncate text-[11px] text-zinc-400">
                                {heading}
                              </span>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ),
        )}

        {messages.length > 0 && !hasAskedQuestion && !pending && suggestionChips}

        {pending && (
          <div className="flex max-w-[85%] items-center gap-3 self-start">
            <AssistantAvatar />
            <span className="flex items-center gap-1 pt-0.5" role="status">
              <span className="sr-only">Looking through the document…</span>
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300" />
            </span>
          </div>
        )}
      </div>

      {error && (
        <div
          className="mx-6 mb-4 shrink-0 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}

      <form
        className="flex shrink-0 gap-3 border-t border-zinc-200 bg-white p-4"
        onSubmit={handleSubmit}
      >
        <input
          className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none disabled:text-zinc-400"
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask a question about the document…"
          maxLength={2000}
          disabled={pending}
        />
        <button
          type="submit"
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-default disabled:opacity-50"
          disabled={pending || !input.trim()}
        >
          Send
        </button>
      </form>
    </section>
  );
}
