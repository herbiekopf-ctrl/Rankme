import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home-hub">
      <section className="home-ballot-hero shell">
        <div className="home-ballot-copy">
          <div className="home-main-event"><span>●</span> WEEKLY TOP 25 · 2026</div>
          <p className="kicker">YOUR OPINION. YOUR ORDER.</p>
          <h1>Make your own<br /><em>AP-style Top 25.</em></h1>
          <p>Pick 25 teams. Put them in order. Publish your ballot.</p>
          <div className="home-ballot-actions">
            <Link className="home-start-ballot" href="/rank/top-25">
              Start my Top 25 <span aria-hidden="true">→</span>
            </Link>
            <small>No setup. Your draft saves automatically.</small>
          </div>
        </div>

        <Link className="home-ballot-card" href="/rank/top-25" aria-label="Start your AP-style Top 25 ballot">
          <header>
            <div><span>YOUR BALLOT</span><strong>College Football Top 25</strong></div>
            <b>START HERE</b>
          </header>
          <ol>
            {[1, 2, 3, 4, 5].map((position) => (
              <li key={position}>
                <b>{position}</b>
                <span className="home-empty-mark">+</span>
                <div><strong>{position === 1 ? "Choose your #1 team" : "Add a team"}</strong><small>Tap to rank</small></div>
              </li>
            ))}
          </ol>
          <footer><span>Start with the obvious picks. Adjust anything later.</span><strong>Begin →</strong></footer>
        </Link>
      </section>

      <section className="home-help-strip">
        <div className="shell">
          <div><span className="home-help-icon">?</span><p><strong>Stuck between teams?</strong> Compare records, schedule strength, offense, defense, talent, and custom models inside your ballot.</p></div>
          <Link href="/rank/top-25">Ranking tools are there when you need them →</Link>
        </div>
      </section>

      <section className="home-more shell" aria-labelledby="home-more-title">
        <div className="home-more-heading"><div><p className="kicker">MORE TO RANK</p><h2 id="home-more-title">Top 25 is just the start.</h2></div><p>See what everyone thinks or create a ranking about anything in college football.</p></div>
        <div className="home-secondary-actions">
          <Link href="/consensus"><span>COMMUNITY</span><strong>Browse consensus</strong><p>Open current polls, see the group ranking, and add your vote.</p><em>Browse polls →</em></Link>
          <Link href="/create"><span>YOUR QUESTION</span><strong>Create a ranking</strong><p>Rank teams, players, coaches, stadiums, conferences, and more.</p><em>Create a poll →</em></Link>
        </div>
      </section>
    </main>
  );
}
