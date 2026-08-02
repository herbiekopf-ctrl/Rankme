import Link from "next/link";

export function AppHeader() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Ranked home">
        <span className="brand-mark" aria-hidden="true">R</span>
        <span>RANKED</span>
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/rank/top-25">Build</Link>
        <Link href="/create">Create a poll</Link>
        <Link href="/consensus">Consensus</Link>
        <Link href="/#explore">Explore</Link>
      </nav>
      <Link className="header-cta" href="/create">Make your poll</Link>
    </header>
  );
}
