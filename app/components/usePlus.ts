"use client";

import { useCallback, useEffect, useState } from "react";

export interface PlusState {
  loaded: boolean;
  enabled: boolean; // payments switched on (STRIPE_SECRET_KEY set)
  active: boolean;
  quoteChecksLeft: number;
  restoreUrl: string | null;
}

const INITIAL: PlusState = { loaded: false, enabled: false, active: false, quoteChecksLeft: 0, restoreUrl: null };

/** Plus status from the server. While payments are off, every feature is unlocked (beta). */
export function usePlus() {
  const [state, setState] = useState<PlusState>(INITIAL);
  const refresh = useCallback(() => {
    fetch("/api/plus/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setState({ loaded: true, enabled: !!d.enabled, active: !!d.active, quoteChecksLeft: d.quoteChecksLeft ?? 0, restoreUrl: d.restoreUrl ?? null }))
      .catch(() => setState((s) => ({ ...s, loaded: true })));
  }, []);
  useEffect(refresh, [refresh]);
  const unlocked = !state.enabled || state.active;
  return { ...state, unlocked, refresh };
}

/** Send the browser to Stripe Checkout. Returns an error message key on failure. */
export async function startCheckout(lang: "en" | "nl", house?: string): Promise<boolean> {
  try {
    const res = await fetch("/api/plus/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang, house }) });
    const data = await res.json();
    if (!res.ok || !data.url) return false;
    window.location.assign(data.url);
    return true;
  } catch {
    return false;
  }
}
