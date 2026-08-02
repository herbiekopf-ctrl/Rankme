import type { Metadata } from "next";
import { PreferenceProfile } from "@/components/PreferenceProfile";

export const metadata: Metadata = { title: "Your perspective · Ranked" };

export default function ProfilePage() {
  return <main className="profile-page shell"><section className="profile-intro"><p className="kicker">PRIVACY BY DESIGN</p><h1>Give your rankings context,<br /><em>not your identity.</em></h1><p>These optional preferences make cohort comparisons useful while Ranked&apos;s database functions prevent small-group or individual disclosure.</p></section><PreferenceProfile /></main>;
}
