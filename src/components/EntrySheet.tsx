import { useState } from "react";
import { useApp } from "../ctx";
import { CATEGORIES, INSTEAD } from "../constants";
import type { Actual, CategoryKey, InsteadKey } from "../types";
import { fmt, toMin, uid } from "../lib/time";
import { tasksFor } from "../lib/plan";
import { Chips, Sheet } from "./Sheet";

const INSTEAD_CAT: Partial<Record<InsteadKey, CategoryKey>> = { otherwork: "work", urgent: "work", hyperfocus: "work", people: "social", rest: "me", food: "me" };

/** Add or edit one stretch of "what really happened". */
export function EntrySheet({ date, entry, start, end }: { date: string; entry?: Actual; start?: number; end?: number }) {
  const { state, update, close } = useApp();
  const [title, setTitle] = useState(entry?.title || "");
  const [from, setFrom] = useState(fmt(entry?.start ?? start ?? 9 * 60));
  const [to, setTo] = useState(entry?.end !== undefined ? fmt(entry.end) : entry ? "" : fmt(end ?? (start ?? 540) + 30));
  const [category, setCategory] = useState<CategoryKey | undefined>(entry?.category);
  const [taskId, setTaskId] = useState<string | undefined>(entry?.taskId);
  const [insteadKey, setInsteadKey] = useState<InsteadKey | undefined>(entry?.insteadKey);
  const [error, setError] = useState("");

  const s0 = toMin(from);
  const overlapping = tasksFor(state, date).filter((t) => toMin(t.start) < (to ? toMin(to) : s0 + 30) && s0 < toMin(t.start) + t.dur);

  const save = () => {
    if (!title.trim()) return setError("Say what you did, or tap one of the options.");
    const e = to ? toMin(to) : undefined;
    if (e !== undefined && e <= s0) return setError("The end time needs to be after the start.");
    const kind: Actual["kind"] = taskId ? "plan" : overlapping.length ? "instead" : "free";
    const data = { title: title.trim(), start: s0, end: e, category, taskId, insteadKey, kind, auto: false };
    update((s) => {
      if (entry) Object.assign(s.actuals.find((a) => a.id === entry.id)!, data);
      else s.actuals.push({ id: uid(), date, ...data });
    });
    close();
  };
  const remove = () => { update((s) => { s.actuals = s.actuals.filter((a) => a.id !== entry!.id); }); close(); };

  return (
    <Sheet title={entry ? "Edit what happened" : "What did you do?"} onClose={close}
      sub={entry?.auto ? "Filled in from how you logged the block. Edit it if it was different." : "Log what really happened, planned or not."}>
      {overlapping.length > 0 && (
        <div className="field"><span>Planned at this time</span>
          <div className="chips">
            {overlapping.map((t) => (
              <button key={t.id} className="pick" aria-pressed={taskId === t.id}
                onClick={() => { setTaskId(taskId === t.id ? undefined : t.id); setTitle(t.title); setCategory(t.category); setInsteadKey(undefined); setFrom(t.start); setTo(fmt(toMin(t.start) + t.dur)); }}>
                I did: {t.title}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="field"><span>{overlapping.length ? "Or something else" : "Quick pick"}</span>
        <Chips options={INSTEAD.map((i) => ({ key: i.key, label: i.label }))} value={insteadKey}
          onChange={(k) => { setInsteadKey(k); setTaskId(undefined); setTitle(INSTEAD.find((i) => i.key === k)!.label); setCategory(INSTEAD_CAT[k]); }} />
      </div>
      <div className="field"><label htmlFor="e-title">What</label>
        <input id="e-title" value={title} onChange={(e) => { setTitle(e.target.value); setInsteadKey(undefined); }} placeholder="Groceries, call with mum, YouTube…" /></div>
      <div className="row">
        <div className="field"><label htmlFor="e-from">From</label><input id="e-from" type="time" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field"><label htmlFor="e-to">To {entry && entry.end === undefined && <span className="opt">still going</span>}</label>
          <input id="e-to" type="time" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      <div className="field"><span>Area <span className="opt">optional</span></span>
        <Chips options={CATEGORIES.map((c) => ({ key: c.key, label: c.label, color: `var(--c-${c.key})` }))} value={category}
          onChange={(k) => setCategory(category === k ? undefined : k)} /></div>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="actions">
        {entry && <button className="btn ghost" onClick={remove}>Delete</button>}
        <span className="spacer" />
        <button className="btn" onClick={close}>Cancel</button>
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Sheet>
  );
}
