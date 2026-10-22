import { LoginPage } from "@/components/login-page";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  return <LoginPage searchParams={searchParams} />;
}
