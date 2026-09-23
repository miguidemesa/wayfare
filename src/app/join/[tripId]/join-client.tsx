"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarRange, Users, ArrowRight, Compass } from "lucide-react";
import { Button, Card, Badge, toast } from "@/components/ui";
import { CoverArt } from "@/components/covers";
import { api, ApiError } from "@/lib/client-api";

type JoinTripData = {
  id: string;
  title: string;
  subtitle: string | null;
  coverEmoji: string;
  coverTheme: string;
  startDate: string;
  endDate: string;
  travelersCount: number;
  ownerName: string;
};

export function JoinTripClient({
  trip,
  user,
}: {
  trip: JoinTripData;
  user: { name: string; email?: string } | null;
}) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);
  const dateFmt = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  async function handleJoin() {
    setError(null);
    setJoining(true);
    try {
      await api(`/api/trips/${trip.id}/join`, { method: "POST" });
      toast.success(`Joined ${trip.title}!`);
      router.push(`/t/${trip.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to join trip");
      setJoining(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 py-12 text-ink selection:bg-accent/20">
      <div className="w-full max-w-md animate-fade-up space-y-4">
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-ink-3">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent to-sky text-white shadow-xs">
            <Compass size={16} strokeWidth={2.3} />
          </span>
          Wayfare Trip Invite
        </div>

        <Card className="overflow-hidden shadow-pop">
          <CoverArt theme={trip.coverTheme} emoji={trip.coverEmoji} size="md" className="h-36">
            <span className="absolute left-3 top-3">
              <Badge tone="accent" className="border-white/20 bg-white/20 !text-white backdrop-blur">
                Invitation
              </Badge>
            </span>
          </CoverArt>

          <div className="p-6 space-y-4">
            <div>
              <p className="text-xs font-medium text-ink-3">
                {trip.ownerName} invited you to
              </p>
              <h1 className="mt-1 font-display text-2xl font-normal tracking-tight">
                {trip.title}
              </h1>
              {trip.subtitle && (
                <p className="mt-0.5 text-xs text-ink-2">{trip.subtitle}</p>
              )}
            </div>

            <div className="space-y-2 border-y border-line py-3 text-xs text-ink-2">
              <div className="flex items-center gap-2">
                <CalendarRange size={13} className="text-accent shrink-0" />
                <span>{dateFmt}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users size={13} className="text-accent shrink-0" />
                <span>{trip.travelersCount} traveler{trip.travelersCount !== 1 ? "s" : ""} on this trip</span>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
                {error}
              </div>
            )}

            <div className="pt-2">
              {user ? (
                <Button
                  variant="brand"
                  size="lg"
                  className="w-full"
                  onClick={handleJoin}
                  loading={joining}
                >
                  Join Trip as {user.name}
                  <ArrowRight size={15} />
                </Button>
              ) : (
                <Link href={`/login?next=/join/${trip.id}`} className="block">
                  <Button variant="brand" size="lg" className="w-full">
                    Sign in to Accept Invite
                    <ArrowRight size={15} />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </Card>

        <p className="text-center text-xs text-ink-3">
          Shared via Wayfare AI Travel OS · Secure trip coordination
        </p>
      </div>
    </div>
  );
}
