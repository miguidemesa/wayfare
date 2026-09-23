import { notFound, redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { JoinTripClient } from "./join-client";

export const dynamic = "force-dynamic";

export default async function JoinTripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const user = await getAuthUser();

  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      title: true,
      subtitle: true,
      coverEmoji: true,
      coverTheme: true,
      startDate: true,
      endDate: true,
      travelersCount: true,
      user: { select: { name: true } },
    },
  });

  if (!trip) notFound();

  // If signed in and already owner, redirect directly
  if (user) {
    const isOwner = await db.trip.findFirst({
      where: { id: tripId, userId: user.id },
    });
    if (isOwner) redirect(`/t/${tripId}`);
  }

  return (
    <JoinTripClient
      trip={{
        id: trip.id,
        title: trip.title,
        subtitle: trip.subtitle,
        coverEmoji: trip.coverEmoji,
        coverTheme: trip.coverTheme,
        startDate: trip.startDate.toISOString(),
        endDate: trip.endDate.toISOString(),
        travelersCount: trip.travelersCount,
        ownerName: trip.user.name,
      }}
      user={user ? { name: user.name, email: user.email } : null}
    />
  );
}
