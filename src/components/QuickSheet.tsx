import { useState } from "react";
import { useApp } from "../ctx";
import { nowMin, today, uid } from "../lib/time";
import { Icon, type IconName } from "./Icon";
import { Sheet } from "./Sheet";

/** The + button: one place to add anything. */
export function QuickSheet() {
  const { update, open, close, date, toast } = useApp();
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
    { icon: "mic", title: "Tell me about your day", sub: "Talk or type it; I turn it into your log", run: () => open({ type: "voice", date: today() }) },
    { icon: "block", title: "Plan a block", sub: "Something with a time slot", run: () => open({ type: "block", date }) },
    { icon: "play", title: "What I'm doing right now", sub: "Log it in one tap", run: () => open({ type: "wyd", date: today() }) },
    { icon: "pen", title: "Log something I did", sub: "Kept for your patterns", run: () => open({ type: "entry", date: today(), start: Math.max(0, n - 30), end: n }) },
    { icon: "repeat", title: "New routine", sub: "Same time on the days you pick", run: () => open({ type: "routine" }) },
    { icon: "sparkle", title: "Free block", sub: "No set time, comes back every few weeks (barbershop…)", run: () => open({ type: "free" }) },
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
