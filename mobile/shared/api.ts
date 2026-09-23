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

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

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

// ------------------------------------------------------------ trip endpoints

export function fetchTrips() {
  return api.get<{ trips: TripSummary[] } | TripSummary[]>("/api/trips").then(normalizeTripsList);
}

function normalizeTripsList(raw: { trips?: TripSummary[] } | TripSummary[]): TripSummary[] {
  const list = Array.isArray(raw) ? raw : (raw.trips ?? []);
  return [...list].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function fetchTripBundle(tripId: string) {
  return api.get<TripBundle>(`/api/trips/${tripId}`);
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
    placeName?: string;
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
  }
) {
  return api.patch<{ item: ItineraryItem }>(`/api/items/${itemId}`, payload);
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
  return api.delete<{ ok: boolean }>(`/api/trips/${tripId}/checklist?id=${id}`);
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
  return api.delete<{ ok: boolean }>(`/api/trips/${tripId}/documents?id=${id}`);
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
  return api.delete<{ ok: boolean }>(`/api/trips/${tripId}/reservations?id=${id}`);
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
  return api.delete<{ ok: boolean }>(`/api/trips/${tripId}/hotels?id=${id}`);
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
  return api.delete<{ ok: boolean }>(`/api/trips/${tripId}/flights?id=${id}`);
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
  return api.delete<{ ok: boolean }>(`/api/trips/${tripId}/saved-places?id=${id}`);
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
  return api.delete<{ ok: boolean }>(`/api/trips/${tripId}/journal?id=${id}`);
}

// -------------------------------------------------------- currency endpoints

export function fetchCurrencyRates() {
  return api.get<CurrencyRateResponse>("/api/currency");
}