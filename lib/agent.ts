// The Claude agent: a streaming, manual tool-use loop. A manual loop (rather than
// the SDK tool runner) lets us forward every tool call, thinking summary and text
// delta to the browser as it happens.
import Anthropic from "@anthropic-ai/sdk";
import type { AgentEvent } from "./events";
import { LIMITS } from "./guardrails";
import { buildSystemPrompt } from "./skills";
import { executeTool, TOOL_DEFS, type Profile } from "./tools";
import type { Lang } from "./i18n";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

type Msg = Anthropic.Beta.BetaMessageParam;

function buildTools(): Anthropic.Beta.BetaToolUnion[] {
  // Deterministic order + content → stable prompt-cache prefix.
  const tools: Anthropic.Beta.BetaToolUnion[] = TOOL_DEFS.map((t) => ({ ...t, eager_input_streaming: true }));
  if (process.env.ENABLE_WEB_SEARCH === "1") {
    tools.push({
      type: "web_search_20260209",
      name: "web_search",
      max_uses: 3,
      allowed_domains: ["rvo.nl", "milieucentraal.nl", "warmtefonds.nl", "rijksoverheid.nl", "huurcommissie.nl"],
    });
  }
  return tools;
}

function preview(s: string, n = 400) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export async function* runClaudeAgent(history: Msg[], userText: string, profile: Profile, lang: Lang = "en"): AsyncGenerator<AgentEvent> {
  const client = new Anthropic();
  const tools = buildTools();
  const system: Anthropic.Beta.BetaTextBlockParam[] = [{ type: "text", text: buildSystemPrompt(), cache_control: { type: "ephemeral" } }];

  // Memory is injected into the *new* user turn only, so earlier turns stay byte-identical (cache + preserved thinking).
  const messages: Msg[] = [
    ...history,
    {
      role: "user",
      content: [
        { type: "text", text: `<user_profile>\n${JSON.stringify(profile)}\n</user_profile>\n<preferences>\n${JSON.stringify({ language: lang === "nl" ? "Dutch (nl)" : "English (en)" })}\n</preferences>` },
        { type: "text", text: userText },
      ],
    },
  ];

  yield { type: "status", mode: "claude", model: MODEL };

  for (let turn = 0; turn < LIMITS.maxAgentTurns; turn++) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      system,
      tools,
      messages,
      // Conversations live in the browser and can outlast a deploy that changes the system prompt or tools.
      // Thinking blocks are bound to that prefix, so drop stale ones instead of failing the whole request.
      thinking: { type: "adaptive", display: "summarized", block_binding: { prefix_mismatch_behavior: "drop_block" } },
      output_config: { effort: "medium" },
      // Server-side fallback: if the request is declined by a safety classifier, the API re-runs it on a suitable model.
      betas: ["server-side-fallback-2026-07-01", "thinking-binding-controls-2026-08-01"],
      fallbacks: "default",
    });

    for await (const ev of stream) {
      if (ev.type === "content_block_delta") {
        if (ev.delta.type === "text_delta") yield { type: "text", delta: ev.delta.text };
        else if (ev.delta.type === "thinking_delta") yield { type: "thinking", delta: ev.delta.thinking };
      } else if (ev.type === "content_block_start" && ev.content_block.type === "server_tool_use") {
        yield { type: "server_tool", name: ev.content_block.name, detail: "searching official sources…" };
      }
    }

    const message = await stream.finalMessage();
    if (message.input_transformations?.length) console.info("thinking blocks dropped:", JSON.stringify(message.input_transformations));
    const u = message.usage;
    yield { type: "usage", input: u.input_tokens, output: u.output_tokens, cacheRead: u.cache_read_input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0 };

    // Append the full content (thinking, fallback, server-tool blocks) unchanged.
    messages.push({ role: "assistant", content: message.content });

    if (message.stop_reason === "pause_turn") continue;
    if (message.stop_reason === "refusal") {
      yield { type: "text", delta: "\n\nI can't help with that request. I can help with home energy questions, insulation, heat pumps, subsidies and financing." };
      break;
    }

    const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0) break;
    if (message.stop_reason === "max_tokens") {
      yield { type: "error", message: "The answer was cut off (max_tokens). Please ask again more narrowly." };
      break;
    }

    // Run all tool calls from this turn, return all results in ONE user message.
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      yield { type: "tool_call", id: tu.id, name: tu.name, input: tu.input };
      const out = await executeTool(tu.name, tu.input, profile, lang);
      yield { type: "tool_result", id: tu.id, name: tu.name, isError: !!out.isError, preview: preview(out.content), ui: out.ui };
      if (out.ui?.kind === "memory") yield { type: "memory", profile: { ...profile } };
      results.push({ type: "tool_result", tool_use_id: tu.id, content: out.content, ...(out.isError && { is_error: true }) });
    }
    messages.push({ role: "user", content: results });
  }

  yield { type: "history", messages };
}

export function hasApiKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export function describeApiError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "The Anthropic API key is invalid.";
  if (err instanceof Anthropic.RateLimitError) return "The AI service is busy (rate limited). Try again in a minute.";
  if (err instanceof Anthropic.BadRequestError) return `Bad request to the AI service: ${err.message}`;
  if (err instanceof Anthropic.APIError) return `AI service error (${err.status}).`;
  return err instanceof Error ? err.message : "Unknown error";
}
