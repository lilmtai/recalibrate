import type { CSSProperties } from "react";
import { useApp } from "../ctx";
import { CAT_LABEL } from "../constants";
import { DAY_SHORT, fmt, toMin } from "../lib/time";

export function RoutinesView() {
  const { state, open } = useApp();
  const routines = [...state.routines].sort((a, b) => a.start.localeCompare(b.start));
  return (
    <>
      <div className="sechead" style={{ marginTop: 16 }}>
        <p className="intro">Routines are sticky blocks. They appear on your calendar on the days you choose, so training, deep work or a wind-down never has to be planned twice.</p>
        <button className="btn primary small" onClick={() => open({ type: "routine" })}>Add routine</button>
      </div>
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
    </>
  );
}
