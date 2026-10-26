import { useApp } from "../ctx";
import { CAT_LABEL, ENERGY_LABEL, INSTEAD_LABEL } from "../constants";
import type { Task } from "../types";
import { addDays, fmt, toMin, uid } from "../lib/time";
import { materialize, remindLabel, rulesFor } from "../lib/plan";
import { scoreRules } from "../lib/actions";
import { syncActuals } from "../lib/actuals";
import { Sheet } from "./Sheet";

const STATUS_LABEL = { done: "done", partial: "partly done", ifnot: "'if not' version", missed: "missed", open: "", skipped: "" };

export function LogSheet({ task }: { task: Task }) {
  const { state, update, open, close, toast } = useApp();
  const rules = rulesFor(state, task.title);

  const mark = (status: "done" | "ifnot") => {
    let id = "";
    update((s) => {
      const t = materialize(s, task);
      t.status = status;
      scoreRules(s, t, true);
      syncActuals(s, t);
      id = t.id;
    });
    if (status === "done") setTimeout(() => open({ type: "actual", taskId: id, planned: task.dur }));
    else { close(); toast("The 'if not' version counts. Momentum kept."); }
  };
  const tomorrow = () => {
    update((s) => {
      const t = materialize(s, task);
      s.tasks.push({ ...t, id: uid(), date: addDays(t.date, 1), status: "open", barrier: undefined, actual: undefined, routineId: undefined });
      if (t.status === "open") t.status = "skipped";
    });
    close();
    toast(`Moved to tomorrow at ${task.start}.`);
  };
  const reset = () => {
    update((s) => {
      const t = materialize(s, task);
      t.status = "open";
      t.barrier = undefined;
      t.actual = undefined;
      t.instead = undefined;
      t.share = undefined;
      syncActuals(s, t);
    });
    close();
  };

  const meta = [`${task.start}–${fmt(toMin(task.start) + task.dur)}`, CAT_LABEL[task.category], task.energy && `${ENERGY_LABEL[task.energy]} energy`, task.routineId && "Routine"]
    .filter(Boolean).join(" · ");
  return (
    <Sheet title={task.title} onClose={close}
      sub={<>{meta}{task.status !== "open" && <> · logged as {STATUS_LABEL[task.status]}</>}</>}>
      {rules.length > 0 && (
        <div className="banner calm" style={{ marginTop: 14 }}>
          <b>Your rule{rules.length > 1 ? "s" : ""}:</b>
          <span>{rules.map((r) => `${r.fix} (${remindLabel(r.remind)})`).join("; ")}</span>
        </div>
      )}
      {task.instead && task.instead.what.length > 0 && (
        <div className="hint">Time went to: {task.instead.what.map((k) => INSTEAD_LABEL[k].toLowerCase()).join(", ")}{task.instead.note ? ` (${task.instead.note})` : ""}</div>
      )}
      <div className="field">How did it go?</div>
      <div className="fixes">
        <button className="pick" onClick={() => mark("done")}>Done</button>
        <button className="pick" onClick={() => open({ type: "miss", task, partial: true })}>Partly done</button>
        <button className="pick" onClick={() => mark("ifnot")}>Did the "if not" version{task.ifNot ? `: ${task.ifNot}` : ""}</button>
        <button className="pick" onClick={() => open({ type: "miss", task })}>Didn't happen</button>
      </div>
      <div className="actions">
        <button className="btn ghost" onClick={tomorrow}>Move to tomorrow</button>
        <span className="spacer" />
        {task.status !== "open" && <button className="btn ghost" onClick={reset}>Reset</button>}
        <button className="btn" onClick={() => open({ type: "block", date: task.date, task })}>Edit</button>
      </div>
    </Sheet>
  );
}

export function ActualSheet({ taskId, planned }: { taskId: string; planned: number }) {
  const { update, close, toast } = useApp();
  const set = (n: number) => {
    update((s) => { const t = s.tasks.find((x) => x.id === taskId); if (t) { t.actual = n; syncActuals(s, t); } });
    close();
    toast("Logged.");
  };
  return (
    <Sheet title="Nice. How long did it take?" sub={`You planned ${planned} min. This trains your time estimates.`} onClose={close}>
      <div className="chips" style={{ marginTop: 14 }}>
        {[0.5, 1, 1.5, 2].map((f) => (
          <button key={f} className="pick" onClick={() => set(Math.round(planned * f))}>{f === 1 ? "As planned" : `${Math.round(planned * f)} min`}</button>
        ))}
      </div>
      <div className="actions"><button className="btn ghost" onClick={close}>Skip</button></div>
    </Sheet>
  );
}
