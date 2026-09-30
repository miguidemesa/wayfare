import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError, fetchCurrencyRates, fetchTripBundle } from "@/shared/api";
import { todayDayIndex } from "@/shared/trip";
import type { TripBundle } from "@/shared/types";

// One source of truth per open trip. Every screen under /trips/[tripId] reads
// from here instead of fetching its own copy, so Plan, Map and Spend always
// agree and a mutation anywhere is visible everywhere.

// Last bundle per trip, kept for the session: reopening a trip renders
// immediately while a fresh copy loads behind it.
const bundleCache = new Map<string, TripBundle>();
export type Rates = { rates: Record<string, number>; source: string; updatedAt: string };
let ratesCache: Rates | null = null;

export function peekBundle(tripId: string) {
  return bundleCache.get(tripId) ?? null;
}

type TripContextValue = {
  tripId: string;
  bundle: TripBundle | null;
  error: string | null;
  refreshing: boolean;
  reload: () => Promise<void>;
  /** Optimistic local edit. Follow with reload() (or roll back) on failure. */
  update: (fn: (b: TripBundle) => TripBundle) => void;
  dayIndex: number;
  setDayIndex: (i: number) => void;
  selectedItemId: string | null;
  setSelectedItemId: (id: string | null) => void;
  rates: Rates | null;
  ensureRates: () => Promise<void>;
};

const TripContext = createContext<TripContextValue | null>(null);

export function TripProvider({ tripId, children }: { tripId: string; children: ReactNode }) {
  const [bundle, setBundle] = useState<TripBundle | null>(() => bundleCache.get(tripId) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // null until the traveller picks a day; see `wantedDay` below.
  const [pickedDay, setPickedDay] = useState<number | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [rates, setRates] = useState<Rates | null>(ratesCache);
  const inflight = useRef<Promise<void> | null>(null);
  const queued = useRef<Promise<void> | null>(null);
  const currentTrip = useRef(tripId);
  currentTrip.current = tripId;

  const load = useCallback(() => {
    setRefreshing(true);
    const id = tripId;
    const p = fetchTripBundle(id)
      .then((data) => {
        bundleCache.set(id, data);
        // A trip opened since this started owns the screen now.
        if (currentTrip.current !== id) return;
        setBundle(data);
        setError(null);
      })
      .catch((e) => {
        if (currentTrip.current !== id) return;
        setError(e instanceof ApiError ? e.message : "Couldn't load this trip.");
      })
      .finally(() => {
        if (inflight.current === p) {
          inflight.current = null;
          setRefreshing(false);
        }
      });
    inflight.current = p;
    return p;
  }, [tripId]);

  // A load already running may have started before the change the caller just
  // saved, so its result can't be trusted to include it. Queue one fresh load
  // behind it; any further calls meanwhile share that one.
  const reload = useCallback((): Promise<void> => {
    if (!inflight.current) return load();
    if (!queued.current) {
      queued.current = inflight.current.then(() => {
        queued.current = null;
        return load();
      });
    }
    return queued.current;
  }, [load]);

  useEffect(() => {
    setPickedDay(null);
    setBundle(bundleCache.get(tripId) ?? null);
    // Anything still running belongs to the previous trip.
    inflight.current = null;
    queued.current = null;
    void reload();
  }, [tripId, reload]);

  // Open on today's page while travelling, otherwise day 1, until the
  // traveller picks a day; their choice sticks. Worked out while rendering,
  // so the plan never shows day 1 for a moment before jumping to today.
  const wantedDay = pickedDay ?? (bundle ? (todayDayIndex(bundle.days) ?? 0) : 0);
  const days = bundle?.days.length ?? 0;
  const safeDay = days === 0 ? 0 : Math.min(wantedDay, days - 1);

  const update = useCallback(
    (fn: (b: TripBundle) => TripBundle) =>
      setBundle((prev) => {
        if (!prev) return prev;
        const next = fn(prev);
        bundleCache.set(tripId, next);
        return next;
      }),
    [tripId]
  );

  const setDayIndex = useCallback((i: number) => {
    setPickedDay(i);
    setSelectedItemId(null);
  }, []);

  const ensureRates = useCallback(async () => {
    if (ratesCache) return;
    try {
      const r = await fetchCurrencyRates();
      ratesCache = { rates: r.rates, source: r.source, updatedAt: r.updatedAt };
      setRates(ratesCache);
    } catch {
      // Conversion previews are a nicety; the server converts on save.
    }
  }, []);

  const value = useMemo<TripContextValue>(
    () => ({
      tripId,
      bundle,
      error,
      refreshing,
      reload,
      update,
      dayIndex: safeDay,
      setDayIndex,
      selectedItemId,
      setSelectedItemId,
      rates,
      ensureRates,
    }),
    [tripId, bundle, error, refreshing, reload, update, safeDay, setDayIndex, selectedItemId, rates, ensureRates]
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTrip must be used inside a trip route");
  return ctx;
}

/** For screens that can only render once the bundle exists. */
export function useLoadedTrip() {
  const ctx = useTrip();
  return ctx as TripContextValue & { bundle: TripBundle };
}

export function invalidateTrip(tripId: string) {
  bundleCache.delete(tripId);
}

/** Forget every cached trip, e.g. on sign-out, so the next account can't see them. */
export function clearTripCache() {
  bundleCache.clear();
  ratesCache = null;
}
