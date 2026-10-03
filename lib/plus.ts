// Warmtewijs Plus: a one-off €19 purchase via Stripe Checkout.
// There is no user database: the paid Checkout Session is the receipt, and its PaymentIntent
// metadata counts quote checks. The browser holds the session id in an httpOnly cookie.
// Payments (and the Plus gate) switch on only when STRIPE_SECRET_KEY is set.
import Stripe from "stripe";

export const PLUS_COOKIE = "ww_plus";
export const PLUS_PRICE_CENTS = 1900;
export const PLUS_QUOTE_CHECKS = 5;

let client: Stripe | null = null;
function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

export const paymentsEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY);

export interface PlusStatus {
  active: boolean;
  quoteChecksLeft: number;
  house: string | null;
  paymentIntentId: string | null;
}

const NONE: PlusStatus = { active: false, quoteChecksLeft: 0, house: null, paymentIntentId: null };
const cache = new Map<string, { at: number; status: PlusStatus }>();

/** Verify a Checkout Session id: paid, for Plus, and how many quote checks are left. */
export async function getPlus(sessionId: string | undefined | null, fresh = false): Promise<PlusStatus> {
  if (!paymentsEnabled() || !sessionId || !/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sessionId)) return NONE;
  const hit = cache.get(sessionId);
  if (!fresh && hit && Date.now() - hit.at < 60_000) return hit.status;
  try {
    const s = await stripe().checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });
    const pi = typeof s.payment_intent === "object" ? s.payment_intent : null;
    const paid = s.payment_status === "paid" && s.metadata?.product === "plus" && pi?.status === "succeeded";
    const used = Number(pi?.metadata?.quote_checks_used ?? "0") || 0;
    const status: PlusStatus = paid
      ? { active: true, quoteChecksLeft: Math.max(0, PLUS_QUOTE_CHECKS - used), house: s.metadata?.house || null, paymentIntentId: pi?.id ?? null }
      : NONE;
    cache.set(sessionId, { at: Date.now(), status });
    return status;
  } catch (err) {
    console.warn("Plus verification failed:", err instanceof Error ? err.message : err);
    return NONE;
  }
}

/** Count one quote check against the purchase. Returns false when none are left. */
export async function consumeQuoteCheck(sessionId: string): Promise<boolean> {
  const status = await getPlus(sessionId, true);
  if (!status.active || status.quoteChecksLeft <= 0 || !status.paymentIntentId) return false;
  const used = PLUS_QUOTE_CHECKS - status.quoteChecksLeft + 1;
  await stripe().paymentIntents.update(status.paymentIntentId, { metadata: { quote_checks_used: String(used) } });
  cache.delete(sessionId);
  return true;
}

export async function createCheckout(opts: { origin: string; lang: "en" | "nl"; house?: string }) {
  const nl = opts.lang === "nl";
  const house = (opts.house ?? "").slice(0, 80);
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: PLUS_PRICE_CENTS,
          product_data: {
            name: "Warmtewijs Plus",
            description: nl
              ? `Offertecheck (tot ${PLUS_QUOTE_CHECKS} offertes), brief aan verhuurder, VvE-voorstel en offerteaanvraag${house ? ` — ${house}` : ""}`
              : `Quote checker (up to ${PLUS_QUOTE_CHECKS} quotes), landlord letter, VvE proposal and quote request${house ? ` — ${house}` : ""}`,
          },
        },
      },
    ],
    // Payment methods (iDEAL, cards, …) come from the Stripe Dashboard settings.
    locale: nl ? "nl" : "en",
    metadata: { product: "plus", house },
    payment_intent_data: { metadata: { product: "plus", house, quote_checks_used: "0" } },
    custom_text: {
      submit: {
        message: nl
          ? `Plus is digitale inhoud die direct na betaling start. Door te betalen stem je daarmee in en vervalt je herroepingsrecht van 14 dagen. Voorwaarden: ${opts.origin}/terms`
          : `Plus is digital content that starts immediately after payment. By paying you agree to this and waive the 14-day right of withdrawal. Terms: ${opts.origin}/terms`,
      },
    },
    success_url: `${opts.origin}/api/plus/activate?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origin}/pricing?canceled=1`,
  });
  return session.url;
}

export const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365 * 2,
};
