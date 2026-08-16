import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home-hub">
      <section className="home-hero shell">
        <div className="season-chip"><span /> College football rankings, built by you</div>
        <p className="kicker">ONE WORKFLOW. EVERY ARGUMENT.</p>
        <h1>Rank what you believe.<br /><em>Back it up with real data.</em></h1>
        <p className="home-lede">Rank a poll, then see how your vote compares with everyone else. Filter the consensus by the perspective you saved on your profile.</p>
        <div className="home-actions" aria-label="Choose what to do">
          <Link className="home-action flagship" href="/rank/top-25">
            <span className="home-action-tag">FLAGSHIP POLL</span>
            <strong>Vote Top 25</strong>
            <p>Build your weekly AP-style ballot and compare teams without leaving the ballot.</p>
            <em>Open the ballot →</em>
          </Link>
          <Link className="home-action" href="/consensus">
            <span className="home-action-icon">⌕</span>
            <strong>See consensus</strong>
            <p>Browse community polls, see the live group ranking, and add or revise your vote.</p>
            <em>Open consensus →</em>
          </Link>
          <Link className="home-action" href="/create">
            <span className="home-action-icon">＋</span>
            <strong>Create a poll</strong>
            <p>Choose one real category, ask your question, set the ranking length, and start.</p>
            <em>Create one poll →</em>
          </Link>
        </div>
      </section>

      <section className="home-workflow">
        <div className="shell home-workflow-grid">
          <div><span>01</span><strong>Choose what to rank</strong><p>Teams, players, coaches, stadiums, and more are ready to compare.</p></div>
          <div><span>02</span><strong>Rank and investigate</strong><p>Search and add quickly. Open details, compare multiple choices, or sort the pool by any available metric when you need depth.</p></div>
          <div><span>03</span><strong>See the consensus</strong><p>Your one active vote joins the group ranking. Revise it while the period is open; older revisions stay in the background.</p></div>
        </div>
      </section>
    </main>
  );
}
