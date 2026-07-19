/**
 * The grounded chat agent — "Ask about this bill."
 *
 * Contract per docs/operations/pulse-demo-ui-ux-plan-2026-07-19.md §9,
 * adapted to ground on a single bill's full page context (title, summary,
 * status, sponsor, AI-extracted topics, narration, live news) rather than
 * the generic seen-set — our dedicated bill pages make this both more
 * reliable and a tighter demo than the original generic-feed sketch.
 *
 * Hard grounding rule (the only way this stays inside Polity's permanent
 * no-AI-synthesis commitment): the model answers using ONLY the bill
 * context below. It never uses outside knowledge, and says so plainly when
 * the context doesn't cover the question. It's a reformatter of
 * already-surfaced primary-source data, not a knowledge source — same
 * posture as the narration and the analyzer.
 */

import { getBill, type BillDetail } from "./bills";

export interface AskRequest {
  question: string;
  billSlug: string;
}

export interface AskSource {
  id: string;
  title: string;
  url: string | null;
}

export interface AskResponse {
  answer: string;
  sources: AskSource[];
  modelUsed: string;
  blocked?: boolean;
  blockReason?: string;
}

interface AskEnv {
  DATABASE_URL?: string;
  PULSE_KV: KVNamespace;
  NEMOTRON_BASE_URL?: string;
  NEMOTRON_API_KEY?: string;
  NEMOTRON_MODEL?: string;
}

const MAX_QUESTION_LENGTH = 280;
const RATE_LIMIT_WINDOW_MS = 10_000; // 1 question / 10s per IP
const ASK_TIMEOUT_MS = 20_000; // reasoning model — same lesson as narration

const SYSTEM_PROMPT =
  "You are a civic explainer for Polity, an app that helps American " +
  "citizens read primary sources. A citizen is asking about ONE specific " +
  "bill. Answer using ONLY the bill context provided below — its title, " +
  "status, sponsor, official summary, and any live news noted. Do not use " +
  "outside knowledge; do not speculate about what the bill might do beyond " +
  "what the context states.\n\n" +
  "Rules:\n" +
  "1. Answer in 1-3 sentences. Neutral, non-partisan, no opinion, no " +
  "\"should\" or \"ought.\"\n" +
  "2. If the context doesn't cover the question, respond with EXACTLY: " +
  "\"I don't have that — the pulse feed hasn't surfaced it.\"\n" +
  "3. When you rely on the bill's summary or a news item, name it (e.g. " +
  "\"per the bill's summary\" or \"per the linked coverage\").\n" +
  "4. Never invent a status, date, sponsor, or outcome not present in the " +
  "context.";

/**
 * Rate-limit one IP to 1 question / 10s via a short-TTL KV marker. The
 * put() is awaited (not fire-and-forget) so two near-simultaneous requests
 * from the same IP can't both read "not limited" before either write
 * lands — KV's eventual consistency means this isn't airtight under true
 * parallelism, but it closes the race for realistic (human-triggered)
 * double-fires, which is all this guardrail needs to handle.
 */
async function checkRateLimit(kv: KVNamespace, ip: string): Promise<boolean> {
  const key = `ask:rate:${ip}`;
  try {
    const existing = await kv.get(key);
    if (existing) return false;
    await kv.put(key, "1", {
      expirationTtl: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
    });
    return true;
  } catch {
    return true; // KV failure shouldn't block the feature
  }
}

function buildContext(bill: BillDetail): string {
  const lines = [
    `Designator: ${bill.designator} (${bill.congress}th Congress)`,
    `Title: ${bill.title}`,
    `Status: ${bill.status.replace(/_/g, " ")}`,
    `Chamber: ${bill.chamber}`,
    `Sponsor: ${bill.sponsor.name ?? "not yet resolved"}` +
      (bill.sponsor.party ? ` (${bill.sponsor.party})` : "") +
      (bill.sponsor.district ? `, ${bill.sponsor.district}` : ""),
    `Introduced: ${bill.introducedDate ?? "unknown"}`,
  ];
  if (bill.summary) {
    lines.push(`Official summary (${bill.summarySource ?? "source unknown"}): ${bill.summary}`);
  }
  if (bill.topics.length > 0) {
    lines.push(`AI-identified topics: ${bill.topics.join(", ")}`);
  }
  if (bill.news.length > 0) {
    lines.push(
      "Live news mentioning this subject:\n" +
        bill.news.map((n) => `- "${n.title}" (${n.domain})`).join("\n"),
    );
  }
  return lines.join("\n");
}

/**
 * Answer a grounded question about one bill. Never throws — every failure
 * mode (missing bill, no LLM configured, timeout, rate limit) returns a
 * structured AskResponse with `blocked: true` and a reason.
 */
export async function answerBillQuestion(
  env: AskEnv,
  req: AskRequest,
  clientIp: string,
): Promise<AskResponse> {
  const empty = (reason: string): AskResponse => ({
    answer: "",
    sources: [],
    modelUsed: env.NEMOTRON_MODEL ?? "unconfigured",
    blocked: true,
    blockReason: reason,
  });

  const question = req.question?.trim() ?? "";
  if (question.length === 0) return empty("Ask a question first.");
  if (question.length > MAX_QUESTION_LENGTH) {
    return empty(`Question too long (max ${MAX_QUESTION_LENGTH} characters).`);
  }
  if (!env.NEMOTRON_BASE_URL || !env.NEMOTRON_API_KEY || !env.NEMOTRON_MODEL) {
    return empty("The agent isn't configured to answer questions right now.");
  }

  const allowed = await checkRateLimit(env.PULSE_KV, clientIp);
  if (!allowed) return empty("Wait 10 seconds between questions.");

  const bill = await getBill(env, req.billSlug);
  if (!bill) return empty("Bill not found.");

  const context = buildContext(bill);
  const base = env.NEMOTRON_BASE_URL.replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ASK_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.NEMOTRON_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.NEMOTRON_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `BILL CONTEXT:\n${context}\n\nQUESTION: ${question}`,
          },
        ],
        // Reasoning model — generous headroom so `content` isn't truncated
        // to null mid-thought (finish_reason: "length"). Learned the hard
        // way in the narration/analyzer paths; same fix here.
        max_tokens: 900,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return empty(`Model request failed (HTTP ${res.status}).`);
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer) return empty("The agent didn't return an answer — try again.");

    const sources: AskSource[] = [
      { id: bill.slug, title: `${bill.designator} — ${bill.title}`, url: bill.sourceUrl },
    ];

    return { answer, sources, modelUsed: env.NEMOTRON_MODEL };
  } catch (e) {
    const err = e as Error;
    return empty(
      err.name === "AbortError"
        ? "The agent took too long to answer — try again."
        : "Something went wrong answering that.",
    );
  } finally {
    clearTimeout(timer);
  }
}
