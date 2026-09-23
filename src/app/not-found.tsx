import Link from "next/link";
import { Compass, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 text-center text-ink selection:bg-accent/20">
      <div className="animate-fade-up max-w-md space-y-4">
        <span className="grid mx-auto h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-accent to-sky text-white shadow-sm">
          <Compass size={24} strokeWidth={2.2} />
        </span>
        <h1 className="font-display text-4xl font-normal tracking-tight">
          Page not found
        </h1>
        <p className="text-sm text-ink-2">
          The page you are looking for does not exist, was moved, or belongs to another trip.
        </p>
        <div className="pt-2">
          <Link href="/">
            <Button variant="brand" size="md">
              <ArrowLeft size={15} />
              Return to Your Trips
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
