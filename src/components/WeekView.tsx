import type { CSSProperties } from "react";
import { useApp } from "../ctx";
import { CATEGORIES } from "../constants";
import type { CategoryKey } from "../types";
import { addDays, DAY_SHORT, fmt, fmtDur, norm, parseKey, today, uid, weekStart } from "../lib/time";
import { cuesFor, tasksFor } from "../lib/plan";

export function WeekView() {
  const { state, update, date, setDate, setTab, open, toast } = useApp();
  const start = weekStart(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const perDay = days.map((d) => tasksFor(state, d));

  const hours: Record<CategoryKey, number> = { work: 0, health: 0, social: 0, side: 0, me: 0 };
  perDay.flat().forEach((t) => (hours[t.category] += t.dur));
  const total = Object.values(hours).reduce((a, b) => a + b, 0);

  const copyLastWeek = () => {
    let n = 0;
    update((s) => {
      for (let i = 0; i < 7; i++) {
        const from = addDays(start, i - 7), to = addDays(start, i);
        for (const t of s.tasks.filter((x) => x.date === from && !x.routineId && x.status !== "skipped")) {
          if (s.tasks.some((x) => x.date === to && norm(x.title) === norm(t.title))) continue;
          s.tasks.push({ ...t, id: uid(), date: to, status: "open", actual: undefined, barrier: undefined, note: undefined, ex: undefined });
          n++;
        }
      }
    });
    toast(n ? `Copied ${n} block${n > 1 ? "s" : ""} from last week.` : "Nothing new to copy from last week.");
  };

  const label = `${parseKey(start).toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${parseKey(days[6]).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  return (
    <>
      <div className="daynav">
        <button className="btn ghost small" onClick={() => setDate(addDays(date, -7))} aria-label="Previous week">‹</button>
        <span className="weeklabel">{label}</span>
        <button className="btn ghost small" onClick={() => setDate(addDays(date, 7))} aria-label="Next week">›</button>
        {weekStart(today()) !== start && <button className="btn small" onClick={() => setDate(today())}>This week</button>}
        <span className="spacer" />
        <button className="btn small" onClick={copyLastWeek}>Copy last week's blocks</button>
        <button className="btn small" onClick={() => open({ type: "routine" })}>Add routine</button>
      </div>

      <div className="card balance">
        <div className="sechead"><h2>Week balance</h2><span className="small muted">{fmtDur(total)} planned</span></div>
        <div className="stack" role="img" aria-label="Planned time per category">
          {CATEGORIES.filter((c) => hours[c.key]).map((c) => (
            <i key={c.key} style={{ width: `${(hours[c.key] / total) * 100}%`, background: `var(--c-${c.key})` }} />
          ))}
        </div>
        <div className="legend">
          {CATEGORIES.map((c) => (
            <span key={c.key}><span className="swatch" style={{ "--c": `var(--c-${c.key})` } as CSSProperties} />{c.label} <b>{fmtDur(hours[c.key])}</b></span>
          ))}
        </div>
      </div>

      <div className="weekscroll">
        <div className="week">
          {days.map((d, i) => {
            const fixes = cuesFor(state, d).filter((c) => c.kind === "fix");
            return (
              <div key={d} className={`wday ${d === today() ? "today" : ""} ${d < today() ? "past" : ""}`}>
                <button className="whead" onClick={() => { setDate(d); setTab("day"); }}>
                  <span>{DAY_SHORT[i]}</span><b>{parseKey(d).getDate()}</b>
                </button>
                <div className="witems">
                  {perDay[i].map((t) => (
                    <button key={t.id} className={`witem s-${t.status}`} style={{ "--c": `var(--c-${t.category})` } as CSSProperties}
                      onClick={() => open(d <= today() ? { type: "log", task: t } : { type: "block", date: d, task: t })}>
                      <span className="time">{t.start}</span>
                      <span className="wt">{t.routineId && <span className="rt">↻</span>}{t.title}</span>
                    </button>
                  ))}
                  {fixes.length > 0 && (
                    <div className="wcue" title={fixes.map((c) => `${fmt(c.at)} ${c.text}`).join("\n")}>
                      {fixes.length} reminder{fixes.length > 1 ? "s" : ""} · first {fmt(fixes[0].at)}
                    </div>
                  )}
                </div>
                <button className="btn ghost small wadd" onClick={() => open({ type: "block", date: d })}>+ Add</button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
