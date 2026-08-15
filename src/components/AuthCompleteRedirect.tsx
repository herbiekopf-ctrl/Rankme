"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AuthCompleteRedirect({ error }: { error: string }) {
  const router = useRouter();

  useEffect(() => {
    if (error) return;
    let returnTo = "/create";
    try {
      const saved = window.sessionStorage.getItem("ranked:auth:returnTo");
      if (saved?.startsWith("/") && !saved.startsWith("//") && !saved.startsWith("/auth/")) returnTo = saved;
      window.sessionStorage.removeItem("ranked:auth:returnTo");
    } catch {}
    router.replace(returnTo);
  }, [error, router]);

  return (
    <main className="auth-complete">
      <section>
        <p className="kicker">RANKED ACCOUNT</p>
        <h1>{error ? "Sign-in did not finish" : "You’re signed in"}</h1>
        <p>{error || "Returning you to your ranking…"}</p>
        {error && <button className="button button-primary" type="button" onClick={() => router.replace("/create")}>Return to Ranked</button>}
      </section>
    </main>
  );
}
