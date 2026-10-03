# Warmtewijs AI

An independent AI energy advisor for Dutch homes, built as an agent on Claude. Tell it your address and situation. It looks up the house, loads the right expert **skill**, runs the numbers through a deterministic engine, checks subsidies, and cites its sources.

It's a working companion to the [Warmtewijs landing page](https://warmtewijs.vercel.app), and a compact reference for the building blocks of a modern AI app.

## AI concepts implemented

| Concept | Where |
|---|---|
| Agent loop (streaming tool use) | `lib/agent.ts`, `app/api/chat/route.ts` |
| Skills (`SKILL.md`, progressive disclosure) | `skills/*/SKILL.md`, `lib/skills.ts`, `load_skill` tool |
| Function calling / tools (Zod-validated) | `lib/tools.ts` |
| RAG with citations (BM25, bilingual synonyms) | `knowledge/*.md`, `lib/rag.ts` |
| Long-term memory | `remember` tool + profile in the browser, injected per turn |
| Structured outputs | `app/api/extract/route.ts` |
| Adaptive thinking (reasoning summaries) | `lib/agent.ts`, shown in the UI |
| Prompt caching | frozen system prompt + deterministic tools |
| MCP server | `app/api/mcp/route.ts` |
| Guardrails | `lib/guardrails.ts` (PII redaction, rate limit, caps), refusal fallback |
| Evals | `evals/run.ts` |
| Context files for coding agents | `AGENTS.md`, `CLAUDE.md` |
| Graceful degradation | `lib/offline-agent.ts` (runs without an API key) |

## Run locally

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY (optional)
npm run dev
```

Open http://localhost:3000/advisor.

## Scripts

- `npm run dev` / `npm run build`: dev server and production build (both bundle skills and knowledge first)
- `npm run evals`: engine, RAG and agent-routing evals. `EVAL_LLM=1 npm run evals` adds end-to-end Claude checks, which call the API and cost money.
- `npm run typecheck`, `npm run lint`

## Use from Claude Code (MCP)

```bash
claude mcp add --transport http warmtewijs https://warmtewijs-ai.vercel.app/api/mcp
```

## Deploy

Deployed on Vercel. Set `ANTHROPIC_API_KEY` in the project's environment variables, then redeploy.

House data is a deterministic stub of the BAG/EP-Online registers, and the subsidy and price figures are indicative. This is a demo; it is not financial advice.
