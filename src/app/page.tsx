import Link from "next/link";
import { seedTeams } from "@/lib/domain/seed";

export default function HomePage() {
  const preview = seedTeams.slice(0, 5);
  return (
    <>
      <section className="hero shell">
        <div className="hero-copy">
          <div className="season-chip"><span /> 2026 preseason is open</div>
          <p className="kicker">YOUR POLL. YOUR RECEIPTS.</p>
          <h1>Stop yelling at<br />the rankings.<br /><em>Make yours.</em></h1>
          <p className="hero-lede">
            The fastest way to build a college football Top 25 you can actually defend—then see exactly how your ballot differs from everyone else.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/rank/top-25">Build my Top 25 <span>→</span></Link>
            <Link className="text-link" href="/consensus">See fan consensus</Link>
          </div>
          <div className="hero-proof">
            <div><strong>5 min</strong><span>to build a ballot</span></div>
            <div><strong>25</strong><span>choices that are yours</span></div>
            <div><strong>∞</strong><span>arguments unlocked</span></div>
          </div>
        </div>

        <div className="hero-card-wrap" aria-label="Sample ballot preview">
          <div className="hero-card-accent" />
          <div className="hero-ballot">
            <div className="ballot-topline">
              <div><span>PRESEASON · 2026</span><strong>Herb&apos;s Top 25</strong></div>
              <span className="live-dot">DRAFT</span>
            </div>
            <div className="mini-list">
              {preview.map((team, index) => (
                <div className="mini-row" key={team.id}>
                  <span className="mini-rank">{index + 1}</span>
                  <span className="team-dot" style={{ background: team.color }}>
                    {team.shortName?.slice(0, 2)}
                  </span>
                  <span className="mini-team"><strong>{team.name}</strong><small>{team.attributes.conference}</small></span>
                  <span className="mini-move">{index === 0 ? "—" : index % 2 ? "↑" : "↓"}</span>
                </div>
              ))}
            </div>
            <div className="ballot-footer">
              <span>20 spots left</span>
              <div className="progress-track"><span style={{ width: "20%" }} /></div>
              <span>Autosaved</span>
            </div>
          </div>
          <div className="float-card float-card-left"><strong>+4</strong><span>vs fan consensus</span></div>
          <div className="float-card float-card-right"><span className="float-icon">↗</span><span>Built to share</span></div>
        </div>
      </section>

      <section className="how-band">
        <div className="shell how-grid">
          <div><span>01</span><strong>Find the contenders</strong><p>Search every FBS team and use the facts that matter to you.</p></div>
          <div><span>02</span><strong>Drag into order</strong><p>Fast, tactile ranking with keyboard and tap controls too.</p></div>
          <div><span>03</span><strong>Publish the receipts</strong><p>Share your ballot and compare it with fans, groups, and regions.</p></div>
        </div>
      </section>

      <section className="shell explore-section" id="explore">
        <div className="section-heading">
          <div><p className="kicker">ONE ENGINE, EVERY ARGUMENT</p><h2>Rank more than teams.</h2></div>
          <p>Top 25 is the weekly ritual. Ranked is built to handle every college football debate with the same clean canvas.</p>
        </div>
        <div className="template-grid">
          <Link href="/rank/top-25" className="template-card template-featured">
            <span className="template-tag">Featured weekly</span>
            <h3>College Football Top 25</h3>
            <p>Build your AP-style ballot with live records, results, and schedule context.</p>
            <strong>Start ranking →</strong>
          </Link>
          <Link href="/rank/stadiums" className="template-card">
            <span className="template-icon">⌂</span>
            <h3>Best Stadiums</h3>
            <p>Atmosphere, tradition, setting—make the list your way.</p>
            <strong>Rank 10 →</strong>
          </Link>
          <div className="template-card template-muted">
            <span className="template-icon">QB</span>
            <h3>Quarterbacks</h3>
            <p>Player templates arrive after roster data and identity are production-ready.</p>
            <span className="soon">Coming next</span>
          </div>
        </div>
      </section>
    </>
  );
}
