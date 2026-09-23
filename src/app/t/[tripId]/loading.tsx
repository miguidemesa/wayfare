// Destination-aware loading state for the whole trip segment.
// Shows a calm, useful skeleton while the TripBundle is assembled.

export default function TripLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6" role="status" aria-label="Loading trip">
      {/* masthead skeleton */}
      <div className="skeleton h-64 rounded-2xl" />

      <div className="mt-6 flex items-center gap-3">
        <span className="h-2 w-2 animate-pulse rounded-full bg-accent" style={{ animationDuration: "2s" }} />
        <p className="text-sm italic text-ink-3">Finding the best rhythm for your journey…</p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="skeleton h-44 rounded-2xl" />
        <div className="skeleton h-44 rounded-2xl" />
        <div className="skeleton h-44 rounded-2xl" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="skeleton h-60 rounded-2xl" />
        <div className="skeleton h-60 rounded-2xl" />
      </div>
    </div>
  );
}