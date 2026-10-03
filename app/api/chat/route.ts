import type Anthropic from "@anthropic-ai/sdk";
import { describeApiError, hasApiKey, runClaudeAgent } from "@/lib/agent";
import type { AgentEvent } from "@/lib/events";
import { clientKey, LIMITS, rateLimit, redactPII } from "@/lib/guardrails";
import { runOfflineAgent } from "@/lib/offline-agent";
import { PROFILE_KEYS, type Profile } from "@/lib/tools";
import { isLang, type Lang } from "@/lib/i18n";

export const maxDuration = 120;

function sanitizeProfile(raw: unknown): Profile {
  const out: Profile = {};
  if (raw && typeof raw === "object") {
    for (const k of PROFILE_KEYS) {
      const v = (raw as Record<string, unknown>)[k];
      if (typeof v === "string" && v.length <= 300) out[k] = v;
    }
  }
  return out;
}

function sanitizeHistory(raw: unknown): Anthropic.Beta.BetaMessageParam[] {
  if (!Array.isArray(raw)) return [];
  const msgs = raw.filter((m) => m && (m.role === "user" || m.role === "assistant") && (typeof m.content === "string" || Array.isArray(m.content)));
  if (msgs.length > LIMITS.maxHistoryMessages) return []; // start fresh rather than splice mid-conversation
  return msgs as Anthropic.Beta.BetaMessageParam[];
}

export async function POST(req: Request) {
  if (!rateLimit(clientKey(req))) return Response.json({ error: "Too many requests — wait a minute." }, { status: 429 });

  let body: { message?: unknown; history?: unknown; profile?: unknown; lang?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.message !== "string" || !body.message.trim()) return Response.json({ error: "Empty message" }, { status: 400 });
  if (body.message.length > LIMITS.maxUserChars) return Response.json({ error: `Message too long (max ${LIMITS.maxUserChars} characters).` }, { status: 400 });

  const { text, redactions } = redactPII(body.message.trim());
  const profile = sanitizeProfile(body.profile);
  const history = sanitizeHistory(body.history);
  const lang: Lang = isLang(body.lang) ? body.lang : "nl";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: AgentEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      if (redactions.length) send({ type: "guardrail", message: `Removed ${[...new Set(redactions)].join(", ")} from your message before sending it to the AI.` });
      try {
        const agent = hasApiKey() ? runClaudeAgent(history, text, profile, lang) : runOfflineAgent(text, profile, lang);
        for await (const ev of agent) send(ev);
      } catch (err) {
        console.error(err);
        send({ type: "error", message: describeApiError(err) });
      }
      send({ type: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}

export async function GET() {
  return Response.json({ mode: hasApiKey() ? "claude" : "offline" });
}
