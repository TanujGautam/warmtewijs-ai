"use client";

import { useEffect, useState } from "react";
import { LANGS } from "@/lib/i18n";
import { useLang } from "./LangProvider";

type Weather = { temp: number; code: number; wind: number; place: string };

// WMO weather codes → icon + label
function describe(code: number, lang: "en" | "nl"): [string, string] {
  const table: [number[], string, string, string][] = [
    [[0], "☀️", "Clear", "Helder"],
    [[1, 2], "🌤️", "Partly cloudy", "Half bewolkt"],
    [[3], "☁️", "Cloudy", "Bewolkt"],
    [[45, 48], "🌫️", "Fog", "Mist"],
    [[51, 53, 55, 56, 57], "🌦️", "Drizzle", "Motregen"],
    [[61, 63, 65, 66, 67, 80, 81, 82], "🌧️", "Rain", "Regen"],
    [[71, 73, 75, 77, 85, 86], "🌨️", "Snow", "Sneeuw"],
    [[95, 96, 99], "⛈️", "Thunderstorm", "Onweer"],
  ];
  const row = table.find(([codes]) => codes.includes(code));
  return row ? [row[1], lang === "nl" ? row[3] : row[2]] : ["🌡️", ""];
}

function savedPostcode(): string {
  try {
    const p = JSON.parse(localStorage.getItem("ww.profile") ?? "{}");
    return typeof p.postcode === "string" ? p.postcode : "";
  } catch {
    return "";
  }
}

export function WeatherClock() {
  const { lang, t } = useLang();
  const [now, setNow] = useState<Date | null>(null);
  const [weather, setWeather] = useState<Weather | null | "error">(null);

  useEffect(() => {
    // Clock and weather only render after mount: avoids server/client time mismatch.
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 15_000);
    const load = () => {
      const pc = savedPostcode();
      fetch(`/api/weather${pc ? `?postcode=${encodeURIComponent(pc)}` : ""}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(setWeather)
        .catch(() => setWeather("error"));
    };
    load();
    const wid = setInterval(load, 15 * 60_000);
    window.addEventListener("ww:profile", load);
    return () => {
      clearInterval(id);
      clearInterval(wid);
      window.removeEventListener("ww:profile", load);
    };
  }, []);

  const time = now?.toLocaleTimeString(lang === "nl" ? "nl-NL" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" });
  const date = now?.toLocaleDateString(lang === "nl" ? "nl-NL" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Amsterdam" });
  const w = weather && weather !== "error" ? weather : null;
  const [icon, label] = w ? describe(w.code, lang) : ["", ""];

  return (
    <div className="hwidgets" aria-live="off">
      <span className="hchip" title={w ? `${label} · ${w.place} · ${t.weather.feels}` : t.weather.unknown}>
        {w ? (
          <>
            <span aria-hidden="true">{icon}</span> <b>{Math.round(w.temp)}°</b> <span className="hmuted">{w.place}</span>
          </>
        ) : (
          <span className="hmuted">{weather === "error" ? "—" : t.weather.loading}</span>
        )}
      </span>
      <span className="hchip" suppressHydrationWarning>
        {time ? (
          <>
            <b>{time}</b> <span className="hmuted">{date}</span>
          </>
        ) : (
          <span className="hmuted">--:--</span>
        )}
      </span>
    </div>
  );
}

export function LangSwitch() {
  const { lang, setLang, t } = useLang();
  return (
    <div className="langSwitch" role="group" aria-label={t.nav.langLabel}>
      {LANGS.map((l) => (
        <button key={l} type="button" className={l === lang ? "on" : ""} aria-pressed={l === lang} onClick={() => l !== lang && setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
