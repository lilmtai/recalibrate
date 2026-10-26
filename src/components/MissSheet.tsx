import { useState } from "react";
import { useApp } from "../ctx";
import { BARRIERS, INSTEAD, LEADS, SUGGESTED_FIXES } from "../constants";
import type { BarrierKey, InsteadKey, Remind, Rule, Task } from "../types";
import { addDays, norm, today, uid } from "../lib/time";
import { materialize, remindLabel } from "../lib/plan";
import { scoreRules } from "../lib/actions";
import { Chips, Sheet } from "./Sheet";

const sameRemind = (a: Remind, b: Remind) => JSON.stringify(a) === JSON.stringify(b);
const INSTEAD_OPTS = INSTEAD.map((i) => ({ key: i.key, label: i.label }));
const toggleIn = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

/**
 * Log a block that didn't (fully) happen: what filled the time, why, and an optional fix.
 * Also edits an existing rule when `rule` is passed.
 */
export function MissSheet({ task, rule, partial }: { task?: Task; rule?: Rule; partial?: boolean }) {
  const { update, close, toast } = useApp();
  const [share, setShare] = useState<number | undefined>(partial ? undefined : 0);
  const [instead, setInstead] = useState<InsteadKey[]>([]);
  const [insteadNote, setInsteadNote] = useState("");
  const [barrier, setBarrier] = useState<BarrierKey | undefined>(rule?.barrier);
  const [fix, setFix] = useState(rule?.fix || "");
  const [remind, setRemind] = useState<Remind>(rule?.remind || { kind: "before", lead: 60 });
  const [match, setMatch] = useState(rule?.match || norm(task?.title || "").split(" ")[0]);

  const suggestions = barrier ? SUGGESTED_FIXES[barrier] : [];
  const canSave = rule ? !!fix.trim() : partial ? share !== undefined : instead.length > 0 || !!barrier;

  function save() {
    if (rule) {
      update((s) => Object.assign(s.rules.find((r) => r.id === rule.id)!, { fix: fix.trim(), remind, match: match.trim() || rule.match, barrier: barrier || rule.barrier }));
      toast("Rule updated.");
      return close();
    }
    if (!task || !canSave) return;
    const addRule = !!(barrier && fix.trim());
    update((s) => {
      const t = materialize(s, task);
      t.status = partial ? "partial" : "missed";
      t.share = partial ? share : undefined;
      t.barrier = barrier;
      t.instead = instead.length || insteadNote.trim() ? { what: instead, note: insteadNote.trim() || undefined } : undefined;
      scoreRules(s, t, !!partial);
      if (addRule && !s.rules.some((r) => norm(r.match) === norm(match) && norm(r.fix) === norm(fix))) {
        s.rules.push({ id: uid(), match: match.trim() || norm(task.title), barrier: barrier!, fix: fix.trim(), remind, created: addDays(today(), 1), wins: 0, fails: 0 });
      }
    });
    toast(addRule ? `Logged. Rule added: reminder ${remindLabel(remind)}.` : "Logged. This feeds your patterns.");
    close();
  }

  if (rule) {
    return (
      <Sheet onClose={close} title="Edit rule" sub="Change the fix, or when the reminder fires.">
        <FixFields {...{ fix, setFix, remind, setRemind, match, setMatch, suggestions: SUGGESTED_FIXES[rule.barrier] }} />
        <div className="actions">
          <button className="btn" onClick={close}>Cancel</button>
          <button className="btn primary" disabled={!canSave} onClick={save}>Save rule</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={close} title={partial ? "Partly done" : "What happened instead?"}
      sub={partial ? "Quick log. Tap what fits; everything is optional except how much you did." : "No judgement. One tap is enough. This shows where your time really goes."}>
      {partial && (
        <div className="field"><span>How much did you get done?</span>
          <Chips options={[{ key: 0.25, label: "About a quarter" }, { key: 0.5, label: "About half" }, { key: 0.75, label: "Most of it" }]} value={share} onChange={setShare} />
        </div>
      )}

      <div className="field"><span>{partial ? "What took the rest of the time?" : "What did you do during that time?"}</span>
        <Chips multi options={INSTEAD_OPTS} value={instead} onChange={(k) => setInstead((a) => toggleIn(a, k))} />
        <input id="m-instead" value={insteadNote} onChange={(e) => setInsteadNote(e.target.value)} placeholder="Anything to add? (optional)" aria-label="Details" />
      </div>

      <div className="field"><span>What got in the way? <span className="opt">optional</span></span>
        <Chips options={BARRIERS.map((b) => ({ key: b.key, label: b.label }))} value={barrier} onChange={(b) => setBarrier(barrier === b ? undefined : b)} />
      </div>

      {barrier && <FixFields {...{ fix, setFix, remind, setRemind, match, setMatch, suggestions }} optional />}

      <div className="actions">
        <span className="spacer" />
        <button className="btn" onClick={close}>Cancel</button>
        <button className="btn primary" disabled={!canSave} onClick={save}>{barrier && fix.trim() ? "Save and add rule" : "Save"}</button>
      </div>
    </Sheet>
  );
}

function FixFields({ fix, setFix, remind, setRemind, match, setMatch, suggestions, optional }: {
  fix: string; setFix: (v: string) => void; remind: Remind; setRemind: (r: Remind) => void;
  match: string; setMatch: (v: string) => void; suggestions: { fix: string; remind: Remind }[]; optional?: boolean;
}) {
  return (
    <>
      <div className="field"><label htmlFor="m-fix">Your fix for next time {optional && <span className="opt">optional</span>}</label>
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
      {fix.trim() && (
        <>
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
    </>
  );
}

/** Halfway check-in when you're not on the block: log what you're doing, in one tap. */
export function CheckSheet({ task }: { task: Task }) {
  const { update, close, toast, now } = useApp();
  const [what, setWhat] = useState<InsteadKey[]>([]);
  const save = () => {
    update((s) => { const t = materialize(s, task); (t.checks ||= []).push({ at: now, on: false, what }); });
    close();
    toast(task.ifNot ? `Logged. Way back in: ${task.ifNot}.` : "Logged. Ready to switch back?");
  };
  return (
    <Sheet onClose={close} title="What are you doing right now?" sub={`Instead of ${task.title}. Tap what fits. You can still get back to it.`}>
      <Chips multi options={INSTEAD_OPTS} value={what} onChange={(k) => setWhat((a) => toggleIn(a, k))} />
      <div className="actions">
        <button className="btn" onClick={close}>Cancel</button>
        <button className="btn primary" disabled={!what.length} onClick={save}>Log it</button>
      </div>
    </Sheet>
  );
}
