import { useState } from "react";
import { useApp } from "../ctx";
import { CATEGORIES, ENERGY_LABEL } from "../constants";
import type { CategoryKey, Energy, Routine, Task } from "../types";
import { DAY_SHORT, fmt, longDate, nowMin, toMin, today, uid, weekday } from "../lib/time";
import { materialize } from "../lib/plan";
import { multiplier } from "../lib/stats";
import { Chips, Sheet } from "./Sheet";

const CAT_OPTS = CATEGORIES.map((c) => ({ key: c.key, label: c.label, color: `var(--c-${c.key})` }));
const ENERGY_OPTS: { key: Energy | "none"; label: string }[] = [
  { key: "none", label: "Not set" },
  ...(Object.keys(ENERGY_LABEL) as Energy[]).map((k) => ({ key: k, label: ENERGY_LABEL[k] })),
];

/** Add or edit a single block, or a routine (sticky block) when `routine` mode is on. */
export function BlockSheet({ date, task, routine, routineMode, start: startHint, title: titleHint, fromNote }: {
  date?: string; task?: Task; routine?: Routine; routineMode?: boolean; start?: string; title?: string; fromNote?: string;
}) {
  const { state, update, close, toast } = useApp();
  const src = task || routine;
  const defStart = startHint || fmt(Math.ceil((nowMin() + 15) / 15) * 15);
  const [title, setTitle] = useState(src?.title || titleHint || "");
  const [category, setCategory] = useState<CategoryKey>(src?.category || "work");
  const [start, setStart] = useState(src?.start || defStart);
  const [dur, setDur] = useState(src ? String(src.dur) : "");
  const [end, setEnd] = useState(src ? fmt(toMin(src.start) + src.dur) : "");
  const [energy, setEnergy] = useState<Energy | "none">(src?.energy || "none");
  const [ifNot, setIfNot] = useState(src?.ifNot || "");
  const [repeat, setRepeat] = useState(!!routineMode);
  const [days, setDays] = useState<number[]>(routine?.days || (date ? [weekday(date)] : [0, 1, 2, 3, 4]));
  const [error, setError] = useState("");
  const mx = multiplier(state);

  // start / finish / duration stay in sync: change one, the others follow
  const onStart = (v: string) => {
    setStart(v);
    if (v && dur) setEnd(fmt(toMin(v) + +dur));
  };
  const onEnd = (v: string) => {
    setEnd(v);
    if (v && start) {
      const d = toMin(v) - toMin(start);
      setDur(d > 0 ? String(d) : "");
    }
  };
  const onDur = (v: string) => {
    setDur(v);
    if (v && +v > 0 && start) setEnd(fmt(toMin(start) + +v));
  };

  const isRoutine = repeat || !!routine;
  const inRoutineInstance = !!task?.routineId;

  function save() {
    if (!title.trim()) return setError("Give the block a name.");
    if (!start) return setError("Pick a start time.");
    if (isRoutine && !days.length) return setError("Pick at least one day for the routine.");
    const d = Math.max(5, +dur || 30);
    const data = {
      title: title.trim(), start, dur: d, category,
      energy: energy === "none" ? undefined : energy,
      ifNot: ifNot.trim() || undefined,
    };
    update((s) => {
      if (isRoutine && !task) {
        if (routine) Object.assign(s.routines.find((r) => r.id === routine.id)!, data, { days });
        else s.routines.push({ id: uid(), ...data, days: [...days].sort(), since: date || today() });
      } else if (task) {
        Object.assign(materialize(s, task), data);
      } else {
        s.tasks.push({ id: uid(), date: date!, status: "open", ...data });
      }
      if (fromNote) s.notes = s.notes.filter((n) => n.id !== fromNote);
    });
    toast(isRoutine && !task ? (routine ? "Routine updated." : `Routine added: ${days.map((x) => DAY_SHORT[x]).join(", ")}.`) : "Saved.");
    close();
  }

  function remove() {
    update((s) => {
      if (routine) {
        s.routines = s.routines.filter((r) => r.id !== routine.id);
        // keep logged history, drop unlogged future instances
        s.tasks = s.tasks.filter((t) => !(t.routineId === routine.id && t.status === "open"));
      } else if (task) {
        if (task.routineId) materialize(s, task).status = "skipped";
        else s.tasks = s.tasks.filter((t) => t.id !== task.id);
      }
    });
    close();
  }

  const heading = routine ? "Edit routine" : routineMode ? "New routine" : task ? "Edit block" : "Add a block";
  return (
    <Sheet title={heading} onClose={close}
      sub={routineMode || routine ? "A routine repeats on the days you pick." : date ? longDate(date) : undefined}>
      <div className="field"><label htmlFor="b-title">What</label>
        <input id="b-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Gym" autoFocus /></div>

      <div className="field"><span>Category</span>
        <Chips options={CAT_OPTS} value={category} onChange={setCategory} /></div>

      <div className="row">
        <div className="field"><label htmlFor="b-start">Start</label>
          <input id="b-start" type="time" value={start} onChange={(e) => onStart(e.target.value)} /></div>
        <div className="field"><label htmlFor="b-end">Finish <span className="opt">optional</span></label>
          <input id="b-end" type="time" value={end} onChange={(e) => onEnd(e.target.value)} /></div>
        <div className="field"><label htmlFor="b-dur">Duration <span className="opt">min, optional</span></label>
          <input id="b-dur" type="number" min="5" step="5" value={dur} placeholder="30" onChange={(e) => onDur(e.target.value)} /></div>
      </div>
      {mx && mx > 1.15 && <div className="hint">Your blocks usually take {mx.toFixed(1)}× what you plan.</div>}

      <div className="field"><span>Energy needed <span className="opt">optional</span></span>
        <Chips options={ENERGY_OPTS} value={energy} onChange={setEnergy} /></div>

      <div className="field"><label htmlFor="b-ifnot">If not… <span className="opt">your fallback on a bad day</span></label>
        <input id="b-ifnot" value={ifNot} onChange={(e) => setIfNot(e.target.value)} placeholder="20-minute walk" /></div>

      {!task && !routine && !routineMode && (
        <label className="toggle"><input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} /> Repeat this block (make it a routine)</label>
      )}
      {isRoutine && !task && (
        <div className="field"><span>Repeats on</span>
          <Chips multi options={DAY_SHORT.map((l, i) => ({ key: i, label: l }))} value={days}
            onChange={(i) => setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]))} /></div>
      )}
      {inRoutineInstance && <div className="hint">This is a routine block. Changes here apply to this day only. Edit the routine itself in the Routines tab.</div>}
      {error && <div className="error" role="alert">{error}</div>}

      <div className="actions">
        {(task || routine) && <button className="btn ghost" onClick={remove}>{routine ? "Delete routine" : inRoutineInstance ? "Skip this day" : "Delete"}</button>}
        <span className="spacer" />
        <button className="btn" onClick={close}>Cancel</button>
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Sheet>
  );
}
