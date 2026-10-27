import { useApp } from "../ctx";
import type { SyncStatus } from "../sync";
import { loadExample } from "../example";
import { STATUS_LABEL } from "./AccountSheet";
import { RoutinesView } from "./RoutinesView";
import { Icon } from "./Icon";

/** Me: routines, your day hours, account and sync, phone app and notifications, example data. */
export function MeView({ sync, pushOn, installed }: { sync: { email: string | null; status: SyncStatus }; pushOn: boolean; installed: boolean }) {
  const { state, update, open, toast } = useApp();
  const hours = state.dayHours || { start: "07:00", end: "23:00" };
  const hasEx = state.tasks.some((t) => t.ex) || state.routines.some((r) => r.ex) || state.notes.some((n) => n.ex);

  const clearExamples = () => {
    update((s) => {
      s.tasks = s.tasks.filter((t) => !t.ex);
      s.routines = s.routines.filter((r) => !r.ex);
      s.rules = s.rules.filter((r) => !r.ex);
      s.notes = s.notes.filter((n) => !n.ex);
      s.actuals = s.actuals.filter((a) => !a.ex);
      for (const k of Object.keys(s.checkins)) if (s.checkins[k].ex) delete s.checkins[k];
    });
    toast("Example data cleared.");
  };

  return (
    <div className="me">
      <section>
        <RoutinesView />
      </section>

      <div className="card mecard">
        <span className="ic"><Icon name="moon" /></span>
        <div className="grow"><b>Your day</b><span className="small muted">The timeline focuses on these hours and folds the night away.</span></div>
        <div className="hours" style={{ flex: "1 1 260px" }}>
          <div className="field"><label htmlFor="me-start">Up by</label>
            <input id="me-start" type="time" value={hours.start} onChange={(e) => update((s) => { s.dayHours = { ...hours, start: e.target.value || "07:00" }; })} /></div>
          <div className="field"><label htmlFor="me-end">Winding down by</label>
            <input id="me-end" type="time" value={hours.end} onChange={(e) => update((s) => { s.dayHours = { ...hours, end: e.target.value || "23:00" }; })} /></div>
        </div>
      </div>

      <div className="card mecard">
        <span className="ic"><Icon name="cloud" /></span>
        <div className="grow"><b>Account & sync</b><span className="small muted">{sync.email ? `${sync.email} · ${STATUS_LABEL[sync.status]}` : "Sign in to keep your planner on your phone and laptop."}</span></div>
        <button className={`btn ${sync.email ? "" : "primary"}`} onClick={() => open({ type: "account" })}>{sync.email ? "Manage" : "Sign in"}</button>
      </div>

      <div className="card mecard">
        <span className="ic"><Icon name="bell" /></span>
        <div className="grow"><b>Phone app & notifications</b><span className="small muted">{pushOn ? "Notifications are on for this device." : installed ? "Installed. Turn on notifications to get reminders when the app is closed." : "Install Recalibrate on your phone and get reminders even when it's closed."}</span></div>
        <button className={`btn ${pushOn ? "" : "primary"}`} onClick={() => open({ type: "setup" })}>{pushOn ? "Settings" : "Set up"}</button>
      </div>

      <div className="card mecard">
        <span className="ic"><Icon name="sparkle" /></span>
        <div className="grow"><b>Example week</b><span className="small muted">Fill the app with a realistic sample to explore. Marked “example” and removable in one tap.</span></div>
        {hasEx
          ? <button className="btn" onClick={clearExamples}>Clear example data</button>
          : <button className="btn" onClick={() => { update(loadExample); toast("Example week loaded."); }}>Load example</button>}
      </div>
    </div>
  );
}
