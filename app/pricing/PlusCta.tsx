"use client";

import { useState } from "react";
import { useLang } from "../components/LangProvider";
import { startCheckout } from "../components/usePlus";

export default function PlusCta() {
  const { lang, t } = useLang();
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  return (
    <>
      <button
        className="btn"
        disabled={state === "busy"}
        onClick={async () => {
          setState("busy");
          if (!(await startCheckout(lang))) setState("error");
        }}
      >
        {state === "busy" ? t.plus.buying : t.plus.buy}
      </button>
      {state === "error" && <p className="muted" role="alert">{t.plus.checkoutError}</p>}
    </>
  );
}
