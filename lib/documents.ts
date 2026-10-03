// Downloadable documents, generated in the browser with jsPDF (nothing leaves the device).
// Every number comes from the deterministic plan; the text is templated in Dutch and English.
import type { House, MeasureResult, PlanResult } from "./engine";
import type { Lang } from "./i18n";
import { num, sourceText } from "./house-text";

type JsPDF = import("jspdf").jsPDF;

const BLUE: [number, number, number] = [26, 70, 200];
const INK: [number, number, number] = [20, 22, 26];
const GREY: [number, number, number] = [107, 112, 121];
const M = 18; // page margin, mm

const tr = (l: Lang, en: string, nl: string) => (l === "nl" ? nl : en);
const eur = (n: number) => `€ ${Math.round(n).toLocaleString("nl-NL")}`;
const today = (l: Lang) => new Date().toLocaleDateString(l === "nl" ? "nl-NL" : "en-GB", { day: "numeric", month: "long", year: "numeric" });

/** The built-in PDF fonts only cover Latin-1 (+€): replace the few characters they can't draw. */
function safe(s: string): string {
  return s
    .replace(/₂/g, "2")
    .replace(/→/g, "->")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/✓/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x00-\xFF€–—…•]/g, "");
}

async function newDoc(title: string, subtitle: string, l: Lang) {
  const { jsPDF } = await import("jspdf");
  const { autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFillColor(...BLUE);
  doc.rect(M, 14, 6, 6, "F");
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...INK).text("Warmtewijs AI", M + 9, 18.8);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...GREY).text(safe(today(l)), 210 - M, 18.8, { align: "right" });
  doc.setFont("helvetica", "bold").setFontSize(19).setTextColor(...INK).text(safe(title), M, 34);
  doc.setFont("helvetica", "normal").setFontSize(10.5).setTextColor(...GREY).text(safe(subtitle), M, 41);
  return { doc, autoTable, y: 50 };
}

function para(doc: JsPDF, text: string, y: number, opts: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number } = {}): number {
  doc.setFont("helvetica", opts.bold ? "bold" : "normal").setFontSize(opts.size ?? 10.5).setTextColor(...(opts.color ?? INK));
  const lines = doc.splitTextToSize(safe(text), 210 - 2 * M) as string[];
  const lh = (opts.size ?? 10.5) * 0.45;
  for (const line of lines) {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, M, y);
    y += lh;
  }
  return y + (opts.gap ?? 3);
}

function heading(doc: JsPDF, text: string, y: number) {
  if (y > 265) {
    doc.addPage();
    y = 20;
  }
  return para(doc, text, y + 2, { size: 12.5, bold: true, gap: 2 });
}

/** Tests can capture the generated PDF instead of triggering a browser download. */
let saveHook: ((doc: JsPDF, filename: string) => void) | null = null;
export function setSaveHook(hook: typeof saveHook) {
  saveHook = hook;
}

function finish(doc: JsPDF, l: Lang, filename: string) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(222, 219, 212).line(M, 285, 210 - M, 285);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...GREY);
    doc.text(
      safe(tr(l, "Indicative figures based on public data (BAG, EP-Online, RVO). Not financial advice. warmtewijs-ai.vercel.app", "Indicatieve bedragen op basis van open data (BAG, EP-Online, RVO). Geen financieel advies. warmtewijs-ai.vercel.app")),
      M,
      290,
    );
    doc.text(`${i}/${pages}`, 210 - M, 290, { align: "right" });
  }
  if (saveHook) saveHook(doc, filename);
  else doc.save(filename);
}

const lastY = (doc: JsPDF) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
const tableStyle = {
  styles: { font: "helvetica", fontSize: 9, cellPadding: 2.2, textColor: INK, lineColor: [222, 219, 212] as [number, number, number], lineWidth: 0.1 },
  headStyles: { fillColor: [237, 234, 228] as [number, number, number], textColor: INK, fontStyle: "bold" as const },
  margin: { left: M, right: M },
};

function houseLine(h: House, l: Lang) {
  return `${h.address ?? `${h.postcode} ${h.houseNumber}`} · ${h.type} · ${tr(l, "built", "bouwjaar")} ${h.buildYear} · ${h.floorArea} m² · label ${h.label}`;
}

const mName = (m: MeasureResult, l: Lang) => (l === "nl" ? m.dutch : `${m.name} (${m.dutch})`);

// ---------- 1. PDF plan ----------
export async function downloadPlan(plan: PlanResult, l: Lang) {
  const h = plan.house;
  const { doc, autoTable, y: y0 } = await newDoc(tr(l, "Your energy plan", "Jouw energieplan"), houseLine(h, l), l);
  let y = y0;

  autoTable(doc, {
    ...tableStyle,
    startY: y,
    head: [[tr(l, "Saving per year", "Besparing per jaar"), tr(l, "Subsidy", "Subsidie"), tr(l, "Investment", "Investering"), tr(l, "CO2 per year", "CO2 per jaar"), tr(l, "Label", "Label")]],
    body: [[eur(plan.totals.savingPerYear), eur(plan.totals.subsidy), eur(plan.totals.cost), `${plan.totals.co2TonnesPerYear.toLocaleString("nl-NL")} t`, `${plan.labelFrom} -> ${plan.labelTo}`]],
  });
  y = lastY(doc) + 8;

  y = heading(doc, tr(l, "Recommended, in order", "Aanbevolen, op volgorde"), y);
  const rec = plan.measures.filter((m) => m.status === "recommended");
  autoTable(doc, {
    ...tableStyle,
    startY: y,
    head: [["#", tr(l, "Measure", "Maatregel"), tr(l, "Cost", "Kosten"), tr(l, "Subsidy", "Subsidie"), tr(l, "Net", "Netto"), tr(l, "Saving/yr", "Besparing/jr"), tr(l, "Payback", "Terugverdientijd")]],
    body: rec.map((m, i) => [String(i + 1), safe(mName(m, l)), eur(m.cost), eur(m.subsidy), eur(m.netCost), eur(m.savingPerYear), `${num(m.paybackYears ?? 0, l)} ${tr(l, "yr", "jr")}`]),
    columnStyles: { 0: { cellWidth: 8 } },
  });
  y = lastY(doc) + 6;
  for (const m of rec) y = para(doc, `${mName(m, l)}: ${m.reason}`, y, { size: 9, color: GREY, gap: 1 });

  const later = plan.measures.filter((m) => m.status !== "recommended");
  if (later.length) {
    y = heading(doc, tr(l, "Not now", "Nu nog niet"), y + 4);
    for (const m of later) y = para(doc, `• ${mName(m, l)}: ${m.reason}`, y, { size: 9.5, gap: 1 });
  }

  y = heading(doc, tr(l, "Assumptions", "Aannames"), y + 4);
  const a = plan.assumptions;
  y = para(
    doc,
    tr(
      l,
      `Gas €${a.gasPrice.toFixed(2)}/m³, electricity €${a.electricityPrice.toFixed(2)}/kWh, gas use ${a.gasUseM3} m³ per year. House data: ${h.source}. Label: ${sourceText(h.labelSource, l)}. House type: ${sourceText(h.typeSource, l)}.`,
      `Gas €${a.gasPrice.toFixed(2).replace(".", ",")}/m³, stroom €${a.electricityPrice.toFixed(2).replace(".", ",")}/kWh, gasverbruik ${a.gasUseM3} m³ per jaar. Woningdata: ${h.source}. Label: ${sourceText(h.labelSource, l)}. Woningtype: ${sourceText(h.typeSource, l)}.`,
    ),
    y,
    { size: 9.5 },
  );
  for (const n of plan.notes) y = para(doc, `• ${n}`, y, { size: 9.5, gap: 1 });

  y = heading(doc, tr(l, "Next steps", "Volgende stappen"), y + 4);
  const steps = rec[0]
    ? [
        tr(l, `Request two quotes for ${rec[0].name.toLowerCase()} (use the Warmtewijs quote request).`, `Vraag twee offertes aan voor ${rec[0].dutch.toLowerCase()} (gebruik de Warmtewijs-offerteaanvraag).`),
        tr(l, "Have every quote checked with the Warmtewijs quote checker before you sign.", "Laat elke offerte controleren met de Warmtewijs-offertecheck voordat je tekent."),
        tr(l, "Plan two or more measures within 24 months to get the doubled ISDE rate.", "Plan twee of meer maatregelen binnen 24 maanden voor het dubbele ISDE-tarief."),
        tr(l, "Apply for ISDE within 24 months after installation, with invoice, proof of payment and photos.", "Vraag ISDE aan binnen 24 maanden na installatie, met factuur, betaalbewijs en foto's."),
      ]
    : [tr(l, "Your house is already in good shape. Test a 50 °C boiler setting to prepare for a heat pump.", "Je huis is al in goede staat. Test een cv-instelling van 50 °C als voorbereiding op een warmtepomp.")];
  steps.forEach((s, i) => (y = para(doc, `${i + 1}. ${s}`, y, { size: 10, gap: 1 })));

  finish(doc, l, tr(l, "warmtewijs-energy-plan.pdf", "warmtewijs-energieplan.pdf"));
}

// ---------- 2. Letter to the landlord ----------
export async function downloadLandlordLetter(plan: PlanResult, names: { tenant: string; landlord: string }, l: Lang) {
  const h = plan.house;
  const addr = h.address ?? `${h.postcode} ${h.houseNumber}`;
  const { doc } = await newDoc(tr(l, "Letter to your landlord", "Brief aan je verhuurder"), addr, l);
  let y = 54;
  const tenant = names.tenant.trim() || tr(l, "[Your name]", "[Je naam]");
  const landlord = names.landlord.trim() || tr(l, "[Landlord]", "[Verhuurder]");
  y = para(doc, `${tenant}\n${addr}`, y, { gap: 5 });
  y = para(doc, `${tr(l, "To", "Aan")}: ${landlord}\n${today(l)}`, y, { gap: 6 });
  y = para(doc, `${tr(l, "Subject", "Betreft")}: ${tr(l, "Request for energy-saving improvements", "Verzoek om energiebesparende maatregelen")} – ${addr}`, y, { bold: true, gap: 6 });
  y = para(doc, tr(l, `Dear ${landlord},`, `Geachte ${landlord},`), y, { gap: 4 });

  const labelInfo = h.labelSource?.startsWith("estimated")
    ? tr(l, `an estimated energy label ${h.label}`, `een geschat energielabel ${h.label}`)
    : tr(l, `energy label ${h.label}`, `energielabel ${h.label}`);
  y = para(
    doc,
    tr(
      l,
      `I rent the home at ${addr}, built in ${h.buildYear}, with ${labelInfo}. The heating costs are high and part of the heat is lost through the building. I would like to ask you to consider the following improvements:`,
      `Ik huur de woning aan ${addr}, gebouwd in ${h.buildYear}, met ${labelInfo}. De stookkosten zijn hoog en een deel van de warmte gaat via het gebouw verloren. Ik wil u vragen de volgende verbeteringen te overwegen:`,
    ),
    y,
  );
  const rec = plan.measures.filter((m) => m.status === "recommended" || m.status === "later").filter((m) => m.id !== "zonnepanelen" && m.id !== "allelectric");
  for (const m of rec.slice(0, 4)) y = para(doc, `• ${mName(m, l)} – ${tr(l, "estimated saving", "geschatte besparing")} ${eur(m.savingPerYear)} ${tr(l, "per year", "per jaar")}`, y, { gap: 1 });
  y += 3;
  y = para(
    doc,
    tr(
      l,
      "These measures make the home more comfortable, lower the energy costs and improve the energy label, which also increases the value of the property. Subsidies may be available for some of them (see rvo.nl).",
      "Deze maatregelen maken de woning comfortabeler, verlagen de energiekosten en verbeteren het energielabel, wat ook de waarde van de woning verhoogt. Voor een deel van de maatregelen is mogelijk subsidie beschikbaar (zie rvo.nl).",
    ),
    y,
  );
  if (["E", "F", "G"].includes(h.label))
    y = para(
      doc,
      tr(
        l,
        `Please note that from 2029, homes with energy label E, F or G may no longer be newly rented out.`,
        `Ter informatie: vanaf 2029 mogen woningen met energielabel E, F of G niet meer opnieuw verhuurd worden.`,
      ),
      y,
    );
  y = para(
    doc,
    tr(
      l,
      "I would appreciate a written response within six weeks, stating which measures you intend to take and when. I am happy to discuss this and to give access to the home for an inspection.",
      "Ik ontvang graag binnen zes weken een schriftelijke reactie, met welke maatregelen u wilt nemen en wanneer. Ik ga hierover graag in gesprek en geef toegang tot de woning voor een inspectie.",
    ),
    y,
    { gap: 8 },
  );
  y = para(doc, tr(l, "Kind regards,", "Met vriendelijke groet,"), y, { gap: 12 });
  para(doc, tenant, y);
  finish(doc, l, tr(l, "letter-to-landlord.pdf", "brief-aan-verhuurder.pdf"));
}

// ---------- 3. VvE proposal ----------
export async function downloadVveProposal(plan: PlanResult, l: Lang) {
  const h = plan.house;
  const addr = h.address ?? `${h.postcode} ${h.houseNumber}`;
  const { doc, autoTable } = await newDoc(tr(l, "Proposal for the VvE meeting", "Voorstel voor de ledenvergadering (ALV)"), tr(l, `Building of ${addr}`, `Gebouw van ${addr}`), l);
  let y = 52;
  y = heading(doc, tr(l, "Agenda item", "Agendapunt"), y);
  y = para(doc, tr(l, "Making the building more sustainable: energy advice and subsidy application", "Verduurzaming van het gebouw: energieadvies en subsidieaanvraag"), y, { bold: true });

  y = heading(doc, tr(l, "Why now", "Waarom nu"), y + 2);
  y = para(
    doc,
    tr(
      l,
      `The building dates from ${h.buildYear}; this home has energy label ${h.label}${h.labelSource?.startsWith("estimated") ? " (estimated)" : ""}. Roof, facade and shared installations are the VvE's responsibility, so individual owners cannot fix the biggest heat losses on their own. Combining the work with planned maintenance (MJOP) saves costs such as scaffolding.`,
      `Het gebouw is uit ${h.buildYear}; deze woning heeft energielabel ${h.label}${h.labelSource?.startsWith("estimated") ? " (geschat)" : ""}. Dak, gevel en gezamenlijke installaties vallen onder de VvE, dus eigenaren kunnen de grootste warmteverliezen niet zelf oplossen. Werk combineren met gepland onderhoud (MJOP) bespaart kosten, zoals steigers.`,
    ),
    y,
  );

  y = heading(doc, tr(l, "Measures to investigate", "Te onderzoeken maatregelen"), y + 2);
  autoTable(doc, {
    ...tableStyle,
    startY: y,
    head: [[tr(l, "Measure", "Maatregel"), tr(l, "Why", "Waarom")]],
    body: [
      [tr(l, "Roof insulation", "Dakisolatie"), tr(l, "Large share of heat loss; best combined with roof maintenance.", "Groot deel van het warmteverlies; het best te combineren met dakonderhoud.")],
      [tr(l, "Cavity wall or facade insulation", "Spouwmuur- of gevelisolatie"), tr(l, "Often the shortest payback in buildings from 1930–1975.", "Vaak de kortste terugverdientijd bij gebouwen uit 1930–1975.")],
      [tr(l, "Ground/floor insulation", "Bodem-/vloerisolatie"), tr(l, "Warmer ground-floor homes; one job for the whole building.", "Warmere benedenwoningen; één klus voor het hele gebouw.")],
      [tr(l, "Ventilation", "Ventilatie"), tr(l, "Needed after insulating to prevent damp and mould.", "Nodig na isoleren om vocht en schimmel te voorkomen.")],
      [tr(l, "Collective (hybrid) heat pump", "Collectieve (hybride) warmtepomp"), tr(l, "Only after insulating; check the municipality's heat plan first.", "Pas na isoleren; check eerst het warmteplan van de gemeente.")],
    ],
  });
  y = lastY(doc) + 6;

  y = heading(doc, tr(l, "Subsidy", "Subsidie"), y);
  y = para(
    doc,
    tr(
      l,
      "The SVVE scheme (RVO) for VvE's contributes to a sustainability advice, an updated long-term maintenance plan (MJOP) and to insulation and heat pump measures. Apply before commissioning the advice. Check current amounts at rvo.nl/svve.",
      "De SVVE-regeling (RVO) voor VvE's draagt bij aan een verduurzamingsadvies, een geactualiseerd meerjarenonderhoudsplan (MJOP) en aan isolatie- en warmtepompmaatregelen. Vraag aan voordat het advies wordt besteld. Check de actuele bedragen op rvo.nl/svve.",
    ),
    y,
  );

  y = heading(doc, tr(l, "Proposed decision", "Voorstel tot besluit"), y + 2);
  y = para(
    doc,
    tr(
      l,
      "The general meeting decides to (1) commission an independent energy advice for the building, (2) authorise the board to apply for the SVVE subsidy, and (3) have the advice included in an updated MJOP, with a maximum budget of € ______ from the reserve fund. The board will present the results and costs at the next meeting.",
      "De ALV besluit om (1) een onafhankelijk energieadvies voor het gebouw te laten opstellen, (2) het bestuur te machtigen de SVVE-subsidie aan te vragen, en (3) het advies te laten verwerken in een geactualiseerd MJOP, met een maximaal budget van € ______ uit het reservefonds. Het bestuur presenteert de uitkomsten en kosten in de volgende vergadering.",
    ),
    y,
  );
  finish(doc, l, tr(l, "vve-proposal.pdf", "vve-voorstel.pdf"));
}

// ---------- 4. Quote request (specification for installers) ----------
const SPECS: Record<string, { area?: "wall" | "roof" | "floor" | "glass"; en: string[]; nl: string[] }> = {
  spouwmuur: {
    area: "wall",
    en: ["Cavity inspection (boroscope) before the work, with a report on cavity width and wall condition.", "Material and Rd-value; ISDE requires Rd >= 1.1.", "Ventilation advice for after insulating."],
    nl: ["Spouwonderzoek (boroscoop) vooraf, met verslag van spouwbreedte en staat van de muur.", "Materiaal en Rd-waarde; ISDE vraagt Rd >= 1,1.", "Ventilatieadvies voor na het isoleren."],
  },
  dak: {
    area: "roof",
    en: ["Insulation from the inside with Rd >= 3.5 (ISDE requirement), minimum 20 m².", "Vapour barrier (dampremmende folie) and finishing included.", "State how roof hatches and skylights are finished."],
    nl: ["Isolatie aan de binnenzijde met Rd >= 3,5 (ISDE-eis), minimaal 20 m².", "Dampremmende folie en afwerking inbegrepen.", "Vermeld hoe dakluiken en dakramen worden afgewerkt."],
  },
  vloer: {
    area: "floor",
    en: ["Floor insulation from the crawl space with Rd >= 3.5 (ISDE requirement), minimum 20 m².", "Check of crawl space ventilation and moisture.", "Pipes and cables in the crawl space handled."],
    nl: ["Vloerisolatie vanuit de kruipruimte met Rd >= 3,5 (ISDE-eis), minimaal 20 m².", "Controle van ventilatie en vocht in de kruipruimte.", "Leidingen en kabels in de kruipruimte meegenomen."],
  },
  hrglas: {
    area: "glass",
    en: ["HR++ glass with U <= 1.2 W/m²K (ISDE requirement), minimum 3 m².", "State whether the existing frames are suitable.", "Removal of old glass included."],
    nl: ["HR++ glas met U <= 1,2 W/m²K (ISDE-eis), minimaal 3 m².", "Vermeld of de bestaande kozijnen geschikt zijn.", "Afvoer van oud glas inbegrepen."],
  },
  hybride: {
    en: ["Hybrid heat pump on the RVO apparatus list: state brand, model and meldcode.", "Capacity (kW) based on a heat loss calculation.", "Electrical work, placement and noise level (dB) at the neighbours' boundary."],
    nl: ["Hybride warmtepomp op de RVO-apparatenlijst: vermeld merk, type en meldcode.", "Vermogen (kW) op basis van een warmteverliesberekening.", "Elektrawerk, plaatsing en geluidsniveau (dB) op de erfgrens."],
  },
  allelectric: {
    en: ["Heat pump on the RVO apparatus list: brand, model, meldcode.", "Heat loss calculation and capacity (kW); low-temperature check of radiators.", "Hot water buffer, electrical work, placement and noise level."],
    nl: ["Warmtepomp op de RVO-apparatenlijst: merk, type, meldcode.", "Warmteverliesberekening en vermogen (kW); controle van radiatoren op lage temperatuur.", "Boilervat, elektrawerk, plaatsing en geluidsniveau."],
  },
  zonnepanelen: {
    en: ["Number of panels, Wp per panel and expected yield (kWh/yr).", "Inverter brand/model and warranty.", "Roof condition check before installation."],
    nl: ["Aantal panelen, Wp per paneel en verwachte opbrengst (kWh/jr).", "Merk/type omvormer en garantie.", "Controle van de dakstaat vóór installatie."],
  },
};

export async function downloadQuoteRequest(plan: PlanResult, l: Lang) {
  const h = plan.house;
  const addr = h.address ?? `${h.postcode} ${h.houseNumber}`;
  const { doc, autoTable } = await newDoc(tr(l, "Request for quotation", "Offerteaanvraag"), houseLine(h, l), l);
  let y = 52;
  y = para(
    doc,
    tr(
      l,
      `I would like to receive a quote for the measures below at ${addr}. Please quote against this specification so quotes can be compared, and measure the areas on site.`,
      `Ik ontvang graag een offerte voor onderstaande maatregelen aan ${addr}. Offreer op basis van deze omschrijving zodat offertes vergelijkbaar zijn, en meet de oppervlaktes ter plaatse in.`,
    ),
    y,
  );
  const rec = plan.measures.filter((m) => m.status === "recommended" && SPECS[m.id]);
  rec.forEach((m, i) => {
    const spec = SPECS[m.id];
    y = heading(doc, `${i + 1}. ${mName(m, l)}`, y + 1);
    if (spec.area) y = para(doc, tr(l, `Approximate area: ${plan.areas[spec.area]} m² (estimate; to be measured).`, `Geschatte oppervlakte: ${plan.areas[spec.area]} m² (schatting; ter plaatse inmeten).`), y, { size: 9.5, color: GREY, gap: 1 });
    for (const line of spec[l]) y = para(doc, `• ${line}`, y, { size: 10, gap: 0.5 });
    y += 2;
  });

  y = heading(doc, tr(l, "Every quote must include", "Elke offerte moet bevatten"), y + 2);
  autoTable(doc, {
    ...tableStyle,
    startY: y,
    body: [
      [tr(l, "Price per m² (or per unit) and total, incl. and excl. VAT", "Prijs per m² (of per stuk) en totaal, incl. en excl. btw")],
      [tr(l, "Material, brand/model, Rd- or U-value, meldcode where relevant", "Materiaal, merk/type, Rd- of U-waarde, meldcode waar van toepassing")],
      [tr(l, "Company name, KvK number and certification (if any)", "Bedrijfsnaam, KvK-nummer en certificering (indien van toepassing)")],
      [tr(l, "Warranty period, planning and validity of the quote", "Garantietermijn, planning en geldigheid van de offerte")],
      [tr(l, "Help with the ISDE application (invoice with meldcode, photos)", "Hulp bij de ISDE-aanvraag (factuur met meldcode, foto's)")],
    ],
  });
  y = lastY(doc) + 8;
  para(doc, tr(l, "Please send your quote within three weeks. Thank you.", "Graag uw offerte binnen drie weken. Alvast bedankt."), y);
  finish(doc, l, tr(l, "quote-request.pdf", "offerteaanvraag.pdf"));
}
