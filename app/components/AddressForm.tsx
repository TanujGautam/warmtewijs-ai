"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import s from "../landing.module.css";
import { useLang } from "./LangProvider";

/** Postcode + house number → opens the advisor with the question already asked. */
export default function AddressForm({ dark = false }: { dark?: boolean }) {
  const router = useRouter();
  const { t } = useLang();
  const [postcode, setPostcode] = useState("");
  const [number, setNumber] = useState("");
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const pc = postcode.toUpperCase().replace(/\s+/g, "");
    if (!/^[1-9][0-9]{3}[A-Z]{2}$/.test(pc)) return setError(t.form.errPostcode);
    if (!/^\d{1,5}\s*-?\s*[A-Za-z0-9]{0,4}$/.test(number.trim())) return setError(t.form.errNumber);
    setError("");
    const q = t.form.question(`${pc.slice(0, 4)} ${pc.slice(4)} ${number.trim()}`);
    router.push(`/advisor?q=${encodeURIComponent(q)}`);
  }

  return (
    <form className={`${s.addr} ${dark ? s.addrDark : ""}`} onSubmit={submit} noValidate>
      <label className={s.field}>
        <span>{t.form.postcode}</span>
        <input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="3511 AB" autoComplete="postal-code" maxLength={7} />
      </label>
      <label className={`${s.field} ${s.fieldNum}`}>
        <span>{t.form.number}</span>
        <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="12" maxLength={10} />
      </label>
      <button className={s.addrBtn}>{t.form.submit}</button>
      {error && <p className={s.addrErr} role="alert">{error}</p>}
    </form>
  );
}
