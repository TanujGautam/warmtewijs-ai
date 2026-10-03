import { clientKey, rateLimit } from "@/lib/guardrails";
import { isLang } from "@/lib/i18n";
import { createCheckout, paymentsEnabled } from "@/lib/plus";

export async function POST(req: Request) {
  if (!paymentsEnabled()) return Response.json({ error: "payments_disabled" }, { status: 503 });
  if (!rateLimit(clientKey(req))) return Response.json({ error: "Too many requests" }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { lang?: unknown; house?: unknown };
  const origin = new URL(req.url).origin;
  try {
    const url = await createCheckout({ origin, lang: isLang(body.lang) ? body.lang : "nl", house: typeof body.house === "string" ? body.house : undefined });
    return Response.json({ url });
  } catch (err) {
    console.error("Stripe checkout failed:", err);
    return Response.json({ error: "checkout_failed" }, { status: 502 });
  }
}
