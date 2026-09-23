import { getAuthUser } from "@/lib/auth";
import { getTripBundle } from "@/lib/trip-service";
import { computeAnalytics } from "@/lib/trip-service";
import { notFound } from "next/navigation";
import { WrappedClient } from "./wrapped-client";

export const dynamic = "force-dynamic";

export default async function WrappedPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const user = await getAuthUser();
  if (!user) return null;
  const { tripId } = await params;

  let bundle, analytics;
  try {
    [bundle, analytics] = await Promise.all([
      getTripBundle(tripId, user.id),
      computeAnalytics(tripId, user.id),
    ]);
  } catch {
    notFound();
  }

  return <WrappedClient bundle={bundle} analytics={analytics} />;
}