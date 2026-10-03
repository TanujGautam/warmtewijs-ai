import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin", "latin-ext"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Warmtewijs AI — your independent energy advisor agent",
  description:
    "An AI agent that tells you what to fix in your Dutch home first. Built on Claude with skills (SKILL.md), tools, RAG, memory, structured outputs, MCP and evals.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
