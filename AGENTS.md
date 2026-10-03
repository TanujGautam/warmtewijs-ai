<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Warmtewijs AI — notes for coding agents

An AI energy-advisor agent for Dutch homes (Next.js App Router + Claude API).

## Layout
- `skills/<name>/SKILL.md` — agent skills (YAML frontmatter `name` + `description`, then the procedure). Loaded on demand via the `load_skill` tool.
- `knowledge/*.md` — RAG corpus, chunked by `##` heading. Frontmatter: `title`, `source`. The file name is the citation id.
- `prompts/system.md` — base system prompt. Keep it free of dates and other volatile content (prompt cache).
- `scripts/build-content.mjs` — bundles the three folders above into `lib/generated/content.ts` (gitignored; runs on `predev`/`prebuild`).
- `lib/engine.ts` — deterministic energy model. **All numbers shown to users come from here.**
- `lib/tools.ts` — tool registry (schemas + Zod validation + executors), shared by the agent, the offline agent and MCP.
- `lib/agent.ts` — Claude streaming tool-use loop. `lib/offline-agent.ts` — rule-based fallback without an API key.
- `app/api/chat` (SSE agent), `app/api/extract` (structured outputs), `app/api/mcp` (MCP server), `app/api/skills`.
- `evals/run.ts` — eval suite.

## Conventions
- Adding a skill: create `skills/<name>/SKILL.md`. No code changes. Add an eval if it changes routing.
- Adding a tool: add the JSON schema + Zod schema + executor in `lib/tools.ts`, then an eval case.
- Never let the model produce numbers; add them to the engine and expose them via a tool.
- Run `npm run typecheck`, `npm run lint` and `npm run evals` before committing.
