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

type Sync = {
  email: string | null; status: SyncStatus;
  signIn: (e: string) => Promise<string | null>;
  verifyCode: (e: string, c: string) => Promise<string | null>;
  signInPassword: (e: string, p: string) => Promise<string | null>;
  signUpPassword: (e: string, p: string) => Promise<{ error: string | null; confirm: boolean }>;
  setPassword: (p: string) => Promise<string | null>;
  signOut: () => Promise<void>; syncNow: () => void;
};

const validEmail = (e: string) => /^\S+@\S+\.\S+$/.test(e.trim());

export function AccountSheet({ sync }: { sync: Sync }) {
  const { close, toast } = useApp();
  const [mode, setMode] = useState<"password" | "code">("password");
  const [email, setEmail] = useState("");
  const [password, setPw] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [newPw, setNewPw] = useState("");

  const run = async (fn: () => Promise<void>) => { setError(""); setInfo(""); setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const done = () => { toast("Signed in. Syncing your planner."); close(); };

  const signIn = () => run(async () => {
    if (!validEmail(email)) return setError("Enter a valid email address.");
    if (!password) return setError("Enter your password.");
    const err = await sync.signInPassword(email.trim(), password);
    if (err) setError(err); else done();
  });
  const create = () => run(async () => {
    if (!validEmail(email)) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Use at least 8 characters for the password.");
    const r = await sync.signUpPassword(email.trim(), password);
    if (r.error) setError(r.error);
    else if (r.confirm) setInfo("Account created. Supabase sent a confirmation email: open it once (any browser is fine), then come back and tap Sign in.");
    else done();
  });
  const sendCode = () => run(async () => {
    if (!validEmail(email)) return setError("Enter a valid email address.");
    const err = await sync.signIn(email.trim());
    if (err) setError(/fetch|network/i.test(err) ? "Couldn't reach the server. Check your connection and try again." : err);
    else setSent(true);
  });
  const verify = () => run(async () => {
    if (!/^\d{6,8}$/.test(code.replace(/\s/g, ""))) return setError("Enter the code from the email (6 to 8 digits).");
    const err = await sync.verifyCode(email.trim(), code);
    if (err) setError(/expired|invalid/i.test(err) ? "That code didn't work or has expired. Send a new one." : err);
    else done();
  });
  const savePw = () => run(async () => {
    if (newPw.length < 8) return setError("Use at least 8 characters.");
    const err = await sync.setPassword(newPw);
    if (err) setError(err); else { setNewPw(""); setInfo("Password saved. You can now sign in with it in the Home Screen app."); }
  });

  if (sync.email) {
    return (
      <Sheet title="Account & sync" sub={<>Signed in as <b>{sync.email}</b></>} onClose={close}>
        <div className="banner calm" style={{ marginTop: 14 }}>
          <b>{STATUS_LABEL[sync.status]}.</b>
          <span>Sign in with the same email on your phone and laptop to see the same plan.</span>
        </div>
        {sync.status === "error" && <div className="error">The last sync failed. Check your connection, then tap Sync now.</div>}
        <div className="field">
          <label htmlFor="a-newpw">Set a password <span className="opt">to sign in without email links</span></label>
          <div className="quickadd" style={{ marginTop: 0 }}>
            <input id="a-newpw" type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="At least 8 characters" />
            <button className="btn" disabled={busy || !newPw} onClick={savePw}>Save</button>
          </div>
        </div>
        {info && <div className="hint">{info}</div>}
        {error && <div className="error" role="alert">{error}</div>}
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
    <Sheet title="Sign in to sync" sub="Keep your planner on your phone and laptop. Anything you've planned here gets added to your account." onClose={close}>
      <div className="subnav" role="group" style={{ marginTop: 14 }}>
        <button aria-pressed={mode === "password"} onClick={() => { setMode("password"); setError(""); setInfo(""); }}>Password</button>
        <button aria-pressed={mode === "code"} onClick={() => { setMode("code"); setError(""); setInfo(""); }}>Email code</button>
      </div>

      <div className="field">
        <label htmlFor="a-email">Email</label>
        <input id="a-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>

      {mode === "password" ? (
        <>
          <div className="field">
            <label htmlFor="a-pw">Password</label>
            <input id="a-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && signIn()} placeholder="At least 8 characters" />
          </div>
          {info && <div className="banner calm" style={{ marginTop: 12 }}><span>{info}</span></div>}
          {error && <div className="error" role="alert">{error}</div>}
          <div className="actions">
            <button className="btn" disabled={busy} onClick={create}>Create account</button>
            <span className="spacer" />
            <button className="btn primary" disabled={busy} onClick={signIn}>{busy ? "Signing in…" : "Sign in"}</button>
          </div>
        </>
      ) : (
        <>
          {sent && (
            <div className="field">
              <label htmlFor="a-code">Code from the email</label>
              <input id="a-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && verify()} placeholder="123456" className="codeinput" />
              <span className="hint" style={{ marginTop: 0 }}>Only works once the email shows a code. In the Home Screen app, don't tap the link.</span>
            </div>
          )}
          {error && <div className="error" role="alert">{error}</div>}
          <div className="actions">
            <span className="spacer" />
            {!sent ? <button className="btn primary" disabled={busy} onClick={sendCode}>Email me a code</button>
              : <button className="btn primary" disabled={busy} onClick={verify}>Sign in</button>}
          </div>
        </>
      )}
    </Sheet>
  );
}
