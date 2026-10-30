import { useState } from "react";
import { useApp } from "../ctx";
import { nowMin, today, uid } from "../lib/time";
import { Icon, type IconName } from "./Icon";
import { Sheet } from "./Sheet";

/** The + button: one place to add anything. */
export function QuickSheet() {
  const { update, open, close, date, setTab, toast } = useApp();
  const [todo, setTodo] = useState("");
  const addTodo = () => {
    const t = todo.trim();
    if (!t) return;
    update((s) => { s.notes.push({ id: uid(), date: date < today() ? today() : date, text: t, done: false }); });
    setTodo("");
    toast("Added to your to-dos.");
    close();
  };
  const n = nowMin();
  const opts: { icon: IconName; title: string; sub: string; run: () => void }[] = [
    { icon: "block", title: "Plan a block", sub: "Something with a time slot", run: () => open({ type: "block", date }) },
    { icon: "play", title: "What I'm doing right now", sub: "Start tracking it in one tap", run: () => { setTab("myday"); close(); } },
    { icon: "pen", title: "Log something I did", sub: "Add it to My day", run: () => open({ type: "entry", date: today(), start: Math.max(0, n - 30), end: n }) },
    { icon: "repeat", title: "New routine", sub: "Repeats on the days you pick", run: () => open({ type: "routine" }) },
  ];
  return (
    <Sheet title="Add" onClose={close}>
      <div className="field"><label htmlFor="q-todo">Quick to-do</label></div>
      <div className="quickadd">
        <input id="q-todo" value={todo} onChange={(e) => setTodo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTodo()}
          placeholder="Call the bank, buy protein bars…" autoFocus />
        <button className="btn primary" onClick={addTodo} disabled={!todo.trim()}>Add</button>
      </div>
      <div className="quick">
        {opts.map((o) => (
          <button key={o.title} onClick={o.run}>
            <span className="ic"><Icon name={o.icon} /></span>
            <span className="grow"><b>{o.title}</b><span className="small">{o.sub}</span></span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
