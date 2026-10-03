import Link from "next/link";
import { getDict } from "@/lib/lang-server";
import { LangSwitch, WeatherClock } from "./HeaderWidgets";

export default async function Header() {
  const { t } = await getDict();
  return (
    <header className="header">
      <Link href="/" className="brand">
        <span className="brandMark" />
        <span className="brandName">Warmtewijs</span>
        <span className="brandTag">AI</span>
      </Link>
      <nav className="nav">
        <Link href="/#how">{t.nav.how}</Link>
        <Link href="/pricing">{t.nav.pricing}</Link>
        <WeatherClock />
        <LangSwitch />
        <Link href="/advisor" className="btn">
          {t.nav.advisor}
        </Link>
      </nav>
    </header>
  );
}
