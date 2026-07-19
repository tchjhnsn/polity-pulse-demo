import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, ExternalLink, AlertCircle } from "lucide-react";

interface AskSource {
  id: string;
  title: string;
  url: string | null;
}

interface AskResponse {
  answer: string;
  sources: AskSource[];
  modelUsed: string;
  blocked?: boolean;
  blockReason?: string;
}

interface AskBillAgentProps {
  billSlug: string;
}

const MAX_LEN = 280;

/**
 * "Ask about this bill" — a grounded Q&A over ONE bill's context. Per
 * pulse-demo-ui-ux-plan-2026-07-19.md §9: the model answers using only the
 * bill's own context (title/status/sponsor/summary/news), never outside
 * knowledge. It's a reformatter, not a knowledge source — same posture as
 * the narration and analyzer chips elsewhere on this page.
 */
export function AskBillAgent({ billSlug }: AskBillAgentProps) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = question.trim();
    if (trimmed.length === 0 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: trimmed, billSlug }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as AskResponse;
      setResult(json);
    } catch (e2) {
      setError((e2 as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-rule bg-paper-2 p-4">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="rounded bg-ink-3 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-white">
          AI
        </span>
        <span className="text-mono uppercase tracking-[0.08em] text-ink-3">
          Ask about this bill
        </span>
      </div>

      <form onSubmit={ask} className="flex gap-2">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, MAX_LEN))}
          placeholder="e.g. Has this passed a floor vote yet?"
          disabled={loading}
          aria-label="Ask a question about this bill"
        />
        <Button type="submit" disabled={loading || question.trim().length === 0}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
      <div className="mt-1 text-mono-sm text-ink-3">
        {question.length}/{MAX_LEN} · grounded only in this bill's own record — the
        agent won't guess beyond it
      </div>

      {loading && (
        <div className="mt-3 space-y-1.5">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
      )}

      {error && !loading && (
        <div className="mt-3">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}.</AlertDescription>
          </Alert>
        </div>
      )}

      {result && !loading && (
        <div className="mt-3">
          {result.blocked ? (
            <Alert variant="warning">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{result.blockReason}</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-1.5">
              <p className="text-small text-ink">{result.answer}</p>
              {result.sources.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {result.sources.map((s) =>
                    s.url ? (
                      <a
                        key={s.id}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-mono-sm text-accent-blue hover:underline"
                      >
                        {s.title} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span key={s.id} className="text-mono-sm text-ink-3">
                        {s.title}
                      </span>
                    ),
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
