import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Ctx, type SheetState, type Tab, type ToastAction } from "./ctx";
import type { Cue } from "./types";
import { materialize, tasksFor } from "./lib/plan";
import { useAppState } from "./store";
import { useReminders } from "./useReminders";
import { nowMin, parseKey, today } from "./lib/time";
import { DayView } from "./components/DayView";
import { WeekView } from "./components/WeekView";
import { MyDayView } from "./components/MyDayView";
import { EntrySheet } from "./components/EntrySheet";
import { PlaybookView } from "./components/PlaybookView";
import { PatternsView } from "./components/PatternsView";
import { BlockSheet } from "./components/BlockSheet";
import { ActualSheet, LogSheet } from "./components/LogSheet";
import { CheckSheet, MissSheet } from "./components/MissSheet";
import { AccountSheet } from "./components/AccountSheet";
import { SetupSheet } from "./components/SetupSheet";
import { MeView } from "./components/MeView";
import { QuickSheet } from "./components/QuickSheet";
import { WelcomeSheet } from "./components/WelcomeSheet";
import { AskSheet } from "./components/AskSheet";
import { applyNotificationAnswers } from "./lib/answers";
import { Icon } from "./components/Icon";
import { useSync } from "./sync";
import { useInstall, usePush } from "./usePwa";

type Group = "today" | "myday" | "week" | "insights" | "me";
const GROUPS: { key: Group; label: string; icon: Parameters<typeof Icon>[0]["name"]; first: Tab }[] = [
  { key: "today", label: "Today", icon: "sun", first: "day" },
  { key: "myday", label: "My day", icon: "clock", first: "myday" },
  { key: "week", label: "Week", icon: "calendar", first: "week" },
  { key: "insights", label: "Insights", icon: "chart", first: "patterns" },
  { key: "me", label: "Me", icon: "person", first: "me" },
];
const groupOf = (t: Tab): Group =>
  t === "day" ? "today" : t === "myday" ? "myday" : t === "week" ? "week" : t === "patterns" || t === "playbook" ? "insights" : "me";
const VALID: Tab[] = ["day", "myday", "week", "patterns", "playbook", "me"];

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

export default function App() {
  const { state, update, replace } = useAppState();
  const sync = useSync(state, replace);
  const [tab, setTabRaw] = useState<Tab>(() => {
    const saved = localStorage.getItem("recalibrate.tab") as Tab | "routines" | null;
    return saved === "routines" ? "me" : saved && VALID.includes(saved as Tab) ? (saved as Tab) : "day";
  });
  const [date, setDate] = useState(today());
  const [sheet, setSheet] = useState<SheetState>(null);
  const [toasts, setToasts] = useState<{ id: number; msg: string; action?: ToastAction }[]>([]);
  const [party, setParty] = useState(0);
  const started = useRef(Date.now());
  const stateRef = useRef(state);
  stateRef.current = state;
  const [now, setNow] = useState(nowMin());
  // remember the last screen inside each tab (Plan vs. Plan-vs-actual, Patterns vs. Playbook)
  const lastIn = useRef<Record<Group, Tab>>({ today: "day", myday: "myday", week: "week", insights: "patterns", me: "me" });
  const setTab = useCallback((t: Tab) => { lastIn.current[groupOf(t)] = t; setTabRaw(t); window.scrollTo({ top: 0 }); }, []);

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
  const celebrate = useCallback(() => {
    setParty((n) => n + 1);
    try { navigator.vibrate?.([18, 40, 28]); } catch { /* not supported */ }
  }, []);
  useEffect(() => {
    if (!party) return;
    const t = setTimeout(() => setParty(0), 1200);
    return () => clearTimeout(t);
  }, [party]);
  const close = useCallback(() => setSheet(null), []);

  // halfway → check-in panel, end of block → log panel
  const onCue = useCallback((c: Cue) => {
    const t = tasksFor(stateRef.current, today()).find((x) => x.id === c.taskId);
    if (!t || t.status !== "open") return;
    setTab("day");
    setDate(today());
    setSheet({ type: "ask", task: t, kind: c.kind === "transition" ? "start" : c.kind });
  }, [setTab]);
  const install = useInstall();
  const push = usePush(sync.userId, state, update);
  useReminders(state, now, toast, onCue, !push.subscribed);

  useEffect(() => {
    const apply = async () => {
      const logged = await applyNotificationAnswers(() => stateRef.current, update).catch(() => []);
      if (logged.length) toast(`From your notifications: ${logged.join(", ")}.`);
    };
    apply();
    const onVis = () => document.visibilityState === "visible" && apply();
    const onMsg = (e: MessageEvent) => e.data?.type === "pending-answers" && apply();
    document.addEventListener("visibilitychange", onVis);
    navigator.serviceWorker?.addEventListener("message", onMsg);
    return () => { document.removeEventListener("visibilitychange", onVis); navigator.serviceWorker?.removeEventListener("message", onMsg); };
  }, [update, toast]);

  // first visit with nothing planned: short setup
  useEffect(() => {
    const s = stateRef.current;
    if (!s.onboarded && !s.tasks.length && !s.routines.length && !new URLSearchParams(window.location.search).get("do")) {
      setSheet({ type: "welcome" });
    }
  }, []);

  // opened from a notification: ?task=…&date=…&do=on|check|log
  const pendingLink = useRef<URLSearchParams | null>(new URLSearchParams(window.location.search));
  useEffect(() => {
    const q = pendingLink.current;
    if (!q || (!q.get("do") && !q.get("date"))) { pendingLink.current = null; return; }
    const d = q.get("date") || today();
    const t = q.get("task") ? tasksFor(state, d).find((x) => x.id === q.get("task")) : undefined;
    if (q.get("task") && !t && Date.now() - started.current < 10_000) return; // wait for sync to bring it in
    pendingLink.current = null;
    window.history.replaceState(null, "", window.location.pathname);
    setTab("day");
    setDate(d);
    if (!t || t.status !== "open") return;
    const act = q.get("do");
    if (act === "on") {
      update((s) => { const real = materialize(s, t); (real.checks ||= []).push({ at: nowMin(), on: true }); });
      toast("Nice. Keep going.");
    } else if (act === "check") setSheet({ type: "check", task: t });
    else if (act === "log") setSheet({ type: "log", task: t });
    else if (act === "ask") setSheet({ type: "ask", task: t, kind: q.get("kind") || "mid" });
  }, [state, update, toast, setTab]);

  const ctx = useMemo(() => ({ state, update, date, setDate, setTab, open: setSheet, close, toast, now, celebrate }),
    [state, update, date, setTab, close, toast, now, celebrate]);

  const group = groupOf(tab);
  const isToday = date === today();
  const dayLabel = parseKey(date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
  const [eyebrow, title] =
    group === "today" ? [dayLabel, isToday ? greeting() : parseKey(date).toLocaleDateString(undefined, { weekday: "long" })]
    : group === "myday" ? [dayLabel, "My day"]
    : group === "week" ? ["Plan ahead", "Your week"]
    : group === "insights" ? ["Last 14 days", "Insights"]
    : [sync.email || "Settings and routines", "Me"];
  const initial = (sync.email || "R")[0].toUpperCase();

  const sub = (opts: [Tab, string][]): ReactNode => (
    <div className="subnav" role="group">
      {opts.map(([t, label]) => <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{label}</button>)}
    </div>
  );

  return (
    <Ctx.Provider value={ctx}>
      <div className="wrap">
        <header className="top">
          <div className="headtext">
            <div className="eyebrow">{eyebrow}</div>
            <h1>{title}</h1>
          </div>
          <div className="headright">
            <nav className="tabs" role="tablist" aria-label="Main">
              {GROUPS.map((g) => (
                <button key={g.key} role="tab" aria-selected={group === g.key} onClick={() => setTab(lastIn.current[g.key] || g.first)}>{g.label}</button>
              ))}
            </nav>
            <button className="avatar" onClick={() => setTab("me")} aria-label={`Me: ${sync.email ? "signed in" : "not signed in"}`}>
              {initial}<span className={`dot s-${sync.status}`} />
            </button>
          </div>
        </header>

        {group === "insights" && sub([["patterns", "Patterns"], ["playbook", "Playbook"]])}

        <main>
          {tab === "day" && <DayView notificationsOn={push.subscribed} />}
          {tab === "myday" && <MyDayView />}
          {tab === "week" && <WeekView />}
          {tab === "patterns" && <PatternsView />}
          {tab === "playbook" && <PlaybookView />}
          {tab === "me" && <MeView sync={sync} pushOn={push.subscribed} installed={install.installed} />}
        </main>
      </div>

      <button className="fab" aria-label="Add" onClick={() => setSheet({ type: "quick" })}><Icon name="plus" size={26} /></button>

      <nav className="bottomnav" role="tablist" aria-label="Main">
        {GROUPS.map((g) => (
          <button key={g.key} role="tab" aria-selected={group === g.key} onClick={() => setTab(lastIn.current[g.key] || g.first)}>
            <Icon name={g.icon} size={23} />{g.label}
          </button>
        ))}
      </nav>

      {sheet?.type === "block" && <BlockSheet key={sheet.task?.id || "new"} date={sheet.date} task={sheet.task} start={sheet.start} title={sheet.title} fromNote={sheet.fromNote} />}
      {sheet?.type === "routine" && <BlockSheet routine={sheet.routine} routineMode />}
      {sheet?.type === "log" && <LogSheet task={sheet.task} />}
      {sheet?.type === "actual" && <ActualSheet taskId={sheet.taskId} planned={sheet.planned} />}
      {sheet?.type === "miss" && <MissSheet key={sheet.task.id + String(sheet.partial)} task={sheet.task} partial={sheet.partial} />}
      {sheet?.type === "check" && <CheckSheet task={sheet.task} />}
      {sheet?.type === "rule" && <MissSheet rule={sheet.rule} />}
      {sheet?.type === "account" && <AccountSheet sync={sync} />}
      {sheet?.type === "setup" && <SetupSheet install={install} push={push} signedIn={!!sync.email} email={sync.email} />}
      {sheet?.type === "entry" && <EntrySheet key={sheet.entry?.id || "new"} date={sheet.date} entry={sheet.entry} start={sheet.start} end={sheet.end} />}
      {sheet?.type === "quick" && <QuickSheet />}
      {sheet?.type === "welcome" && <WelcomeSheet />}
      {sheet?.type === "ask" && <AskSheet key={sheet.task.id + sheet.kind} task={sheet.task} kind={sheet.kind} />}

      {party > 0 && (
        <div className="celebrate" key={party} aria-hidden="true">
          <div className="ring"><Icon name="check" size={52} stroke={3} /></div>
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return <i key={i} className="spark" style={{ "--dx": `${Math.cos(a) * 110}px`, "--dy": `${Math.sin(a) * 110}px` } as CSSProperties} />;
          })}
        </div>
      )}

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
