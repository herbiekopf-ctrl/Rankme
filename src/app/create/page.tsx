import type { Metadata } from "next";
import { PollCreator } from "@/components/PollCreator";

export const metadata: Metadata = { title: "Create a custom poll", description: "Create a college football ranking from teams, conferences, mascots, towns, stadiums, players, or your own options." };

export default function CreatePollPage() {
  return <PollCreator />;
}
