"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountStatus } from "./AccountStatus";

type NavIconName = "home" | "browse" | "create" | "profile";

function NavIcon({ name }: { name: NavIconName }) {
  if (name === "home") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10.5 12 3l8.5 7.5v9a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z" /><path d="M9 21v-7h6v7" /></svg>;
  if (name === "browse") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4 4M8 8h6M8 11h6M8 14h3" /></svg>;
  if (name === "create") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /><rect x="3" y="3" width="18" height="18" rx="4" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></svg>;
}

const navItems: Array<{ href: string; label: string; icon: NavIconName }> = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/consensus", label: "Browse", icon: "browse" },
  { href: "/create", label: "Create", icon: "create" },
  { href: "/profile", label: "Profile", icon: "profile" },
];

export function AppHeader() {
  const pathname = usePathname();
  const isRankingRoute = pathname.startsWith("/rank/");
  return (
    <header className={`site-header${isRankingRoute ? " is-ranking-route" : ""}`}>
      <Link className="brand" href="/" aria-label="Ranked home">
        <span className="brand-mark" aria-hidden="true">R</span>
        <span>RANKED</span>
      </Link>
      <nav aria-label="Main navigation">
        {navItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return <Link key={item.href} href={item.href} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined}><NavIcon name={item.icon} /><span>{item.label}</span></Link>;
        })}
      </nav>
      <div className="header-account"><Link className="header-cta" href="/rank/top-25">Rank Top 25</Link><AccountStatus /></div>
    </header>
  );
}
