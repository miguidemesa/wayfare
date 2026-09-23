import { getAuthUser } from "@/lib/auth";
import { getTripBundle } from "@/lib/trip-service";
import { notFound } from "next/navigation";
import { ReservationsClient } from "./reservations-client";

export const dynamic = "force-dynamic";

export default async function ReservationsPage({
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

  return <ReservationsClient tripId={tripId} bundle={bundle} />;
}