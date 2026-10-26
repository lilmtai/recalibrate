import { useApp } from "../ctx";
import { BARRIER_LABEL, CATEGORIES } from "../constants";
import type { BarrierKey } from "../types";
import { norm } from "../lib/time";
import { multiplier, stats14 } from "../lib/stats";
import { loadExample } from "../example";

export function PatternsView() {
  const { state, update } = useApp();
  const s = stats14(state);
  const mx = multiplier(state);
  if (s.ts.length < 3) {
    return (
      <div className="card empty" style={{ marginTop: 20 }}>
        <div className="what">Not enough data yet</div>
        <div>Log a few days of blocks (done, “if not” version or missed) and patterns show up here.</div>
        <div className="row center"><button className="btn" onClick={() => update(loadExample)}>Load an example week</button></div>
      </div>
    );
  }
  const insights: string[] = [];
  const worst = Object.entries(s.byTask).filter(([, v]) => v.miss >= 2).sort((a, b) => b[1].miss - a[1].miss)[0];
  if (worst) {
    const tb = Object.entries(worst[1].b).sort((a, b) => b[1] - a[1])[0];
    const hasRule = state.rules.some((r) => norm(worst[0]).includes(norm(r.match)));
    insights.push(`You missed **${worst[0]}** ${worst[1].miss} of ${worst[1].n} times${tb ? `, mostly from **${BARRIER_LABEL[tb[0] as BarrierKey].toLowerCase()}**` : ""}. ${hasRule ? "A rule is in place; watch whether it holds." : "Set a fix next time you log it."}`);
  }
  if (s.shortSleep != null && s.goodSleep != null && s.goodSleep - s.shortSleep >= 15)
    insights.push(`After under 6 h of sleep you follow through **${s.shortSleep}%** of the time, compared with **${s.goodSleep}%** otherwise. Sleep is a lever.`);
  if (s.byEnergy.low != null && s.byEnergy.high != null && s.byEnergy.high - s.byEnergy.low >= 15)
    insights.push(`Low-energy days drop you to **${s.byEnergy.low}%**. Plan those days around “if not” versions.`);
  const cats = CATEGORIES.filter((c) => s.byCategory[c.key] != null).sort((a, b) => s.byCategory[a.key]! - s.byCategory[b.key]!);
  if (cats.length >= 2 && s.byCategory[cats[cats.length - 1].key]! - s.byCategory[cats[0].key]! >= 20)
    insights.push(`**${cats[0].label}** is your weakest area at **${s.byCategory[cats[0].key]}%**, while ${cats[cats.length - 1].label.toLowerCase()} sits at ${s.byCategory[cats[cats.length - 1].key]}%.`);
  const topB = Object.entries(s.barriers).sort((a, b) => b[1] - a[1])[0];
  if (topB && topB[1] >= 2) insights.push(`Your most common barrier is **${BARRIER_LABEL[topB[0] as BarrierKey].toLowerCase()}** (${topB[1]}×). Fix the system for that one first.`);
  if (mx && mx > 1.2) insights.push(`Blocks take **${mx.toFixed(1)}×** longer than you plan. Your 60-minute tasks are really ${Math.round(60 * mx)}-minute tasks.`);

  const bmax = Math.max(1, ...Object.values(s.barriers));
  return (
    <>
      <div className="stats">
        <div className="card stat"><div className="v">{s.rate}%</div><div className="k">Follow-through ({s.ts.length} blocks logged)</div></div>
        <div className="card stat"><div className="v">{s.ifNots}</div><div className="k">Saved by the “if not” version</div></div>
        <div className="card stat"><div className="v">{mx ? `${mx.toFixed(1)}×` : "—"}</div><div className="k">{mx ? "Actual time vs. planned" : "Log actual time on 3+ blocks to see this"}</div></div>
      </div>
      <div className="two">
        <div className="card"><h2>What the data says</h2>
          {insights.length ? insights.map((i) => (
            <div key={i} className="insight"><span className="dot" /><span dangerouslySetInnerHTML={{ __html: i.replace(/[<>&]/g, "").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>") }} /></div>
          )) : <div className="muted small">No strong patterns yet.</div>}
        </div>
        <div className="card">
          <h2>Why things didn't happen</h2>
          <div className="bars">
            {Object.entries(s.barriers).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
              <div key={k} className="hbar"><span>{BARRIER_LABEL[k as BarrierKey]}</span><span className="track"><i style={{ width: `${(n / bmax) * 100}%` }} /></span><span className="n">{n}</span></div>
            ))}
          </div>
          <h2 style={{ marginTop: 18 }}>Follow-through by area</h2>
          <div className="bars">
            {CATEGORIES.map((c) => (
              <div key={c.key} className="hbar"><span>{c.label}</span><span className="track"><i style={{ width: `${s.byCategory[c.key] ?? 0}%`, background: `var(--c-${c.key})` }} /></span><span className="n">{s.byCategory[c.key] == null ? "—" : `${s.byCategory[c.key]}%`}</span></div>
            ))}
          </div>
          <h2 style={{ marginTop: 18 }}>Follow-through by energy</h2>
          <div className="bars">
            {(["low", "steady", "high"] as const).map((e) => (
              <div key={e} className="hbar acc"><span>{e[0].toUpperCase() + e.slice(1)} energy</span><span className="track"><i style={{ width: `${s.byEnergy[e] ?? 0}%` }} /></span><span className="n">{s.byEnergy[e] == null ? "—" : `${s.byEnergy[e]}%`}</span></div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
