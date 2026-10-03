import Link from "next/link";
import Header from "../components/Header";
import { getDict } from "@/lib/lang-server";
import { CONTACT_EMAIL } from "@/lib/site";
import { paymentsEnabled } from "@/lib/plus";
import PlusCta from "./PlusCta";
import s from "../landing.module.css";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: `${t.nav.pricing} — Warmtewijs AI` };
}

export default async function Pricing() {
  const { lang, t } = await getDict();
  const p = t.pricing;
  const live = paymentsEnabled();
  const unit = (u: string) => (u === "perHouse" ? p.perHouse : u === "perMonth" ? p.perMonth : "");
  return (
    <>
      <Header />
      <main className={s.page}>
        <section className={s.section}>
          <div className={s.wrap}>
            <div className={s.eyebrow}>{p.eyebrow}</div>
            <h1 className={s.h2}>{p.title}</h1>
            {!live && <p className={s.sub}>{p.sub}</p>}

            <div className="priceGrid">
              {p.tiers.map((tier, i) => {
                const business = i === p.tiers.length - 1;
                const href = business ? (CONTACT_EMAIL ? `mailto:${CONTACT_EMAIL}` : null) : "/advisor";
                return (
                  <div key={tier.name} id={business ? "business" : undefined} className={`priceCard ${"featured" in tier && tier.featured ? "featured" : ""}`}>
                    {"featured" in tier && tier.featured && !live && <span className="priceRibbon">{p.beta}</span>}
                    <h2>{tier.name}</h2>
                    <div className="priceAmount">
                      <strong>{tier.price}</strong>
                      {tier.unit && <span>{unit(tier.unit)}</span>}
                    </div>
                    {!business && i > 0 && !live && <p className="priceBeta">{p.beta}</p>}
                    <ul>
                      {tier.items.map((it) => <li key={it}>{it}</li>)}
                    </ul>
                    {live && "featured" in tier && tier.featured ? (
                      <PlusCta />
                    ) : href ? (
                      <Link href={href} className={`btn ${"featured" in tier && tier.featured ? "" : "btnGhost"}`}>{tier.cta}</Link>
                    ) : (
                      <span className="btn btnGhost priceSoon">{lang === "nl" ? "Contact volgt binnenkort" : "Contact coming soon"}</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="priceFaq">
              <h2 className={s.h2} style={{ fontSize: 28 }}>{p.faqTitle}</h2>
              {p.faq.map(([q, a]) => (
                <details key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
