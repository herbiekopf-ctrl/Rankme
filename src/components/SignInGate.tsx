"use client";

import { useState } from "react";
import { getBrowserSupabaseClient, signInToRankedWithGoogle } from "@/lib/supabase/browser";

export function SignInGate() {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");

  async function continueWithGoogle() {
    const client = getBrowserSupabaseClient();
    if (!client) return setError("Supabase is not configured for this app yet.");
    setSigningIn(true);
    setError("");
    try {
      await signInToRankedWithGoogle(client);
    } catch (reason) {
      setSigningIn(false);
      setError(reason instanceof Error ? reason.message : "Google sign-in could not be started.");
    }
  }

  return (
    <div className="sign-in-gate">
      <div><span>ACCOUNT REQUIRED TO PUBLISH</span><strong>One tap. No new password.</strong><p>Sign in with your Google account to publish, join consensus, or add optional profile context. Your ranking is saved while Google signs you in.</p></div>
      <button className="google-sign-in" type="button" disabled={signingIn} onClick={continueWithGoogle}>
        <svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.32 2.98-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.43l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.05v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.86A6 6 0 0 1 6.08 12c0-.65.11-1.28.31-1.86V7.52H3.05A10 10 0 0 0 2 12c0 1.61.39 3.13 1.05 4.48l3.34-2.62Z"/><path fill="#EA4335" d="M12 6.01c1.47 0 2.79.51 3.83 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.95 5.52l3.34 2.62C7.18 7.77 9.39 6.01 12 6.01Z"/></svg>
        {signingIn ? "Opening Google…" : "Continue with Google"}
      </button>
      {error && <p className="creator-error" role="alert">{error}</p>}
    </div>
  );
}
