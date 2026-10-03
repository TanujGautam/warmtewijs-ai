import { cookies, headers } from "next/headers";
import { DICTS, LANG_COOKIE, resolveLang, type Lang } from "./i18n";

export async function getLang(): Promise<Lang> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return resolveLang(c.get(LANG_COOKIE)?.value, h.get("accept-language"));
}

export async function getDict() {
  const lang = await getLang();
  return { lang, t: DICTS[lang] };
}
