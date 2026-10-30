import { useState, type ReactNode } from "react";
import { useApp } from "../ctx";
import { DEFAULT_NOTIFY } from "../lib/push";
import type { NotifyPrefs } from "../types";
import type { PushOutcome } from "../usePwa";
import { Sheet } from "./Sheet";

type Install = { installed: boolean; canPrompt: boolean; install: () => Promise<void>; ios: boolean };
type Push = {
  supported: boolean; subscribed: boolean; permission: string;
  enable: () => Promise<PushOutcome>; disable: () => Promise<void>; test: () => Promise<string>;
};

const KINDS: { key: keyof NotifyPrefs; label: string; sub: string }[] = [
  { key: "start", label: "5 minutes before a block", sub: "Time to wrap up and switch" },
  { key: "mid", label: "Halfway check-in", sub: "“Still on it?” with one-tap answers" },
  { key: "end", label: "End of a block", sub: "“Log what really happened”" },
  { key: "fix", label: "Reminders from your fixes", sub: "Like “Set an alarm for tomorrow” at 21:00" },
];

function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children: ReactNode }) {
  return (
    <div className={`step ${done ? "done" : ""}`}>
      <span className="stepn">{done ? "✓" : n}</span>
      <div className="grow"><b className="steptitle">{title}</b><div className="small muted">{children}</div></div>
    </div>
  );
}

/** Phone setup: install the app, sign in, turn on notifications that work when the app is closed. */
export function SetupSheet({ install, push, signedIn, email }: { install: Install; push: Push; signedIn: boolean; email: string | null }) {
  const { state, update, close, open, toast } = useApp();
  const [msg, setMsg] = useState("");
  const [detail, setDetail] = useState("");
  const prefs = { ...DEFAULT_NOTIFY, ...state.notify };
  const needsInstallFirst = install.ios && !install.installed;

  const turnOn = async () => {
    setMsg(""); setDetail("");
    const { result: r, detail: d } = await push.enable();
    setDetail(d || "");
    if (r === "ok") toast("Notifications are on for this device.");
    else if (r === "signin") setMsg("Sign in first, so your reminders can follow your plan.");
    else if (r === "denied") setMsg("Notifications are blocked. Allow them for Recalibrate in your phone or browser settings, then try again.");
    else if (r === "unsupported") setMsg(install.ios ? "On iPhone, open Recalibrate from your Home Screen first (step 1)." : "This browser doesn't support notifications.");
    else if (r === "nosetup") setMsg("The notification server isn't set up yet. Run supabase/push.sql in the Supabase SQL Editor, then try again.");
    else if (r === "subscribe") setMsg("This device couldn't sign up for notifications. Close Recalibrate fully, reopen it, and try again.");
    else setMsg("Couldn't save this device for notifications. Check your connection, then try again.");
  };
  const sendTest = async () => {
    setDetail("");
    const r = await push.test();
    setMsg(r === "ok" ? "Test sent. It should arrive within a minute, even if you close the app." : "Couldn't send a test. Check the Supabase push setup.");
  };
  const setPref = (k: keyof NotifyPrefs, v: boolean) => update((s) => { s.notify = { ...DEFAULT_NOTIFY, ...s.notify, [k]: v }; });

  return (
    <Sheet title="Phone app & notifications" sub="Three steps. Once done, reminders reach you even when Recalibrate is closed." onClose={close}>
      <div className="steps">
        <Step n={1} done={install.installed} title="Install the app">
          {install.installed ? "Installed. You're using the app version."
            : install.canPrompt ? <button className="btn primary small" onClick={install.install}>Install Recalibrate</button>
            : install.ios ? <>In <b>Safari</b>, tap the Share button <span aria-hidden="true">⎋</span>, then <b>Add to Home Screen</b>. Then open Recalibrate from your Home Screen and come back here.</>
            : <>Open your browser menu and choose <b>Install app</b> or <b>Add to Home screen</b>.</>}
        </Step>
        <Step n={2} done={signedIn} title="Sign in">
          {signedIn ? <>Signed in as {email}.</> : <button className="btn small" onClick={() => open({ type: "account" })}>Sign in with a code</button>}
        </Step>
        <Step n={3} done={push.subscribed} title="Turn on notifications">
          {push.subscribed ? "On for this device."
            : needsInstallFirst ? "On iPhone this works from the Home Screen app. Do step 1 first."
            : <button className="btn primary small" disabled={!signedIn} onClick={turnOn}>Turn on notifications</button>}
        </Step>
      </div>
      {msg && <div className="banner calm" style={{ marginTop: 12 }}><span>{msg}{detail && <><br /><span className="small muted">Details: {detail}</span></>}</span></div>}

      {push.subscribed && (
        <>
          <div className="field"><span>Send me</span></div>
          <label className="toggle"><input type="checkbox" checked={prefs.enabled} onChange={(e) => setPref("enabled", e.target.checked)} /> <b>All notifications</b> <span className="muted small">(pauses every device when off)</span></label>
          {KINDS.map((k) => (
            <label key={k.key} className="toggle sub"><input type="checkbox" disabled={!prefs.enabled} checked={prefs[k.key] as boolean} onChange={(e) => setPref(k.key, e.target.checked)} />
              <span>{k.label}<span className="small muted"> · {k.sub}</span></span></label>
          ))}
          <div className="actions">
            <button className="btn ghost" onClick={async () => { await push.disable(); toast("Notifications off for this device."); }}>Turn off on this device</button>
            <span className="spacer" />
            <button className="btn" onClick={sendTest}>Send a test</button>
          </div>
        </>
      )}
      {!push.subscribed && <div className="actions"><button className="btn" onClick={close}>Close</button></div>}
    </Sheet>
  );
}
