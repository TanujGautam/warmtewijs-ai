// Structured outputs: turn a free-text description of a house into a typed
// profile with a JSON schema the model is constrained to.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import { describeApiError, hasApiKey, MODEL } from "@/lib/agent";
import { MEASURE_IDS } from "@/lib/engine";
import { clientKey, rateLimit, redactPII } from "@/lib/guardrails";

export const maxDuration = 60;

const Intake = z.object({
  postcode: z.string().nullable().describe("Dutch postcode like '1072 AB', or null if not mentioned"),
  houseNumber: z.string().nullable(),
  applicant: z.enum(["owner", "renter", "vve", "unknown"]),
  doneMeasures: z.array(z.enum(MEASURE_IDS as [string, ...string[]])).describe("Measures the user says are already done"),
  gasUseM3: z.number().nullable().describe("Yearly gas use in m³ if stated"),
  budget: z.number().nullable().describe("Budget in euros if stated"),
  yearsStaying: z.number().nullable(),
  concerns: z.array(z.string()).describe("Short list of the user's concerns, e.g. 'cold floors', 'damp'"),
});

export async function POST(req: Request) {
  if (!rateLimit(clientKey(req))) return Response.json({ error: "Too many requests" }, { status: 429 });
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text || text.length > 3000) return Response.json({ error: "Provide 1–3000 characters of text." }, { status: 400 });
  if (!hasApiKey()) return Response.json({ error: "Structured extraction needs an ANTHROPIC_API_KEY (offline mode)." }, { status: 503 });

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(Intake) },
      system: "Extract a home-energy intake profile from the user's description of their Dutch home. Only include facts that are stated; use null or 'unknown' otherwise.",
      messages: [{ role: "user", content: redactPII(text).text }],
    });
    if (response.stop_reason === "refusal") return Response.json({ error: "Request declined." }, { status: 422 });
    return Response.json({ intake: response.parsed_output });
  } catch (err) {
    return Response.json({ error: describeApiError(err) }, { status: 502 });
  }
}
