import type { Metadata } from "next";
import { PreferenceProfile } from "@/components/PreferenceProfile";
import { MyMetrics } from "@/components/MyMetrics";
import { MyRankings } from "@/components/MyRankings";

export const metadata: Metadata = { title: "Your perspective · Ranked" };

export default function ProfilePage() {
  return <main className="profile-page shell"><section className="profile-intro"><p className="kicker">YOUR PROFILE</p><h1>Your perspective,<br /><em>over time.</em></h1><p>Review every saved list, see when your opinions changed, and reuse the metrics you build.</p></section><PreferenceProfile /><MyRankings /><MyMetrics /></main>;
}
