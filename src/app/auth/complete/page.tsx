import { AuthCompleteRedirect } from "@/components/AuthCompleteRedirect";

export default async function AuthCompletePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error = "" } = await searchParams;
  return <AuthCompleteRedirect error={error} />;
}
