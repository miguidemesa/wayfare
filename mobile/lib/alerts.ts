import { useEffect, useState, useSyncExternalStore } from "react";

// Alerts dismissed this session, shared by every screen that shows them
// (Plan and Home), so dismissing one in one place hides it in both.
const dismissed = new Set<string>();
let version = 0;
const listeners = new Set<() => void>();

export function dismissAlert(id: string) {
  dismissed.add(id);
  version++;
  listeners.forEach((l) => l());
}

export function useDismissedAlerts(): ReadonlySet<string> {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version
  );
  return dismissed;
}

/** The current time, refreshed every `ms` — for "leave in 12 min" and the like. */
export function useNow(ms = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
