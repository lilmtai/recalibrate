import { useState } from "react";
import { useApp } from "../ctx";
import { BARRIERS } from "../constants";
import type { BarrierKey, Task } from "../types";
import { materialize } from "../lib/plan";
import { scoreRules } from "../lib/actions";
import { syncActuals } from "../lib/actuals";
import { Sheet } from "./Sheet";

/**
 * "Didn't happen", in one tap: pick the reason and it's logged.
 * Details (what you did instead, a fix for next time) are offered after, never required.
 */
export function WhySheet({ task }: { task: Task }) {
  const { update, close, open } = useApp();
  const [saved, setSaved] = useState<BarrierKey | "none" | null>(null);

  const log = (b: BarrierKey | "none") => {
    update((s) => {
      const t = materialize(s, task);
      t.status = "missed";
      t.barrier = b === "none" ? undefined : b;
      scoreRules(s, t, false);
      syncActuals(s, t);
    });
    setSaved(b);
  };

  if (saved) {
    return (
      <Sheet title="Logged. No judgement." sub="That's all you need. Want to add more? Totally optional." onClose={close}>
        <div className="askbtns">
          <button className="btn big" onClick={() => open({ type: "miss", task, barrier: saved === "none" ? undefined : saved })}>Add a fix for next time</button>
          <button className="btn big" onClick={() => open({ type: "miss", task, barrier: saved === "none" ? undefined : saved })}>Note what I did instead</button>
          <button className="btn primary big" onClick={close}>Done</button>
        </div>
      </Sheet>
    );
  }
  return (
    <Sheet title={`What got in the way of ${task.title}?`} sub="One tap logs it." onClose={close}>
      <div className="whygrid">
        {BARRIERS.map((b) => <button key={b.key} className="whybtn" onClick={() => log(b.key)}>{b.label}</button>)}
        <button className="whybtn quiet" onClick={() => log("none")}>Not sure / skip</button>
      </div>
    </Sheet>
  );
}
