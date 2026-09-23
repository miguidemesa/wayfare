"use client";

import { useEffect, useState } from "react";
import { flushOutbox, lastSyncedAt, pendingCount } from "@/lib/client-api";

export type OnlineState = {
  online: boolean;
  pending: number;
  lastSync: number | null;
  refresh: () => void;
};

export function useOnline(): OnlineState {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [lastSync, setLastSync] = useState<number | null>(null);

  const refresh = () => {
    setOnline(navigator.onLine);
    setPending(pendingCount());
    setLastSync(lastSyncedAt());
  };

  useEffect(() => {
    refresh();
    const onOnline = async () => {
      refresh();
      await flushOutbox();
      refresh();
    };
    // Bridge service-worker messages ("wayfare:sync" from background sync)
    // into the window event the hook already understands.
    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "wayfare:sync") {
        void onOnline();
      }
    };
    navigator.serviceWorker?.addEventListener("message", onSwMessage);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", refresh);
    window.addEventListener("wayfare:sync", refresh);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", refresh);
      window.removeEventListener("wayfare:sync", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { online, pending, lastSync, refresh };
}
