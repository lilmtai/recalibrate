import { useState } from "react";
import { useApp } from "../ctx";
import { CATEGORIES } from "../constants";
import type { CategoryKey, FreeItem } from "../types";
import { addDays, longDate, today, uid } from "../lib/time";
import { everyLabel } from "../lib/plan";
import { freeDone, freeLater } from "../lib/actions";
import { Chips, Sheet } from "./Sheet";

const EVERY: { key: number; label: string }[] = [
  { key: 0, label: "Just once" }, { key: 7, label: "Every week" }, { key: 14, label: "Every 2 weeks" },
  { key: 30, label: "Every month" }, { key: 90, label: "Every 3 months" }, { key: -1, label: "Custom" },
];

/** Add or edit a free block: no set time, comes back every N days, reminds you when due. */
export function FreeSheet({ item }: { item?: FreeItem }) {
  const { update, close, toast } = useApp();
  const preset = item ? (EVERY.some((e) => e.key === item.everyDays) ? item.everyDays : -1) : 14;
  const [title, setTitle] = useState(item?.title || "");
  const [category, setCategory] = useState<CategoryKey>(item?.category || "me");
  const [every, setEvery] = useState<number>(preset);
  const [custom, setCustom] = useState(String(item && preset === -1 ? item.everyDays : 10));
  const [due, setDue] = useState(item?.nextDue || today());
  const [remindAt, setRemindAt] = useState(item?.remindAt || "10:00");
  const [error, setError] = useState("");

  const save = () => {
    if (!title.trim()) return setError("Give it a name, like Barbershop.");
    const everyDays = every === -1 ? Math.max(1, Math.round(+custom || 0)) : every;
    const data = { title: title.trim(), category, everyDays, nextDue: due || today(), remindAt: remindAt || "10:00" };
    update((s) => {
      if (item) Object.assign(s.free.find((f) => f.id === item.id)!, data);
      else s.free.push({ id: uid(), ...data });
    });
    const n = new Date();
    const passed = data.nextDue === today() && data.remindAt <= `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
    toast(item ? "Saved." : passed ? "Added. It's on today's to-dos; if it's still open, you'll get a reminder tomorrow."
      : `Added. You'll be reminded ${data.nextDue === today() ? "today" : longDate(data.nextDue)} at ${data.remindAt}.`);
    close();
  };
  const remove = () => { update((s) => { s.free = s.free.filter((f) => f.id !== item!.id); }); close(); };

  return (
    <Sheet title={item ? "Edit free block" : "New free block"} sub="No set time. It shows up on your to-dos when it's due, and reminds you." onClose={close}>
      <div className="field"><label htmlFor="f-title">What</label>
        <input id="f-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Barbershop" autoFocus={!item} /></div>
      <div className="field"><span>How often</span>
        <Chips options={EVERY} value={every} onChange={setEvery} />
        {every === -1 && (
          <div className="row" style={{ alignItems: "center", marginTop: 6 }}>
            <span>Every</span>
            <input id="f-custom" type="number" min={1} value={custom} onChange={(e) => setCustom(e.target.value)} style={{ width: 80 }} aria-label="Number of days" />
            <span>days</span>
          </div>
        )}
      </div>
      <div className="row">
        <div className="field"><label htmlFor="f-due">{item ? "Next due" : "First due"}</label>
          <input id="f-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
        <div className="field"><label htmlFor="f-at">Remind me at</label>
          <input id="f-at" type="time" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} /></div>
      </div>
      <div className="field"><span>Area</span>
        <Chips options={CATEGORIES.map((c) => ({ key: c.key, label: c.label, color: `var(--c-${c.key})` }))} value={category} onChange={setCategory} /></div>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="actions">
        {item && <button className="btn ghost" onClick={remove}>Delete</button>}
        <span className="spacer" />
        <button className="btn" onClick={close}>Cancel</button>
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Sheet>
  );
}

/** "Barbershop is due": Done brings it back after its interval; Tomorrow snoozes. */
export function FreeDueSheet({ id }: { id: string }) {
  const { state, update, close, open, celebrate } = useApp();
  const f = state.free.find((x) => x.id === id);
  if (!f) return null;
  const done = () => { update((s) => freeDone(s, f.id, today())); celebrate(); close(); };
  const later = () => { update((s) => freeLater(s, f.id, today())); close(); };
  return (
    <Sheet title={`${f.title} is due`} sub={f.everyDays ? `Every ${everyLabel(f.everyDays)}. Next time after this: ${longDate(addDays(today(), f.everyDays))}.` : "One-off."} onClose={close}>
      <div className="askbtns">
        <button className="btn primary big" onClick={done}>Done</button>
        <button className="btn big" onClick={later}>Tomorrow</button>
        <button className="btn ghost" onClick={() => open({ type: "free", item: f })}>Edit</button>
      </div>
    </Sheet>
  );
}
