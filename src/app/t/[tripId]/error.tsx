"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui";

export default function TripError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Trip section error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <div className="card p-8 space-y-4 animate-fade-up">
        <span className="grid mx-auto h-11 w-11 place-items-center rounded-xl bg-danger/10 text-danger border border-danger/25">
          <AlertTriangle size={20} />
        </span>
        <h2 className="text-xl font-semibold">Failed to load trip section</h2>
        <p className="text-xs text-ink-2">
          {error.message || "An error occurred while rendering this section."}
        </p>
        <div className="flex items-center justify-center gap-3 pt-3">
          <Button variant="secondary" size="sm" onClick={() => reset()}>
            <RefreshCw size={13} />
            Try again
          </Button>
          <Link href="/">
            <Button variant="brand" size="sm">
              <Home size={13} />
              All Trips
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
