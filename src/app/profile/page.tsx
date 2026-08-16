import type { Metadata } from "next";
import { PreferenceProfile } from "@/components/PreferenceProfile";
import { MyMetrics } from "@/components/MyMetrics";

export const metadata: Metadata = { title: "Your perspective · Ranked" };

export default function ProfilePage() {
  return <main className="profile-page shell"><section className="profile-intro"><p className="kicker">YOUR PROFILE</p><h1>Your perspective,<br /><em>your models.</em></h1><p>Manage the context behind your rankings and reuse the metrics you build.</p></section><PreferenceProfile /><MyMetrics /></main>;
}
