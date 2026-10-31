import { useState } from "react";
import { useApp } from "../ctx";
import { DAY_SHORT, addDays, today, weekday } from "../lib/time";
import { notesToReview } from "../lib/plan";
import { Sheet } from "./Sheet";

/** Unfinished to-dos from earlier days: decide each one (today, another day, drop). Nothing moves by itself. */
export function ReviewSheet() {
  const { state, update, close, toast } = useApp();
  const items = notesToReview(state, today());
  const [picking, setPicking] = useState<string | null>(null);
  const move = (id: string, date: string) => update((s) => { const n = s.notes.find((x) => x.id === id); if (n) n.date = date; });
  const drop = (id: string) => update((s) => { s.notes = s.notes.filter((x) => x.id !== id); });
  const allToday = () => { update((s) => { for (const n of s.notes) if (!n.done && n.date < today()) n.date = today(); }); toast("All kept for today."); close(); };

  if (!items.length) {
    return (
      <Sheet title="All reviewed" sub="Nothing left from earlier days." onClose={close}>
        <div className="actions"><button className="btn primary" onClick={close}>Done</button></div>
      </Sheet>
    );
  }
  return (
    <Sheet title="Unfinished from before" sub="Decide each one. Nothing moves on its own." onClose={close}>
      <ul className="reviewlist">
        {items.map((n) => (
          <li key={n.id}>
            <div className="grow"><b>{n.text}</b><span className="small muted"> · from {DAY_SHORT[weekday(n.date)]} {n.date.slice(8)}</span></div>
            {picking === n.id ? (
              <input type="date" aria-label={`New day for ${n.text}`} min={today()} defaultValue={addDays(today(), 1)}
                onChange={(e) => { if (e.target.value) { move(n.id, e.target.value); setPicking(null); } }} />
            ) : (
              <div className="row tight">
                <button className="btn small primary" onClick={() => move(n.id, today())}>Today</button>
                <button className="btn small" onClick={() => setPicking(n.id)}>Pick a day</button>
                <button className="btn small ghost" onClick={() => drop(n.id)}>Drop</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="actions">
        <button className="btn ghost" onClick={allToday}>Keep all for today</button>
      </div>
    </Sheet>
  );
}
