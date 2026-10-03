import Link from "next/link";
import Header from "./Header";
import type { LegalDoc } from "@/lib/legal";
import type { Lang } from "@/lib/i18n";
import { LEGAL_UPDATED, legalComplete } from "@/lib/site";

export default function LegalPage({ doc, lang }: { doc: LegalDoc; lang: Lang }) {
  const nl = lang === "nl";
  const date = new Date(LEGAL_UPDATED).toLocaleDateString(nl ? "nl-NL" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
  return (
    <>
      <Header />
      <main className="wrap legal">
        {!legalComplete() && (
          <div className="notice legalDraft" role="note">
            {nl
              ? "Concept: deze tekst is nog niet definitief. Bedrijfsgegevens worden nog aangevuld en de tekst wordt juridisch gecontroleerd."
              : "Draft: this text is not final yet. Company details are still being added and the text is being legally reviewed."}
          </div>
        )}
        <div className="eyebrow">{nl ? `Laatst bijgewerkt: ${date}` : `Last updated: ${date}`}</div>
        <h1>{doc.title}</h1>
        <p className="legalIntro">{doc.intro}</p>
        {doc.sections.map((s) => (
          <section key={s.h}>
            <h2>{s.h}</h2>
            {s.p.map((p, i) => <p key={i}>{p}</p>)}
          </section>
        ))}
        <p className="legalNav">
          <Link href="/terms">{nl ? "Algemene voorwaarden" : "Terms of service"}</Link> · <Link href="/privacy">{nl ? "Privacyverklaring" : "Privacy statement"}</Link> ·{" "}
          <Link href="/pricing">{nl ? "Prijzen" : "Pricing"}</Link>
        </p>
      </main>
    </>
  );
}
