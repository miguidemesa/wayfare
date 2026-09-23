"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";

export function NewTripButton({ large }: { large?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      onClick={() => {
        setBusy(true);
        router.push("/new-trip");
      }}
      disabled={busy}
      className={
        large
          ? "mt-5 inline-flex items-center gap-1.5 rounded-[10px] bg-ink px-4 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
          : "inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-accent to-sky px-3.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:shadow-md active:scale-[0.98] disabled:opacity-60"
      }
    >
      <Plus size={15} strokeWidth={2.5} />
      New trip
    </button>
  );
}
