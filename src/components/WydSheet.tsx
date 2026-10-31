import { useState } from "react";
import { useApp } from "../ctx";
import { INSTEAD } from "../constants";
import type { Actual, InsteadKey } from "../types";
import { fmt, toMin, today } from "../lib/time";
import { tasksFor } from "../lib/plan";
import { logSpan, wydFrom } from "../lib/actuals";
import { Sheet } from "./Sheet";

const QUICK: InsteadKey[] = ["phone", "otherwork", "people", "chores", "food", "rest", "late"];

/**
 * "What are you doing?": one tap logs the stretch since your last entry (at most an hour) into My day.
 * Offers what was planned, what you logged recently, common things, or your own words.
 */
export function WydSheet({ date, at, from: fromHint }: { date: string; at?: number; from?: number }) {
  const { state, update, close, toast, now } = useApp();
  const to0 = at ?? (date === today() ? now : 18 * 60);
  const [from, setFrom] = useState(fmt(fromHint ?? wydFrom(state, date, to0)));
  const [to, setTo] = useState(fmt(to0));
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const f = toMin(from), t = toMin(to);
  const planned = tasksFor(state, date).filter((x) => toMin(x.start) < t && f < toMin(x.start) + x.dur);
  const recent = [...new Set(state.actuals.filter((a) => a.kind !== "plan").sort((a, b) => (b.end ?? 0) - (a.end ?? 0) + b.date.localeCompare(a.date)).map((a) => a.title))]
    .filter((x) => !INSTEAD.some((i) => i.label === x)).slice(0, 5);

  const save = (fields: Omit<Actual, "id" | "date" | "start" | "end">) => {
    if (t <= f) return setError("The end needs to be after the start.");
    update((s) => logSpan(s, date, f, t, fields));
    toast(`Logged ${from}–${to}: ${fields.title}`);
    close();
  };

  return (
    <Sheet title="What were you doing?" sub="One tap logs it in My day." onClose={close}>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div className="field"><label htmlFor="w-from">From</label><input id="w-from" type="time" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field"><label htmlFor="w-to">To</label><input id="w-to" type="time" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      {planned.length > 0 && (
        <div className="field"><span>Planned then</span>
          <div className="chips">
            {planned.map((p) => <button key={p.id} className="pick strong" onClick={() => save({ title: p.title, kind: "plan", category: p.category, taskId: p.id })}>I did: {p.title}</button>)}
          </div>
        </div>
      )}
      {recent.length > 0 && (
        <div className="field"><span>Recent</span>
          <div className="chips">{recent.map((r) => <button key={r} className="pick" onClick={() => save({ title: r, kind: "free" })}>{r}</button>)}</div>
        </div>
      )}
      <div className="field"><span>Quick</span>
        <div className="chips">
          {QUICK.map((k) => { const it = INSTEAD.find((i) => i.key === k)!; return <button key={k} className="pick" onClick={() => save({ title: it.label, kind: "free", insteadKey: k })}>{it.label}</button>; })}
        </div>
      </div>
      <div className="quickadd" style={{ marginTop: 14 }}>
        <input id="w-text" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && text.trim() && save({ title: text.trim(), kind: "free" })}
          placeholder="Or type it: groceries, call with mum…" aria-label="What you were doing" />
        <button className="btn primary" disabled={!text.trim()} onClick={() => save({ title: text.trim(), kind: "free" })}>Log</button>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
    </Sheet>
  );
}
