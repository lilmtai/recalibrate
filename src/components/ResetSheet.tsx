import { useState } from "react";
import { useApp } from "../ctx";
import { supabase } from "../lib/supabase";
import { backupJson, freshState, LOCAL_KEYS } from "../lib/reset";
import { today } from "../lib/time";
import { Sheet } from "./Sheet";

/** "Start fresh": a clear list of what goes and what stays, an optional backup, then one confirm. */
export function ResetSheet() {
  const { state, update, close, toast, setTab, open } = useApp();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const download = () => {
    const url = URL.createObjectURL(new Blob([backupJson(state)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `recalibrate-backup-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setSaved(true);
  };

  const reset = async () => {
    setBusy(true);
    update((s) => {
      const f = freshState(s);
      for (const k of Object.keys(s)) delete (s as unknown as Record<string, unknown>)[k];
      Object.assign(s, f);
    });
    for (const k of LOCAL_KEYS) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
    // the log in its own table: mark every entry deleted (kept on the server, hidden everywhere)
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    if (uid) await supabase.from("execution_log").update({ deleted: true }).eq("user_id", uid).eq("deleted", false);
    setBusy(false);
    setTab("day");
    toast("Fresh start. Your settings are kept.");
    open({ type: "welcome" });
  };

  return (
    <Sheet title="Start fresh?" sub="Clears your planner on every device you're signed in on. This can't be undone." onClose={close}>
      <div className="resetcols">
        <div>
          <div className="lbl">Goes</div>
          <ul className="resetlist">
            <li>Blocks, routines and free blocks</li>
            <li>To-dos, projects, steps, notes, journal and goals</li>
            <li>Your log, check-ins and Playbook fixes</li>
          </ul>
        </div>
        <div>
          <div className="lbl">Stays</div>
          <ul className="resetlist keep">
            <li>Your account and sign-in</li>
            <li>Categories, day hours, appearance</li>
            <li>Notification settings</li>
          </ul>
        </div>
      </div>
      <button className="btn" onClick={download}>{saved ? "Backup downloaded" : "Download a backup first"}</button>
      <div className="actions">
        <button className="btn ghost" onClick={close}>Cancel</button>
        <span className="spacer" />
        <button className="btn danger" disabled={busy} onClick={reset}>{busy ? "Clearing…" : "Delete everything and start fresh"}</button>
      </div>
    </Sheet>
  );
}
