"use client";

import { useEffect, useState } from "react";
import { ADS } from "@/lib/ads";
import { DEFAULT_ASSUMPTIONS, type PlanResult } from "@/lib/engine";
import type { Profile } from "@/lib/tools";
import { useLang } from "../components/LangProvider";
import type { PlusState } from "../components/usePlus";

export type Step = { id: string; name: string; input?: unknown; preview?: string; isError?: boolean; kind: "skill" | "tool" | "rag" | "mem" | "web"; pending: boolean };
type DocKind = "plan" | "letter" | "vve" | "rfq";

const SALDERING_END = Date.UTC(2026, 11, 31, 23); // 1 Jan 2027, 00:00 Amsterdam

export default function SidePanel(props: {
  plan: PlanResult | null;
  profile: Profile;
  steps: Step[];
  skillsLoaded: string[];
  busy: boolean;
  plus: PlusState & { unlocked: boolean };
  onBuy: () => void;
  onUpload: (kind: "bill" | "quote") => void;
  onReset: (all: boolean) => void;
}) {
  const { plan, profile, steps, skillsLoaded, busy, plus, onBuy, onUpload, onReset } = props;
  const [copied, setCopied] = useState(false);
  // Plus tag only matters once payments are on and the user hasn't bought it.
  const lockTag = plus.enabled && !plus.active ? <span className="proTag">Plus</span> : null;
  const gated = (fn: () => void) => () => (plus.unlocked ? fn() : onBuy());
  const { lang, t } = useLang();
  const p = t.panel;
  const [temp, setTemp] = useState<number | null>(null);
  const [letterOpen, setLetterOpen] = useState(false);
  const [names, setNames] = useState({ tenant: "", landlord: "" });
  const [making, setMaking] = useState<DocKind | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- time-dependent values only after mount (no SSR mismatch)
    setNow(Date.now());
    const pc = profile.postcode ? `?postcode=${encodeURIComponent(profile.postcode)}` : "";
    fetch(`/api/weather${pc}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((w) => w && typeof w.temp === "number" && setTemp(Math.round(w.temp)))
      .catch(() => {});
  }, [profile.postcode]);

  async function makeDoc(kind: DocKind) {
    if (!plan) return;
    setMaking(kind);
    try {
      const docs = await import("@/lib/documents");
      if (kind === "plan") await docs.downloadPlan(plan, lang);
      if (kind === "letter") await docs.downloadLandlordLetter(plan, names, lang);
      if (kind === "vve") await docs.downloadVveProposal(plan, lang);
      if (kind === "rfq") await docs.downloadQuoteRequest(plan, lang);
      setLetterOpen(false);
    } finally {
      setMaking(null);
    }
  }

  const h = plan?.house;
  const days = now !== null ? Math.max(0, Math.ceil((SALDERING_END - now) / 86_400_000)) : null;
  const gas = plan?.assumptions.gasPrice ?? (profile.gasPrice ? Number(profile.gasPrice) : DEFAULT_ASSUMPTIONS.gasPrice);
  const el = plan?.assumptions.electricityPrice ?? (profile.electricityPrice ? Number(profile.electricityPrice) : DEFAULT_ASSUMPTIONS.electricityPrice);
  const fmt = (n: number) => `€${n.toFixed(2).replace(".", lang === "nl" ? "," : ".")}`;
  const ad = ADS[now !== null ? Math.floor(now / 60_000) % ADS.length : 0]; // rotate per minute

  return (
    <aside className="trace" aria-label={p.house}>
      {/* Your house */}
      <section className="traceSec">
        <h4><span>{p.house}</span></h4>
        {h ? (
          <>
            <div className="houseAddr">{h.address ?? `${h.postcode} ${h.houseNumber}`}</div>
            <dl className="kv">
              <dt>{p.label}</dt>
              <dd>
                <span className={`labelBadge l${h.label}`}>{h.label}</span>
                {h.labelSource?.startsWith("estimated") && <span className="muted"> {p.est}</span>}
              </dd>
              <dt>{p.type}</dt><dd>{h.type}</dd>
              <dt>{p.built}</dt><dd>{h.buildYear}</dd>
              <dt>{p.area}</dt><dd>{h.floorArea} m²</dd>
            </dl>
          </>
        ) : (
          <p className="muted">{p.houseEmpty}</p>
        )}
      </section>

      {/* Uploads */}
      <section className="traceSec">
        <h4><span>{p.bill}</span></h4>
        <p className="muted">{p.billBody}</p>
        {profile.gasUseM3 && (
          <p className="billValues">
            🔥 {Number(profile.gasUseM3).toLocaleString("nl-NL")} m³{profile.electricityKwh && <> · ⚡ {Number(profile.electricityKwh).toLocaleString("nl-NL")} kWh</>}
          </p>
        )}
        <button className="btn btnGhost btnSm" disabled={busy} onClick={() => onUpload("bill")}>📎 {p.billBtn}</button>
      </section>

      <section className="traceSec highlight">
        <h4>
          <span>{p.quote}</span>
          {plus.active ? <span className="plusOn">{t.plus.active}</span> : <span className="proTag">Plus</span>}
        </h4>
        <p className="muted">{p.quoteBody}</p>
        {plus.active && <p className="plusLeft">{t.plus.left(plus.quoteChecksLeft)}</p>}
        {plus.unlocked ? (
          <button className="btn btnSm" disabled={busy || (plus.active && plus.quoteChecksLeft <= 0)} onClick={() => onUpload("quote")}>📄 {p.quoteBtn}</button>
        ) : (
          <button className="btn btnSm btnBuy" onClick={onBuy}>⭐ {t.plus.buy}</button>
        )}
        {plus.active && plus.quoteChecksLeft <= 0 && <p className="muted">{t.plus.quota}</p>}
        {plus.active && plus.restoreUrl && (
          <p className="restore">
            <button
              className="linkBtn"
              onClick={() => {
                navigator.clipboard?.writeText(plus.restoreUrl!).then(() => setCopied(true));
              }}
            >
              {copied ? `✓ ${t.plus.copied}` : t.plus.restore}
            </button>
            <span className="muted"> · {t.plus.restoreHint}</span>
          </p>
        )}
      </section>

      {/* Documents */}
      <section className="traceSec">
        <h4><span>{p.docs}</span></h4>
        {!plan && <p className="muted">{p.docsHint}</p>}
        <div className="docList">
          <button disabled={!plan || !!making} onClick={() => makeDoc("plan")}>⬇ {p.docPlan}</button>
          <button disabled={!plan || !!making} onClick={gated(() => setLetterOpen((o) => !o))}>⬇ {p.docLetter} {lockTag}</button>
          {letterOpen && plan && (
            <form
              className="letterForm"
              onSubmit={(e) => {
                e.preventDefault();
                makeDoc("letter");
              }}
            >
              <input placeholder={t.doc.name} value={names.tenant} onChange={(e) => setNames({ ...names, tenant: e.target.value })} maxLength={80} />
              <input placeholder={t.doc.landlord} value={names.landlord} onChange={(e) => setNames({ ...names, landlord: e.target.value })} maxLength={80} />
              <div>
                <button type="submit" className="btn btnSm">{t.doc.make}</button>
                <button type="button" className="linkBtn" onClick={() => setLetterOpen(false)}>{t.doc.cancel}</button>
              </div>
            </form>
          )}
          <button disabled={!plan || !!making} onClick={gated(() => makeDoc("vve"))}>⬇ {p.docVve} {lockTag}</button>
          <button disabled={!plan || !!making} onClick={gated(() => makeDoc("rfq"))}>⬇ {p.docRfq} {lockTag}</button>
        </div>
      </section>

      {/* Important info */}
      <section className="traceSec">
        <h4><span>{p.dates}</span></h4>
        <ul className="infoList">
          {temp !== null && <li>🌡️ {p.weatherTip(temp)}</li>}
          <li>
            ☀️ <b>{p.saldering}</b> 1-1-2027{days !== null && <span className="muted"> · {p.salderingDays(days)}</span>}
          </li>
          <li>📅 {p.isdeDeadline}</li>
          <li>🔄 {p.rates}</li>
          <li>💶 <b>{p.prices}:</b> {p.pricesBody(fmt(gas), fmt(el))}</li>
        </ul>
      </section>

      {/* Sponsored */}
      {ad && (
        <section className="traceSec">
          <a className="adCard" href={ad.href} style={{ borderLeftColor: ad.accent }}>
            <span className="adTag">{p.ad} · {ad.sponsor}</span>
            <strong>{ad.headline[lang]}</strong>
            <span>{ad.body[lang]}</span>
            <span className="adCta">{ad.cta[lang]}</span>
          </a>
          <p className="muted adNote">{p.adNote}</p>
        </section>
      )}

      {/* Agent trace */}
      <details className="traceSec" open={busy}>
        <summary className="detailsSum">{t.advisor.stepsTitle} {steps.length > 0 && <span className="muted">({steps.length})</span>}</summary>
        {steps.length === 0 && <p className="muted">{t.advisor.stepsEmpty}</p>}
        {steps.map((s) => (
          <div className="step" key={s.id}>
            <span className="name">{s.name}</span>
            <span className={`tag ${s.isError ? "err" : s.kind}`}>{s.isError ? "error" : s.kind === "mem" ? "memory" : s.kind}</span>
            {s.pending && <span className="muted"> · {t.advisor.running}</span>}
            {s.preview && <pre>{s.preview}</pre>}
          </div>
        ))}
        {skillsLoaded.length > 0 && (
          <p style={{ marginTop: 8 }}>
            <span className="muted">{t.advisor.skills}: </span>
            {skillsLoaded.map((s) => <span key={s} className="tag skill" style={{ marginRight: 6 }}>{s}</span>)}
          </p>
        )}
      </details>

      {/* Memory */}
      <details className="traceSec">
        <summary className="detailsSum">{t.advisor.memoryTitle}</summary>
        {Object.keys(profile).length ? (
          <dl className="kv" style={{ marginTop: 8 }}>
            {Object.entries(profile).map(([k, v]) => (
              <div key={k} style={{ display: "contents" }}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="muted">{t.advisor.memoryEmpty}</p>
        )}
        <button className="linkBtn" style={{ marginTop: 8 }} onClick={() => onReset(true)}>{t.advisor.forget}</button>
      </details>

      <section className="traceSec">
        <button className="btn btnGhost" style={{ width: "100%" }} onClick={() => onReset(false)}>{t.advisor.newChat}</button>
      </section>
    </aside>
  );
}
