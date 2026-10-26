import { useApp } from "../ctx";
import { BARRIER_LABEL } from "../constants";
import { remindLabel } from "../lib/plan";

export function PlaybookView() {
  const { state, update, open } = useApp();
  return (
    <>
      <p className="intro">Each rule comes from a miss. When a block's name contains the trigger word, the fix becomes a reminder. Rules that keep failing get flagged so you can swap the fix.</p>
      {!state.rules.length ? (
        <div className="card empty" style={{ marginTop: 16 }}><div className="what">No rules yet</div><div>Mark a block as “Didn't happen” and set a fix. It lands here.</div></div>
      ) : (
        <div className="rules">
          {state.rules.map((r) => {
            const tries = r.wins + r.fails;
            const chip = tries === 0 ? <span className="chip">Not tested yet</span>
              : r.fails >= 2 && r.fails > r.wins ? <span className="chip warn">Not working · {r.wins}/{tries}</span>
              : <span className="chip good">Worked {r.wins}/{tries}</span>;
            return (
              <div key={r.id} className="card rule">
                <div className="if">If <b>{r.match}</b> · after “{BARRIER_LABEL[r.barrier]}”</div>
                <div className="then">{r.fix}</div>
                <div className="foot"><span className="small muted">Reminder {remindLabel(r.remind)}</span>{chip}</div>
                <div className="actions" style={{ marginTop: 12 }}>
                  <button className="btn ghost small" onClick={() => update((s) => { s.rules = s.rules.filter((x) => x.id !== r.id); })}>Remove</button>
                  <button className="btn small" onClick={() => open({ type: "rule", rule: r })}>Edit</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
