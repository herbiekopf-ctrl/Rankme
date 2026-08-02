"use client";

import { useState } from "react";
import { getBrowserSupabaseClient, sendRankedEmailCode, verifyRankedEmailCode } from "@/lib/supabase/browser";

export function SignInGate() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "verifying">("idle");
  const [error, setError] = useState("");

  async function sendCode() {
    const client = getBrowserSupabaseClient();
    if (!client) return setError("Supabase is not configured for this app yet.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address.");
    setState("sending");
    setError("");
    try {
      await sendRankedEmailCode(client, email);
      setState("sent");
    } catch (reason) {
      setState("idle");
      setError(reason instanceof Error ? reason.message : "The sign-in code could not be sent.");
    }
  }

  async function verifyCode() {
    const client = getBrowserSupabaseClient();
    if (!client) return setError("Supabase is not configured for this app yet.");
    if (!/^\d{6,8}$/.test(code.trim())) return setError("Enter the code from your email.");
    setState("verifying");
    setError("");
    try {
      await verifyRankedEmailCode(client, email, code);
      window.location.reload();
    } catch (reason) {
      setState("sent");
      setError(reason instanceof Error ? reason.message : "That code could not be verified.");
    }
  }

  if (state === "sent" || state === "verifying") return (
    <div className="sign-in-gate">
      <div><span>CHECK YOUR EMAIL</span><strong>Enter the sign-in code sent to {email.trim()}.</strong><p>Your ranking stays open here while you check your email. The code can only be used once.</p></div>
      <div className="sign-in-form"><input className="sign-in-code" type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="123456" onKeyDown={(event) => { if (event.key === "Enter") void verifyCode(); }} /><button className="button button-primary" disabled={state === "verifying"} onClick={verifyCode}>{state === "verifying" ? "Checking…" : "Verify code"}</button></div>
      <button className="sign-in-reset" type="button" onClick={() => { setState("idle"); setCode(""); setError(""); }}>Use a different email</button>
      {error && <p className="creator-error" role="alert">{error}</p>}
    </div>
  );

  return (
    <div className="sign-in-gate">
      <div><span>ACCOUNT REQUIRED TO PUBLISH</span><strong>Keep consensus human and accountable.</strong><p>Building stays open to everyone. A verified account is required only to publish, join consensus, or add optional profile context.</p></div>
      <div className="sign-in-form"><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" onKeyDown={(event) => { if (event.key === "Enter") void sendCode(); }} /><button className="button button-primary" disabled={state === "sending"} onClick={sendCode}>{state === "sending" ? "Sending…" : "Email me a sign-in code"}</button></div>
      {error && <p className="creator-error" role="alert">{error}</p>}
    </div>
  );
}
