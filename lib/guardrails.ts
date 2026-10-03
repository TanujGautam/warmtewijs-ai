// Guardrails applied before anything reaches the model.

export const LIMITS = {
  maxUserChars: 2000,
  maxHistoryMessages: 60,
  maxAgentTurns: 8, // tool-use iterations per user message
  requestsPerMinute: 12,
};

/** Redact data we never want to send to a model or keep in history: BSN, IBAN, card numbers, emails, phone numbers. */
export function redactPII(text: string): { text: string; redactions: string[] } {
  const redactions: string[] = [];
  const rules: [string, RegExp][] = [
    ["IBAN", /\b[A-Z]{2}\d{2}[A-Z]{4}\d{10}\b/gi],
    ["card number", /\b(?:\d[ -]?){13,19}\b/g],
    ["BSN", /\b\d{9}\b/g],
    ["email", /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g],
    ["phone number", /(?:\+31|\b0)[ -]?6[ -]?(?:\d[ -]?){8}\b/g],
  ];
  let out = text;
  for (const [label, re] of rules) {
    out = out.replace(re, () => {
      redactions.push(label);
      return `[${label} removed]`;
    });
  }
  return { text: out, redactions };
}

// Best-effort in-memory rate limiter (per serverless instance). Use a shared store (e.g. Upstash) for production scale.
const hits = new Map<string, number[]>();
export function rateLimit(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length <= LIMITS.requestsPerMinute;
}

export function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}
