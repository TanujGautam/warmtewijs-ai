"use client";

import type { PlanResult } from "@/lib/engine";
import type { QuoteReport } from "@/lib/quote-check";
import { useLang } from "../components/LangProvider";
import { num, sourceText } from "@/lib/house-text";

const eur = (n: number) => `€${Math.round(n).toLocaleString("nl-NL")}`;

export function PlanCard({ plan }: { plan: PlanResult }) {
  const { lang, t } = useLang();
  const nl = lang === "nl";
  const h = plan.house;
  const rec = plan.measures.filter((m) => m.status !== "not-applicable");
  return (
    <div className="plan">
      <div className="planHead">
        <span>{h.address ?? `${h.postcode} ${h.houseNumber}`} · {h.type} {h.buildYear} · {h.floorArea} m²</span>
        <span>
          Label {plan.labelFrom}
          {h.labelSource?.startsWith("estimated") ? ` (${t.panel.est})` : ""} → {plan.labelTo}
        </span>
      </div>
      <div className="planStats">
        <div><small>{t.hero.saving}</small><strong>{eur(plan.totals.savingPerYear)}</strong></div>
        <div><small>{t.hero.subsidy}</small><strong>{eur(plan.totals.subsidy)}</strong></div>
        <div><small>{t.hero.co2}</small><strong>{plan.totals.co2TonnesPerYear.toLocaleString("nl-NL")} t</strong></div>
      </div>
      {rec.map((m, i) => (
        <div key={m.id} className={`planRow ${m.status === "later" ? "later" : ""}`}>
          <span className="n">{m.status === "recommended" ? String(i + 1).padStart(2, "0") : "—"}</span>
          <div>
            <div>{m.dutch} {!nl && <span className="muted">· {m.name}</span>}</div>
            <div className="sub">
              {m.status === "recommended"
                ? `${eur(m.cost)} · ${nl ? "subsidie" : "subsidy"} ${eur(m.subsidy)} · ${nl ? "bespaart" : "saves"} ${eur(m.savingPerYear)}/${nl ? "jr" : "yr"}`
                : m.reason}
            </div>
          </div>
          <span className="pb">{m.status === "recommended" ? `${num(m.paybackYears ?? 0, lang)} ${nl ? "jr" : "yr"}` : t.showcase.later}</span>
        </div>
      ))}
      <div className="planRow" style={{ gridTemplateColumns: "1fr" }}>
        <span className="sub">
          {nl
            ? `Aannames: gas €${plan.assumptions.gasPrice.toFixed(2).replace(".", ",")}/m³, stroom €${plan.assumptions.electricityPrice.toFixed(2).replace(".", ",")}/kWh, ${plan.assumptions.gasUseM3} m³/jr. Woningdata: ${h.source}. Label: ${sourceText(h.labelSource, lang)}. Klopt iets niet? Zeg het tegen de adviseur.`
            : `Assumes gas €${plan.assumptions.gasPrice.toFixed(2)}/m³, electricity €${plan.assumptions.electricityPrice.toFixed(2)}/kWh, ${plan.assumptions.gasUseM3} m³/yr. House data: ${h.source}. Label: ${sourceText(h.labelSource, lang)}. Wrong? Just tell the advisor.`}
        </span>
      </div>
    </div>
  );
}

const VERDICT_CLASS: Record<string, string> = { ok: "good", low: "warn", high: "warn", "very-high": "bad", unknown: "neutral" };
const ISDE_CLASS: Record<string, string> = { ok: "good", check: "warn", fail: "bad", "n/a": "neutral" };

export function QuoteCard({ report, onAsk }: { report: QuoteReport; onAsk: () => void }) {
  const { lang, t } = useLang();
  const nl = lang === "nl";
  const verdictLabel: Record<string, string> = nl
    ? { ok: "prijs ok", low: "erg laag", high: "hoog", "very-high": "te hoog", unknown: "onbekend" }
    : { ok: "price ok", low: "very low", high: "high", "very-high": "too high", unknown: "unknown" };
  const isdeLabel: Record<string, string> = nl
    ? { ok: "ISDE ok", check: "ISDE checken", fail: "geen ISDE", "n/a": "geen ISDE-maatregel" }
    : { ok: "ISDE ok", check: "check ISDE", fail: "no ISDE", "n/a": "not an ISDE measure" };
  return (
    <div className={`quoteCard ${report.overall}`}>
      <div className="planHead">
        <span>{t.upload.quoteTitle}{report.installer ? ` · ${report.installer}` : ""}</span>
        {report.total !== null && <span>{eur(report.total)}</span>}
      </div>
      <div className={`quoteOverall ${report.overall}`}>{report.overallText}</div>
      {report.lines.map((l, i) => (
        <div className="quoteLine" key={i}>
          <div className="quoteLineHead">
            <strong>{l.name}</strong>
            {l.areaM2 !== null && <span className="muted"> · {l.areaM2} m²</span>}
            <span className={`qpill ${VERDICT_CLASS[l.verdict]}`}>{verdictLabel[l.verdict]}</span>
            <span className={`qpill ${ISDE_CLASS[l.isde]}`}>{isdeLabel[l.isde]}</span>
          </div>
          <p>{l.verdictText}</p>
          {l.isdeNotes.map((n, j) => <p key={j} className="muted">{n}</p>)}
          {l.missing.length > 0 && (
            <ul className="qmissing">
              {l.missing.map((m, j) => <li key={j}>{m}</li>)}
            </ul>
          )}
        </div>
      ))}
      {report.general.length > 0 && (
        <div className="quoteLine">
          <strong>{nl ? "Algemeen" : "General"}</strong>
          <ul className="qmissing">{report.general.map((g, j) => <li key={j}>{g}</li>)}</ul>
        </div>
      )}
      {report.questions.length > 0 && (
        <div className="quoteLine">
          <strong>{nl ? "Vraag de installateur" : "Ask the installer"}</strong>
          <ol className="qquestions">{report.questions.map((q, j) => <li key={j}>{q}</li>)}</ol>
        </div>
      )}
      <div className="quoteFoot">
        <button className="btn" onClick={onAsk}>{t.upload.askAbout}</button>
      </div>
    </div>
  );
}
