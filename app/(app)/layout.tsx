import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { primaryUnit } from "@/lib/db";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const path = (await headers()).get("x-pathname") || "";
  const unit = primaryUnit(user.id);
  if (!unit && path !== "/onboarding") redirect("/onboarding");
  if (unit && path === "/onboarding") redirect("/home");
  return <Shell user={user} unit={unit}>{children}</Shell>;
}
