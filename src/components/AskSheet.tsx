import { useApp } from "../ctx";
import type { Task } from "../types";
import { materialize } from "../lib/plan";
import { scoreRules } from "../lib/actions";
import { syncActuals } from "../lib/actuals";
import { Sheet } from "./Sheet";

/**
 * The one-tap question behind a notification: "On it?" or "Done?".
 * Yes is a single tap and closes; only "no" leads to logging what happened instead.
 */
export function AskSheet({ task, kind }: { task: Task; kind: string }) {
  const { update, close, open, toast, celebrate, now } = useApp();
  const ended = kind === "end";

  const onIt = () => {
    update((s) => { const t = materialize(s, task); (t.checks ||= []).push({ at: now, on: true }); });
    close();
    toast("Logged. Back to it.");
  };
  const done = () => {
    update((s) => { const t = materialize(s, task); t.status = "done"; scoreRules(s, t, true); syncActuals(s, t); });
    celebrate();
    close();
  };

  return (
    <Sheet onClose={close} title={ended ? `How did ${task.title} go?` : kind === "start" ? `Starting ${task.title}?` : `Still on ${task.title}?`}
      sub={ended ? "One tap and you're done." : "One tap. Only if not, tell us what you're doing instead."}>
      <div className="askbtns">
        {ended ? (
          <>
            <button className="btn primary big" onClick={done}>Done</button>
            <button className="btn big" onClick={() => open({ type: "miss", task, partial: true })}>Partly</button>
            <button className="btn big" onClick={() => open({ type: "miss", task })}>Not done</button>
          </>
        ) : (
          <>
            <button className="btn primary big" onClick={onIt}>Yes, I'm on it</button>
            <button className="btn big" onClick={() => open({ type: "check", task })}>No, something else</button>
          </>
        )}
      </div>
    </Sheet>
  );
}
