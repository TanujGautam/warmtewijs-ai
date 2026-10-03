// Stripe redirects here after payment. Also works as a "restore purchase" link on another device.
import { NextResponse } from "next/server";
import { cookieOptions, getPlus, PLUS_COOKIE } from "@/lib/plus";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session_id");
  const status = await getPlus(sessionId, true);
  const target = new URL("/advisor", url.origin);
  target.searchParams.set("plus", status.active ? "active" : "failed");
  const res = NextResponse.redirect(target);
  if (status.active && sessionId) res.cookies.set(PLUS_COOKIE, sessionId, cookieOptions);
  return res;
}
