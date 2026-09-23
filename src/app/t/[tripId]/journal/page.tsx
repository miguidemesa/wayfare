import { getAuthUser } from "@/lib/auth";
import { getTripBundle } from "@/lib/trip-service";
import { notFound } from "next/navigation";
import { JournalClient } from "./journal-client";

export const dynamic = "force-dynamic";

export default async function JournalPage({
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

  return <JournalClient tripId={tripId} bundle={bundle} />;
}