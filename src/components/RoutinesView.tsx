import type { CSSProperties } from "react";
import { useApp } from "../ctx";
import { CAT_LABEL } from "../constants";
import { DAY_SHORT, fmt, longDate, toMin, today } from "../lib/time";
import { everyLabel } from "../lib/plan";

export function RoutinesView() {
  const { state, open } = useApp();
  const routines = [...state.routines].sort((a, b) => a.start.localeCompare(b.start));
  return (
    <>
      <div className="sechead">
        <h2>Routines</h2>
        <button className="btn primary small" onClick={() => open({ type: "routine" })}>Add routine</button>
      </div>
      <p className="intro" style={{ marginTop: 0, marginBottom: 4 }}>Sticky blocks that appear on the days you choose, so training or deep work never has to be planned twice.</p>
      {!routines.length ? (
        <div className="card empty"><div className="what">No routines yet</div><div>Add things you do on a set rhythm, like training on Mon/Wed/Fri at 18:00.</div></div>
      ) : (
        <div className="rules">
          {routines.map((r) => (
            <button key={r.id} className="card rule routine" style={{ "--c": `var(--c-${r.category})` } as CSSProperties} onClick={() => open({ type: "routine", routine: r })}>
              <div className="if"><span className="swatch" />{CAT_LABEL[r.category]} · {r.start}–{fmt(toMin(r.start) + r.dur)}</div>
              <div className="then">{r.title}</div>
              <div className="daydots">{DAY_SHORT.map((d, i) => <span key={d} className={r.days.includes(i) ? "on" : ""}>{d[0]}</span>)}</div>
              {r.ifNot && <div className="small muted" style={{ marginTop: 8 }}>If not: {r.ifNot}</div>}
            </button>
          ))}
        </div>
      )}
    <div className="sechead" style={{ marginTop: 26 }}>
        <h2>Free blocks</h2>
        <button className="btn small" onClick={() => open({ type: "free" })}>Add free block</button>
      </div>
      <p className="intro" style={{ marginTop: 0, marginBottom: 4 }}>No set time. They show up on your to-dos when due and remind you, like the barbershop every 2 weeks.</p>
      {!state.free.length ? (
        <div className="card empty" style={{ padding: 24 }}><div>Nothing yet. Try “Barbershop · every 2 weeks”.</div></div>
      ) : (
        <div className="rules">
          {[...state.free].sort((a, b) => a.nextDue.localeCompare(b.nextDue)).map((f) => (
            <button key={f.id} className="card rule routine" style={{ "--c": `var(--c-${f.category})` } as CSSProperties} onClick={() => open({ type: "free", item: f })}>
              <div className="if"><span className="swatch" />{f.everyDays ? `Every ${everyLabel(f.everyDays)}` : "Once"} · reminder {f.remindAt}</div>
              <div className="then">{f.title}</div>
              <div className="small muted">{f.nextDue <= today() ? (f.nextDue < today() ? "Overdue" : "Due today") : `Next: ${longDate(f.nextDue)}`}</div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
