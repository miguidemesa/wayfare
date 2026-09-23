"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console or error service in production
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 text-center text-ink selection:bg-accent/20">
      <div className="animate-fade-up max-w-md space-y-4">
        <span className="grid mx-auto h-12 w-12 place-items-center rounded-2xl bg-danger/10 text-danger border border-danger/25">
          <AlertTriangle size={24} />
        </span>
        <h1 className="font-display text-3xl font-normal tracking-tight">
          Something went wrong
        </h1>
        <p className="text-sm text-ink-2">
          An unexpected error occurred while loading this page. You can try refreshing or returning to your dashboard.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="secondary" onClick={() => reset()}>
            <RefreshCw size={14} />
            Try again
          </Button>
          <Link href="/">
            <Button variant="brand">
              <Home size={14} />
              Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
