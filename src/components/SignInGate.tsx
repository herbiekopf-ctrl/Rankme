"use client";

import { useState } from "react";
import { getBrowserSupabaseClient, sendRankedMagicLink } from "@/lib/supabase/browser";

export function SignInGate({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function sendLink() {
    const client = getBrowserSupabaseClient();
    if (!client) return setError("Supabase is not configured for this app yet.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address.");
    setState("sending");
    setError("");
    try {
      await sendRankedMagicLink(client, email, nextPath);
      setState("sent");
    } catch (reason) {
      setState("idle");
      setError(reason instanceof Error ? reason.message : "The sign-in link could not be sent.");
    }
  }

  if (state === "sent") return <div className="sign-in-receipt"><span>CHECK YOUR EMAIL</span><strong>We sent a secure sign-in link to {email.trim()}.</strong><p>Your ranking is still saved here. Open the link in this browser, then publish.</p></div>;

  return (
    <div className="sign-in-gate">
      <div><span>ACCOUNT REQUIRED TO PUBLISH</span><strong>Keep consensus human and accountable.</strong><p>Building stays open to everyone. A verified account is required only to publish, join consensus, or add optional profile context.</p></div>
      <div className="sign-in-form"><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" onKeyDown={(event) => { if (event.key === "Enter") void sendLink(); }} /><button className="button button-primary" disabled={state === "sending"} onClick={sendLink}>{state === "sending" ? "Sending…" : "Email me a sign-in link"}</button></div>
      {error && <p className="creator-error" role="alert">{error}</p>}
    </div>
  );
}
