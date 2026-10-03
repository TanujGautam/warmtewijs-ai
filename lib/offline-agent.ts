// Offline fallback agent used when no ANTHROPIC_API_KEY is configured. It uses the
// same skills, tools and knowledge base, with a rule-based router instead of an LLM —
// so the app is fully demoable and the tool layer is exercised either way.
import type { AgentEvent } from "./events";
import { MEASURES, MEASURE_IDS, type MeasureId, type PlanResult } from "./engine";
import { executeTool, type Profile, type ToolOutcome } from "./tools";

const eur = (n: number) => `€${Math.round(n).toLocaleString("nl-NL")}`;

const ROUTES: { skill: string; re: RegExp; query: string }[] = [
  { skill: "renters", re: /\b(rent|renter|tenant|huur|huurder|landlord|verhuurder|corporatie)/i, query: "tenant landlord energy improvements" },
  { skill: "heat-pump", re: /(heat ?pump|warmtepomp|hybri|all-electric|gasless|van het gas|boiler|cv-ketel)/i, query: "heat pump hybrid all-electric" },
  { skill: "subsidies", re: /(subsid|isde|svve|rvo|grant)/i, query: "ISDE subsidy rates two-measure rule" },
  { skill: "solar", re: /(solar|zonnepane|saldering|battery|accu|pv\b)/i, query: "solar panels saldering" },
  { skill: "financing", re: /(loan|lening|warmtefonds|financ|mortgage|hypotheek|afford|budget)/i, query: "Warmtefonds loan interest" },
  { skill: "insulation", re: /(insulat|isolat|spouw|cavity|roof|dak|floor|vloer|glass|glas|draught|tocht|first|eerst|what should|wat moet)/i, query: "cavity wall insulation" },
];

async function* call(name: string, input: Record<string, unknown>, profile: Profile, id: string): AsyncGenerator<AgentEvent, ToolOutcome> {
  yield { type: "tool_call", id, name, input };
  const out = await executeTool(name, input, profile);
  yield { type: "tool_result", id, name, isError: !!out.isError, preview: out.content.slice(0, 400), ui: out.ui };
  if (out.ui?.kind === "memory") yield { type: "memory", profile: { ...profile } };
  return out;
}

function words(text: string, s: string) {
  for (const ch of s.match(/\S+\s*/g) ?? []) text += ch;
  return text;
}

export async function* runOfflineAgent(userText: string, profile: Profile): AsyncGenerator<AgentEvent> {
  yield { type: "status", mode: "offline" };
  let n = 0;
  const id = () => `offline_${Date.now()}_${n++}`;
  let reply = "";

  // 1. Extract durable facts → memory
  const pc = userText.match(/\b([1-9][0-9]{3}) ?([A-Za-z]{2})\b/);
  const hn = userText.match(/\b[1-9][0-9]{3} ?[A-Za-z]{2}[ ,]+(?:nr\.?\s*)?([0-9]{1,5}(?:-?[a-zA-Z0-9]{1,4})?)\b/) ?? userText.match(/\b(?:number|nummer|nr\.?|huisnummer)\s*([0-9]{1,5}[a-zA-Z]?)\b/i);
  if (pc) yield* call("remember", { key: "postcode", value: `${pc[1]} ${pc[2].toUpperCase()}` }, profile, id());
  if (hn) yield* call("remember", { key: "houseNumber", value: hn[1] }, profile, id());
  if (/\b(i rent|we rent|renter|tenant|huurder|huurwoning)\b/i.test(userText)) yield* call("remember", { key: "applicant", value: "renter" }, profile, id());
  if (/\b(i own|we own|owner|eigenaar|koopwoning)\b/i.test(userText)) yield* call("remember", { key: "applicant", value: "owner" }, profile, id());
  const doneFound = MEASURE_IDS.filter((m) => new RegExp(`(already|done|have|heb|hebben|al)[^.]*\\b(${doneWords(m)})`, "i").test(userText));
  if (doneFound.length) {
    const merged = [...new Set([...(profile.doneMeasures?.split(",").filter(Boolean) ?? []), ...doneFound])];
    yield* call("remember", { key: "doneMeasures", value: merged.join(",") }, profile, id());
  }
  const budget = userText.match(/(?:budget|€|eur)\s*([0-9][0-9.]{2,})/i);
  if (budget) yield* call("remember", { key: "budget", value: budget[1].replace(/\./g, "") }, profile, id());

  // 2. Route to a skill
  const route = ROUTES.find((r) => r.re.test(userText));
  if (route) yield* call("load_skill", { name: route.skill }, profile, id());

  // 3. No address yet → ask for it
  if (!profile.postcode || !profile.houseNumber) {
    if (route) {
      const k = yield* call("search_knowledge", { query: route.query }, profile, id());
      const first = k.ui?.kind === "sources" ? k.ui.hits[0] : null;
      if (first) reply = words(reply, `${first.text.split("\n")[0]} [${first.docId}]\n\n`);
    }
    reply = words(reply, "To make this specific to your house, what's your **postcode and house number**? (e.g. *1072 AB 14*). I'll pull the build year, type and label from the registers.");
    yield { type: "text", delta: reply };
    return;
  }

  // 4. Run the model
  const applicant = (profile.applicant as "owner" | "renter" | "vve") ?? "owner";
  const done = (profile.doneMeasures?.split(",").filter((m) => MEASURE_IDS.includes(m as MeasureId)) ?? []) as MeasureId[];
  const out = yield* call(
    "calculate_plan",
    {
      postcode: profile.postcode,
      house_number: profile.houseNumber,
      applicant,
      done_measures: done,
      ...(profile.budget && { budget: Number(profile.budget) }),
      ...(profile.houseType && { house_type: profile.houseType }),
      ...(profile.buildYear && { build_year: Number(profile.buildYear) }),
      ...(profile.floorArea && { floor_area: Number(profile.floorArea) }),
      ...(profile.label && { label: profile.label }),
    },
    profile,
    id(),
  );
  if (out.isError || out.ui?.kind !== "plan") {
    yield { type: "text", delta: `I couldn't calculate a plan: ${out.content}` };
    return;
  }
  const plan: PlanResult = out.ui.plan;
  const rec = plan.measures.filter((m) => m.status === "recommended");
  const h = plan.house;

  let text = `**${h.address ?? `${h.postcode} ${h.houseNumber}`}: ${h.type}, built ${h.buildYear}, ${h.floorArea} m², label ${h.label}${h.labelSource?.startsWith("estimated") ? " (estimated)" : ""}.** `;
  if (applicant === "renter") text += "You rent, so structural work is your landlord's call — here's what to ask for.\n\n";
  else text += rec.length ? `Here's the order that pays best:\n\n` : "Good news: there's little left that pays back. ";
  if (rec.length) {
    text += "| # | Measure | Net cost | Saving/yr | Payback |\n|---|---|---|---|---|\n";
    rec.forEach((m, i) => (text += `| ${i + 1} | ${m.name} (${m.dutch}) | ${eur(m.netCost)} | ${eur(m.savingPerYear)} | ${m.paybackYears} yr |\n`));
    text += `\nTogether: **${eur(plan.totals.savingPerYear)}/yr** saved, **${eur(plan.totals.subsidy)}** subsidy, label **${plan.labelFrom} → ${plan.labelTo}**.\n\n`;
  }
  const later = plan.measures.filter((m) => m.status === "later");
  if (later.length) text += `**Not yet:** ${later.map((m) => `${m.name} — ${m.reason}`).join(" ")}\n\n`;

  // Ground the explanation in the top recommendation for *this* house, not just the topic of the question.
  const topic = route && route.skill !== "insulation" ? route.query : rec[0] ? `${rec[0].name} ${rec[0].dutch}` : route?.query;
  if (topic) {
    const k = yield* call("search_knowledge", { query: topic }, profile, id());
    if (k.ui?.kind === "sources" && k.ui.hits[0]) {
      const hit = k.ui.hits[0];
      text += `**${hit.heading}:** ${hit.text.split("\n")[0]} [${hit.docId}]\n\n`;
    }
  }
  if (applicant === "renter") text += "Want me to draft a letter to your landlord asking for the top measure?\n\n";
  text += `**This month:** ${rec[0] ? `get two quotes for ${rec[0].name.toLowerCase()} and ask the installer for a ventilation check.` : "lower the boiler flow temperature to 50 °C as a test for a future heat pump."}\n\n`;
  text += "_Offline mode: answers are rule-based. Add an ANTHROPIC_API_KEY for the full Claude advisor._";

  // Stream it word by word so the UI behaves the same as with Claude.
  for (const chunk of text.match(/\S+\s*|\n/g) ?? []) {
    yield { type: "text", delta: chunk };
    await new Promise((r) => setTimeout(r, 8));
  }
}

function doneWords(m: MeasureId): string {
  return (
    {
      spouwmuur: "cavity|spouw",
      dak: "roof|dak",
      vloer: "floor|vloer",
      hrglas: "hr\\+\\+|glazing|glas|double glass",
      hybride: "hybrid|hybride",
      allelectric: "all-electric|volledige warmtepomp",
      zonnepanelen: "solar|zonnepanelen",
    }[m] ?? MEASURES[m].name
  );
}
