import { useState } from "react";
import { useApp } from "../ctx";
import { BARRIERS, LEADS, SUGGESTED_FIXES } from "../constants";
import type { BarrierKey, Remind, Rule, Task } from "../types";
import { addDays, norm, today, uid } from "../lib/time";
import { materialize, remindLabel } from "../lib/plan";
import { scoreRules } from "../lib/actions";
import { Chips, Sheet } from "./Sheet";

const sameRemind = (a: Remind, b: Remind) => JSON.stringify(a) === JSON.stringify(b);

/** Log a missed block and turn the reason into a rule, or edit an existing rule. */
export function MissSheet({ task, rule }: { task?: Task; rule?: Rule }) {
  const { update, close, toast } = useApp();
  const [barrier, setBarrier] = useState<BarrierKey | undefined>(rule?.barrier);
  const [note, setNote] = useState("");
  const [fix, setFix] = useState(rule?.fix || "");
  const [remind, setRemind] = useState<Remind>(rule?.remind || { kind: "before", lead: 60 });
  const [match, setMatch] = useState(rule?.match || norm(task?.title || "").split(" ")[0]);

  const suggestions = barrier ? SUGGESTED_FIXES[barrier] : [];

  function save(withFix: boolean) {
    if (rule) {
      if (!fix.trim()) return;
      update((s) => Object.assign(s.rules.find((r) => r.id === rule.id)!, { fix: fix.trim(), remind, match: match.trim() || rule.match, barrier: barrier || rule.barrier }));
      toast("Rule updated.");
      return close();
    }
    if (!task || !barrier) return;
    const addRule = withFix && fix.trim();
    update((s) => {
      const t = materialize(s, task);
      t.status = "missed";
      t.barrier = barrier;
      t.note = note.trim() || undefined;
      scoreRules(s, t, false);
      if (addRule && !s.rules.some((r) => norm(r.match) === norm(match) && norm(r.fix) === norm(fix))) {
        s.rules.push({ id: uid(), match: match.trim() || norm(task.title), barrier, fix: fix.trim(), remind, created: addDays(today(), 1), wins: 0, fails: 0 });
      }
    });
    toast(addRule ? `Rule added. You'll get a reminder ${remindLabel(remind)}.` : "Logged.");
    close();
  }

  return (
    <Sheet onClose={close} title={rule ? "Edit rule" : "What got in the way?"}
      sub={rule ? "Change the fix, or when the reminder fires." : "No judgement. This is data. Pick the closest reason, then set one fix for next time."}>
      {!rule && (
        <>
          <Chips options={BARRIERS.map((b) => ({ key: b.key, label: b.label }))} value={barrier} onChange={setBarrier} />
          <div className="field"><label htmlFor="m-note">Detail <span className="opt">optional</span></label>
            <input id="m-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Big lunch at 2pm, felt heavy" /></div>
        </>
      )}

      {(barrier || rule) && (
        <>
          <div className="field"><label htmlFor="m-fix">Your fix for next time</label>
            <input id="m-fix" value={fix} onChange={(e) => setFix(e.target.value)} placeholder="Set an alarm for tomorrow" /></div>

          {suggestions.length > 0 && (
            <div className="field"><span>Or pick a suggestion</span>
              <div className="fixes">
                {suggestions.map((sg) => (
                  <button key={sg.fix} className="pick" aria-pressed={fix === sg.fix && sameRemind(remind, sg.remind)}
                    onClick={() => { setFix(sg.fix); setRemind(sg.remind); }}>
                    {sg.fix} <span className="muted small">· {remindLabel(sg.remind)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="field"><span>Remind me</span>
            <div className="seg" role="group">
              <button type="button" aria-pressed={remind.kind === "before"} onClick={() => setRemind({ kind: "before", lead: 60 })}>Before the block</button>
              <button type="button" aria-pressed={remind.kind === "at"} onClick={() => setRemind({ kind: "at", time: "21:00", dayBefore: true })}>At a set time</button>
            </div>
          </div>
          {remind.kind === "before" ? (
            <div className="field"><label htmlFor="m-lead">How long before</label>
              <select id="m-lead" value={remind.lead} onChange={(e) => setRemind({ kind: "before", lead: +e.target.value })}>
                {LEADS.map((l) => <option key={l} value={l}>{remindLabel({ kind: "before", lead: l })}</option>)}
              </select></div>
          ) : (
            <div className="row">
              <div className="field"><label htmlFor="m-time">Time</label>
                <input id="m-time" type="time" value={remind.time} onChange={(e) => setRemind({ ...remind, time: e.target.value })} /></div>
              <div className="field"><label htmlFor="m-day">Day</label>
                <select id="m-day" value={remind.dayBefore ? "before" : "same"} onChange={(e) => setRemind({ ...remind, dayBefore: e.target.value === "before" })}>
                  <option value="before">The night before</option>
                  <option value="same">The same day</option>
                </select></div>
            </div>
          )}

          <div className="field"><label htmlFor="m-match">Applies to blocks containing</label>
            <input id="m-match" value={match} onChange={(e) => setMatch(e.target.value)} /></div>
        </>
      )}

      <div className="actions">
        {!rule && <button className="btn ghost" disabled={!barrier} onClick={() => save(false)}>Log without a fix</button>}
        <span className="spacer" />
        <button className="btn" onClick={close}>Cancel</button>
        <button className="btn primary" disabled={!(barrier || rule) || !fix.trim()} onClick={() => save(true)}>{rule ? "Save rule" : "Save fix"}</button>
      </div>
    </Sheet>
  );
}
