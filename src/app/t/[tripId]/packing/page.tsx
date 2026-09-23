import { getAuthUser } from "@/lib/auth";
import { getTripBundle } from "@/lib/trip-service";
import { notFound } from "next/navigation";
import { PackingClient } from "./packing-client";

export const dynamic = "force-dynamic";

export default async function PackingPage({
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

  return <PackingClient tripId={tripId} bundle={bundle} />;
}