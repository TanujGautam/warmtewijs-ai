import Link from "next/link";
import Header from "./components/Header";
import AddressForm from "./components/AddressForm";
import ThermalHouse from "./components/ThermalHouse";
import { getDict } from "@/lib/lang-server";
import s from "./landing.module.css";

// 24×24 stroke icons for the feature grid (same order as t.features.items)
const FEATURE_ICONS = [
  "M6 3h9l3 3v15H6zM14 3v4h4M9 12h6M9 16h4", // bill
  "M9 11l2 2 4-4M5 4h14v16H5zM8 17h8", // quote check
  "M6 3h9l3 3v15H6zM12 10v6M9 13l3 3 3-3", // pdf plan
  "M4 6h16v12H4zM4 7l8 6 8-6", // letter
  "M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M21 20v-2a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8", // vve
  "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01", // rfq
  "M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6", // registers
  "M5 4h14v16l-7-4-7 4z", // memory
];

const PLAN = [
  { n: "01", name: "Spouwmuurisolatie", en: "Cavity wall", meta: "€3.000 · ISDE €1.113", pb: "4,2" },
  { n: "02", name: "Dakisolatie", en: "Roof", meta: "€5.350 · ISDE €2.574", pb: "8,8" },
  { n: "03", name: "Hybride warmtepomp", en: "Hybrid heat pump", meta: "€5.800 · ISDE €2.100", pb: "12,6" },
];

export default async function Home() {
  const { lang, t } = await getDict();
  const nl = lang === "nl";
  const yr = nl ? "jr" : "yr";
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
                <span className={s.badgeDot} /> {t.hero.badge}
              </span>
              <h1 className={s.h1}>
                {t.hero.h1a}
                <span className={s.hot}>{t.hero.h1hot}</span>
                {t.hero.h1b}
              </h1>
              <p className={s.lede}>{t.hero.lede}</p>
              <AddressForm />
              <ul className={s.trust}>
                {t.hero.trust.map((x) => <li key={x}>{x}</li>)}
              </ul>
            </div>

            <div className={s.heroVisual}>
              <ThermalHouse lang={lang} />
              <div className={s.floatCard}>
                <div className={s.floatHead}>
                  <span>{t.hero.planReady}</span>
                  <span className={s.label}>D → A</span>
                </div>
                <div className={s.floatStats}>
                  <div><small>{t.hero.saving}</small><strong>€1.405</strong></div>
                  <div><small>{t.hero.subsidy}</small><strong>€7.306</strong></div>
                  <div><small>{t.hero.co2}</small><strong>2 t</strong></div>
                </div>
              </div>
              <div className={s.floatTrace} aria-hidden="true">
                <div className={s.traceLine} style={{ animationDelay: ".2s" }}><b>lookup_house</b> 1973 · hoekwoning</div>
                <div className={s.traceLine} style={{ animationDelay: ".9s" }}><b>{nl ? "jaarafrekening" : "energy bill"}</b> 1.240 m³</div>
                <div className={s.traceLine} style={{ animationDelay: "1.6s" }}><b>calculate_plan</b> {nl ? "5 maatregelen" : "5 measures"}</div>
              </div>
            </div>
          </div>
        </section>

        {/* SOURCES */}
        <section className={s.sources}>
          <div className={`${s.wrap} ${s.sourcesRow}`}>
            <span className={s.sourcesLabel}>{t.sources.label}</span>
            {t.sources.items.map(([b, rest]) => (
              <span key={b}><b>{b}</b> {rest}</span>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className={s.section} id="how">
          <div className={s.wrap}>
            <div className={s.eyebrow}>{t.how.eyebrow}</div>
            <h2 className={s.h2}>{t.how.title}</h2>
            <div className={s.steps}>
              {t.how.steps.map(([title, body], i) => (
                <div className={s.step} key={title}>
                  <span className={s.stepN}>{String(i + 1).padStart(2, "0")}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PLAN SHOWCASE */}
        <section className={`${s.section} ${s.tinted}`}>
          <div className={`${s.wrap} ${s.showcase}`}>
            <div>
              <div className={s.eyebrow}>{t.showcase.eyebrow}</div>
              <h2 className={s.h2}>{t.showcase.title}</h2>
              <ul className={s.ticks}>
                {t.showcase.ticks.map(([b, rest]) => (
                  <li key={b}><b>{b}</b> {rest}</li>
                ))}
              </ul>
              <Link href="/advisor" className={s.ctaLink}>{t.showcase.cta}</Link>
            </div>
            <div className={s.planCard}>
              <div className={s.planTop}>
                <span>{t.showcase.planTop}</span>
                <span>Label D → A</span>
              </div>
              <div className={s.planStats}>
                <div><small>{t.hero.saving}</small><strong>€1.405</strong></div>
                <div><small>{t.hero.subsidy}</small><strong>€7.306</strong></div>
                <div><small>{t.hero.co2}</small><strong>2,0 t</strong></div>
              </div>
              {PLAN.map((p) => (
                <div className={s.planRow} key={p.n}>
                  <span className={s.planN}>{p.n}</span>
                  <div>
                    <div className={s.planName}>{p.name} {!nl && <span>· {p.en}</span>}</div>
                    <div className={s.planMeta}>{p.meta}</div>
                  </div>
                  <span className={s.planPb}>{p.pb} {yr}</span>
                </div>
              ))}
              <div className={`${s.planRow} ${s.planLater}`}>
                <span className={s.planN}>—</span>
                <div>
                  <div className={s.planName}>Zonnepanelen {!nl && <span>· Solar</span>}</div>
                  <div className={s.planMeta}>{t.showcase.notYet}</div>
                </div>
                <span className={s.planPb}>{t.showcase.later}</span>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className={s.section} id="features">
          <div className={s.wrap}>
            <div className={s.eyebrow}>{t.features.eyebrow}</div>
            <h2 className={s.h2}>{t.features.title}</h2>
            <div className={s.concepts}>
              {t.features.items.map(([title, body], i) => (
                <div className={s.concept} key={title}>
                  <div className={s.conceptTop}>
                    <svg className={s.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d={FEATURE_ICONS[i]} />
                    </svg>
                  </div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* INDEPENDENCE */}
        <section className={s.dark}>
          <div className={s.wrap}>
            <div className={`${s.eyebrow} ${s.eyebrowLight}`}>{t.indep.eyebrow}</div>
            <h2 className={`${s.h2} ${s.h2Light}`}>{t.indep.title}</h2>
            <div className={s.pillars}>
              {t.indep.pillars.map(([title, body], i) => (
                <div key={title}><span>{String(i + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{body}</p></div>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className={s.final}>
          <div className={s.wrap}>
            <h2 className={`${s.h2} ${s.h2Light}`}>{t.final.title}</h2>
            <p className={s.finalSub}>{t.final.sub}</p>
            <AddressForm dark />
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={`${s.wrap} ${s.footerRow}`}>
          <span className={s.footerBrand}><i /> Warmtewijs AI</span>
          <span>{t.footer.data}</span>
          <span>
            <Link href="/pricing">{t.nav.pricing}</Link> · <Link href="/advisor">{t.nav.advisor}</Link> · <Link href="/skills">Skills</Link> ·{" "}
            <a href="https://github.com/TanujGautam/warmtewijs-ai">GitHub</a>
          </span>
        </div>
      </footer>
    </>
  );
}
