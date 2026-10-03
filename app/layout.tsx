import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { getLang } from "@/lib/lang-server";
import { LangProvider } from "./components/LangProvider";
import "./globals.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin", "latin-ext"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"] });

export async function generateMetadata(): Promise<Metadata> {
  const nl = (await getLang()) === "nl";
  return nl
    ? {
        title: "Warmtewijs AI — onafhankelijk energieadvies voor je huis",
        description: "Een AI-energieadviseur voor Nederlandse woningen: echte woningdata, een plan op volgorde, subsidies, offertecheck en documenten.",
      }
    : {
        title: "Warmtewijs AI — independent energy advice for your home",
        description: "An AI energy advisor for Dutch homes: real house data, a ranked plan, subsidies, a quote checker and ready-to-use documents.",
      };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  return (
    <html lang={lang} className={`${archivo.variable} ${plexMono.variable}`}>
      <body>
        <LangProvider initial={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
