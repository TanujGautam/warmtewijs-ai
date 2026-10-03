"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentEvent } from "@/lib/events";
import type { PlanResult } from "@/lib/engine";
import type { Profile } from "@/lib/tools";
import { renderMarkdown } from "./markdown";

type Turn =
  | { role: "user"; text: string }
  | { role: "bot"; text: string; thinking: string; plans: PlanResult[]; notices: { kind: "info" | "err"; text: string }[]; live: boolean };

type Step = { id: string; name: string; input?: unknown; preview?: string; isError?: boolean; kind: "skill" | "tool" | "rag" | "mem" | "web"; pending: boolean };

const STORE = { profile: "ww.profile", history: "ww.history", turns: "ww.turns" };
const SUGGESTIONS = [
  "I own a 1970s terraced house at 3511 AB 2. What should I do first?",
  "Is a hybrid heat pump worth it for me?",
  "I rent. My landlord won't insulate. What can I do?",
  "How does the ISDE two-measure rule work?",
];

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

const eur = (n: number) => `€${Math.round(n).toLocaleString("nl-NL")}`;
const kindOf = (name: string): Step["kind"] => (name === "load_skill" ? "skill" : name === "search_knowledge" ? "rag" : name === "remember" ? "mem" : name === "web_search" ? "web" : "tool");

export default function Advisor() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [history, setHistory] = useState<unknown[]>([]);
  const [profile, setProfile] = useState<Profile>({});
  const [steps, setSteps] = useState<Step[]>([]);
  const [skillsLoaded, setSkillsLoaded] = useState<string[]>([]);
  const [mode, setMode] = useState<{ mode: string; model?: string } | null>(null);
  const [usage, setUsage] = useState({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Restore persisted state after mount (localStorage is unavailable during SSR).
    setProfile(load(STORE.profile, {}));
    setHistory(load(STORE.history, []));
    setTurns(load<Turn[]>(STORE.turns, []).map((t) => (t.role === "bot" ? { ...t, live: false } : t)));
    fetch("/api/chat").then((r) => r.json()).then((d) => setMode((m) => m ?? d)).catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  function patchBot(fn: (t: Extract<Turn, { role: "bot" }>) => Extract<Turn, { role: "bot" }>) {
    setTurns((ts) => {
      const copy = [...ts];
      const last = copy[copy.length - 1];
      if (last?.role === "bot") copy[copy.length - 1] = fn(last);
      return copy;
    });
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setInput("");
    setSteps([]);
    setTurns((ts) => [...ts, { role: "user", text: message }, { role: "bot", text: "", thinking: "", plans: [], notices: [], live: true }]);

    let finalHistory: unknown[] | null = null;
    let latestProfile = profile;
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, history, profile }) });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        patchBot((t) => ({ ...t, notices: [...t.notices, { kind: "err", text: err.error ?? "Request failed" }] }));
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
            case "status":
              setMode({ mode: ev.mode, model: ev.model });
              break;
            case "text":
              patchBot((t) => ({ ...t, text: t.text + ev.delta }));
              break;
            case "thinking":
              patchBot((t) => ({ ...t, thinking: t.thinking + ev.delta }));
              break;
            case "tool_call":
              setSteps((s) => [...s, { id: ev.id, name: ev.name, input: ev.input, kind: kindOf(ev.name), pending: true }]);
              break;
            case "tool_result":
              setSteps((s) => s.map((x) => (x.id === ev.id ? { ...x, preview: ev.preview, isError: ev.isError, pending: false } : x)));
              if (ev.ui?.kind === "plan") {
                const plan = ev.ui.plan;
                patchBot((t) => ({ ...t, plans: [plan] }));
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
              latestProfile = ev.profile;
              setProfile(ev.profile);
              save(STORE.profile, ev.profile);
              break;
            case "guardrail":
              patchBot((t) => ({ ...t, notices: [...t.notices, { kind: "info", text: ev.message }] }));
              break;
            case "usage":
              setUsage((u) => ({ input: u.input + ev.input, output: u.output + ev.output, cacheRead: u.cacheRead + ev.cacheRead, cacheWrite: u.cacheWrite + ev.cacheWrite }));
              break;
            case "history":
              finalHistory = ev.messages;
              break;
            case "error":
              patchBot((t) => ({ ...t, notices: [...t.notices, { kind: "err", text: ev.message }] }));
              break;
          }
        }
      }
    } catch (e) {
      patchBot((t) => ({ ...t, notices: [...t.notices, { kind: "err", text: e instanceof Error ? e.message : "Network error" }] }));
    } finally {
      patchBot((t) => ({ ...t, live: false }));
      if (finalHistory) {
        setHistory(finalHistory);
        save(STORE.history, finalHistory);
      }
      save(STORE.profile, latestProfile);
      setTurns((ts) => {
        save(STORE.turns, ts.slice(-40));
        return ts;
      });
      setBusy(false);
    }
  }

  function reset(all: boolean) {
    setTurns([]);
    setHistory([]);
    setSteps([]);
    setSkillsLoaded([]);
    save(STORE.turns, []);
    save(STORE.history, []);
    if (all) {
      setProfile({});
      save(STORE.profile, {});
    }
  }

  return (
    <div className="advisor">
      <section className="chatCol">
        <div className="chatScroll" ref={scrollRef}>
          <div className="chatInner">
            {turns.length === 0 && (
              <div className="welcome">
                <div className="eyebrow">Warmtewijs advisor</div>
                <h1>What would you like to fix in your house?</h1>
                <p>Tell me your postcode and house number, and whether you own or rent. Then ask anything about insulation, heat pumps, subsidies, solar or financing. The panel on the right shows each step the agent takes.</p>
              </div>
            )}
            {turns.map((t, i) =>
              t.role === "user" ? (
                <div key={i} className="msgUser">{t.text}</div>
              ) : (
                <div key={i} className="msgBot">
                  <div className="who">
                    <span className={`dot ${t.live ? "live" : ""}`} /> Warmtewijs {t.live && !t.text && "· working…"}
                  </div>
                  {t.thinking && (
                    <details className="thinking">
                      <summary>Reasoning summary</summary>
                      <div style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{t.thinking}</div>
                    </details>
                  )}
                  {t.plans.map((p, j) => <PlanCard key={j} plan={p} />)}
                  {t.text && <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(t.text) }} />}
                  {t.notices.map((n, j) => (
                    <div key={j} className={`notice ${n.kind === "err" ? "err" : ""}`} style={{ marginTop: 8 }}>{n.text}</div>
                  ))}
                </div>
              ),
            )}
          </div>
        </div>
        <div className="composer">
          <div className="composerInner">
            {turns.length === 0 && (
              <div className="chips">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            )}
            <form className="composerRow" onSubmit={(e) => { e.preventDefault(); send(input); }}>
              <textarea
                value={input}
                placeholder="e.g. 1072 AB 14, we own it. Is cavity wall insulation worth it?"
                maxLength={2000}
                rows={1}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                aria-label="Message"
              />
              <button className="btn" disabled={busy || !input.trim()}>{busy ? "…" : "Send"}</button>
            </form>
            <div className="hint">Personal numbers (BSN, IBAN, email, phone) are removed before sending. Figures are indicative.</div>
          </div>
        </div>
      </section>

      <aside className="trace" aria-label="Agent trace">
        <div className="traceSec">
          <h4>
            <span>Engine</span>
            {mode && <span className={`pill ${mode.mode === "claude" ? "on" : "off"}`}>{mode.mode === "claude" ? mode.model : "offline · rule-based"}</span>}
          </h4>
          {mode?.mode === "offline" && <p className="muted">No ANTHROPIC_API_KEY is set on the server, so a rule-based agent is driving the same tools and skills.</p>}
          {usage.input + usage.output > 0 && (
            <dl className="kv" style={{ marginTop: 8 }}>
              <dt>tokens in</dt><dd>{usage.input.toLocaleString()}</dd>
              <dt>tokens out</dt><dd>{usage.output.toLocaleString()}</dd>
              <dt>cache read</dt><dd>{usage.cacheRead.toLocaleString()}</dd>
              <dt>cache write</dt><dd>{usage.cacheWrite.toLocaleString()}</dd>
            </dl>
          )}
        </div>

        <div className="traceSec">
          <h4><span>Agent steps (this turn)</span><span>{steps.length || ""}</span></h4>
          {steps.length === 0 && <p className="muted">Tool calls, skill loads and retrievals appear here as they happen.</p>}
          {steps.map((s) => (
            <div className="step" key={s.id}>
              <span className="name">{s.name}</span>
              <span className={`tag ${s.isError ? "err" : s.kind}`}>{s.isError ? "error" : s.kind === "mem" ? "memory" : s.kind}</span>
              {s.pending && <span className="muted"> · running…</span>}
              {s.input !== undefined && <pre>{JSON.stringify(s.input)}</pre>}
              {s.preview && <pre>{s.preview}</pre>}
            </div>
          ))}
        </div>

        <div className="traceSec">
          <h4><span>Skills loaded</span></h4>
          {skillsLoaded.length ? skillsLoaded.map((s) => <span key={s} className="tag skill" style={{ marginRight: 6 }}>{s}</span>) : <p className="muted">None yet. Skills load on demand.</p>}
        </div>

        <div className="traceSec">
          <h4>
            <span>Memory · your profile</span>
            <button className="linkBtn" onClick={() => reset(true)}>forget me</button>
          </h4>
          {Object.keys(profile).length ? (
            <dl className="kv">
              {Object.entries(profile).map(([k, v]) => (
                <div key={k} style={{ display: "contents" }}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="muted">Empty. The agent saves facts you share, and they&apos;re kept in this browser only.</p>
          )}
        </div>

        <div className="traceSec">
          <button className="btn btnGhost" style={{ width: "100%" }} onClick={() => reset(false)}>New conversation</button>
        </div>
      </aside>
    </div>
  );
}

function PlanCard({ plan }: { plan: PlanResult }) {
  const h = plan.house;
  return (
    <div className="plan">
      <div className="planHead">
        <span>{h.address ?? `${h.postcode} ${h.houseNumber}`} · {h.type} {h.buildYear} · {h.floorArea} m²</span>
        <span>Label {plan.labelFrom}{h.labelSource?.startsWith("estimated") ? " (est.)" : ""} → {plan.labelTo}</span>
      </div>
      <div className="planStats">
        <div><small>Saving / year</small><strong>{eur(plan.totals.savingPerYear)}</strong></div>
        <div><small>Subsidy</small><strong>{eur(plan.totals.subsidy)}</strong></div>
        <div><small>CO₂ / year</small><strong>{plan.totals.co2TonnesPerYear.toLocaleString("nl-NL")} t</strong></div>
      </div>
      {plan.measures.filter((m) => m.status !== "not-applicable").map((m, i) => (
        <div key={m.id} className={`planRow ${m.status === "later" ? "later" : ""}`}>
          <span className="n">{m.status === "recommended" ? String(i + 1).padStart(2, "0") : "—"}</span>
          <div>
            <div>{m.dutch} <span className="muted">· {m.name}</span></div>
            <div className="sub">{m.status === "recommended" ? `${eur(m.cost)} · subsidy ${eur(m.subsidy)} · saves ${eur(m.savingPerYear)}/yr` : m.reason}</div>
          </div>
          <span className="pb">{m.status === "recommended" ? `${m.paybackYears} yr` : "later"}</span>
        </div>
      ))}
      <div className="planRow" style={{ gridTemplateColumns: "1fr" }}>
        <span className="sub">Assumes gas €{plan.assumptions.gasPrice.toFixed(2)}/m³, electricity €{plan.assumptions.electricityPrice.toFixed(2)}/kWh, {plan.assumptions.gasUseM3} m³/yr. House data: {h.source}. Label: {h.labelSource ?? "register"}. Type: {h.typeSource ?? "register"}. Wrong? Just tell the advisor.</span>
      </div>
    </div>
  );
}
