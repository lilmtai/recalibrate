import { useState, type CSSProperties } from "react";
import { useApp } from "../ctx";
import type { CategoryKey } from "../types";
import { DAY_SHORT, today, uid } from "../lib/time";
import { loadExample } from "../example";
import { Sheet } from "./Sheet";

type Tpl = { id: string; title: string; start: string; dur: number; category: CategoryKey; days: number[]; ifNot: string; on: boolean };
const TEMPLATES: Tpl[] = [
  { id: "deep", title: "Deep work", start: "09:00", dur: 90, category: "work", days: [0, 1, 2, 3, 4], ifNot: "25 minutes, one small step", on: true },
  { id: "gym", title: "Training", start: "18:00", dur: 60, category: "health", days: [0, 2, 4], ifNot: "20-minute walk", on: true },
  { id: "lunch", title: "Lunch away from the desk", start: "12:30", dur: 45, category: "me", days: [0, 1, 2, 3, 4], ifNot: "10 minutes outside", on: false },
  { id: "side", title: "Side project", start: "20:00", dur: 60, category: "side", days: [1, 3], ifNot: "Write the next step", on: false },
  { id: "people", title: "Call family or friends", start: "18:00", dur: 30, category: "social", days: [6], ifNot: "Send a voice note", on: false },
  { id: "plan", title: "Plan tomorrow", start: "21:30", dur: 15, category: "me", days: [0, 1, 2, 3, 4, 5, 6], ifNot: "Pick the top 1", on: true },
];
const daysLabel = (d: number[]) =>
  d.length === 7 ? "Every day" : d.join() === "0,1,2,3,4" ? "Weekdays" : d.map((x) => DAY_SHORT[x]).join(", ");

/** First visit: day hours, a few starter routines, then reminders. */
export function WelcomeSheet() {
  const { update, close, open } = useApp();
  const [step, setStep] = useState(0);
  const [hours, setHours] = useState({ start: "07:00", end: "23:00" });
  const [tpls, setTpls] = useState(TEMPLATES);

  const finish = (withRoutines: boolean) => {
    update((s) => {
      s.onboarded = true;
      s.dayHours = hours;
      if (withRoutines) {
        for (const t of tpls.filter((x) => x.on)) {
          s.routines.push({ id: uid(), title: t.title, start: t.start, dur: t.dur, category: t.category, days: t.days, ifNot: t.ifNot, since: today() });
        }
      }
    });
  };
  const dismiss = () => { update((s) => { s.onboarded = true; }); close(); };
  const explore = () => { update((s) => { s.onboarded = true; loadExample(s); }); close(); };

  const dots = <div className="stepdots" aria-hidden="true">{[0, 1, 2, 3].map((i) => <i key={i} className={i <= step ? "on" : ""} />)}</div>;

  if (step === 0) {
    return (
      <Sheet title="Welcome to Recalibrate" onClose={dismiss}
        sub="A planner that learns from what really happens, not just what you planned.">
        <ul className="welcome-list">
          <li><span className="ic">1</span><span>Plan your day in blocks, with an “if not” version for bad days.</span></li>
          <li><span className="ic">2</span><span>When something slips, log why in one tap. It turns into a fix for next time.</span></li>
          <li><span className="ic">3</span><span>See where your time really goes, and what actually works for you.</span></li>
        </ul>
        <div className="actions">
          <button className="btn ghost" onClick={explore}>Explore an example week</button>
          <span className="spacer" />
          <button className="btn primary" onClick={() => setStep(1)}>Set up my week · 1 min</button>
        </div>
      </Sheet>
    );
  }
  if (step === 1) {
    return (
      <Sheet title="When does your day run?" sub="The timeline focuses on these hours. You can still see the night when you need it." onClose={dismiss}>
        {dots}
        <div className="hours">
          <div className="field"><label htmlFor="w-start">Usually up by</label><input id="w-start" type="time" value={hours.start} onChange={(e) => setHours({ ...hours, start: e.target.value })} /></div>
          <div className="field"><label htmlFor="w-end">Usually winding down by</label><input id="w-end" type="time" value={hours.end} onChange={(e) => setHours({ ...hours, end: e.target.value })} /></div>
        </div>
        <div className="actions"><button className="btn" onClick={() => setStep(0)}>Back</button><button className="btn primary" onClick={() => setStep(2)}>Next</button></div>
      </Sheet>
    );
  }
  if (step === 2) {
    return (
      <Sheet title="Pick a few routines" sub="They appear on your days automatically. Start small: two or three is plenty." onClose={dismiss}>
        {dots}
        {tpls.map((t) => (
          <label key={t.id} className="tpl" style={{ "--c": `var(--c-${t.category})` } as CSSProperties}>
            <input type="checkbox" checked={t.on} onChange={(e) => setTpls((all) => all.map((x) => (x.id === t.id ? { ...x, on: e.target.checked } : x)))} />
            <span className="grow"><b>{t.title}</b><div className="small muted">{daysLabel(t.days)} · {t.dur} min</div></span>
            <input type="time" aria-label={`${t.title} start time`} value={t.start}
              onChange={(e) => setTpls((all) => all.map((x) => (x.id === t.id ? { ...x, start: e.target.value } : x)))} />
          </label>
        ))}
        <div className="hint">You can change days, times and the “if not” version later in Me → Routines.</div>
        <div className="actions"><button className="btn" onClick={() => setStep(1)}>Back</button><button className="btn primary" onClick={() => { finish(true); setStep(3); }}>Add {tpls.filter((t) => t.on).length} routines</button></div>
      </Sheet>
    );
  }
  return (
    <Sheet title="Want reminders on your phone?" sub="A heads-up before each block, a halfway check-in, and a nudge to log what happened. They work even when the app is closed." onClose={close}>
      {dots}
      <div className="actions">
        <button className="btn" onClick={close}>Maybe later</button>
        <button className="btn primary" onClick={() => open({ type: "setup" })}>Set up the phone app</button>
      </div>
    </Sheet>
  );
}
