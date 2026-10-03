// Eval suite. Three layers:
//   1. engine  — deterministic maths & ranking rules (always run)
//   2. rag     — retrieval: does the right source come back in the top 3? (always run)
//   3. agent   — end-to-end behaviour of the Claude agent (only with EVAL_LLM=1 and an API key; costs money)
// Run: npm run evals            (or EVAL_LLM=1 npm run evals)
import { calculatePlan, subsidyFor, type House } from "../lib/engine";
import { checkQuote, type ExtractedQuote, type QuoteLine } from "../lib/quote-check";
import { lookupHouse, parseHouseNumber } from "../lib/registers";
import { search } from "../lib/rag";
import { runOfflineAgent } from "../lib/offline-agent";
import { runClaudeAgent, hasApiKey } from "../lib/agent";
import type { AgentEvent } from "../lib/events";

type Case = { name: string; run: () => boolean | string | Promise<boolean | string> };
const house = (o: Partial<House>): House => ({ postcode: "1234 AB", houseNumber: "1", buildYear: 1968, type: "rijtjeshuis", floorArea: 110, label: "D", source: "eval", ...o });
const ids = (p: ReturnType<typeof calculatePlan>, status: string) => p.measures.filter((m) => m.status === status).map((m) => m.id);

const engine: Case[] = [
  { name: "1968 terraced house: cavity wall is recommended", run: () => ids(calculatePlan(house({})), "recommended").includes("spouwmuur") },
  { name: "1968 terraced house: cavity wall ranks first (best payback)", run: () => ids(calculatePlan(house({})), "recommended")[0] === "spouwmuur" || ids(calculatePlan(house({})), "recommended").join() },
  { name: "1985 house: cavity wall not applicable", run: () => ids(calculatePlan(house({ buildYear: 1985 })), "not-applicable").includes("spouwmuur") },
  { name: "apartment: roof is a VvE decision", run: () => calculatePlan(house({ type: "appartement" })).measures.find((m) => m.id === "dak")?.status === "not-applicable" },
  { name: "done measures are excluded", run: () => !calculatePlan(house({}), { done: ["spouwmuur"] }).measures.some((m) => m.id === "spouwmuur") },
  { name: "label F: all-electric is deferred", run: () => calculatePlan(house({ label: "F", buildYear: 1950 })).measures.find((m) => m.id === "allelectric")?.status === "later" },
  { name: "solar waits for roof insulation", run: () => calculatePlan(house({})).measures.find((m) => m.id === "zonnepanelen")?.status === "later" },
  { name: "renters get €0 subsidy", run: () => calculatePlan(house({}), { applicant: "renter" }).totals.subsidy === 0 },
  { name: "budget caps recommended net cost", run: () => {
      const p = calculatePlan(house({ label: "E", buildYear: 1955 }), { budget: 4000 });
      const spent = p.measures.filter((m) => m.status === "recommended").reduce((s, m) => s + m.netCost, 0);
      return spent <= 4000 || `spent ${spent}`;
    } },
  { name: "label improves when measures are recommended", run: () => { const p = calculatePlan(house({ label: "E", buildYear: 1955 })); return p.labelTo < p.labelFrom || `${p.labelFrom}→${p.labelTo}`; } },
  { name: "house number parsing (12, 12A, 12-2, 12 h)", run: () => JSON.stringify(["12", "12A", "12-2", "12 h"].map((n) => parseHouseNumber(n))) === JSON.stringify([{ number: 12, suffix: "" }, { number: 12, suffix: "A" }, { number: 12, suffix: "2" }, { number: 12, suffix: "H" }]) },
];

// Quote checker: deterministic verdicts on extracted quotes.
const line = (o: Partial<QuoteLine>): QuoteLine => ({ measure: "spouwmuur", description: "", areaM2: null, quantity: null, totalPriceInclVat: null, totalPriceExclVat: null, rdValue: null, uValue: null, material: null, brandModel: null, meldcode: null, capacityKw: null, panelCount: null, ...o });
const quote = (lines: QuoteLine[], o: Partial<ExtractedQuote> = {}): ExtractedQuote => ({
  isQuote: true, installerName: "Test BV", installerKvk: "12345678", quoteDate: null, totalInclVat: null, warrantyYears: 10, validityDays: 30, lines,
  mentions: { cavityInspection: true, ventilationAdvice: true, vapourBarrier: true, crawlspaceVentilation: true, electricalWork: true, vatStated: true },
  ...o,
});
const quotes: Case[] = [
  { name: "quote: fair cavity wall quote passes", run: () => { const r = checkQuote(quote([line({ areaM2: 80, totalPriceInclVat: 2000, rdValue: 1.3, material: "EPS parels" })]), "en"); return (r.overall === "good" && r.lines[0].verdict === "ok" && r.lines[0].isde === "ok") || JSON.stringify(r.lines[0]); } },
  { name: "quote: roof under 20 m² fails ISDE", run: () => checkQuote(quote([line({ measure: "dak", areaM2: 15, totalPriceInclVat: 900, rdValue: 4, material: "PIR" })]), "en").lines[0].isde === "fail" },
  { name: "quote: €150/m² roof is flagged too high", run: () => { const r = checkQuote(quote([line({ measure: "dak", areaM2: 60, totalPriceInclVat: 9000, rdValue: 4, material: "PIR" })]), "en"); return (r.lines[0].verdict === "very-high" && r.overall === "concerns") || r.lines[0].verdict; } },
  { name: "quote: Rd below 3.5 on a floor fails ISDE", run: () => checkQuote(quote([line({ measure: "vloer", areaM2: 50, totalPriceInclVat: 1800, rdValue: 2.5, material: "PIR" })]), "en").lines[0].isde === "fail" },
  { name: "quote: missing cavity inspection is flagged", run: () => checkQuote(quote([line({ areaM2: 80, totalPriceInclVat: 2000, rdValue: 1.3, material: "EPS" })], { mentions: { cavityInspection: false, ventilationAdvice: true, vapourBarrier: true, crawlspaceVentilation: true, electricalWork: true, vatStated: true } }), "en").lines[0].missing.some((m) => /inspection/i.test(m)) },
  { name: "quote: heat pump without meldcode needs an ISDE check", run: () => { const r = checkQuote(quote([line({ measure: "hybride", quantity: 1, totalPriceInclVat: 5500, brandModel: "X", capacityKw: 4 })]), "en"); return (r.lines[0].isde === "check" && r.lines[0].verdict === "ok") || JSON.stringify(r.lines[0]); } },
  { name: "quote: missing KvK and warranty are general issues", run: () => checkQuote(quote([line({ areaM2: 80, totalPriceInclVat: 2000, rdValue: 1.3, material: "EPS" })], { installerKvk: null, warrantyYears: null }), "en").general.length >= 2 },
  { name: "quote: Dutch report is in Dutch", run: () => /binnen de gebruikelijke/.test(checkQuote(quote([line({ areaM2: 80, totalPriceInclVat: 2000, rdValue: 1.3, material: "EPS" })]), "nl").lines[0].verdictText) },
  { name: "ISDE: roof needs 20 m² (RVO 2025+)", run: () => subsidyFor("dak", house({ type: "appartement" }), "owner", 1).amount === 0 && subsidyFor("dak", house({ floorArea: 25 }), "owner", 1).amount === 0 },
  { name: "ISDE: cavity wall at €5,25/m², doubled with two measures", run: () => { const h = house({}); const one = subsidyFor("spouwmuur", h, "owner", 1).amount; const two = subsidyFor("spouwmuur", h, "owner", 2).amount; return (Math.abs(two - 2 * one) <= 1 && one === Math.round(61 * 5.25)) || `${one} ${two}`; } },
  { name: "engine: Dutch reasons in Dutch", run: () => /Eerst isoleren|Isoleer eerst/.test(calculatePlan(house({ label: "F", buildYear: 1950 }), { lang: "nl" }).measures.map((m) => m.reason).join(" ")) },
];

// Live public registers (PDOK / BAG). Skip with EVAL_OFFLINE=1.
const registers: Case[] = [
  { name: "BAG: invalid postcode rejected", run: async () => "error" in (await lookupHouse("0000", "1")) },
  { name: "BAG: Stadhouderskade 52-H is an 1880 apartment of 32 m²", run: async () => {
      const h = await lookupHouse("1072 AB", "52-H");
      if (!("buildYear" in h)) return JSON.stringify(h);
      return (h.buildYear === 1880 && h.floorArea === 32 && h.type === "appartement" && h.address?.includes("Stadhouderskade 52-H")) || JSON.stringify(h);
    } },
  { name: "BAG: number with several units asks which one", run: async () => { const h = await lookupHouse("1072AB", "52"); return "ambiguous" in h || JSON.stringify(h); } },
  { name: "BAG: unknown house number is an error, not made-up data", run: async () => "error" in (await lookupHouse("1072AB", "99999")) },
];

const rag: [string, string][] = [
  ["how much ISDE subsidy for cavity wall", "isde-2026"],
  ["two measure rule double subsidy", "isde-2026"],
  ["hybride warmtepomp kosten", "heat-pumps"],
  ["is my house ready for a heat pump 50 degrees", "heat-pumps"],
  ["my landlord won't insulate, I'm a tenant", "renters-rights"],
  ["saldering stops 2027 solar panels", "solar-saldering"],
  ["0% loan Warmtefonds income", "warmtefonds"],
  ["VvE ledenvergadering MJOP", "vve"],
  ["what does energy label D to A mean for value", "energy-labels"],
  ["mould after insulating ventilation", "insulation-basics"],
];
const ragCases: Case[] = rag.map(([q, doc]) => ({ name: `rag: "${q}" → ${doc}`, run: () => { const hits = search(q).map((h) => h.docId); return hits.includes(doc) || `got ${hits.join(", ")}`; } }));

async function collect(gen: AsyncGenerator<AgentEvent>) {
  const events: AgentEvent[] = [];
  for await (const e of gen) events.push(e);
  return { events, text: events.filter((e) => e.type === "text").map((e) => (e as { delta: string }).delta).join(""), tools: events.filter((e) => e.type === "tool_call").map((e) => (e as { name: string }).name) };
}

const offline: Case[] = [
  { name: "offline: asks for address when unknown", run: async () => (await collect(runOfflineAgent("What should I insulate first?", {}))).text.toLowerCase().includes("postcode") },
  { name: "offline: renter routes to renters skill", run: async () => { const r = await collect(runOfflineAgent("I rent my place at 1072 AB 14, landlord won't help", {})); return r.events.some((e) => e.type === "tool_result" && e.ui?.kind === "skill" && e.ui.name === "renters") || r.tools.join(); } },
  { name: "offline: address → calculate_plan with the real address", run: async () => { const r = await collect(runOfflineAgent("1072 AB 52-H, what should I do?", {})); return (r.tools.includes("calculate_plan") && r.text.includes("Stadhouderskade 52-H")) || r.text.slice(0, 200); } },
];

const agent: Case[] = [
  { name: "agent: uses calculate_plan for numbers", run: async () => { const r = await collect(runClaudeAgent([], "I own 1072 AB 14. What should I insulate first and what does it cost?", {})); return r.tools.includes("calculate_plan") || r.tools.join(); } },
  { name: "agent: loads a skill before advising", run: async () => { const r = await collect(runClaudeAgent([], "Should I get a hybrid heat pump? I'm at 3511 AB 2.", {})); return r.tools.includes("load_skill") || r.tools.join(); } },
  { name: "agent: cites knowledge sources", run: async () => /\[[a-z0-9-]+\]/.test((await collect(runClaudeAgent([], "What is the ISDE two-measure rule?", {}))).text) },
  { name: "agent: declines off-topic", run: async () => { const r = await collect(runClaudeAgent([], "Write me a poem about football.", {})); return !r.tools.includes("calculate_plan"); } },
];

async function main() {
  const suites: [string, Case[]][] = [["engine", engine], ["quote checker", quotes], ["rag", ragCases]];
  if (process.env.EVAL_OFFLINE !== "1") suites.push(["registers (live)", registers], ["offline agent", offline]);
  if (process.env.EVAL_LLM === "1") {
    if (hasApiKey()) suites.push(["claude agent", agent]);
    else console.log("EVAL_LLM=1 but no ANTHROPIC_API_KEY — skipping agent evals.");
  }
  let pass = 0, fail = 0;
  for (const [suite, cases] of suites) {
    console.log(`\n${suite}`);
    for (const c of cases) {
      let r: boolean | string;
      try { r = await c.run(); } catch (e) { r = String(e); }
      if (r === true) { pass++; console.log(`  ✓ ${c.name}`); }
      else { fail++; console.log(`  ✗ ${c.name}${typeof r === "string" ? ` (${r})` : ""}`); }
    }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();
