import { cookies } from "next/headers";
import { getPlus, paymentsEnabled, PLUS_COOKIE, PLUS_PRICE_CENTS } from "@/lib/plus";

export async function GET(req: Request) {
  const enabled = paymentsEnabled();
  if (!enabled) return Response.json({ enabled: false, active: false });
  const sessionId = (await cookies()).get(PLUS_COOKIE)?.value;
  const s = await getPlus(sessionId);
  return Response.json({
    enabled,
    priceCents: PLUS_PRICE_CENTS,
    active: s.active,
    quoteChecksLeft: s.quoteChecksLeft,
    house: s.house,
    // Lets the buyer open Plus on another device; only ever returned to the cookie holder.
    restoreUrl: s.active && sessionId ? `${new URL(req.url).origin}/api/plus/activate?session_id=${sessionId}` : null,
  });
}
