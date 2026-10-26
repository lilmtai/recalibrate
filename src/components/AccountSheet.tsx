import { useState } from "react";
import { useApp } from "../ctx";
import type { SyncStatus } from "../sync";
import { Sheet } from "./Sheet";

export const STATUS_LABEL: Record<SyncStatus, string> = {
  signedout: "On this device only",
  syncing: "Syncing…",
  synced: "Synced",
  offline: "Offline, will sync later",
  error: "Sync problem",
};

export function AccountSheet({ sync }: {
  sync: { email: string | null; status: SyncStatus; signIn: (e: string) => Promise<string | null>; signOut: () => Promise<void>; syncNow: () => void };
}) {
  const { close, toast } = useApp();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email address.");
    setSending(true);
    const err = await sync.signIn(email.trim());
    setSending(false);
    if (err) setError(err);
    else { setSent(true); setError(""); }
  };

  if (sync.email) {
    return (
      <Sheet title="Sync across devices" sub={<>Signed in as <b>{sync.email}</b></>} onClose={close}>
        <div className="banner calm" style={{ marginTop: 14 }}>
          <b>{STATUS_LABEL[sync.status]}.</b>
          <span>Your planner saves to your account. Sign in with the same email on your phone or laptop to see the same plan.</span>
        </div>
        {sync.status === "error" && <div className="error">The last sync failed. Check your connection, then tap Sync now.</div>}
        <div className="actions">
          <button className="btn ghost" onClick={async () => { await sync.signOut(); close(); toast("Signed out. Your data stays on this device."); }}>Sign out</button>
          <span className="spacer" />
          <button className="btn" onClick={() => sync.syncNow()}>Sync now</button>
          <button className="btn primary" onClick={close}>Done</button>
        </div>
      </Sheet>
    );
  }
  return (
    <Sheet title="Sync across devices" sub="Sign in with your email to keep your planner on your phone and laptop. No password needed." onClose={close}>
      {sent ? (
        <div className="banner calm" style={{ marginTop: 14 }}>
          <b>Check your inbox.</b>
          <span>We sent a sign-in link to {email}. Open it on this device. Anything you've already planned here gets added to your account.</span>
        </div>
      ) : (
        <div className="field">
          <label htmlFor="a-email">Email</label>
          <input id="a-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()} placeholder="you@example.com" autoFocus />
        </div>
      )}
      {error && <div className="error" role="alert">{error}</div>}
      <div className="actions">
        <button className="btn" onClick={close}>{sent ? "Close" : "Cancel"}</button>
        {!sent && <button className="btn primary" disabled={sending} onClick={send}>{sending ? "Sending…" : "Send sign-in link"}</button>}
      </div>
    </Sheet>
  );
}
