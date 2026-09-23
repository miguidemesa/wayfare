import { getAuthUser } from "@/lib/auth";
import { getTripBundle } from "@/lib/trip-service";
import { notFound } from "next/navigation";
import { OverviewClient } from "./overview-client";

export const dynamic = "force-dynamic";

export default async function TripOverviewPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const user = await getAuthUser();
  if (!user) return null;
  const { tripId } = await params;

  let bundle;
  try {
    bundle = await getTripBundle(tripId, user.id);
  } catch {
    notFound();
  }

  const aiStatus = { live: false };
  try {
    const { providerStatus } = await import("@/lib/ai/providers");
    const s = providerStatus();
    aiStatus.live = s.configured;
  } catch {}

  return <OverviewClient bundle={bundle} aiLive={aiStatus.live} />;
}
