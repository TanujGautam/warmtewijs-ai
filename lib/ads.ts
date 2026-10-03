// Sponsored slots in the advisor's side panel.
// Only add real advertisers here once there is an agreement with them (name, logo and claims must be theirs).
// Ads are always labelled and never influence the advice or the ranking.
import type { Lang } from "./i18n";

export interface Ad {
  id: string;
  sponsor: string;
  headline: Record<Lang, string>;
  body: Record<Lang, string>;
  cta: Record<Lang, string>;
  href: string;
  accent: string; // brand colour for the card's edge
}

export const ADS: Ad[] = [
  {
    id: "house-advertise",
    sponsor: "Warmtewijs",
    headline: { en: "Your energy company here", nl: "Jouw energiebedrijf hier" },
    body: {
      en: "Reach homeowners at the moment they plan their energy improvements. Clearly labelled, never part of the advice.",
      nl: "Bereik huiseigenaren precies wanneer ze hun verduurzaming plannen. Duidelijk gemarkeerd, nooit onderdeel van het advies.",
    },
    cta: { en: "Advertise with us →", nl: "Adverteer bij ons →" },
    href: "/pricing#business",
    accent: "#ff6a3d",
  },
  {
    id: "house-business",
    sponsor: "Warmtewijs Business",
    headline: { en: "Installer, adviser or VvE manager?", nl: "Installateur, adviseur of VvE-beheerder?" },
    body: {
      en: "Put this advisor on your own website, in your own branding.",
      nl: "Zet deze adviseur op je eigen website, in je eigen huisstijl.",
    },
    cta: { en: "See Business →", nl: "Bekijk Zakelijk →" },
    href: "/pricing#business",
    accent: "#1a46c8",
  },
];
