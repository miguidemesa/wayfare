"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui";
import type { TripBundle } from "@/lib/trip-service";

const MapView = dynamic(() => import("./map-view"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
      <Skeleton className="h-[70vh] w-full rounded-2xl" />
    </div>
  ),
});

export function MapLoader({ bundle }: { bundle: TripBundle }) {
  return <MapView bundle={bundle} />;
}
