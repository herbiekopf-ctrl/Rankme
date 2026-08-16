import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home-hub">
      <section className="home-hero shell">
        <div className="season-chip"><span /> College football rankings, built by you</div>
        <p className="kicker">ONE WORKFLOW. EVERY ARGUMENT.</p>
        <h1>Rank what you believe.<br /><em>Back it up with real data.</em></h1>
        <p className="home-lede">Start with the flagship Top 25, create a question about any real college-football entity, or browse published rankings. Every ballot uses the same fast ranking and comparison workspace.</p>
        <div className="home-actions" aria-label="Choose what to do">
          <Link className="home-action flagship" href="/rank/top-25">
            <span className="home-action-tag">FLAGSHIP POLL</span>
            <strong>Vote Top 25</strong>
            <p>Build your weekly AP-style ballot and compare teams without leaving the ballot.</p>
            <em>Open the ballot →</em>
          </Link>
          <Link className="home-action" href="/create">
            <span className="home-action-icon">＋</span>
            <strong>Create a poll</strong>
            <p>Choose one real category, ask your question, set the ranking length, and start.</p>
            <em>Create one poll →</em>
          </Link>
          <Link className="home-action" href="/consensus">
            <span className="home-action-icon">⌕</span>
            <strong>Browse</strong>
            <p>Find published polls and weekly consensus once real responses are available.</p>
            <em>Browse rankings →</em>
          </Link>
        </div>
      </section>

      <section className="home-workflow">
        <div className="shell home-workflow-grid">
          <div><span>01</span><strong>Choose what to rank</strong><p>Teams, players, coaches, stadiums, and more are ready to compare.</p></div>
          <div><span>02</span><strong>Rank and investigate</strong><p>Search and add quickly. Open details, compare multiple choices, or sort the pool by any available metric when you need depth.</p></div>
          <div><span>03</span><strong>Publish by period</strong><p>Every response keeps its timestamp, season, and weekly cycle so opinions from different moments are never mixed together.</p></div>
        </div>
      </section>
    </main>
  );
}
