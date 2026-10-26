import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ctx, type SheetState, type Tab, type ToastAction } from "./ctx";
import type { Cue } from "./types";
import { tasksFor } from "./lib/plan";
import { useAppState } from "./store";
import { useReminders } from "./useReminders";
import { longDate, nowMin, today } from "./lib/time";
import { loadExample } from "./example";
import { DayView } from "./components/DayView";
import { WeekView } from "./components/WeekView";
import { MyDayView } from "./components/MyDayView";
import { EntrySheet } from "./components/EntrySheet";
import { RoutinesView } from "./components/RoutinesView";
import { PlaybookView } from "./components/PlaybookView";
import { PatternsView } from "./components/PatternsView";
import { BlockSheet } from "./components/BlockSheet";
import { ActualSheet, LogSheet } from "./components/LogSheet";
import { CheckSheet, MissSheet } from "./components/MissSheet";
import { AccountSheet, STATUS_LABEL } from "./components/AccountSheet";
import { useSync } from "./sync";

const TABS: { key: Tab; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "myday", label: "My day" },
  { key: "week", label: "Week" },
  { key: "routines", label: "Routines" },
  { key: "playbook", label: "Playbook" },
  { key: "patterns", label: "Patterns" },
];

export default function App() {
  const { state, update, replace } = useAppState();
  const sync = useSync(state, replace);
  const [tab, setTab] = useState<Tab>(() => (localStorage.getItem("recalibrate.tab") as Tab) || "day");
  const [date, setDate] = useState(today());
  const [sheet, setSheet] = useState<SheetState>(null);
  const [toasts, setToasts] = useState<{ id: number; msg: string; action?: ToastAction }[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [now, setNow] = useState(nowMin());

  useEffect(() => {
    const t = setInterval(() => setNow(nowMin()), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { try { localStorage.setItem("recalibrate.tab", tab); } catch { /* ignore */ } }, [tab]);

  const toast = useCallback((msg: string, action?: ToastAction) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, action }]);
    // prompts with a button stay longer so there's time to tap them
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 20_000 : 4000);
  }, []);
  const close = useCallback(() => setSheet(null), []);
  // halfway → check-in panel, end of block → log panel
  const onCue = useCallback((c: Cue) => {
    const t = tasksFor(stateRef.current, today()).find((x) => x.id === c.taskId);
    if (!t || t.status !== "open") return;
    setTab("day");
    setDate(today());
    setSheet(c.kind === "mid" ? { type: "check", task: t } : { type: "log", task: t });
  }, []);
  const reminders = useReminders(state, now, toast, onCue);

  const ctx = useMemo(() => ({ state, update, date, setDate, setTab, open: setSheet, close, toast, now }), [state, update, date, close, toast, now]);
  const empty = !state.tasks.length && !state.routines.length;

  const title =
    tab === "day" ? longDate(date)
    : tab === "myday" ? `My day · ${longDate(date)}`
    : tab === "week" ? "Week plan"
    : tab === "routines" ? "Routines"
    : tab === "playbook" ? "Your playbook"
    : "Patterns · last 14 days";

  return (
    <Ctx.Provider value={ctx}>
      <div className="wrap">
        <header className="top">
          <div>
            <div className="brand">
              Recalibrate
              <button className={`syncbtn s-${sync.status}`} onClick={() => setSheet({ type: "account" })}>
                <span className="dot" />{sync.email ? STATUS_LABEL[sync.status] : "Sign in to sync"}
              </button>
            </div>
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
          {tab === "myday" && <MyDayView />}
          {tab === "week" && <WeekView />}
          {tab === "routines" && <RoutinesView />}
          {tab === "playbook" && <PlaybookView />}
          {tab === "patterns" && <PatternsView />}
        </main>
      </div>

      {sheet?.type === "block" && <BlockSheet key={sheet.task?.id || "new"} date={sheet.date} task={sheet.task} start={sheet.start} title={sheet.title} fromNote={sheet.fromNote} />}
      {sheet?.type === "routine" && <BlockSheet routine={sheet.routine} routineMode />}
      {sheet?.type === "log" && <LogSheet task={sheet.task} />}
      {sheet?.type === "actual" && <ActualSheet taskId={sheet.taskId} planned={sheet.planned} />}
      {sheet?.type === "miss" && <MissSheet key={sheet.task.id + String(sheet.partial)} task={sheet.task} partial={sheet.partial} />}
      {sheet?.type === "check" && <CheckSheet task={sheet.task} />}
      {sheet?.type === "rule" && <MissSheet rule={sheet.rule} />}
      {sheet?.type === "account" && <AccountSheet sync={sync} />}
      {sheet?.type === "entry" && <EntrySheet key={sheet.entry?.id || "new"} date={sheet.date} entry={sheet.entry} start={sheet.start} end={sheet.end} />}

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <span>{t.msg}</span>
            {t.action && (
              <button className="toastbtn" onClick={() => { t.action!.run(); setToasts((x) => x.filter((y) => y.id !== t.id)); }}>{t.action.label}</button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
