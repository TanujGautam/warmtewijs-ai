"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentEvent } from "@/lib/events";
import type { PlanResult } from "@/lib/engine";
import type { QuoteReport } from "@/lib/quote-check";
import type { Profile } from "@/lib/tools";
import { useLang } from "../components/LangProvider";
import { PlanCard, QuoteCard } from "./Cards";
import SidePanel, { type Step } from "./SidePanel";
import { renderMarkdown } from "./markdown";

type Notice = { kind: "info" | "err"; text: string };
type BotTurn = { role: "bot"; text: string; thinking: string; plans: PlanResult[]; quote?: { report: QuoteReport; summary: string }; notices: Notice[]; live: boolean };
type Turn = { role: "user"; text: string } | BotTurn;

const STORE = { profile: "ww.profile", history: "ww.history", turns: "ww.turns", plan: "ww.plan" };
const ADDRESS_KEYS = ["postcode", "houseNumber", "houseType", "buildYear", "floorArea", "label", "doneMeasures"] as const;
const MAX_UPLOAD = 4 * 1024 * 1024;

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — conversation still works in memory */
  }
}

const kindOf = (name: string): Step["kind"] => (name === "load_skill" ? "skill" : name === "search_knowledge" ? "rag" : name === "remember" ? "mem" : name === "web_search" ? "web" : "tool");

/** Photos from phones are large: scale to ≤2000 px JPEG before upload (Claude reads them fine at that size). */
async function prepareFile(file: File): Promise<File> {
  if (file.type === "application/pdf" || !file.type.startsWith("image/")) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file;
  } catch {
    return file; // e.g. HEIC the browser can't decode: send as-is and let the server reject the type
  }
}

export default function Advisor() {
  const { lang, t } = useLang();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [history, setHistory] = useState<unknown[]>([]);
  const [profile, setProfile] = useState<Profile>({});
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [skillsLoaded, setSkillsLoaded] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadKind = useRef<"bill" | "quote">("bill");
  const started = useRef(false);

  function updateProfile(p: Profile) {
    setProfile(p);
    save(STORE.profile, p);
    window.dispatchEvent(new Event("ww:profile")); // header weather follows the house location
  }

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice in dev; never double-send
    started.current = true;
    // Restore persisted state after mount (localStorage is unavailable during SSR).
    const savedProfile = load<Profile>(STORE.profile, {});
    const q = new URLSearchParams(window.location.search).get("q")?.slice(0, 2000);
    if (q) {
      // Arrived from the landing page with an address: start a fresh conversation about that house,
      // keeping general facts (owner/renter, budget, bill) but not the previous house's details.
      const fresh: Profile = { ...savedProfile };
      for (const k of ADDRESS_KEYS) delete fresh[k];
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from localStorage after mount
      updateProfile(fresh);
      save(STORE.history, []);
      save(STORE.turns, []);
      save(STORE.plan, null);
      window.history.replaceState(null, "", "/advisor");
      send(q, { history: [], profile: fresh });
    } else {
      setProfile(savedProfile);
      setHistory(load(STORE.history, []));
      setPlan(load<PlanResult | null>(STORE.plan, null));
      setTurns(load<Turn[]>(STORE.turns, []).map((tt) => (tt.role === "bot" ? { ...tt, live: false } : tt)));
    }
    // Mount-only by design: restore once, and auto-send the landing-page question at most once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  function patchBot(fn: (b: BotTurn) => BotTurn) {
    setTurns((ts) => {
      const copy = [...ts];
      const last = copy[copy.length - 1];
      if (last?.role === "bot") copy[copy.length - 1] = fn(last);
      return copy;
    });
  }
  const notice = (kind: Notice["kind"], text: string) => patchBot((b) => ({ ...b, notices: [...b.notices, { kind, text }] }));
  const persistTurns = () =>
    setTurns((ts) => {
      save(STORE.turns, ts.slice(-40));
      return ts;
    });

  async function send(text: string, start?: { history: unknown[]; profile: Profile }) {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setInput("");
    setSteps([]);
    setTurns((ts) => [...ts, { role: "user", text: message }, { role: "bot", text: "", thinking: "", plans: [], notices: [], live: true }]);

    let finalHistory: unknown[] | null = null;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: start?.history ?? history, profile: start?.profile ?? profile, lang }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        notice("err", err.error ?? "Request failed");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          const ev = JSON.parse(part.slice(6)) as AgentEvent;
          switch (ev.type) {
            case "text":
              patchBot((b) => ({ ...b, text: b.text + ev.delta }));
              break;
            case "thinking":
              patchBot((b) => ({ ...b, thinking: b.thinking + ev.delta }));
              break;
            case "tool_call":
              setSteps((s) => [...s, { id: ev.id, name: ev.name, input: ev.input, kind: kindOf(ev.name), pending: true }]);
              break;
            case "tool_result":
              setSteps((s) => s.map((x) => (x.id === ev.id ? { ...x, preview: ev.preview, isError: ev.isError, pending: false } : x)));
              if (ev.ui?.kind === "plan") {
                const p = ev.ui.plan;
                patchBot((b) => ({ ...b, plans: [p] }));
                setPlan(p);
                save(STORE.plan, p);
              }
              if (ev.ui?.kind === "skill") {
                const name = ev.ui.name;
                setSkillsLoaded((s) => (s.includes(name) ? s : [...s, name]));
              }
              break;
            case "server_tool":
              setSteps((s) => [...s, { id: `${ev.name}-${s.length}`, name: ev.name, preview: ev.detail, kind: "web", pending: false }]);
              break;
            case "memory":
              updateProfile(ev.profile);
              break;
            case "guardrail":
              notice("info", ev.message);
              break;
            case "history":
              finalHistory = ev.messages;
              break;
            case "error":
              notice("err", ev.message);
              break;
          }
        }
      }
    } catch (e) {
      notice("err", e instanceof Error ? e.message : "Network error");
    } finally {
      patchBot((b) => ({ ...b, live: false }));
      if (finalHistory) {
        setHistory(finalHistory);
        save(STORE.history, finalHistory);
      }
      persistTurns();
      setBusy(false);
    }
  }

  function pickFile(kind: "bill" | "quote") {
    uploadKind.current = kind;
    fileRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    e.target.value = "";
    if (!raw || busy) return;
    const kind = uploadKind.current;
    setTurns((ts) => [...ts, { role: "user", text: `📎 ${raw.name}` }, { role: "bot", text: "", thinking: "", plans: [], notices: [{ kind: "info", text: t.upload.privacy }], live: true }]);
    if (!/^(application\/pdf|image\/(jpeg|png|webp|gif))$/.test(raw.type) && !raw.type.startsWith("image/")) {
      notice("err", t.upload.badType);
      patchBot((b) => ({ ...b, live: false }));
      return;
    }
    setBusy(true);
    let followUp: string | null = null;
    try {
      const file = await prepareFile(raw);
      if (file.size > MAX_UPLOAD) {
        notice("err", t.upload.tooBig);
        return;
      }
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      form.append("lang", lang);
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const map: Record<string, string> = { too_big: t.upload.tooBig, bad_type: t.upload.badType, not_a_quote: lang === "nl" ? "Dit lijkt geen offerte voor energiemaatregelen." : "This doesn't look like a quote for energy measures.", unreadable: t.upload.billNothing };
        notice("err", map[data.error] ?? data.error ?? "Upload failed");
        return;
      }
      if (data.kind === "bill") {
        const v = data.values as { gasUseM3: number | null; electricityKwh: number | null; gasPrice: number | null; electricityPrice: number | null; label: string | null };
        const next: Profile = { ...profile };
        if (v.gasUseM3) next.gasUseM3 = String(v.gasUseM3);
        if (v.electricityKwh) next.electricityKwh = String(v.electricityKwh);
        if (v.gasPrice) next.gasPrice = String(v.gasPrice);
        if (v.electricityPrice) next.electricityPrice = String(v.electricityPrice);
        if (v.label) next.label = v.label;
        if (!v.gasUseM3 && !v.electricityKwh && !v.label) {
          notice("err", t.upload.billNothing);
          return;
        }
        updateProfile(next);
        const nl = lang === "nl";
        const parts = [
          v.gasUseM3 && `${nl ? "Gasverbruik" : "Gas use"}: ${v.gasUseM3.toLocaleString("nl-NL")} m³/${nl ? "jaar" : "year"}.`,
          v.electricityKwh && `${nl ? "Stroomverbruik" : "Electricity use"}: ${v.electricityKwh.toLocaleString("nl-NL")} kWh/${nl ? "jaar" : "year"}.`,
          v.gasPrice && `${nl ? "Gasprijs" : "Gas price"}: €${v.gasPrice.toFixed(2)}/m³.`,
          v.electricityPrice && `${nl ? "Stroomprijs" : "Electricity price"}: €${v.electricityPrice.toFixed(2)}/kWh.`,
          v.label && `${nl ? "Energielabel" : "Energy label"}: ${v.label}.`,
        ].filter(Boolean) as string[];
        patchBot((b) => ({
          ...b,
          text: `**${t.upload.billDone}**${data.supplier ? ` (${data.supplier}${data.period ? `, ${data.period}` : ""})` : ""}:\n\n${parts.map((x) => `- ${x}`).join("\n")}${data.scaled ? `\n\n_${nl ? "Omgerekend naar een heel jaar." : "Scaled to a full year."}_` : ""}`,
        }));
        followUp = t.upload.billMessage(parts.join(" "));
      } else if (data.kind === "quote") {
        patchBot((b) => ({ ...b, quote: { report: data.report, summary: data.summary } }));
      }
    } catch (err) {
      notice("err", err instanceof Error ? err.message : "Upload failed");
    } finally {
      patchBot((b) => ({ ...b, live: false }));
      persistTurns();
      setBusy(false);
    }
    // Let the advisor recalculate with the real figures (after busy is released).
    if (followUp) setTimeout(() => send(followUp!), 50);
  }

  function reset(all: boolean) {
    setTurns([]);
    setHistory([]);
    setSteps([]);
    setSkillsLoaded([]);
    save(STORE.turns, []);
    save(STORE.history, []);
    if (all) {
      setPlan(null);
      save(STORE.plan, null);
      updateProfile({});
    }
  }

  return (
    <div className="advisor">
      <section className="chatCol">
        <div className="chatScroll" ref={scrollRef}>
          <div className="chatInner">
            {turns.length === 0 && (
              <div className="welcome">
                <div className="eyebrow">{t.advisor.eyebrow}</div>
                <h1>{t.advisor.welcomeTitle}</h1>
                <p>{t.advisor.welcomeBody}</p>
              </div>
            )}
            {turns.map((tt, i) =>
              tt.role === "user" ? (
                <div key={i} className="msgUser">{tt.text}</div>
              ) : (
                <div key={i} className="msgBot">
                  <div className="who">
                    <span className={`dot ${tt.live ? "live" : ""}`} /> Warmtewijs {tt.live && !tt.text && `· ${t.advisor.working}`}
                  </div>
                  {tt.thinking && (
                    <details className="thinking">
                      <summary>{t.advisor.reasoning}</summary>
                      <div style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{tt.thinking}</div>
                    </details>
                  )}
                  {tt.plans.map((p, j) => <PlanCard key={j} plan={p} />)}
                  {tt.quote && <QuoteCard report={tt.quote.report} onAsk={() => send(t.upload.quoteMessage(tt.quote!.summary))} />}
                  {tt.text && <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(tt.text) }} />}
                  {tt.notices.map((n, j) => (
                    <div key={j} className={`notice ${n.kind === "err" ? "err" : ""}`} style={{ marginTop: 8 }}>{n.text}</div>
                  ))}
                  {tt.live && !tt.text && !tt.plans.length && !tt.quote && tt.notices.length > 0 && <div className="muted" style={{ marginTop: 8 }}>{t.upload.reading}</div>}
                </div>
              ),
            )}
          </div>
        </div>
        <div className="composer">
          <div className="composerInner">
            {turns.length === 0 && (
              <div className="chips">
                {t.advisor.suggestions.map((s) => (
                  <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
                ))}
                <button className="chip chipAccent" onClick={() => pickFile("bill")}>📎 {t.advisor.attach}</button>
                <button className="chip chipAccent" onClick={() => pickFile("quote")}>📄 {t.advisor.attachQuote}</button>
              </div>
            )}
            <form className="composerRow" onSubmit={(e) => { e.preventDefault(); send(input); }}>
              <button type="button" className="attachBtn" title={t.advisor.attach} aria-label={t.advisor.attach} disabled={busy} onClick={() => pickFile("bill")}>📎</button>
              <textarea
                value={input}
                placeholder={t.advisor.placeholder}
                maxLength={2000}
                rows={1}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                aria-label="Message"
              />
              <button className="btn" disabled={busy || !input.trim()}>{busy ? "…" : t.advisor.send}</button>
            </form>
            <input ref={fileRef} type="file" accept="application/pdf,image/*" hidden onChange={onFile} />
            <div className="hint">{t.advisor.hint}</div>
          </div>
        </div>
      </section>

      <SidePanel plan={plan} profile={profile} steps={steps} skillsLoaded={skillsLoaded} busy={busy} onUpload={pickFile} onReset={reset} />
    </div>
  );
}
