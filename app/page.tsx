import Link from "next/link";
import Header from "./components/Header";
import { SKILLS } from "@/lib/skills";
import { TOOL_DEFS } from "@/lib/tools";
import { CHUNK_COUNT } from "@/lib/rag";

const CONCEPTS: { tag: string; title: string; body: React.ReactNode }[] = [
  { tag: "Agent loop", title: "Tool-using agent", body: <>Claude plans, calls tools, reads results and repeats (up to 8 turns per message), streamed live to your screen over Server-Sent Events.</> },
  { tag: "Skills", title: "SKILL.md with progressive disclosure", body: <>{SKILLS.length} skills in <code>skills/*/SKILL.md</code>. Only the name and description sit in the prompt. The agent calls <code>load_skill</code> to pull the full procedure when it needs it.</> },
  { tag: "Tools", title: "Function calling", body: <>{TOOL_DEFS.length} typed tools with JSON Schema, each input validated by Zod. The energy maths lives in a deterministic engine, so the model never makes up a number.</> },
  { tag: "RAG", title: "Retrieval with citations", body: <>A BM25 index over {CHUNK_COUNT} knowledge passages (ISDE, heat pumps, renters, solar), with Dutch↔English synonyms. Answers cite their sources like <code>[isde-2026]</code>.</> },
  { tag: "Memory", title: "Long-term user profile", body: <>The agent calls <code>remember</code> to save facts such as your postcode, owner or renter status, and measures already done. The profile is kept in your browser and injected into each new turn, so it never asks twice.</> },
  { tag: "Structured output", title: "Schema-constrained extraction", body: <><code>/api/extract</code> turns a free-text description of your home into a typed intake profile, using a JSON schema the model has to follow.</> },
  { tag: "Reasoning", title: "Adaptive thinking", body: <>Claude decides how much to think. You can expand a summary of its reasoning under each answer.</> },
  { tag: "MCP", title: "Model Context Protocol server", body: <><code>/api/mcp</code> exposes the same tools and skills to Claude Desktop, Claude Code or any MCP client.</> },
  { tag: "Guardrails", title: "Safety and cost controls", body: <>PII redaction (BSN, IBAN, email, phone) before anything reaches the model, rate limiting, input caps, scope limits, a refusal fallback, and prompt caching on the frozen system prompt.</> },
  { tag: "Evals", title: "Tested behaviour", body: <><code>npm run evals</code> checks the engine maths, retrieval quality and agent routing. <code>EVAL_LLM=1</code> adds end-to-end Claude checks.</> },
  { tag: "Context engineering", title: "AGENTS.md and CLAUDE.md", body: <>Repo-level instructions so coding agents (Claude Code and others) know how the project is laid out and how to add a skill.</> },
  { tag: "Fallback", title: "Works without a key", body: <>With no API key, a rule-based agent runs the same skills, tools and RAG. The app is always demoable.</> },
];

export default function Home() {
  return (
    <>
      <Header />
      <main className="wrap">
        <section className="hero">
          <div>
            <div className="eyebrow">Independent · Agentic · Open method</div>
            <h1>An AI agent that knows what your house needs first.</h1>
            <p className="lede">
              Warmtewijs AI is a Claude-powered energy advisor for Dutch homes. Tell it your address and situation. It looks up your house, loads the right expert skill, runs the numbers in a transparent model, checks subsidies, and cites its sources.
            </p>
            <div className="heroActions">
              <Link href="/advisor" className="btn">Start the conversation →</Link>
              <Link href="#under-the-hood" className="btn btnGhost">See how it works</Link>
            </div>
          </div>
          <div className="terminal" aria-label="Example agent trace">
            <div className="dim"># you: &quot;1972 rijtjeshuis, 3511 AB 2. What first?&quot;</div>
            <div><span className="key">remember</span>(postcode=&quot;3511 AB&quot;) <span className="ok">✓</span></div>
            <div><span className="key">load_skill</span>(&quot;insulation&quot;) <span className="ok">✓ SKILL.md</span></div>
            <div><span className="key">lookup_house</span>(3511 AB, 2) <span className="ok">✓ 1973 · hoekwoning · D</span></div>
            <div><span className="key">calculate_plan</span>(…) <span className="ok">✓ 5 measures ranked</span></div>
            <div><span className="key">search_knowledge</span>(&quot;cavity wall&quot;) <span className="ok">✓ 3 passages</span></div>
            <div className="dim">─────────────────────────────</div>
            <div>01 Spouwmuurisolatie · payback 3.4 yr</div>
            <div>02 Dakisolatie · two-measure ISDE rate</div>
            <div>03 Hybride warmtepomp · after insulating</div>
            <div className="dim">—  Zonnepanelen: not yet, roof first</div>
          </div>
        </section>

        <section className="section" id="under-the-hood">
          <div className="eyebrow">Under the hood</div>
          <h2>Every building block of a modern AI app, in one small codebase.</h2>
          <p className="sectionLede">Each concept below is implemented in the code you can read, not just described. Open the advisor, and the panel on the right shows each one at work.</p>
          <div className="grid3">
            {CONCEPTS.map((c) => (
              <div className="cell" key={c.title}>
                <span className="cellTag">{c.tag}</span>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section" id="mcp">
          <div className="eyebrow">Use it from your own AI</div>
          <h2>Connect the advisor to Claude over MCP.</h2>
          <p className="sectionLede">The same tools the web agent uses are available as an MCP server. Add it to Claude Code with one command:</p>
          <div className="terminal">
            <div>claude mcp add --transport http warmtewijs https://&lt;this-site&gt;/api/mcp</div>
            <div className="dim"># tools: {TOOL_DEFS.filter((t) => t.name !== "remember").map((t) => t.name).join(", ")}</div>
            <div className="dim"># prompts: {SKILLS.map((s) => s.name).join(", ")}</div>
          </div>
        </section>

        <section className="section">
          <h2>Find out what your house actually needs.</h2>
          <p className="sectionLede">Free, no account. Works in English and Dutch.</p>
          <Link href="/advisor" className="btn">Ask the advisor →</Link>
        </section>
      </main>
      <footer className="footer">
        <span>Warmtewijs AI · house data from BAG (Kadaster) via PDOK and EP-Online · figures are indicative</span>
        <span>
          <Link href="/skills">Skills</Link> · <a href="/api/skills">API</a>
        </span>
      </footer>
    </>
  );
}
