import { LiveAffinityQuery } from "@/components/LiveAffinityQuery";

export default function InsightsPage() {
  return <main className="shell live-insights-page"><p className="kicker">REAL AGGREGATE INSIGHTS</p><h1>Ranking connections</h1><p>Results appear only from eligible published ballots after the privacy threshold is met. Ranked does not show synthetic previews.</p><LiveAffinityQuery /></main>;
}
