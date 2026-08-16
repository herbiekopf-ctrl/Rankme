"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getBrowserSupabaseClient, getRankedUser, signInToRankedWithGoogle } from "@/lib/supabase/browser";

export function AccountStatus() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const client = getBrowserSupabaseClient();
    if (!client) { void Promise.resolve().then(() => setReady(true)); return; }
    let active = true;
    void getRankedUser(client).then((value) => { if (active) setUser(value); }).finally(() => { if (active) setReady(true); });
    const { data } = client.auth.onAuthStateChange((_event, session) => { setUser(session?.user ?? null); setReady(true); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  async function signIn() {
    const client = getBrowserSupabaseClient(); if (!client) return;
    setWorking(true); await signInToRankedWithGoogle(client).catch(() => setWorking(false));
  }
  async function signOut() {
    const client = getBrowserSupabaseClient(); if (!client) return;
    setWorking(true); await client.auth.signOut(); setWorking(false);
  }

  if (!ready) return <span className="account-status is-loading" aria-label="Checking account" />;
  if (!user) return <button className="account-sign-in" type="button" disabled={working} onClick={() => void signIn()}>{working ? "Opening Google…" : "Sign in"}</button>;
  const label = String(user.user_metadata.full_name ?? user.user_metadata.name ?? user.email?.split("@")[0] ?? "You");
  return <div className="account-status"><Link href="/profile" aria-label="Open your saved rankings"><span>{label.slice(0, 1).toUpperCase()}</span><strong>{label}</strong></Link><button type="button" disabled={working} onClick={() => void signOut()}>Sign out</button></div>;
}
