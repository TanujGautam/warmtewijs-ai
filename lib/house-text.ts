// Display text for house-data provenance. The register layer writes English source strings
// (they also go to the model); this translates them for the Dutch interface and documents.
import type { House } from "./engine";
import type { Lang } from "./i18n";

const NL: [RegExp, string][] = [
  [/^estimated from build year — no label registered in EP-Online$/, "geschat op basis van bouwjaar — geen label geregistreerd in EP-Online"],
  [/^estimated from build year — EP-Online not configured$/, "geschat op basis van bouwjaar — EP-Online niet gekoppeld"],
  [/^estimated from build year — EP-Online lookup failed$/, "geschat op basis van bouwjaar — EP-Online tijdelijk niet bereikbaar"],
  [/^EP-Online \(registered (.+)\)$/, "EP-Online (geregistreerd $1)"],
  [/^EP-Online \(registered\)$/, "EP-Online (geregistreerd)"],
  [/^derived from BAG building footprints$/, "afgeleid uit BAG-gebouwcontouren"],
  [/^unknown — assumed terraced$/, "onbekend — tussenwoning aangenomen"],
  [/^corrected by user$/, "door jou aangepast"],
  [/^provided by user$/, "door jou opgegeven"],
  [/^assumed$/, "aangenomen"],
];

export function sourceText(s: string | undefined, lang: Lang): string {
  if (!s) return lang === "nl" ? "register" : "register";
  if (lang === "en") return s;
  for (const [re, nl] of NL) if (re.test(s)) return s.replace(re, nl);
  return s;
}

export const isEstimated = (h: House) => !!h.labelSource?.startsWith("estimated");

/** Dutch uses a decimal comma. */
export const num = (n: number, lang: Lang) => n.toLocaleString(lang === "nl" ? "nl-NL" : "en-GB", { maximumFractionDigits: 1 });
