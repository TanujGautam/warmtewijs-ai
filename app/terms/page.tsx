import LegalPage from "../components/LegalPage";
import { terms } from "@/lib/legal";
import { getLang } from "@/lib/lang-server";

export async function generateMetadata() {
  return { title: `${terms(await getLang()).title} — Warmtewijs AI` };
}

export default async function TermsPage() {
  const lang = await getLang();
  return <LegalPage doc={terms(lang)} lang={lang} />;
}
