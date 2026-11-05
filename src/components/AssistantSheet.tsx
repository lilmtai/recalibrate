import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useApp } from "../ctx";
import { catLabel } from "../constants";
import { callAi } from "../lib/ai";
import { applySuggestion, buildAssistantContext, checkSuggestions, type Suggestion } from "../lib/assistant";
import { DAY_SHORT, fmt, parseKey, today, weekday } from "../lib/time";
import { Sheet } from "./Sheet";
import { Icon } from "./Icon";

interface Msg {
  role: "user" | "assistant";
  text: string;
  suggestions?: Suggestion[];
  /** keys of suggestions already added / moved */
  done?: string[];
  dropped?: number;
}

const STORE = "recalibrate.chat";
const STARTERS = [
  "I want 1h of gym today. When fits best?",
  "Find a time this week for 1h with a tutor",
  "I have 30 minutes. Which goal should I work on?",
  "Make me a 1h plan for my most important project",
];

// the chat survives closing the panel (per device, for today)
function loadChat(): Msg[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) || "null");
    return v && v.date === today() && Array.isArray(v.messages) ? v.messages : [];
  } catch { return []; }
}
const saveChat = (messages: Msg[]) => { try { localStorage.setItem(STORE, JSON.stringify({ date: today(), messages })); } catch { /* ignore */ } };

const when = (date: string, start: number, dur: number) =>
  `${date === today() ? "Today" : `${DAY_SHORT[weekday(date)]} ${parseKey(date).getDate()}`} · ${fmt(start)} – ${fmt(start + dur)}`;

/** The assistant: ask about your schedule, work and goals. Suggestions change nothing until you tap them. */
export function AssistantSheet() {
  const { state, update, close, now, toast, celebrate } = useApp();
  const [messages, setMessages] = useState<Msg[]>(loadChat);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { saveChat(messages); endRef.current?.scrollIntoView({ block: "end" }); }, [messages, busy]);

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setError("");
    const next: Msg[] = [...messages, { role: "user", text: question }];
    setMessages(next);
    setText("");
    setBusy(true);
    const res = await callAi<{ result?: { reply?: unknown; suggestions?: unknown } }>("assistant", {
      messages: next.map((m) => ({ role: m.role, text: m.text })),
      context: buildAssistantContext(state, today(), now),
    });
    setBusy(false);
    if ("error" in res) { setError(res.error); return; }
    const r = res.data.result || {};
    const { ok, dropped } = checkSuggestions(r.suggestions, state, today(), now);
    setMessages([...next, { role: "assistant", text: typeof r.reply === "string" ? r.reply : "", suggestions: ok, dropped, done: [] }]);
  };

  const accept = (mi: number, sg: Suggestion) => {
    let fine = false;
    update((s) => { fine = applySuggestion(s, sg); });
    if (!fine) return toast("That slot isn't free any more. Ask again for a new time.");
    celebrate();
    toast(sg.kind === "add" ? `Added “${sg.title}” · ${when(sg.date, sg.start, sg.dur)}` : `Moved “${sg.title}” to ${fmt(sg.start)}`);
    setMessages((ms) => ms.map((m, i) => (i === mi ? { ...m, done: [...(m.done || []), sg.key] } : m)));
  };

  return (
    <Sheet title="Assistant" sub="Knows your week, your work and what you've logged. It only suggests; you decide." onClose={close}>
      <div className="chat">
        {!messages.length && (
          <div className="chatstart">
            <div className="small muted">Try:</div>
            {STARTERS.map((s) => <button key={s} className="pick" onClick={() => send(s)}>{s}</button>)}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.text && <div className="bubble">{m.text}</div>}
            {m.suggestions?.map((sg) => {
              const done = m.done?.includes(sg.key);
              return (
                <div key={sg.key} className={`sugg ${done ? "done" : ""}`} style={{ "--c": `var(--c-${sg.kind === "add" ? sg.category : "work"})` } as CSSProperties}>
                  <div className="grow">
                    <div className="rtitle">{sg.kind === "move" ? `Move “${sg.title}”` : sg.title}</div>
                    <div className="small muted">{sg.kind === "move" ? `${sg.from} → ${fmt(sg.start)} · ` : ""}{when(sg.date, sg.start, sg.dur)}{sg.kind === "add" ? ` · ${catLabel(state, sg.category)}` : ""}</div>
                    {sg.why && <div className="small muted">{sg.why}</div>}
                  </div>
                  <button className={`btn small ${done ? "" : "primary"}`} disabled={done} onClick={() => accept(i, sg)}>
                    {done ? <><Icon name="check" size={14} stroke={3} /> {sg.kind === "add" ? "Added" : "Moved"}</> : sg.kind === "add" ? "Add" : "Move"}
                  </button>
                </div>
              );
            })}
            {!!m.dropped && <div className="small muted">I left out {m.dropped} suggestion{m.dropped > 1 ? "s" : ""} that clashed with your schedule.</div>}
          </div>
        ))}
        {busy && <div className="msg assistant"><div className="bubble typing"><i /><i /><i /></div></div>}
        <div ref={endRef} />
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="chatinput">
        <textarea rows={1} value={text} placeholder="Ask about your day or work…" aria-label="Ask the assistant"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }} />
        <button className="btn primary" disabled={busy || !text.trim()} onClick={() => send(text)} aria-label="Send">Send</button>
      </div>
      {messages.length > 0 && (
        <button className="linkbtn small" style={{ marginTop: 8 }} onClick={() => { setMessages([]); setError(""); }}>New conversation</button>
      )}
    </Sheet>
  );
}
