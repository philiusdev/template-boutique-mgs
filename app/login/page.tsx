import { LoginForm } from "@/components/login-form";
import { safeInternalPath } from "@/lib/safe-internal-path";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const destination = safeInternalPath(next);
  return <LoginForm destination={destination} authError={error} />;
}
