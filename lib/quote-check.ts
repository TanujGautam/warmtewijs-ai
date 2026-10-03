// Quote checker: deterministic checks on a quote that Claude has extracted into structured data.
// Benchmarks are indicative 2026 consumer prices incl. VAT; ISDE rules come from RVO (2025+).
import type { Lang } from "./i18n";

export const QUOTE_MEASURES = ["spouwmuur", "dak", "zoldervloer", "vloer", "bodem", "gevel", "hrglas", "triple", "hybride", "allelectric", "zonnepanelen", "ventilatie", "other"] as const;
export type QuoteMeasure = (typeof QUOTE_MEASURES)[number];

export interface QuoteLine {
  measure: QuoteMeasure;
  description: string;
  areaM2: number | null;
  quantity: number | null;
  totalPriceInclVat: number | null;
  totalPriceExclVat: number | null;
  rdValue: number | null;
  uValue: number | null;
  material: string | null;
  brandModel: string | null;
  meldcode: string | null;
  capacityKw: number | null;
  panelCount: number | null;
}

export interface ExtractedQuote {
  isQuote: boolean;
  installerName: string | null;
  installerKvk: string | null;
  quoteDate: string | null;
  totalInclVat: number | null;
  warrantyYears: number | null;
  validityDays: number | null;
  lines: QuoteLine[];
  mentions: {
    cavityInspection: boolean;
    ventilationAdvice: boolean;
    vapourBarrier: boolean;
    crawlspaceVentilation: boolean;
    electricalWork: boolean;
    vatStated: boolean;
  };
}

type Verdict = "low" | "ok" | "high" | "very-high" | "unknown";
type IsdeStatus = "ok" | "fail" | "check" | "n/a";

export interface LineReport {
  measure: QuoteMeasure;
  name: string;
  description: string;
  areaM2: number | null;
  price: number | null;
  unitPrice: number | null;
  unit: string;
  benchmark: { min: number; max: number; unit: string } | null;
  verdict: Verdict;
  verdictText: string;
  isde: IsdeStatus;
  isdeNotes: string[];
  missing: string[];
}

export interface QuoteReport {
  installer: string | null;
  total: number | null;
  lines: LineReport[];
  general: string[];
  questions: string[];
  overall: "good" | "check" | "concerns";
  overallText: string;
}

const tr = (l: Lang, en: string, nl: string) => (l === "nl" ? nl : en);
const eur = (n: number) => `€${Math.round(n).toLocaleString("nl-NL")}`;

const NAMES: Record<QuoteMeasure, [string, string]> = {
  spouwmuur: ["Cavity wall insulation", "Spouwmuurisolatie"],
  dak: ["Roof insulation", "Dakisolatie"],
  zoldervloer: ["Attic floor insulation", "Zoldervloerisolatie"],
  vloer: ["Floor insulation", "Vloerisolatie"],
  bodem: ["Ground insulation", "Bodemisolatie"],
  gevel: ["Facade insulation", "Gevelisolatie"],
  hrglas: ["HR++ glazing", "HR++ glas"],
  triple: ["Triple glazing", "Triple glas"],
  hybride: ["Hybrid heat pump", "Hybride warmtepomp"],
  allelectric: ["All-electric heat pump", "Volledige warmtepomp"],
  zonnepanelen: ["Solar panels", "Zonnepanelen"],
  ventilatie: ["Ventilation", "Ventilatie"],
  other: ["Other", "Overig"],
};

/** Indicative price ranges incl. VAT. "m2" = per m², "unit" = per installation, "panel" = per panel. */
export const BENCHMARKS: Partial<Record<QuoteMeasure, { min: number; max: number; per: "m2" | "unit" | "panel" }>> = {
  spouwmuur: { min: 15, max: 35, per: "m2" },
  dak: { min: 40, max: 90, per: "m2" },
  zoldervloer: { min: 20, max: 45, per: "m2" },
  vloer: { min: 25, max: 45, per: "m2" },
  bodem: { min: 15, max: 30, per: "m2" },
  gevel: { min: 100, max: 250, per: "m2" },
  hrglas: { min: 150, max: 250, per: "m2" },
  triple: { min: 250, max: 450, per: "m2" },
  hybride: { min: 4000, max: 7000, per: "unit" },
  allelectric: { min: 10000, max: 18000, per: "unit" },
  zonnepanelen: { min: 350, max: 550, per: "panel" },
};

/** ISDE technical requirements per insulation measure (RVO, 2025+). */
export const ISDE_RULES: Partial<Record<QuoteMeasure, { minM2: number; rd?: number; u?: number }>> = {
  spouwmuur: { minM2: 10, rd: 1.1 },
  dak: { minM2: 20, rd: 3.5 },
  zoldervloer: { minM2: 20, rd: 3.5 },
  vloer: { minM2: 20, rd: 3.5 },
  bodem: { minM2: 20, rd: 3.5 },
  gevel: { minM2: 10, rd: 3.5 },
  hrglas: { minM2: 3, u: 1.2 },
  triple: { minM2: 3, u: 0.7 },
};

const INSULATION: QuoteMeasure[] = ["spouwmuur", "dak", "zoldervloer", "vloer", "bodem", "gevel", "hrglas", "triple"];

function price(line: QuoteLine): number | null {
  if (line.totalPriceInclVat && line.totalPriceInclVat > 0) return line.totalPriceInclVat;
  if (line.totalPriceExclVat && line.totalPriceExclVat > 0) return Math.round(line.totalPriceExclVat * 1.21);
  return null;
}

function checkLine(line: QuoteLine, q: ExtractedQuote, l: Lang): LineReport {
  const [en, nl] = NAMES[line.measure];
  const p = price(line);
  const bm = BENCHMARKS[line.measure];
  const units = bm?.per === "m2" ? line.areaM2 : bm?.per === "panel" ? (line.panelCount ?? line.quantity) : 1;
  const unitPrice = p && units ? Math.round((p / units) * 100) / 100 : null;
  const unitLabel = bm?.per === "m2" ? "m²" : bm?.per === "panel" ? tr(l, "panel", "paneel") : tr(l, "installation", "installatie");

  let verdict: Verdict = "unknown";
  let verdictText = tr(l, "Not enough information to compare the price.", "Te weinig informatie om de prijs te vergelijken.");
  if (bm && unitPrice !== null) {
    const range = `${eur(bm.min)}–${eur(bm.max)}`;
    if (unitPrice < bm.min * 0.8) {
      verdict = "low";
      verdictText = tr(l, `${eur(unitPrice)} per ${unitLabel} is well below the usual ${range}. Check what's included and the material quality.`, `${eur(unitPrice)} per ${unitLabel} is ruim onder de gebruikelijke ${range}. Check wat er inbegrepen is en de kwaliteit van het materiaal.`);
    } else if (unitPrice <= bm.max) {
      verdict = "ok";
      verdictText = tr(l, `${eur(unitPrice)} per ${unitLabel} is within the usual ${range}.`, `${eur(unitPrice)} per ${unitLabel} valt binnen de gebruikelijke ${range}.`);
    } else if (unitPrice <= bm.max * 1.3) {
      verdict = "high";
      verdictText = tr(l, `${eur(unitPrice)} per ${unitLabel} is above the usual ${range}. Ask for a second quote.`, `${eur(unitPrice)} per ${unitLabel} is hoger dan de gebruikelijke ${range}. Vraag een tweede offerte.`);
    } else {
      verdict = "very-high";
      verdictText = tr(l, `${eur(unitPrice)} per ${unitLabel} is far above the usual ${range}. Get at least two other quotes.`, `${eur(unitPrice)} per ${unitLabel} is veel hoger dan de gebruikelijke ${range}. Vraag minstens twee andere offertes.`);
    }
  } else if (bm && bm.per === "m2" && !line.areaM2) {
    verdictText = tr(l, "The quote doesn't state the number of m², so the price can't be compared.", "De offerte noemt geen aantal m², dus de prijs is niet te vergelijken.");
  }

  // ISDE
  const isdeNotes: string[] = [];
  let isde: IsdeStatus = "n/a";
  const rule = ISDE_RULES[line.measure];
  if (rule) {
    isde = "ok";
    if (line.areaM2 === null) {
      isde = "check";
      isdeNotes.push(tr(l, `Area not stated; ISDE needs at least ${rule.minM2} m².`, `Oppervlakte niet vermeld; ISDE vraagt minimaal ${rule.minM2} m².`));
    } else if (line.areaM2 < rule.minM2) {
      isde = "fail";
      isdeNotes.push(tr(l, `${line.areaM2} m² is below the ISDE minimum of ${rule.minM2} m².`, `${line.areaM2} m² is onder het ISDE-minimum van ${rule.minM2} m².`));
    }
    if (rule.rd !== undefined) {
      if (line.rdValue === null) {
        if (isde === "ok") isde = "check";
        isdeNotes.push(tr(l, `Rd-value not stated; ISDE requires Rd ≥ ${rule.rd}.`, `Rd-waarde niet vermeld; ISDE vraagt Rd ≥ ${rule.rd}.`));
      } else if (line.rdValue < rule.rd) {
        isde = "fail";
        isdeNotes.push(tr(l, `Rd ${line.rdValue} is below the ISDE requirement of ${rule.rd}.`, `Rd ${line.rdValue} is lager dan de ISDE-eis van ${rule.rd}.`));
      } else isdeNotes.push(tr(l, `Rd ${line.rdValue} meets the ISDE requirement (≥ ${rule.rd}).`, `Rd ${line.rdValue} voldoet aan de ISDE-eis (≥ ${rule.rd}).`));
    }
    if (rule.u !== undefined) {
      if (line.uValue === null) {
        if (isde === "ok") isde = "check";
        isdeNotes.push(tr(l, `U-value not stated; ISDE requires U ≤ ${rule.u}.`, `U-waarde niet vermeld; ISDE vraagt U ≤ ${rule.u}.`));
      } else if (line.uValue > rule.u) {
        isde = "fail";
        isdeNotes.push(tr(l, `U ${line.uValue} is above the ISDE maximum of ${rule.u}.`, `U ${line.uValue} is hoger dan het ISDE-maximum van ${rule.u}.`));
      } else isdeNotes.push(tr(l, `U ${line.uValue} meets the ISDE requirement (≤ ${rule.u}).`, `U ${line.uValue} voldoet aan de ISDE-eis (≤ ${rule.u}).`));
    }
  } else if (line.measure === "hybride" || line.measure === "allelectric") {
    isde = line.meldcode ? "ok" : "check";
    isdeNotes.push(
      line.meldcode
        ? tr(l, `Meldcode ${line.meldcode} stated — check it on the RVO apparatus list.`, `Meldcode ${line.meldcode} vermeld — controleer die op de RVO-apparatenlijst.`)
        : tr(l, "No meldcode stated. ISDE only covers heat pumps on the RVO apparatus list; ask for the meldcode.", "Geen meldcode vermeld. ISDE geldt alleen voor warmtepompen op de RVO-apparatenlijst; vraag om de meldcode."),
    );
  } else if (line.measure === "zonnepanelen") {
    isdeNotes.push(tr(l, "No ISDE for solar panels; 0% VAT applies.", "Geen ISDE voor zonnepanelen; wel 0% btw."));
  }

  // Missing items
  const missing: string[] = [];
  const m = q.mentions;
  if (line.measure === "spouwmuur" && !m.cavityInspection) missing.push(tr(l, "No cavity inspection (boroscope check of cavity width and wall condition).", "Geen spouwonderzoek (boroscoopcontrole van spouwbreedte en muur)."));
  if (INSULATION.includes(line.measure) && !line.material && line.measure !== "hrglas" && line.measure !== "triple") missing.push(tr(l, "Insulation material not specified.", "Isolatiemateriaal niet vermeld."));
  if (line.measure === "dak" && !m.vapourBarrier) missing.push(tr(l, "No vapour barrier (dampremmende folie) mentioned.", "Geen dampremmende folie vermeld."));
  if ((line.measure === "vloer" || line.measure === "bodem") && !m.crawlspaceVentilation) missing.push(tr(l, "No crawl space ventilation check mentioned.", "Geen controle van de kruipruimteventilatie vermeld."));
  if ((line.measure === "hybride" || line.measure === "allelectric") && !line.capacityKw) missing.push(tr(l, "Heat pump capacity (kW) not stated.", "Vermogen van de warmtepomp (kW) niet vermeld."));
  if ((line.measure === "hybride" || line.measure === "allelectric") && !line.brandModel) missing.push(tr(l, "Brand and model not stated.", "Merk en type niet vermeld."));
  if ((line.measure === "hybride" || line.measure === "allelectric") && !m.electricalWork) missing.push(tr(l, "Electrical work (extra group in the meter box) not mentioned.", "Elektrawerk (extra groep in de meterkast) niet vermeld."));
  if (line.measure === "zonnepanelen" && !line.panelCount && !line.quantity) missing.push(tr(l, "Number of panels not stated.", "Aantal panelen niet vermeld."));

  return {
    measure: line.measure,
    name: l === "nl" ? nl : en,
    description: line.description,
    areaM2: line.areaM2,
    price: p,
    unitPrice,
    unit: unitLabel,
    benchmark: bm ? { min: bm.min, max: bm.max, unit: unitLabel } : null,
    verdict,
    verdictText,
    isde,
    isdeNotes,
    missing,
  };
}

export function checkQuote(q: ExtractedQuote, l: Lang): QuoteReport {
  const lines = q.lines.filter((x) => x.measure !== "other" || (price(x) ?? 0) > 0).map((x) => checkLine(x, q, l));
  const general: string[] = [];
  if (!q.installerKvk) general.push(tr(l, "No KvK number on the quote. ISDE requires the work to be done by a registered company.", "Geen KvK-nummer op de offerte. ISDE vereist dat een geregistreerd bedrijf het werk uitvoert."));
  if (!q.warrantyYears) general.push(tr(l, "No warranty period stated.", "Geen garantietermijn vermeld."));
  if (!q.mentions.vatStated) general.push(tr(l, "It's not clear whether prices include VAT.", "Het is niet duidelijk of de prijzen inclusief btw zijn."));
  if (!q.validityDays) general.push(tr(l, "No validity period for the quote.", "Geen geldigheidsduur van de offerte."));
  if (lines.some((x) => INSULATION.includes(x.measure)) && !q.mentions.ventilationAdvice)
    general.push(tr(l, "No ventilation advice. After insulating, the house needs enough ventilation to prevent damp.", "Geen ventilatieadvies. Na isoleren heeft het huis voldoende ventilatie nodig om vocht te voorkomen."));

  const questions: string[] = [];
  for (const x of lines) {
    if (x.verdict === "high" || x.verdict === "very-high") questions.push(tr(l, `Why is the ${x.name.toLowerCase()} priced at ${eur(x.unitPrice!)} per ${x.unit}?`, `Waarom kost de ${x.name.toLowerCase()} ${eur(x.unitPrice!)} per ${x.unit}?`));
    if (x.isde === "check" || x.isde === "fail") questions.push(tr(l, `Can you confirm the ${x.name.toLowerCase()} meets the ISDE requirements (${x.isdeNotes[0] ?? "Rd/U-value, m²"})?`, `Kunt u bevestigen dat de ${x.name.toLowerCase()} voldoet aan de ISDE-eisen (${x.isdeNotes[0] ?? "Rd/U-waarde, m²"})?`));
    for (const miss of x.missing.slice(0, 2)) questions.push(tr(l, `Please add: ${miss}`, `Graag toevoegen: ${miss}`));
  }

  const bad = lines.filter((x) => x.verdict === "very-high" || x.isde === "fail").length;
  const warn = lines.filter((x) => x.verdict === "high" || x.verdict === "low" || x.isde === "check" || x.missing.length).length + (general.length > 2 ? 1 : 0);
  const overall = bad ? "concerns" : warn ? "check" : "good";
  const overallText = {
    good: tr(l, "This quote looks reasonable: prices are within the usual range and the ISDE requirements are met.", "Deze offerte ziet er redelijk uit: de prijzen vallen binnen de gebruikelijke bandbreedte en voldoen aan de ISDE-eisen."),
    check: tr(l, "Mostly fine, but a few points need clarifying before you sign.", "Grotendeels in orde, maar een paar punten moet je laten verduidelijken voordat je tekent."),
    concerns: tr(l, "There are serious concerns: prices well above normal or ISDE requirements not met. Don't sign yet.", "Er zijn serieuze aandachtspunten: prijzen ver boven normaal of ISDE-eisen niet gehaald. Teken nog niet."),
  }[overall];

  return { installer: q.installerName, total: q.totalInclVat, lines, general, questions: questions.slice(0, 8), overall, overallText };
}

/** One-paragraph summary to hand to the chat agent. */
export function summarizeReport(r: QuoteReport, l: Lang): string {
  const parts = r.lines.map((x) => `${x.name}: ${x.verdictText} ISDE: ${x.isde}${x.isdeNotes.length ? ` (${x.isdeNotes.join(" ")})` : ""}.${x.missing.length ? ` ${tr(l, "Missing", "Ontbreekt")}: ${x.missing.join(" ")}` : ""}`);
  return `${r.overallText} ${parts.join(" ")} ${r.general.join(" ")}`.trim();
}
