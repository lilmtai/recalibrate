import { useApp } from "../ctx";
import { addDays, DAY_SHORT, parseKey, today, weekStart } from "../lib/time";
import { Icon } from "./Icon";

/** Week strip: Mon–Sun of the selected day's week; tap a day, arrows change week. */
export function WeekStrip() {
  const { date, setDate } = useApp();
  const start = weekStart(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const month = parseKey(date).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return (
    <div className="weekstrip-wrap">
      <div className="weekstrip-head">
        <button className="btn ghost small" aria-label="Previous week" onClick={() => setDate(addDays(date, -7))}><Icon name="back" size={16} /></button>
        <span className="weekstrip-month">{month}</span>
        <button className="btn ghost small flip" aria-label="Next week" onClick={() => setDate(addDays(date, 7))}><Icon name="back" size={16} /></button>
        <span className="spacer" />
        {date !== today() && <button className="btn small" onClick={() => setDate(today())}>Today</button>}
      </div>
      <div className="weekstrip" role="tablist" aria-label="Day">
        {days.map((d, i) => (
          <button key={d} role="tab" aria-selected={d === date} className={`wsday ${d === today() ? "istoday" : ""} ${d < today() ? "past" : ""}`} onClick={() => setDate(d)}>
            <span>{DAY_SHORT[i][0]}</span>
            <b>{parseKey(d).getDate()}</b>
          </button>
        ))}
      </div>
    </div>
  );
}
