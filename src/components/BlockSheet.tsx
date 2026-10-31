import { useState } from "react";
import { useApp } from "../ctx";
import { categoriesOf, ENERGY_LABEL } from "../constants";
import type { CategoryKey, Energy, Routine, Task } from "../types";
import { DAY_SHORT, fmt, longDate, nowMin, toMin, today, uid, weekday } from "../lib/time";
import { materialize } from "../lib/plan";
import { EMOJI_PICKS, suggestEmoji } from "../lib/emoji";
import { multiplier } from "../lib/stats";
import { Chips, Sheet } from "./Sheet";

const ENERGY_OPTS: { key: Energy | "none"; label: string }[] = [
  { key: "none", label: "Not set" },
  ...(Object.keys(ENERGY_LABEL) as Energy[]).map((k) => ({ key: k, label: ENERGY_LABEL[k] })),
];

/** Add or edit a single block, or a routine (sticky block) when `routine` mode is on. */
export function BlockSheet({ date, task, routine, routineMode, start: startHint, title: titleHint, fromNote }: {
  date?: string; task?: Task; routine?: Routine; routineMode?: boolean; start?: string; title?: string; fromNote?: string;
}) {
  const { state, update, close, toast, open } = useApp();
  const src = task || routine;
  const defStart = startHint || fmt(Math.ceil((nowMin() + 15) / 15) * 15);
  const [title, setTitle] = useState(src?.title || titleHint || "");
  const [category, setCategory] = useState<CategoryKey>(src?.category || "work");
  const [start, setStart] = useState(src?.start || defStart);
  // a new block gets a real finish (start + 30 min) instead of an empty field that looks like "now"
  const [dur, setDur] = useState(src ? String(src.dur) : "30");
  const [end, setEnd] = useState(fmt(toMin(src?.start || defStart) + (src?.dur ?? 30)));
  // no finish time = ongoing: it runs until you mark it finished
  const [hasEnd, setHasEnd] = useState(src ? !src.ongoing : false);
  const [emoji, setEmoji] = useState<string | undefined>(src?.emoji);
  const [picking, setPicking] = useState(false);
  const [energy, setEnergy] = useState<Energy | "none">(src?.energy || "none");
  const [ifNot, setIfNot] = useState(src?.ifNot || "");
  const [repeat, setRepeat] = useState(!!routineMode);
  const [days, setDays] = useState<number[]>(routine?.days || (date ? [weekday(date)] : [0, 1, 2, 3, 4]));
  const [error, setError] = useState("");
  const mx = multiplier(state);

  // start / finish / duration stay in sync: change one, the others follow
  const onStart = (v: string) => {
    setStart(v);
    // keep the length; the finish moves with the start (capped at midnight)
    if (v) setEnd(fmt(Math.min(1439, toMin(v) + (+dur || 30))));
  };
  // the finish can never be before the start: an earlier time is refused and explained
  const onEnd = (v: string) => {
    if (v && start && toMin(v) <= toMin(start)) {
      setError(`The finish has to be after the start (${start}).`);
      return;
    }
    setError("");
    setEnd(v);
    if (v && start) setDur(String(toMin(v) - toMin(start)));
  };
  const onDur = (v: string) => {
    setDur(v);
    if (v && +v > 0 && start) setEnd(fmt(toMin(start) + +v));
  };

  const isRoutine = repeat || !!routine;
  const inRoutineInstance = !!task?.routineId;

  function save(everyWeek = false) {
    if (!title.trim()) return setError("Give the block a name.");
    if (!start) return setError("Pick a start time.");
    if (hasEnd && end && toMin(end) <= toMin(start)) return setError(`The finish has to be after the start (${start}).`);
    if (isRoutine && !days.length) return setError("Pick at least one day for the routine.");
    const d = hasEnd ? Math.max(5, +dur || 30) : 30; // ongoing: 30 is only for drawing until it's finished
    const data = {
      title: title.trim(), start, dur: d, category,
      emoji: emoji || suggestEmoji(title.trim(), category, state),
      ongoing: hasEnd ? undefined : true,
      energy: energy === "none" ? undefined : energy,
      ifNot: ifNot.trim() || undefined,
    };
    update((s) => {
      if (isRoutine && !task) {
        if (routine) Object.assign(s.routines.find((r) => r.id === routine.id)!, data, { days });
        else s.routines.push({ id: uid(), ...data, days: [...days].sort(), since: date || today() });
      } else if (task && everyWeek && task.routineId) {
        // change the routine itself, so every week follows
        const r = s.routines.find((x) => x.id === task.routineId);
        if (r) Object.assign(r, data);
        const real = s.tasks.find((x) => x.id === task.id);
        if (real) Object.assign(real, data);
      } else if (task) {
        Object.assign(materialize(s, task), data);
      } else {
        s.tasks.push({ id: uid(), date: date!, status: "open", ...data });
      }
      if (fromNote) s.notes = s.notes.filter((n) => n.id !== fromNote);
    });
    toast(isRoutine && !task ? (routine ? "Routine updated." : `Routine added: ${days.map((x) => DAY_SHORT[x]).join(", ")}, every week.`)
      : everyWeek ? "Saved for every week." : inRoutineInstance ? "Saved for this day only." : "Saved.");
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
        <div className="titlerow">
          <button type="button" className="emojipill big" aria-label="Choose an emoji" onClick={() => setPicking(!picking)}>{emoji || suggestEmoji(title, category, state)}</button>
          <input id="b-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Gym, cook dinner, deep work…" autoFocus />
        </div>
        {picking && (
          <div className="emojigrid">
            <button type="button" className="emojibtn auto" aria-pressed={!emoji} onClick={() => { setEmoji(undefined); setPicking(false); }}>Auto</button>
            {EMOJI_PICKS.map((e) => <button key={e} type="button" className="emojibtn" aria-pressed={emoji === e} onClick={() => { setEmoji(e); setPicking(false); }}>{e}</button>)}
          </div>
        )}
      </div>

      <div className="field"><span>Category</span>
        <Chips options={categoriesOf(state).map((c) => ({ key: c.key, label: `${c.emoji} ${c.label}`, color: `var(--c-${c.key})` }))} value={category} onChange={setCategory} />
        <button type="button" className="linkbtn small" style={{ alignSelf: "flex-start", marginTop: 4 }} onClick={() => open({ type: "categories" })}>Edit categories</button></div>

      <div className="row">
        <div className="field"><label htmlFor="b-start">Start</label>
          <input id="b-start" type="time" value={start} onChange={(e) => onStart(e.target.value)} /></div>
        {hasEnd ? (
          <>
            <div className="field"><label htmlFor="b-end">Finish</label>
              <input id="b-end" type="time" value={end} min={start} onChange={(e) => onEnd(e.target.value)} /></div>
            <div className="field"><label htmlFor="b-dur">Minutes</label>
              <input id="b-dur" type="number" min="5" step="5" value={dur} placeholder="30" onChange={(e) => onDur(e.target.value)} /></div>
          </>
        ) : (
          <div className="field"><span>Finish</span>
            <button type="button" className="btn ongoingbtn" onClick={() => { setHasEnd(true); setEnd(fmt(Math.min(1439, toMin(start) + (+dur || 30)))); }}>+ Add a finish time</button></div>
        )}
      </div>
      {hasEnd
        ? <button type="button" className="linkbtn small" style={{ marginTop: 6 }} onClick={() => setHasEnd(false)}>No finish time (ongoing)</button>
        : <div className="hint">No finish time: it stays open until you tap ✓ to finish, and the real length is recorded.</div>}
      {mx && mx > 1.15 && <div className="hint">Your blocks usually take {mx.toFixed(1)}× what you plan.</div>}

      <div className="field"><span>Energy needed <span className="opt">optional</span></span>
        <Chips options={ENERGY_OPTS} value={energy} onChange={setEnergy} /></div>

      <div className="field"><label htmlFor="b-ifnot">If not… <span className="opt">your fallback on a bad day</span></label>
        <input id="b-ifnot" value={ifNot} onChange={(e) => setIfNot(e.target.value)} placeholder="20-minute walk" /></div>

      {!task && !routine && !routineMode && (
        <div className="field"><span>Repeat</span>
          <div className="seg" role="group">
            <button type="button" aria-pressed={!repeat} onClick={() => setRepeat(false)}>Just once</button>
            <button type="button" aria-pressed={repeat} onClick={() => setRepeat(true)}>Every week</button>
          </div>
        </div>
      )}
      {isRoutine && !task && (
        <div className="field"><span>Repeats on</span>
          <Chips multi options={DAY_SHORT.map((l, i) => ({ key: i, label: l }))} value={days}
            onChange={(i) => setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]))} /></div>
      )}
      {inRoutineInstance && <div className="hint">This block comes from a routine. Save the change for this day only, or for every week.</div>}
      {error && <div className="error" role="alert">{error}</div>}

      <div className="actions">
        {(task || routine) && <button className="btn ghost" onClick={remove}>{routine ? "Delete routine" : inRoutineInstance ? "Skip this day" : "Delete"}</button>}
        <span className="spacer" />
        {inRoutineInstance ? (
          <>
            <button className="btn" onClick={() => save(false)}>This day only</button>
            <button className="btn primary" onClick={() => save(true)}>Every week</button>
          </>
        ) : (
          <>
            <button className="btn" onClick={close}>Cancel</button>
            <button className="btn primary" onClick={() => save()}>Save</button>
          </>
        )}
      </div>
    </Sheet>
  );
}
