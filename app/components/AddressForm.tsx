"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import s from "../landing.module.css";

/** Postcode + house number → opens the advisor with the question already asked. */
export default function AddressForm({ dark = false }: { dark?: boolean }) {
  const router = useRouter();
  const [postcode, setPostcode] = useState("");
  const [number, setNumber] = useState("");
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const pc = postcode.toUpperCase().replace(/\s+/g, "");
    if (!/^[1-9][0-9]{3}[A-Z]{2}$/.test(pc)) return setError("Enter a Dutch postcode, like 3511 AB.");
    if (!/^\d{1,5}\s*-?\s*[A-Za-z0-9]{0,4}$/.test(number.trim())) return setError("Enter your house number, like 12 or 12A.");
    setError("");
    const q = `My address is ${pc.slice(0, 4)} ${pc.slice(4)} ${number.trim()}. What should I fix in my house first?`;
    router.push(`/advisor?q=${encodeURIComponent(q)}`);
  }

  return (
    <form className={`${s.addr} ${dark ? s.addrDark : ""}`} onSubmit={submit} noValidate>
      <label className={s.field}>
        <span>Postcode</span>
        <input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="3511 AB" autoComplete="postal-code" maxLength={7} />
      </label>
      <label className={`${s.field} ${s.fieldNum}`}>
        <span>Nr.</span>
        <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="12" maxLength={10} />
      </label>
      <button className={s.addrBtn}>Check my house →</button>
      {error && <p className={s.addrErr} role="alert">{error}</p>}
    </form>
  );
}
