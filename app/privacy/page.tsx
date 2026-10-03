import LegalPage from "../components/LegalPage";
import { privacy } from "@/lib/legal";
import { getLang } from "@/lib/lang-server";

export async function generateMetadata() {
  return { title: `${privacy(await getLang()).title} — Warmtewijs AI` };
}

export default async function PrivacyPage() {
  const lang = await getLang();
  return <LegalPage doc={privacy(lang)} lang={lang} />;
}
