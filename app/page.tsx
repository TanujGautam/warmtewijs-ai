import Link from "next/link";
import Header from "./components/Header";
import AddressForm from "./components/AddressForm";
import ThermalHouse from "./components/ThermalHouse";
import { SKILLS } from "@/lib/skills";
import { TOOL_DEFS } from "@/lib/tools";
import { CHUNK_COUNT } from "@/lib/rag";
import s from "./landing.module.css";

// 24×24 stroke icons
const ICONS: Record<string, string> = {
  loop: "M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4",
  skill: "M6 3h9l3 3v15H6zM14 3v4h4M9 12h6M9 16h6",
  tool: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z",
  rag: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5M8 11h6",
  memory: "M5 4h14v16l-7-4-7 4z",
  schema: "M8 4H6a2 2 0 0 0-2 2v4l-2 2 2 2v4a2 2 0 0 0 2 2h2M16 4h2a2 2 0 0 1 2 2v4l2 2-2 2v4a2 2 0 0 1-2 2h-2",
  think: "M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z",
  mcp: "M8 8V4M16 8V4M6 8h12v4a6 6 0 0 1-12 0zM12 18v3",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4",
  check: "M4 6h16M4 12h10M4 18h7M17 15l2 2 4-4",
  doc: "M4 19V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2zM8 7h6M8 11h8",
  plug: "M12 22v-5M7 7V2M17 7V2M5 7h14v4a7 7 0 0 1-14 0z",
};

function Icon({ name }: { name: string }) {
  return (
    <svg className={s.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

const CONCEPTS = [
  { icon: "loop", tag: "Agent loop", title: "A tool-using agent", body: <>Claude plans, calls tools, reads the results and keeps going, up to 8 steps per message. Every step streams live to your screen.</> },
  { icon: "skill", tag: "Skills", title: "SKILL.md expertise", body: <>{SKILLS.length} expert procedures in <code>skills/*/SKILL.md</code>. Only their descriptions sit in the prompt; the full skill loads when it&apos;s needed.</> },
  { icon: "tool", tag: "Tools", title: "Function calling", body: <>{TOOL_DEFS.length} typed, validated tools. A deterministic engine does all the maths, so the model never makes up a number.</> },
  { icon: "rag", tag: "RAG", title: "Sources, cited", body: <>Search over {CHUNK_COUNT} passages on ISDE, heat pumps, renters and solar. Answers cite them like <code>[isde-2026]</code>.</> },
  { icon: "memory", tag: "Memory", title: "It remembers you", body: <>Your postcode, whether you own or rent, and what&apos;s already done are saved in your browser, so it never asks twice.</> },
  { icon: "schema", tag: "Structured output", title: "Typed extraction", body: <>Describe your house in your own words and <code>/api/extract</code> turns it into a validated profile.</> },
  { icon: "think", tag: "Reasoning", title: "Adaptive thinking", body: <>Claude decides how hard to think. Expand the reasoning summary under any answer to see why.</> },
  { icon: "mcp", tag: "MCP", title: "Use it from your AI", body: <>The same tools and skills are available to Claude Desktop and Claude Code through <code>/api/mcp</code>.</> },
  { icon: "shield", tag: "Guardrails", title: "Safe by default", body: <>BSN, IBAN, email and phone numbers are stripped before anything reaches the model. Rate limits and a refusal fallback are built in.</> },
  { icon: "check", tag: "Evals", title: "Tested behaviour", body: <>28 checks cover the maths, retrieval quality, the live registers and the agent&apos;s routing.</> },
  { icon: "doc", tag: "Context files", title: "AGENTS.md", body: <>Repo instructions so coding agents know how the project fits together and how to add a skill.</> },
  { icon: "plug", tag: "Fallback", title: "Always works", body: <>No API key? A rule-based agent runs the same skills, tools and sources.</> },
];

const STEPS = [
  { n: "01", title: "Your address", body: "Postcode and house number. We fetch the build year, floor area, house type and registered energy label from the official registers." },
  { n: "02", title: "A short chat", body: "Tell it what's already done, whether you own or rent, and your budget. Ask anything along the way." },
  { n: "03", title: "Your ranked plan", body: "Measures in the order that pays best, with cost, subsidy, yearly saving, payback, CO₂ and label effect." },
  { n: "04", title: "Take it anywhere", body: "Use it to brief an installer, apply for ISDE, or argue your case with the VvE or your landlord." },
];

const PLAN = [
  { n: "01", name: "Spouwmuurisolatie", en: "Cavity wall", meta: "€3.000 · ISDE €1.060", pb: "4,2 yr" },
  { n: "02", name: "Dakisolatie", en: "Roof", meta: "€5.350 · ISDE €2.370", pb: "8,9 yr" },
  { n: "03", name: "Hybride warmtepomp", en: "Hybrid heat pump", meta: "€5.800 · ISDE €2.100", pb: "12,6 yr" },
];

export default function Home() {
  return (
    <>
      <Header />
      <main className={s.page}>
        {/* HERO */}
        <section className={s.hero}>
          <div className={s.heroGlow} aria-hidden="true" />
          <div className={`${s.wrap} ${s.heroGrid}`}>
            <div className={s.heroCopy}>
              <span className={s.badge}>
                <span className={s.badgeDot} /> Independent · no installer commissions
              </span>
              <h1 className={s.h1}>
                See where your house <span className={s.hot}>leaks heat</span>, and what to fix first.
              </h1>
              <p className={s.lede}>
                Warmtewijs AI is an energy advisor agent for Dutch homes. It reads your house from the official registers, runs the numbers in an open model, checks your subsidies and cites its sources.
              </p>
              <AddressForm />
              <ul className={s.trust}>
                <li>✓ Free, no account</li>
                <li>✓ Real BAG &amp; EP-Online data</li>
                <li>✓ English &amp; Nederlands</li>
              </ul>
            </div>

            <div className={s.heroVisual}>
              <ThermalHouse />
              <div className={s.floatCard}>
                <div className={s.floatHead}>
                  <span>Plan ready</span>
                  <span className={s.label}>D → A</span>
                </div>
                <div className={s.floatStats}>
                  <div><small>Saving / yr</small><strong>€1.405</strong></div>
                  <div><small>Subsidy</small><strong>€7.306</strong></div>
                  <div><small>CO₂ / yr</small><strong>2 t</strong></div>
                </div>
              </div>
              <div className={s.floatTrace} aria-hidden="true">
                <div className={s.traceLine} style={{ animationDelay: ".2s" }}><b>lookup_house</b> 1973 · hoekwoning</div>
                <div className={s.traceLine} style={{ animationDelay: ".9s" }}><b>load_skill</b> insulation</div>
                <div className={s.traceLine} style={{ animationDelay: "1.6s" }}><b>calculate_plan</b> 5 measures</div>
              </div>
            </div>
          </div>
        </section>

        {/* SOURCES */}
        <section className={s.sources}>
          <div className={`${s.wrap} ${s.sourcesRow}`}>
            <span className={s.sourcesLabel}>Built on public data</span>
            <span><b>BAG</b> build year &amp; area</span>
            <span><b>EP-Online</b> energy label</span>
            <span><b>RVO</b> ISDE rates</span>
            <span><b>PDOK</b> addresses</span>
            <span><b>Claude</b> reasoning</span>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className={s.section} id="how">
          <div className={s.wrap}>
            <div className={s.eyebrow}>How it works</div>
            <h2 className={s.h2}>Four minutes from address to plan.</h2>
            <div className={s.steps}>
              {STEPS.map((st) => (
                <div className={s.step} key={st.n}>
                  <span className={s.stepN}>{st.n}</span>
                  <h3>{st.title}</h3>
                  <p>{st.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PLAN SHOWCASE */}
        <section className={`${s.section} ${s.tinted}`}>
          <div className={`${s.wrap} ${s.showcase}`}>
            <div>
              <div className={s.eyebrow}>What you get</div>
              <h2 className={s.h2}>A plan ranked by payback, not by margin.</h2>
              <ul className={s.ticks}>
                <li><b>The right order.</b> Insulate first, then make your heating efficient, then generate your own power.</li>
                <li><b>Every number explained.</b> Gas price, gas use and subsidy rate are all visible, and you can correct any of them.</li>
                <li><b>What not to do yet.</b> Solar panels on a roof that needs insulating, or a heat pump in a leaky house.</li>
                <li><b>Subsidies that fit.</b> ISDE for owners, SVVE for VvE&apos;s, and a letter to your landlord if you rent.</li>
              </ul>
              <Link href="/advisor" className={s.ctaLink}>Try it with your address →</Link>
            </div>
            <div className={s.planCard}>
              <div className={s.planTop}>
                <span>Plan · hoekwoning 1973 · 132 m²</span>
                <span>Label D → A</span>
              </div>
              <div className={s.planStats}>
                <div><small>Saving / year</small><strong>€1.405</strong></div>
                <div><small>Subsidy</small><strong>€7.306</strong></div>
                <div><small>CO₂ / year</small><strong>2,0 t</strong></div>
              </div>
              {PLAN.map((p) => (
                <div className={s.planRow} key={p.n}>
                  <span className={s.planN}>{p.n}</span>
                  <div>
                    <div className={s.planName}>{p.name} <span>· {p.en}</span></div>
                    <div className={s.planMeta}>{p.meta}</div>
                  </div>
                  <span className={s.planPb}>{p.pb}</span>
                </div>
              ))}
              <div className={`${s.planRow} ${s.planLater}`}>
                <span className={s.planN}>—</span>
                <div>
                  <div className={s.planName}>Zonnepanelen <span>· Solar</span></div>
                  <div className={s.planMeta}>Not yet. Insulate the roof first.</div>
                </div>
                <span className={s.planPb}>later</span>
              </div>
            </div>
          </div>
        </section>

        {/* INDEPENDENCE */}
        <section className={s.dark}>
          <div className={s.wrap}>
            <div className={`${s.eyebrow} ${s.eyebrowLight}`}>Independence</div>
            <h2 className={`${s.h2} ${s.h2Light}`}>We don&apos;t sell installations. Nobody pays us to recommend theirs.</h2>
            <div className={s.pillars}>
              <div><span>01</span><h3>No commissions</h3><p>The ranking never depends on who&apos;s paying. Sometimes the right answer is to do nothing this year.</p></div>
              <div><span>02</span><h3>Numbers from code</h3><p>The AI explains; a transparent, tested model calculates. Every assumption is on the page.</p></div>
              <div><span>03</span><h3>Official data</h3><p>Your house comes from the Kadaster and RVO registers. If something&apos;s wrong, tell the advisor and it updates.</p></div>
            </div>
          </div>
        </section>

        {/* UNDER THE HOOD */}
        <section className={s.section} id="under-the-hood">
          <div className={s.wrap}>
            <div className={s.eyebrow}>Under the hood</div>
            <h2 className={s.h2}>Every building block of a modern AI app.</h2>
            <p className={s.sub}>Each one is implemented, not just described. Open the advisor, and the panel on the right shows them at work.</p>
            <div className={s.concepts}>
              {CONCEPTS.map((c) => (
                <div className={s.concept} key={c.title}>
                  <div className={s.conceptTop}>
                    <Icon name={c.icon} />
                    <span>{c.tag}</span>
                  </div>
                  <h3>{c.title}</h3>
                  <p>{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* MCP */}
        <section className={`${s.section} ${s.tinted}`} id="mcp">
          <div className={`${s.wrap} ${s.mcp}`}>
            <div>
              <div className={s.eyebrow}>For builders</div>
              <h2 className={s.h2}>Plug the advisor into your own AI.</h2>
              <p className={s.sub}>The same tools are available as an MCP server. Add it to Claude Code with one command.</p>
            </div>
            <div className={s.terminal}>
              <div className={s.termBar}><i /><i /><i /></div>
              <code>
                <span className={s.prompt}>$</span> claude mcp add --transport http warmtewijs \<br />
                &nbsp;&nbsp;https://warmtewijs-ai.vercel.app/api/mcp
                <br />
                <span className={s.dim}># tools: {TOOL_DEFS.filter((t) => t.name !== "remember").map((t) => t.name).join(", ")}</span>
                <br />
                <span className={s.dim}># prompts: {SKILLS.map((sk) => sk.name).join(", ")}</span>
              </code>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className={s.final}>
          <div className={s.wrap}>
            <h2 className={`${s.h2} ${s.h2Light}`}>Find out what your house actually needs.</h2>
            <p className={s.finalSub}>Free, no account, about four minutes.</p>
            <AddressForm dark />
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={`${s.wrap} ${s.footerRow}`}>
          <span className={s.footerBrand}><i /> Warmtewijs AI</span>
          <span>House data: BAG (Kadaster) via PDOK and EP-Online (RVO). Figures are indicative; this is not financial advice.</span>
          <span>
            <Link href="/skills">Skills</Link> · <Link href="/advisor">Advisor</Link> · <a href="https://github.com/TanujGautam/warmtewijs-ai">GitHub</a>
          </span>
        </div>
      </footer>
    </>
  );
}
