// Canonical string unions for fields stored as TEXT in SQLite.

export const ITEM_TYPES = [
  "FLIGHT",
  "HOTEL",
  "RESTAURANT",
  "ACTIVITY",
  "TRANSPORT",
  "RESERVATION",
  "PERSONAL",
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const EXPENSE_CATEGORIES = [
  "FOOD",
  "TRANSPORT",
  "HOTEL",
  "FLIGHT",
  "ACTIVITY",
  "SHOPPING",
  "ENTERTAINMENT",
  "MISC",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_META: Record<
  ExpenseCategory,
  { label: string; emoji: string; color: string }
> = {
  FOOD: { label: "Food", emoji: "🍜", color: "#F59E0B" },
  TRANSPORT: { label: "Transport", emoji: "🚆", color: "#38BDF8" },
  HOTEL: { label: "Hotel", emoji: "🏨", color: "#A78BFA" },
  FLIGHT: { label: "Flights", emoji: "✈️", color: "#34D399" },
  ACTIVITY: { label: "Activities", emoji: "🎟️", color: "#FB7185" },
  SHOPPING: { label: "Shopping", emoji: "🛍️", color: "#E879F9" },
  ENTERTAINMENT: { label: "Entertainment", emoji: "🎭", color: "#FBBF24" },
  MISC: { label: "Misc", emoji: "🧾", color: "#94A3B8" },
};

export const PLACE_CATEGORIES = [
  "RESTAURANT",
  "ATTRACTION",
  "CAFE",
  "BAR",
  "SHOPPING",
  "ESSENTIAL",
  "PARK",
  "MUSEUM",
  "TEMPLE",
  "OTHER",
] as const;
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

export const PLACE_CATEGORY_META: Record<PlaceCategory, { label: string; emoji: string }> = {
  RESTAURANT: { label: "Restaurants", emoji: "🍽️" },
  ATTRACTION: { label: "Attractions", emoji: "📍" },
  CAFE: { label: "Cafés", emoji: "☕" },
  BAR: { label: "Bars & Nightlife", emoji: "🍸" },
  SHOPPING: { label: "Shopping", emoji: "🛍️" },
  ESSENTIAL: { label: "Essentials", emoji: "🛒" },
  PARK: { label: "Parks", emoji: "🌳" },
  MUSEUM: { label: "Museums", emoji: "🏛️" },
  TEMPLE: { label: "Temples & Shrines", emoji: "⛩️" },
  OTHER: { label: "Other", emoji: "📌" },
};

export const TRANSPORT_MODES = ["WALK", "TRAIN", "BUS", "TAXI", "CAR", "FLIGHT"] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];

export const RESERVATION_TYPES = [
  "FLIGHT",
  "HOTEL",
  "RESTAURANT",
  "ACTIVITY",
  "TRAIN",
  "TOUR",
  "EVENT",
] as const;
export type ReservationType = (typeof RESERVATION_TYPES)[number];

export const DOC_KINDS = [
  "PASSPORT_NOTE",
  "FLIGHT",
  "HOTEL",
  "RESTAURANT",
  "TOUR",
  "TICKET",
  "INSURANCE",
  "NOTE",
  "OTHER",
] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export const TRIP_STATUSES = ["PLANNING", "UPCOMING", "ACTIVE", "COMPLETED"] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const PACE_LEVELS = ["relaxed", "balanced", "packed"] as const;
export type PaceLevel = (typeof PACE_LEVELS)[number];

export const INTEREST_OPTIONS = [
  "Food",
  "Culture",
  "Shopping",
  "Nightlife",
  "Nature",
  "Photography",
  "History",
  "Luxury",
  "Adventure",
  "Relaxation",
  "Anime & Pop Culture",
  "Architecture",
] as const;
export type Interest = (typeof INTEREST_OPTIONS)[number];

export function statusForDates(startDate: Date, endDate: Date): TripStatus {
  const now = new Date();
  if (now < startDate) return "UPCOMING";
  if (now > endDate) return "COMPLETED";
  return "ACTIVE";
}
