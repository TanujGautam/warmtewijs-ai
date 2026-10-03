// Deterministic energy model. Every number the advisor shows comes from here,
// never from the language model — so the maths is inspectable and testable.

export type HouseType = "rijtjeshuis" | "hoekwoning" | "twee-onder-een-kap" | "vrijstaand" | "appartement";
export type Label = "A" | "B" | "C" | "D" | "E" | "F" | "G";
export type MeasureId = "spouwmuur" | "dak" | "vloer" | "hrglas" | "hybride" | "allelectric" | "zonnepanelen";
export type Applicant = "owner" | "renter" | "vve";
export type Lang = "en" | "nl";
const tr = (lang: Lang, en: string, nl: string) => (lang === "nl" ? nl : en);

export interface House {
  postcode: string;
  houseNumber: string;
  buildYear: number;
  type: HouseType;
  floorArea: number;
  label: Label;
  source: string;
  address?: string;
  labelSource?: string;
  typeSource?: string;
  use?: string;
  transient?: boolean; // part of the data came from a failed lookup; don't cache
}

export interface Assumptions {
  gasPrice: number; // € per m³
  electricityPrice: number; // € per kWh
  gasUseM3?: number; // annual, overrides the estimate
}

export const DEFAULT_ASSUMPTIONS: Assumptions = { gasPrice: 1.3, electricityPrice: 0.3 };

const LABELS: Label[] = ["G", "F", "E", "D", "C", "B", "A"];
export const HOUSE_TYPES: HouseType[] = ["rijtjeshuis", "hoekwoning", "twee-onder-een-kap", "vrijstaand", "appartement"];
export const LABEL_VALUES = ["A", "B", "C", "D", "E", "F", "G"] as const;
const CO2_PER_M3_GAS = 1.78; // kg
const CO2_PER_KWH = 0.33; // kg, grid average

export const MEASURES: Record<MeasureId, { name: string; dutch: string; category: "insulation" | "heat" | "generation" }> = {
  spouwmuur: { name: "Cavity wall insulation", dutch: "Spouwmuurisolatie", category: "insulation" },
  dak: { name: "Roof insulation", dutch: "Dakisolatie", category: "insulation" },
  vloer: { name: "Floor insulation", dutch: "Vloerisolatie", category: "insulation" },
  hrglas: { name: "HR++ glazing", dutch: "HR++ glas", category: "insulation" },
  hybride: { name: "Hybrid heat pump", dutch: "Hybride warmtepomp", category: "heat" },
  allelectric: { name: "All-electric heat pump", dutch: "Volledige warmtepomp", category: "heat" },
  zonnepanelen: { name: "Solar panels (10×)", dutch: "Zonnepanelen", category: "generation" },
};

export const MEASURE_IDS = Object.keys(MEASURES) as MeasureId[];

export interface HouseOverrides {
  type?: HouseType;
  buildYear?: number;
  floorArea?: number;
  label?: Label;
}

/** Apply corrections from the user (they know their house better than the register). */
export function applyOverrides(house: House, o: HouseOverrides): House {
  const out = { ...house };
  if (o.type) [out.type, out.typeSource] = [o.type, "corrected by user"];
  if (o.buildYear) out.buildYear = o.buildYear;
  if (o.floorArea) out.floorArea = o.floorArea;
  if (o.label) [out.label, out.labelSource] = [o.label, "provided by user"];
  return out;
}

export function surfaces(house: House) {
  const a = house.floorArea;
  const exposed = { rijtjeshuis: 0.55, hoekwoning: 0.8, "twee-onder-een-kap": 0.9, vrijstaand: 1.15, appartement: 0.45 }[house.type];
  return {
    wall: Math.round(a * exposed),
    roof: house.type === "appartement" ? 0 : Math.round(a * 0.6),
    floor: house.type === "appartement" ? 0 : Math.round(a * 0.5),
    glass: Math.round(a * 0.16),
  };
}

export function estimateGasUse(house: House): number {
  const perM2 = { G: 22, F: 19, E: 16, D: 13.5, C: 11, B: 8.5, A: 6 }[house.label];
  return Math.round(house.floorArea * perM2 + 250); // + tap water/cooking
}

interface MeasureSpec {
  applicable: (h: House, done: Set<MeasureId>, lang: Lang) => string | null; // reason not applicable, or null
  cost: (h: House) => number;
  gasReduction: number; // fraction of space-heating gas saved
  extraKwh?: (gasSaved: number) => number;
  solarKwh?: number;
  labelSteps: number;
}

const SPECS: Record<MeasureId, MeasureSpec> = {
  spouwmuur: {
    applicable: (h, _d, l) =>
      h.buildYear < 1925
        ? tr(l, "Pre-1925 walls are usually solid — no cavity to fill.", "Muren van vóór 1925 zijn meestal massief — geen spouw om te vullen.")
        : h.buildYear >= 1975
          ? tr(l, "Built 1975 or later — the cavity is usually already insulated.", "Gebouwd in 1975 of later — de spouw is meestal al geïsoleerd.")
          : null,
    cost: (h) => 450 + surfaces(h).wall * 24,
    gasReduction: 0.2,
    labelSteps: 1,
  },
  dak: {
    applicable: (h, _d, l) =>
      h.type === "appartement"
        ? tr(l, "Apartment — the roof is a VvE decision.", "Appartement — het dak is een VvE-besluit.")
        : h.buildYear >= 1992
          ? tr(l, "Built after 1992 — roof was insulated to building code.", "Gebouwd na 1992 — het dak is volgens het Bouwbesluit geïsoleerd.")
          : null,
    cost: (h) => 600 + surfaces(h).roof * 60,
    gasReduction: 0.18,
    labelSteps: 1,
  },
  vloer: {
    applicable: (h, _d, l) =>
      h.type === "appartement"
        ? tr(l, "Apartment — usually no crawl space.", "Appartement — meestal geen kruipruimte.")
        : h.buildYear >= 1992
          ? tr(l, "Built after 1992 — floor was insulated to building code.", "Gebouwd na 1992 — de vloer is volgens het Bouwbesluit geïsoleerd.")
          : null,
    cost: (h) => 300 + surfaces(h).floor * 35,
    gasReduction: 0.1,
    labelSteps: 0.5,
  },
  hrglas: {
    applicable: (h, _d, l) => (h.buildYear >= 2006 ? tr(l, "Built after 2006 — HR++ is standard.", "Gebouwd na 2006 — HR++ is standaard.") : null),
    cost: (h) => surfaces(h).glass * 200,
    gasReduction: 0.12,
    labelSteps: 0.5,
  },
  hybride: {
    applicable: (h, done, l) => (done.has("allelectric") ? tr(l, "Already all-electric.", "Al volledig elektrisch.") : null),
    cost: () => 5800,
    gasReduction: 0.6,
    extraKwh: (gasSaved) => (gasSaved * 9.77 * 0.95) / 3.6, // heat delivered / SCOP
    labelSteps: 1,
  },
  allelectric: {
    applicable: (h, done, l) => (done.has("allelectric") ? tr(l, "Already all-electric.", "Al volledig elektrisch.") : null),
    cost: (h) => 11000 + h.floorArea * 25,
    gasReduction: 1,
    extraKwh: (gasSaved) => (gasSaved * 9.77 * 0.95) / 3.2,
    labelSteps: 2,
  },
  zonnepanelen: {
    applicable: (h, _d, l) => (h.type === "appartement" ? tr(l, "Apartment — shared roof, VvE decision.", "Appartement — gedeeld dak, VvE-besluit.") : null),
    cost: () => 5200,
    gasReduction: 0,
    solarKwh: 3600,
    labelSteps: 1,
  },
};

export interface MeasureResult {
  id: MeasureId;
  name: string;
  dutch: string;
  cost: number;
  subsidy: number;
  netCost: number;
  savingPerYear: number;
  paybackYears: number | null;
  co2TonnesPerYear: number;
  status: "recommended" | "later" | "not-applicable";
  reason: string;
}

export interface PlanResult {
  house: House;
  assumptions: Assumptions & { gasUseM3: number };
  measures: MeasureResult[];
  totals: { cost: number; subsidy: number; savingPerYear: number; co2TonnesPerYear: number };
  labelFrom: Label;
  areas: { wall: number; roof: number; floor: number; glass: number }; // estimated m² from floor area and type
  labelTo: Label;
  notes: string[];
}

const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

/** ISDE insulation rules (RVO, 2025+): rate per m² (single measure), minimum and maximum subsidised m². */
export const ISDE_INSULATION = {
  spouwmuur: { rate: 5.25, min: 10, max: 170, rd: 1.1 },
  dak: { rate: 16.25, min: 20, max: 200, rd: 3.5 },
  vloer: { rate: 5.5, min: 20, max: 130, rd: 3.5 },
  hrglas: { rate: 25, min: 3, max: 45, u: 1.2 },
} as const;
type InsulationId = keyof typeof ISDE_INSULATION;

/** Subsidy (indicative ISDE 2026) for a measure, given how many measures are planned together. */
export function subsidyFor(id: MeasureId, house: House, applicant: Applicant, measureCount: number, lang: Lang = "en"): { amount: number; conditions: string } {
  if (applicant === "renter") return { amount: 0, conditions: tr(lang, "Tenants are not eligible for ISDE; the landlord can apply.", "Huurders komen niet in aanmerking voor ISDE; de verhuurder kan aanvragen.") };
  const s = surfaces(house);
  const double = measureCount >= 2 ? 2 : 1;
  const prefix = applicant === "vve" ? tr(lang, "Via SVVE for VvE's. ", "Via SVVE voor VvE's. ") : "";
  const two = double === 2 ? tr(lang, " (two-measure rate)", " (tarief bij twee maatregelen)") : "";
  if (id in ISDE_INSULATION) {
    const key = id as InsulationId;
    const rule = ISDE_INSULATION[key];
    const area = { spouwmuur: s.wall, dak: s.roof, vloer: s.floor, hrglas: s.glass }[key];
    const rate = round(rule.rate * double, 2);
    const amount = area >= rule.min ? Math.round(Math.min(area, rule.max) * rate) : 0;
    const what = { spouwmuur: tr(lang, "wall", "muur"), dak: tr(lang, "roof", "dak"), vloer: tr(lang, "floor", "vloer"), hrglas: tr(lang, "glass", "glas") }[key];
    const dec = (n: number) => n.toLocaleString(lang === "nl" ? "nl-NL" : "en-GB");
    const spec = "rd" in rule ? `Rd ≥ ${dec(rule.rd)}` : `U ≤ ${dec(rule.u)}`;
    return { amount, conditions: `${prefix}≥ ${rule.min} m² ${what}, ${spec}. €${rate.toLocaleString("nl-NL")}/m²${two}.` };
  }
  if (id === "hybride") return { amount: 2100, conditions: prefix + tr(lang, "Device must be on the RVO apparatus list (meldcode).", "Het toestel moet op de RVO-apparatenlijst staan (meldcode).") };
  if (id === "allelectric") return { amount: 3400, conditions: prefix + tr(lang, "Device must be on the RVO apparatus list (meldcode).", "Het toestel moet op de RVO-apparatenlijst staan (meldcode).") };
  return { amount: 0, conditions: tr(lang, "No ISDE for solar; 0% VAT applies instead.", "Geen ISDE voor zonnepanelen; wel 0% btw.") };
}

export function calculatePlan(
  house: House,
  opts: { done?: MeasureId[]; applicant?: Applicant; assumptions?: Partial<Assumptions>; yearsStaying?: number; budget?: number; lang?: Lang } = {},
): PlanResult {
  const done = new Set(opts.done ?? []);
  const applicant = opts.applicant ?? "owner";
  const l: Lang = opts.lang ?? "en";
  const a = { ...DEFAULT_ASSUMPTIONS, ...opts.assumptions };
  const gasUse = a.gasUseM3 ?? estimateGasUse(house);
  const notes: string[] = [];

  // Insulation is evaluated on the remaining gas use after previous insulation (diminishing returns).
  const candidates = MEASURE_IDS.filter((id) => !done.has(id));
  const applicable = candidates.filter((id) => SPECS[id].applicable(house, done, l) === null);
  const insulationCount = applicable.filter((id) => MEASURES[id].category === "insulation").length;
  const heatingGas = gasUse - 250;

  let remainingHeating = heatingGas;
  const results: MeasureResult[] = [];

  const ordered = [...candidates].sort((x, y) => {
    const order = ["insulation", "heat", "generation"];
    return order.indexOf(MEASURES[x].category) - order.indexOf(MEASURES[y].category);
  });

  const insulationLeft = applicable.some((id) => ["spouwmuur", "dak"].includes(id));
  const poorLabel = ["E", "F", "G"].includes(house.label);

  for (const id of ordered) {
    const spec = SPECS[id];
    const meta = MEASURES[id];
    const notApplicable = spec.applicable(house, done, l);
    if (notApplicable) {
      results.push({ id, ...pick(meta), cost: 0, subsidy: 0, netCost: 0, savingPerYear: 0, paybackYears: null, co2TonnesPerYear: 0, status: "not-applicable", reason: notApplicable });
      continue;
    }
    const cost = Math.round(spec.cost(house) / 50) * 50;
    const sub = subsidyFor(id, house, applicant, insulationCount + (["hybride", "allelectric"].includes(id) ? 1 : 0), l);
    // All-electric replaces whatever gas is left after the insulation above (heating + tap water).
    const gasSaved = id === "allelectric" ? remainingHeating + 250 : remainingHeating * spec.gasReduction;
    const extraKwh = spec.extraKwh ? spec.extraKwh(gasSaved) : 0;
    const solarKwh = spec.solarKwh ?? 0;
    let saving = gasSaved * a.gasPrice - extraKwh * a.electricityPrice + solarKwh * a.electricityPrice * 0.75; // ~75% value after saldering ends
    if (id === "allelectric") saving += 300; // fixed gas connection charge
    const co2 = (gasSaved * CO2_PER_M3_GAS - extraKwh * CO2_PER_KWH + solarKwh * CO2_PER_KWH) / 1000;
    const net = cost - sub.amount;
    const payback = saving > 0 ? round(net / saving, 1) : null;

    let status: MeasureResult["status"] = "recommended";
    let reason = "";
    if (id === "allelectric" && (poorLabel || insulationLeft)) {
      status = "later";
      reason = tr(l, "Insulate first — an all-electric heat pump needs a well-insulated house (label B or better).", "Eerst isoleren — een volledige warmtepomp vraagt een goed geïsoleerd huis (label B of beter).");
    } else if (id === "allelectric" && applicable.includes("hybride")) {
      status = "later";
      reason = tr(l, "A hybrid heat pump gives most of the saving at half the cost; go all-electric when the boiler is due.", "Een hybride warmtepomp geeft het grootste deel van de besparing voor de helft van de kosten; ga volledig elektrisch als de cv-ketel aan vervanging toe is.");
    } else if (id === "hybride" && poorLabel && insulationLeft) {
      status = "later";
      reason = tr(l, "Insulate walls and roof first, then add a hybrid heat pump.", "Isoleer eerst muren en dak, en neem daarna een hybride warmtepomp.");
    } else if (id === "zonnepanelen" && applicable.includes("dak")) {
      status = "later";
      reason = tr(l, "Insulate the roof first — moving panels later costs €800–€1.500.", "Isoleer eerst het dak — panelen later verplaatsen kost €800–€1.500.");
    } else if (payback !== null && opts.yearsStaying && payback > opts.yearsStaying) {
      status = "later";
      reason = tr(l, `Payback (${payback} yr) is longer than you plan to stay (${opts.yearsStaying} yr).`, `Terugverdientijd (${payback} jr) is langer dan je hier nog woont (${opts.yearsStaying} jr).`);
    } else if (payback === null || payback > 25) {
      status = "later";
      reason = tr(l, "Doesn't pay back within 25 years at current prices.", "Verdient zich bij de huidige prijzen niet binnen 25 jaar terug.");
    } else {
      reason = sub.conditions;
    }

    // Heat measures are alternatives to each other, so only insulation reduces the base they're computed on.
    if (meta.category === "insulation" && status === "recommended") remainingHeating -= gasSaved;

    results.push({
      id,
      ...pick(meta),
      cost,
      subsidy: sub.amount,
      netCost: net,
      savingPerYear: Math.round(saving),
      paybackYears: payback,
      co2TonnesPerYear: round(co2, 2),
      status,
      reason,
    });
  }

  const recommended = results.filter((r) => r.status === "recommended").sort((x, y) => (x.paybackYears ?? 99) - (y.paybackYears ?? 99));
  const rest = results.filter((r) => r.status !== "recommended");

  if (opts.budget !== undefined) {
    let spent = 0;
    for (const r of recommended) {
      spent += r.netCost;
      if (spent > opts.budget) {
        r.status = "later";
        r.reason = tr(l, `Over your budget of €${opts.budget.toLocaleString("nl-NL")} — consider financing (Warmtefonds).`, `Boven je budget van €${opts.budget.toLocaleString("nl-NL")} — overweeg financiering (Warmtefonds).`);
      }
    }
  }

  const final = [...recommended.filter((r) => r.status === "recommended"), ...recommended.filter((r) => r.status !== "recommended"), ...rest];
  const steps = final.filter((r) => r.status === "recommended").reduce((s, r) => s + SPECS[r.id].labelSteps, 0);
  const labelTo = LABELS[Math.min(6, LABELS.indexOf(house.label) + Math.floor(steps))];
  if (applicant === "renter") notes.push(tr(l, "You rent: structural measures are your landlord's decision. Use this plan to make your request concrete.", "Je huurt: bouwkundige maatregelen zijn een besluit van je verhuurder. Gebruik dit plan om je verzoek concreet te maken."));
  if (house.labelSource?.startsWith("estimated")) notes.push(tr(l, `Energy label ${house.label} is estimated from the build year — tell us your actual label for a sharper plan.`, `Energielabel ${house.label} is geschat op basis van het bouwjaar — noem je echte label voor een scherper plan.`));
  if (a.gasUseM3 === undefined) notes.push(tr(l, `Gas use estimated at ${gasUse} m³/yr from label and floor area — upload your energy bill for a sharper plan.`, `Gasverbruik geschat op ${gasUse} m³/jr op basis van label en oppervlakte — upload je jaarafrekening voor een scherper plan.`));
  notes.push(tr(l, "Indicative 2026 figures. Get two quotes and check RVO before you sign.", "Indicatieve bedragen 2026. Vraag twee offertes aan en check RVO voordat je tekent."));

  const rec = final.filter((r) => r.status === "recommended");
  return {
    house,
    assumptions: { ...a, gasUseM3: gasUse },
    measures: final,
    totals: {
      cost: sum(rec.map((r) => r.cost)),
      subsidy: sum(rec.map((r) => r.subsidy)),
      savingPerYear: sum(rec.map((r) => r.savingPerYear)),
      co2TonnesPerYear: round(sum(rec.map((r) => r.co2TonnesPerYear)), 1),
    },
    labelFrom: house.label,
    areas: surfaces(house),
    labelTo,
    notes,
  };
}

function pick(m: { name: string; dutch: string }) {
  return { name: m.name, dutch: m.dutch };
}
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

/** Annuity payment, used by the financing skill. */
export function monthlyPayment(principal: number, annualRatePct: number, years: number): number {
  const n = years * 12;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return Math.round(principal / n);
  return Math.round((principal * r) / (1 - (1 + r) ** -n));
}
