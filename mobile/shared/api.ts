// Mobile API client — same cookie-session backend as the web app.
// React Native's fetch persists cookies natively per host, so the existing
// auth works unchanged.

import type {
  ChecklistItem,
  CreateTripPayload,
  CurrencyRateResponse,
  DocumentFile,
  Expense,
  Flight,
  Hotel,
  ItineraryItem,
  JournalEntry,
  POI,
  Reservation,
  SavedPlace,
  TripBundle,
  TripSummary,
} from "./types";
import { addDays, dayKey, daysBetween, learnServerOffset } from "./trip";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Called when a signed-in request comes back 401: the session expired or was
// revoked. The auth provider registers this to send the user to sign in.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

// A 401 from these is an answer ("wrong password", "not signed in"), not a
// lost session.
const AUTH_PATHS = /^\/api\/auth\//;

async function request<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const method = init?.method ?? (init?.json ? "POST" : "GET");
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      method,
      headers: {
        ...(init?.json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
      credentials: "include",
    });
  } catch {
    throw new ApiError(0, "Can't reach Wayfare — check your connection.");
  }
  if (!res.ok) {
    if (res.status === 401 && !AUTH_PATHS.test(path)) onUnauthorized?.();
    let message = `Error ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data?.error === "string") message = data.error;
    } catch {}
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, json?: unknown) => request<T>(path, { method: "POST", json }),
  patch: <T>(path: string, json?: unknown) => request<T>(path, { method: "PATCH", json }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// ------------------------------------------------------------- auth endpoints

export async function login(email: string, password: string) {
  return api.post<{ id: string; name: string; email: string }>("/api/auth/login", {
    email,
    password,
  });
}

export async function register(email: string, password: string, name?: string) {
  return api.post<{ id: string; name: string; email: string }>("/api/auth/register", {
    email,
    password,
    name,
  });
}

export async function logout() {
  await api.post("/api/auth/logout").catch(() => {});
}

/** The signed-in user, or null. Throws ApiError(0) when the server can't be reached. */
export async function fetchMe() {
  const res = await api.get<{ user: { id: string; name: string; email: string } | null }>("/api/auth/me");
  return res.user;
}

// ------------------------------------------------------------ trip endpoints

export function fetchTrips() {
  return api.get<{ trips: TripSummary[] } | TripSummary[]>("/api/trips").then(normalizeTripsList);
}

function normalizeTripsList(raw: { trips?: TripSummary[] } | TripSummary[]): TripSummary[] {
  const list = Array.isArray(raw) ? raw : (raw.trips ?? []);
  // Before any date on screen is read — see dayKey() in trip.ts.
  if (list[0]) learnServerOffset(list[0].startDate);
  return [...list].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export async function fetchTripBundle(tripId: string) {
  const bundle = await api.get<TripBundle>(`/api/trips/${tripId}`);
  learnServerOffset(bundle.trip.startDate);
  return bundle;
}

export function createTrip(payload: CreateTripPayload) {
  return api.post<{ trip: { id: string } }>("/api/trips", payload);
}

export function deleteTrip(tripId: string) {
  return api.delete<{ ok: boolean }>(`/api/trips/${tripId}`);
}

// -------------------------------------------------------- itinerary endpoints

export function addItineraryItem(
  tripId: string,
  payload: {
    dayId: string;
    type?: string;
    title: string;
    startTime?: string;
    durationMin?: number;
    /** Links the stop to a place from /places — the only way it gets coordinates. */
    poiId?: string;
    cost?: number;
    currency?: string;
    notes?: string;
  }
) {
  return api.post<{ item: ItineraryItem }>(`/api/trips/${tripId}/itinerary`, {
    kind: "item",
    ...payload,
  });
}

export function updateItineraryItem(
  itemId: string,
  payload: {
    title?: string;
    startTime?: string | null;
    durationMin?: number;
    cost?: number | null;
    notes?: string | null;
    confirmed?: boolean;
    type?: string;
    moveToDayId?: string;
  }
) {
  return api.patch<{ item: ItineraryItem }>(`/api/items/${itemId}`, payload);
}

export function createDay(tripId: string, date: string, city?: string) {
  return api.post<{ day: { id: string } }>(`/api/trips/${tripId}/itinerary`, { kind: "day", date, city });
}

/** A generous ceiling so a mistyped year can't create thousands of days. */
export const MAX_TRIP_DAYS = 366;

/**
 * Create a day for every date in the trip that doesn't have one yet. New trips
 * start with no days, and stops can only be added to a day. Takes YYYY-MM-DD
 * keys (use dayKey() on a trip's dates). One request at a time: the server
 * numbers each new day from the ones already there.
 */
export async function layOutDays(
  tripId: string,
  startKey: string,
  endKey: string,
  existing: { date: string }[],
  /** One city, or several split across the trip in order. */
  cities?: string | string[]
) {
  const have = new Set(existing.map((d) => dayKey(d.date)));
  const total = Math.min(daysBetween(startKey, endKey) + 1, MAX_TRIP_DAYS);
  const list = cities == null ? [] : Array.isArray(cities) ? cities : [cities];
  let created = 0;
  for (let n = 0; n < total; n++) {
    const key = addDays(startKey, n);
    if (have.has(key)) continue;
    const city = list.length ? list[Math.min(list.length - 1, Math.floor((n * list.length) / total))] : undefined;
    await createDay(tripId, key, city);
    created++;
  }
  return created;
}

/** Persist a day's full stop order. */
export function reorderDay(tripId: string, dayId: string, itemIds: string[]) {
  return api.patch<{ ok: boolean }>(`/api/trips/${tripId}/itinerary`, { dayId, itemIds });
}

export function deleteItineraryItem(itemId: string) {
  return api.delete<{ ok: boolean }>(`/api/items/${itemId}`);
}

export function optimizeDay(tripId: string, date: string, apply: boolean = false) {
  return api.post<{ summary?: string; order?: string[]; timeSavedMin?: number }>(
    `/api/trips/${tripId}/optimize`,
    { date, apply }
  );
}

export function generateItineraryPlan(
  tripId: string,
  apply: boolean = false,
  plan?: unknown[],
  pace?: "relaxed" | "balanced" | "packed"
) {
  return api.post<{ plan?: unknown[]; appliedDays?: number; totalTravelMin?: number; estCost?: number }>(
    `/api/trips/${tripId}/generate`,
    { apply, plan, pace }
  );
}

// --------------------------------------------------------- expenses endpoints

export function addExpense(
  tripId: string,
  payload: {
    merchant: string;
    amount: number;
    currency: string;
    category?: string;
    date?: string;
    paymentMethod?: string;
    description?: string;
    locationName?: string;
  }
) {
  return api.post<{ expense: Expense }>(`/api/trips/${tripId}/expenses`, payload);
}

/** Send only what changed: a new amount or currency is re-converted at today's rate. */
export function updateExpense(
  expenseId: string,
  payload: {
    merchant?: string;
    amount?: number;
    currency?: string;
    category?: string;
    date?: string;
    paymentMethod?: string;
    description?: string | null;
  }
) {
  return api.patch<{ expense: Expense }>(`/api/expenses/${expenseId}`, payload);
}

export function deleteExpense(expenseId: string) {
  return api.delete<{ ok: boolean }>(`/api/expenses/${expenseId}`);
}

// -------------------------------------------------------- checklist endpoints

export function fetchChecklist(tripId: string) {
  return api.get<{ checklist: ChecklistItem[] }>(`/api/trips/${tripId}/checklist`);
}

export function toggleChecklistItem(tripId: string, id: string, checked: boolean) {
  return api.patch<{ item: ChecklistItem }>(`/api/trips/${tripId}/checklist`, { id, checked });
}

export function addChecklistItem(
  tripId: string,
  payload: { text: string; section?: "BEFORE_TRIP" | "PACKING"; category?: string }
) {
  return api.post<{ item: ChecklistItem }>(`/api/trips/${tripId}/checklist`, payload);
}

export function deleteChecklistItem(tripId: string, id: string) {
  return api.delete<{ ok: boolean }>(`/api/trips/${tripId}/checklist?id=${encodeURIComponent(id)}`);
}

export function generatePackingList(tripId: string) {
  return api.post<{ generated: number }>(`/api/trips/${tripId}/checklist`, { action: "generate" });
}

// -------------------------------------------------------- documents endpoints

export function fetchDocuments(tripId: string) {
  return api.get<{ documents: DocumentFile[] }>(`/api/trips/${tripId}/documents`);
}

export function addDocumentNote(
  tripId: string,
  payload: { name: string; kind: string; content: string; sensitive?: boolean }
) {
  const formData = new FormData();
  formData.append("name", payload.name);
  formData.append("kind", payload.kind);
  formData.append("content", payload.content);
  if (payload.sensitive) formData.append("sensitive", "true");

  return request<{ document: DocumentFile }>(`/api/trips/${tripId}/documents`, {
    method: "POST",
    body: formData,
  });
}

export function deleteDocument(tripId: string, id: string) {
  return api.delete<{ ok: boolean }>(`/api/trips/${tripId}/documents?id=${encodeURIComponent(id)}`);
}

// ----------------------------------------------------- reservations endpoints

export function fetchReservations(tripId: string) {
  return api.get<{ reservations: Reservation[] }>(`/api/trips/${tripId}/reservations`);
}

export function addReservation(
  tripId: string,
  payload: {
    type: string;
    title: string;
    dateTime: string;
    confirmationNumber?: string;
    locationName?: string;
    cost?: number;
    currency?: string;
    notes?: string;
  }
) {
  return api.post<{ reservation: Reservation }>(`/api/trips/${tripId}/reservations`, payload);
}

export function deleteReservation(tripId: string, id: string) {
  return api.delete<{ ok: boolean }>(`/api/trips/${tripId}/reservations?id=${encodeURIComponent(id)}`);
}

export function addHotel(
  tripId: string,
  payload: {
    name: string;
    destinationName?: string;
    address?: string;
    checkIn: string;
    checkOut: string;
    confirmationNumber?: string;
    phone?: string;
    costPerNight?: number;
    currency?: string;
  }
) {
  return api.post<{ hotel: Hotel }>(`/api/trips/${tripId}/hotels`, payload);
}

export function deleteHotel(tripId: string, id: string) {
  return api.delete<{ ok: boolean }>(`/api/trips/${tripId}/hotels?id=${encodeURIComponent(id)}`);
}

export function addFlight(
  tripId: string,
  payload: {
    airline: string;
    flightNumber?: string;
    originCode?: string;
    originCity?: string;
    destCode?: string;
    destCity?: string;
    departAt: string;
    arriveAt: string;
    seat?: string;
    confirmation?: string;
    price?: number;
    currency?: string;
  }
) {
  return api.post<{ flight: Flight }>(`/api/trips/${tripId}/flights`, payload);
}

export function deleteFlight(tripId: string, id: string) {
  return api.delete<{ ok: boolean }>(`/api/trips/${tripId}/flights?id=${encodeURIComponent(id)}`);
}

// ---------------------------------------------------------- places endpoints

export function fetchPlaces(
  tripId: string,
  params?: {
    city?: string;
    category?: string;
    q?: string;
    cuisine?: string;
    minRating?: number;
    openNow?: boolean;
  }
) {
  const query = new URLSearchParams({ tripId });
  if (params?.city) query.set("city", params.city);
  if (params?.category) query.set("category", params.category);
  if (params?.q) query.set("q", params.q);
  if (params?.cuisine) query.set("cuisine", params.cuisine);
  if (params?.minRating) query.set("minRating", String(params.minRating));
  if (params?.openNow) query.set("openNow", "1");

  return api.get<{ places: POI[] }>(`/api/trips/${tripId}/places?${query.toString()}`);
}

export function savePlace(tripId: string, poiId: string) {
  return api.post<{ savedPlace: SavedPlace; alreadySaved?: boolean }>(
    `/api/trips/${tripId}/saved-places`,
    { poiId }
  );
}

export function deleteSavedPlace(tripId: string, id: string) {
  return api.delete<{ ok: boolean }>(`/api/trips/${tripId}/saved-places?id=${encodeURIComponent(id)}`);
}

// --------------------------------------------------------- journal endpoints

export function fetchJournal(tripId: string) {
  return api.get<{ journal: JournalEntry[] }>(`/api/trips/${tripId}/journal`);
}

export function addJournalEntry(
  tripId: string,
  payload: {
    title: string;
    body?: string;
    date?: string;
    locationName?: string;
    mood?: string;
  }
) {
  return api.post<{ entry: JournalEntry }>(`/api/trips/${tripId}/journal`, payload);
}

export function deleteJournalEntry(tripId: string, id: string) {
  return api.delete<{ ok: boolean }>(`/api/trips/${tripId}/journal?id=${encodeURIComponent(id)}`);
}

// -------------------------------------------------------- currency endpoints

export function fetchCurrencyRates() {
  return api.get<CurrencyRateResponse>("/api/currency");
}
// ------------------------------------------------------------ concierge

export type ConciergeMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

export function fetchConversation(tripId: string) {
  return api.get<{ activeConversationId: string | null; messages: ConciergeMessage[] }>(
    `/api/trips/${tripId}/ai`
  );
}

/** Ask the trip concierge. It can edit the itinerary itself (toolsUsed says what it did). */
export function askConcierge(tripId: string, message: string, conversationId: string | null) {
  return api.post<{ conversationId: string; content: string; toolsUsed: string[] }>(
    `/api/trips/${tripId}/ai`,
    { message, conversationId }
  );
}

// ------------------------------------------------------------ geocoding

export type Place = { name: string; country: string; admin: string | null; lat: number; lng: number };

/** City search via Open-Meteo's free geocoder (no key). */
export async function searchCities(query: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  let res: Response;
  try {
    res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?count=6&language=en&format=json&name=${encodeURIComponent(q)}`
    );
  } catch {
    throw new ApiError(0, "Can't search places offline.");
  }
  if (!res.ok) throw new ApiError(res.status, "Place search is unavailable right now.");
  const data = (await res.json()) as {
    results?: { name: string; country?: string; admin1?: string; latitude: number; longitude: number }[];
  };
  return (data.results ?? []).map((r) => ({
    name: r.name,
    country: r.country ?? "",
    admin: r.admin1 ?? null,
    lat: r.latitude,
    lng: r.longitude,
  }));
}
