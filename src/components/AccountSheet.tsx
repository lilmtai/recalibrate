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
  sync: {
    email: string | null; status: SyncStatus; signIn: (e: string) => Promise<string | null>;
    verifyCode: (e: string, c: string) => Promise<string | null>; signOut: () => Promise<void>; syncNow: () => void;
  };
}) {
  const { close, toast } = useApp();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState("");
  const verify = async () => {
    if (!/^\d{6,8}$/.test(code.replace(/\s/g, ""))) return setError("Enter the code from the email (6 to 8 digits).");
    setSending(true);
    const err = await sync.verifyCode(email.trim(), code);
    setSending(false);
    if (err) setError(err.includes("expired") || err.includes("invalid") ? "That code didn't work or has expired. Send a new one." : err);
    else { toast("Signed in. Syncing your planner."); close(); }
  };

  const send = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email address.");
    setSending(true);
    const err = await sync.signIn(email.trim());
    setSending(false);
    if (err) setError(/fetch|network/i.test(err) ? "Couldn't reach the server. Check your connection and try again." : err);
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
        <>
          <div className="banner calm" style={{ marginTop: 14 }}>
            <b>Check your inbox.</b>
            <span>We emailed {email}. Type the code from the email here. In the Home Screen app, use the code, not the link: the link signs in Safari instead. Anything you've already planned here gets added to your account.</span>
          </div>
          <div className="field">
            <label htmlFor="a-code">Code from the email</label>
            <input id="a-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && verify()} placeholder="123456" autoFocus className="codeinput" />
          </div>
        </>
      ) : (
        <div className="field">
          <label htmlFor="a-email">Email</label>
          <input id="a-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()} placeholder="you@example.com" autoFocus />
        </div>
      )}
      {error && <div className="error" role="alert">{error}</div>}
      <div className="actions">
        {sent && <button className="btn ghost" onClick={() => { setSent(false); setCode(""); setError(""); }}>Use a different email</button>}
        <span className="spacer" />
        <button className="btn" onClick={close}>{sent ? "Close" : "Cancel"}</button>
        {!sent && <button className="btn primary" disabled={sending} onClick={send}>{sending ? "Sending…" : "Email me a code"}</button>}
        {sent && <button className="btn primary" disabled={sending} onClick={verify}>{sending ? "Checking…" : "Sign in"}</button>}
      </div>
    </Sheet>
  );
}
