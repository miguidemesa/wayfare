import Link from "next/link";
import { Compass, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui";

export default function TripNotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="card p-8 space-y-4 animate-fade-up">
        <span className="grid mx-auto h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-accent to-sky text-white shadow-sm">
          <Compass size={22} />
        </span>
        <h2 className="text-xl font-semibold">Trip not found</h2>
        <p className="text-xs text-ink-2">
          This trip may have been deleted or you may not have permission to view it.
        </p>
        <div className="pt-2">
          <Link href="/">
            <Button variant="brand" size="sm">
              <ArrowLeft size={14} />
              Return to Your Trips
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
