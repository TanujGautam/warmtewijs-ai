// Tool definitions (function calling). One registry serves three consumers:
// the Claude agent loop, the offline fallback agent, and the MCP endpoint.
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { applyOverrides, calculatePlan, HOUSE_TYPES, LABEL_VALUES, MEASURE_IDS, MEASURES, subsidyFor, monthlyPayment, type House, type HouseType, type Label, type MeasureId } from "./engine";
import { lookupHouse } from "./registers";
import { search } from "./rag";
import { getSkill, SKILL_NAMES } from "./skills";

export const PROFILE_KEYS = ["postcode", "houseNumber", "applicant", "doneMeasures", "budget", "yearsStaying", "gasUseM3", "houseType", "buildYear", "floorArea", "label", "name", "notes"] as const;
export type ProfileKey = (typeof PROFILE_KEYS)[number];
export type Profile = Partial<Record<ProfileKey, string>>;

const measureEnum = z.enum(MEASURE_IDS as [MeasureId, ...MeasureId[]]);
const applicantEnum = z.enum(["owner", "renter", "vve"]);

// Corrections the user can make to register data; accepted by every house-based tool.
const overrides = {
  house_type: z.enum(HOUSE_TYPES as [HouseType, ...HouseType[]]).optional(),
  build_year: z.number().int().min(1500).max(2030).optional(),
  floor_area: z.number().min(10).max(2000).optional(),
  label: z.enum(LABEL_VALUES).optional(),
};
const address = { postcode: z.string().min(4).max(8), house_number: z.string().min(1).max(10) };

const schemas = {
  lookup_house: z.object({ ...address, ...overrides }),
  calculate_plan: z.object({
    ...address,
    ...overrides,
    done_measures: z.array(measureEnum).optional(),
    applicant: applicantEnum.optional(),
    gas_use_m3: z.number().min(100).max(10000).optional(),
    gas_price: z.number().min(0.3).max(5).optional(),
    electricity_price: z.number().min(0.05).max(2).optional(),
    budget: z.number().min(0).max(500000).optional(),
    years_staying: z.number().min(0).max(60).optional(),
  }),
  check_subsidies: z.object({
    ...address,
    ...overrides,
    measures: z.array(measureEnum).min(1),
    applicant: applicantEnum,
  }),
  search_knowledge: z.object({ query: z.string().min(2).max(300) }),
  load_skill: z.object({ name: z.enum(SKILL_NAMES as [string, ...string[]]) }),
  remember: z.object({ key: z.enum(PROFILE_KEYS), value: z.string().max(300) }),
  loan_calculator: z.object({ principal: z.number().min(0).max(1000000), annual_rate_pct: z.number().min(0).max(20), years: z.number().int().min(1).max(30) }),
};

export type ToolName = keyof typeof schemas;

const OVERRIDE_PROPS = {
  house_type: { type: "string", enum: HOUSE_TYPES, description: "Correction: rijtjeshuis (terraced), hoekwoning (corner), twee-onder-een-kap (semi-detached), vrijstaand (detached), appartement." },
  build_year: { type: "integer", description: "Correction: build year." },
  floor_area: { type: "number", description: "Correction: usable floor area in m²." },
  label: { type: "string", enum: [...LABEL_VALUES], description: "Correction: energy label letter (A+ and up → A)." },
} as const;

const measureList = MEASURE_IDS.map((id) => `${id} (${MEASURES[id].name})`).join(", ");

export const TOOL_DEFS: Anthropic.Tool[] = [
  {
    name: "lookup_house",
    description:
      "Look up a Dutch address in the public registers (BAG via PDOK; EP-Online when configured). Returns the full address, build year, floor area, house type and energy label, each with its source. If several units share the number it returns the list so you can ask which. Pass corrections (house_type, build_year, floor_area, label) when the user says the register is wrong.",
    input_schema: {
      type: "object",
      properties: {
        postcode: { type: "string", description: "Dutch postcode, e.g. '1012 AB'" },
        house_number: { type: "string", description: "House number incl. letter/addition, e.g. '12', '12A' or '12-2'" },
        ...OVERRIDE_PROPS,
      },
      required: ["postcode", "house_number"],
    },
  },
  {
    name: "calculate_plan",
    description: `Run the deterministic energy model for a house and return a ranked list of measures with cost, ISDE subsidy, yearly saving, payback, CO₂ and label effect. The ONLY source for numbers. Measure ids: ${measureList}.`,
    input_schema: {
      type: "object",
      properties: {
        postcode: { type: "string" },
        house_number: { type: "string" },
        ...OVERRIDE_PROPS,
        done_measures: { type: "array", items: { type: "string", enum: MEASURE_IDS }, description: "Measures already done — excluded from the plan." },
        applicant: { type: "string", enum: ["owner", "renter", "vve"] },
        gas_use_m3: { type: "number", description: "Actual yearly gas use in m³, if the user knows it." },
        gas_price: { type: "number", description: "€ per m³ (default 1.30)" },
        electricity_price: { type: "number", description: "€ per kWh (default 0.30)" },
        budget: { type: "number", description: "Available budget in € (net, after subsidy)." },
        years_staying: { type: "number", description: "How many more years the user expects to live here." },
      },
      required: ["postcode", "house_number"],
    },
  },
  {
    name: "check_subsidies",
    description: "Check indicative 2026 ISDE/SVVE subsidy amounts and conditions for specific measures. Planning ≥ 2 measures triggers the doubled insulation rate.",
    input_schema: {
      type: "object",
      properties: {
        postcode: { type: "string" },
        house_number: { type: "string" },
        ...OVERRIDE_PROPS,
        measures: { type: "array", items: { type: "string", enum: MEASURE_IDS } },
        applicant: { type: "string", enum: ["owner", "renter", "vve"] },
      },
      required: ["postcode", "house_number", "measures", "applicant"],
    },
  },
  {
    name: "search_knowledge",
    description: "Search the Warmtewijs knowledge base (subsidy rules, insulation, heat pumps, labels, renters, solar, VvE, financing). Returns the top passages with source ids to cite in [brackets].",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "load_skill",
    description: "Load the full instructions (SKILL.md) of a skill. Do this before answering in that skill's domain.",
    input_schema: { type: "object", properties: { name: { type: "string", enum: SKILL_NAMES } }, required: ["name"] },
  },
  {
    name: "remember",
    description: `Save a durable fact about the user or their house to long-term memory. Keys: ${PROFILE_KEYS.join(", ")}. For doneMeasures, store a comma-separated list of measure ids.`,
    input_schema: {
      type: "object",
      properties: { key: { type: "string", enum: [...PROFILE_KEYS] }, value: { type: "string" } },
      required: ["key", "value"],
    },
  },
  {
    name: "loan_calculator",
    description: "Compute the monthly annuity payment for a loan (Warmtefonds or mortgage top-up).",
    input_schema: {
      type: "object",
      properties: { principal: { type: "number" }, annual_rate_pct: { type: "number" }, years: { type: "integer" } },
      required: ["principal", "annual_rate_pct", "years"],
    },
  },
];

export interface ToolOutcome {
  content: string;
  isError?: boolean;
  /** Structured payload the UI renders (plan card, sources, skill, memory). */
  ui?: { kind: "house"; house: House } | { kind: "plan"; plan: ReturnType<typeof calculatePlan> } | { kind: "sources"; hits: ReturnType<typeof search> } | { kind: "skill"; name: string } | { kind: "memory"; key: string; value: string };
}

type OverrideInput = { postcode: string; house_number: string; house_type?: HouseType; build_year?: number; floor_area?: number; label?: Label };

/** Register lookup + user corrections. Falls back to user-supplied data when the registers are unreachable. */
async function resolveHouse(i: OverrideInput): Promise<House | { error: string }> {
  const o = { type: i.house_type, buildYear: i.build_year, floorArea: i.floor_area, label: i.label };
  const r = await lookupHouse(i.postcode, i.house_number);
  if ("ambiguous" in r) return { error: `Several addresses share this number — ask the user which one: ${r.ambiguous.join("; ")}` };
  if ("error" in r) {
    if (o.type && o.buildYear && o.floorArea) {
      return { postcode: i.postcode, houseNumber: i.house_number, type: o.type, buildYear: o.buildYear, floorArea: o.floorArea, label: o.label ?? "D", labelSource: o.label ? "provided by user" : "assumed", typeSource: "provided by user", source: "provided by user" };
    }
    return r;
  }
  return applyOverrides(r, o);
}

export async function executeTool(name: string, rawInput: unknown, profile: Profile): Promise<ToolOutcome> {
  if (!(name in schemas)) return { content: `Unknown tool: ${name}`, isError: true };
  const parsed = schemas[name as ToolName].safeParse(rawInput);
  if (!parsed.success) return { content: `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`, isError: true };
  const input = parsed.data as Record<string, unknown>;

  switch (name as ToolName) {
    case "lookup_house": {
      const r = await resolveHouse(input as OverrideInput);
      if ("error" in r) return { content: r.error, isError: true };
      return { content: JSON.stringify(r), ui: { kind: "house", house: r } };
    }
    case "calculate_plan": {
      const i = input as z.infer<typeof schemas.calculate_plan>;
      const house = await resolveHouse(i);
      if ("error" in house) return { content: house.error, isError: true };
      const plan = calculatePlan(house, {
        done: i.done_measures,
        applicant: i.applicant,
        budget: i.budget,
        yearsStaying: i.years_staying,
        assumptions: { gasUseM3: i.gas_use_m3, ...(i.gas_price && { gasPrice: i.gas_price }), ...(i.electricity_price && { electricityPrice: i.electricity_price }) },
      });
      return { content: JSON.stringify(plan), ui: { kind: "plan", plan } };
    }
    case "check_subsidies": {
      const i = input as z.infer<typeof schemas.check_subsidies>;
      const house = await resolveHouse(i);
      if ("error" in house) return { content: house.error, isError: true };
      const insulation = i.measures.filter((m) => MEASURES[m].category === "insulation").length;
      const heat = i.measures.some((m) => MEASURES[m].category === "heat") ? 1 : 0;
      const rows = i.measures.map((m) => ({ measure: m, ...subsidyFor(m, house, i.applicant, insulation + heat) }));
      return { content: JSON.stringify({ applicant: i.applicant, twoMeasureRate: insulation + heat >= 2, subsidies: rows, applyWithin: "24 months after installation", source: "isde-2026" }) };
    }
    case "search_knowledge": {
      const hits = search(String(input.query));
      if (!hits.length) return { content: "No relevant passages found." };
      return { content: hits.map((h) => `[${h.docId}] ${h.title} — ${h.heading}\n${h.text}`).join("\n\n---\n\n"), ui: { kind: "sources", hits } };
    }
    case "load_skill": {
      const skill = getSkill(String(input.name))!;
      return { content: `<skill name="${skill.name}">\n${skill.body}\n</skill>`, ui: { kind: "skill", name: skill.name } };
    }
    case "remember": {
      const key = String(input.key);
      const value = String(input.value);
      profile[key as ProfileKey] = value;
      return { content: `Saved ${key}.`, ui: { kind: "memory", key, value } };
    }
    case "loan_calculator": {
      const i = input as z.infer<typeof schemas.loan_calculator>;
      const pmt = monthlyPayment(i.principal, i.annual_rate_pct, i.years);
      return { content: JSON.stringify({ monthlyPayment: pmt, totalPaid: pmt * i.years * 12, ...i }) };
    }
  }
}
