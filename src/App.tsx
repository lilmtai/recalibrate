import { useCallback, useEffect, useMemo, useState } from "react";
import { Ctx, type SheetState, type Tab } from "./ctx";
import { useAppState } from "./store";
import { useReminders } from "./useReminders";
import { longDate, nowMin, today } from "./lib/time";
import { loadExample } from "./example";
import { DayView } from "./components/DayView";
import { WeekView } from "./components/WeekView";
import { RoutinesView } from "./components/RoutinesView";
import { PlaybookView } from "./components/PlaybookView";
import { PatternsView } from "./components/PatternsView";
import { BlockSheet } from "./components/BlockSheet";
import { ActualSheet, LogSheet } from "./components/LogSheet";
import { MissSheet } from "./components/MissSheet";

const TABS: { key: Tab; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "routines", label: "Routines" },
  { key: "playbook", label: "Playbook" },
  { key: "patterns", label: "Patterns" },
];

export default function App() {
  const { state, update } = useAppState();
  const [tab, setTab] = useState<Tab>(() => (localStorage.getItem("recalibrate.tab") as Tab) || "day");
  const [date, setDate] = useState(today());
  const [sheet, setSheet] = useState<SheetState>(null);
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const [now, setNow] = useState(nowMin());

  useEffect(() => {
    const t = setInterval(() => setNow(nowMin()), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { try { localStorage.setItem("recalibrate.tab", tab); } catch { /* ignore */ } }, [tab]);

  const toast = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  const close = useCallback(() => setSheet(null), []);
  const reminders = useReminders(state, now, toast);

  const ctx = useMemo(() => ({ state, update, date, setDate, setTab, open: setSheet, close, toast, now }), [state, update, date, close, toast, now]);
  const empty = !state.tasks.length && !state.routines.length;

  const title =
    tab === "day" ? longDate(date)
    : tab === "week" ? "Week plan"
    : tab === "routines" ? "Routines"
    : tab === "playbook" ? "Your playbook"
    : "Patterns · last 14 days";

  return (
    <Ctx.Provider value={ctx}>
      <div className="wrap">
        <header className="top">
          <div>
            <div className="brand">Recalibrate</div>
            <h1>{title}</h1>
          </div>
          <nav className="tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>{t.label}</button>
            ))}
          </nav>
        </header>

        {empty && (
          <div className="banner calm">
            <b>New here?</b>
            <span>Load a sample week to see how it works, then clear it from the Day view. <button className="linkbtn" onClick={() => update(loadExample)}>Load an example week</button></span>
          </div>
        )}

        <main>
          {tab === "day" && <DayView reminders={reminders} />}
          {tab === "week" && <WeekView />}
          {tab === "routines" && <RoutinesView />}
          {tab === "playbook" && <PlaybookView />}
          {tab === "patterns" && <PatternsView />}
        </main>
      </div>

      {sheet?.type === "block" && <BlockSheet key={sheet.task?.id || "new"} date={sheet.date} task={sheet.task} start={sheet.start} />}
      {sheet?.type === "routine" && <BlockSheet routine={sheet.routine} routineMode />}
      {sheet?.type === "log" && <LogSheet task={sheet.task} />}
      {sheet?.type === "actual" && <ActualSheet taskId={sheet.taskId} planned={sheet.planned} />}
      {sheet?.type === "miss" && <MissSheet task={sheet.task} />}
      {sheet?.type === "rule" && <MissSheet rule={sheet.rule} />}

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className="toast">{t.msg}</div>)}
      </div>
    </Ctx.Provider>
  );
}
