import { useEffect, useRef, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useApp } from "../ctx";
import { BARRIER_LABEL, INSTEAD_LABEL, catLabel } from "../constants";
import { supabase } from "../lib/supabase";
import { applyVoice, buildVoiceRequest, parseVoiceResult, type VoiceItem, type VoiceProposal } from "../lib/voice";
import { fmt, longDate, today } from "../lib/time";
import { Sheet } from "./Sheet";
import { Icon } from "./Icon";

const ERRORS: Record<string, string> = {
  missing_key: "Voice logging isn't switched on yet: the Claude API key still has to be added in Supabase.",
  bad_key: "The Claude API key in Supabase isn't working. Check it in the Anthropic console and paste it again.",
  signin: "Sign in first (Me → Account & sync), so your log stays private.",
  refused: "Couldn't turn that into a log. Try saying it a bit differently.",
  bad_output: "Couldn't turn that into a log. Try again.",
  too_long: "That was a lot! Try a shorter version.",
  busy: "Busy right now. Try again in a minute.",
  empty: "Say or type something first.",
};

const STATUS: Record<string, string> = { done: "done", partial: "partly done", missed: "didn't happen", ifnot: "“if not” version" };

// the browser's own speech-to-text, when there is one (Chrome, Safari)
type Rec = { start: () => void; stop: () => void; onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null; onend: (() => void) | null; continuous: boolean; interimResults: boolean; lang: string };
const Recognition = (): (new () => Rec) | null => {
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

/** "Tell me about your day": talk (or type), Claude turns it into log entries, you approve them. */
export function VoiceSheet({ date }: { date: string }) {
  const { state, update, close, open, now, toast, celebrate } = useApp();
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"write" | "thinking" | "review">("write");
  const [proposal, setProposal] = useState<VoiceProposal | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const rec = useRef<Rec | null>(null);
  const isToday = date === today();
  useEffect(() => () => rec.current?.stop(), []);

  const listen = () => {
    const R = Recognition();
    if (!R) return;
    if (listening) { rec.current?.stop(); return; }
    try {
      const r = new R();
      r.continuous = true;
      r.interimResults = false;
      r.lang = navigator.language || "en-US";
      r.onresult = (e) => {
        let add = "";
        for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) add += e.results[i][0].transcript;
        if (add) setText((t) => (t ? `${t.trimEnd()} ${add.trim()}` : add.trim()));
      };
      r.onend = () => setListening(false);
      r.start();
      rec.current = r;
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const understand = async () => {
    rec.current?.stop();
    setError("");
    if (!text.trim()) return setError(ERRORS.empty);
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return setError(ERRORS.signin);
    setPhase("thinking");
    const { data, error: err } = await supabase.functions.invoke("log-day", { body: buildVoiceRequest(state, date, text, isToday ? now : null) });
    if (err) {
      let code = "";
      if (err instanceof FunctionsHttpError) {
        if (err.context?.status === 404) code = "not_deployed";
        else { try { code = (await err.context.json())?.error || ""; } catch { /* not JSON */ } }
      }
      setPhase("write");
      return setError(code === "not_deployed" ? "The “log-day” function isn't in Supabase yet (see the setup steps)." : ERRORS[code] || "Couldn't reach the server. Check your connection and try again.");
    }
    const p = parseVoiceResult(data?.result, state, date);
    setProposal(p);
    setOff(new Set());
    setPhase("review");
  };

  const chosen = (proposal?.items || []).filter((i) => !off.has(i.id));
  const approve = () => {
    let n = 0;
    update((s) => { n = applyVoice(s, date, chosen); });
    celebrate();
    toast(n ? `Logged ${n} thing${n > 1 ? "s" : ""}.` : "Nothing logged.");
    close();
  };

  const line = (i: VoiceItem): { title: string; detail: string } => {
    if (i.kind === "block") {
      const bits = [STATUS[i.status], i.minutes ? `${i.minutes} min` : "", i.reason ? BARRIER_LABEL[i.reason].toLowerCase() : "", i.note || ""].filter(Boolean);
      return { title: i.title, detail: bits.join(" · ") };
    }
    if (i.kind === "extra") {
      const bits = [`${fmt(i.start)} – ${fmt(i.end)}${i.guessedEnd ? " (about)" : ""}`, i.instead ? `instead (${INSTEAD_LABEL[i.instead].toLowerCase()})` : "", i.category ? catLabel(state, i.category) : ""].filter(Boolean);
      return { title: i.title, detail: bits.join(" · ") };
    }
    if (i.kind === "energy") return { title: "Energy", detail: i.energy };
    if (i.kind === "sleep") return { title: "Sleep", detail: `${i.hours} h` };
    return { title: "New to-do", detail: i.text };
  };

  if (phase === "review" && proposal) {
    return (
      <Sheet title="Here's what I got" sub={proposal.summary || "Untick anything that's wrong, then approve."} onClose={close}>
        {!proposal.items.length ? (
          <div className="empty recover-empty"><div className="what">Nothing to log</div><div>Try adding times or block names.</div></div>
        ) : (
          <ul className="recoverlist voicelist">
            {proposal.items.map((i) => {
              const l = line(i);
              const on = !off.has(i.id);
              return (
                <li key={i.id} className={on ? "" : "offc"}>
                  <div className="grow"><div className="rtitle">{l.title}</div><div className="small muted">{l.detail}</div></div>
                  <input type="checkbox" checked={on} aria-label={`Include: ${l.title}`}
                    onChange={() => setOff((o) => { const n = new Set(o); if (n.has(i.id)) n.delete(i.id); else n.add(i.id); return n; })} />
                </li>
              );
            })}
          </ul>
        )}
        {proposal.skipped.length > 0 && <div className="hint">Not logged: {proposal.skipped.join(", ")}.</div>}
        <div className="actions">
          <button className="btn ghost" onClick={() => setPhase("write")}>Back</button>
          <span className="spacer" />
          {proposal.items.length > 0 && <button className="btn primary" disabled={!chosen.length} onClick={approve}>Approve{chosen.length < proposal.items.length ? ` ${chosen.length}` : ""}</button>}
        </div>
      </Sheet>
    );
  }

  const canListen = !!Recognition();
  return (
    <Sheet title="Tell me about your day" sub={isToday ? "Talk or type: what you did, what you skipped and why. I'll turn it into your log, and you approve it." : longDate(date)} onClose={close}>
      <div className="field">
        <textarea id="voice-text" rows={7} value={text} onChange={(e) => setText(e.target.value)} disabled={phase === "thinking"}
          placeholder="Gym was good, about 45 minutes. Skipped Spanish, too tired, scrolled my phone instead from 6 to 7. Cooked dinner around 8…" />
      </div>
      <div className="hint">{canListen ? "Tap Talk, or use the mic on your keyboard." : "Tip: tap the mic on your keyboard to talk instead of typing."}</div>
      {error && <div className="error" role="alert">{error}{error === ERRORS.signin && <> <button className="linkbtn" onClick={() => open({ type: "account" })}>Sign in</button></>}</div>}
      <div className="actions">
        {canListen && (
          <button className={`btn ${listening ? "primary" : ""}`} onClick={listen} disabled={phase === "thinking"}>
            <Icon name="mic" size={16} /> {listening ? "Stop" : "Talk"}
          </button>
        )}
        <span className="spacer" />
        <button className="btn primary" onClick={understand} disabled={phase === "thinking" || !text.trim()}>
          {phase === "thinking" ? "Reading it…" : "Turn into my log"}
        </button>
      </div>
    </Sheet>
  );
}
