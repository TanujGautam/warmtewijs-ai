// Eval suite. Three layers:
//   1. engine  — deterministic maths & ranking rules (always run)
//   2. rag     — retrieval: does the right source come back in the top 3? (always run)
//   3. agent   — end-to-end behaviour of the Claude agent (only with EVAL_LLM=1 and an API key; costs money)
// Run: npm run evals            (or EVAL_LLM=1 npm run evals)
import { calculatePlan, lookupHouse, type House } from "../lib/engine";
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
  { name: "lookup is deterministic", run: () => JSON.stringify(lookupHouse("1072ab", "14")) === JSON.stringify(lookupHouse("1072 AB", "14")) },
  { name: "invalid postcode rejected", run: () => "error" in lookupHouse("0000", "1") },
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
  { name: "offline: address → calculate_plan", run: async () => (await collect(runOfflineAgent("1072 AB 14, what should I do?", {}))).tools.includes("calculate_plan") },
];

const agent: Case[] = [
  { name: "agent: uses calculate_plan for numbers", run: async () => { const r = await collect(runClaudeAgent([], "I own 1072 AB 14. What should I insulate first and what does it cost?", {})); return r.tools.includes("calculate_plan") || r.tools.join(); } },
  { name: "agent: loads a skill before advising", run: async () => { const r = await collect(runClaudeAgent([], "Should I get a hybrid heat pump? I'm at 3511 AB 2.", {})); return r.tools.includes("load_skill") || r.tools.join(); } },
  { name: "agent: cites knowledge sources", run: async () => /\[[a-z0-9-]+\]/.test((await collect(runClaudeAgent([], "What is the ISDE two-measure rule?", {}))).text) },
  { name: "agent: declines off-topic", run: async () => { const r = await collect(runClaudeAgent([], "Write me a poem about football.", {})); return !r.tools.includes("calculate_plan"); } },
];

async function main() {
  const suites: [string, Case[]][] = [["engine", engine], ["rag", ragCases], ["offline agent", offline]];
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
