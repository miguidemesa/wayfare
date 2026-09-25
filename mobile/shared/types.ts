import type { TripBrief } from "./brief";

// Shared data types for the mobile app — mirrors the JSON the Wayfare API
// returns (Prisma Dates serialize as ISO strings over the wire).

export type Destination = {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  order: number;
  arrivalDate?: string | null;
};

export type TripSummary = {
  id: string;
  title: string;
  subtitle: string | null;
  coverEmoji: string;
  coverTheme: string;
  status: string;
  startDate: string;
  endDate: string;
  budgetAmount: number;
  homeCurrency: string;
  travelersCount: number;
  destinations: Destination[];
  spent: number;
  _count: { days: number; items: number; expenses: number };
};

export type ItineraryItem = {
  id: string;
  type: string; // FLIGHT | HOTEL | RESTAURANT | ACTIVITY | TRANSPORT | RESERVATION | PERSONAL
  title: string;
  startTime: number | null;
  endTime: number | null;
  durationMin: number;
  neighborhood: string | null;
  placeName: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  cost: number | null;
  currency: string | null;
  notes: string | null;
  /** Why the planner picked it; null for stops the traveller added. */
  reason?: string | null;
  confirmed: boolean;
  transportMode: string | null;
  transportMin: number | null;
  transportCost?: number | null;
  order?: number;
};

export type ItineraryDay = {
  id: string;
  date: string;
  city: string;
  title: string | null;
  summary?: string | null;
  dayIndex: number;
  items: ItineraryItem[];
};

export type Expense = {
  id: string;
  category: string;
  merchant: string;
  amount: number;
  currency: string;
  amountHome: number;
  date: string;
  description: string | null;
  locationName?: string | null;
  paymentMethod?: string;
  receiptUrl?: string | null;
  aiCategorized?: boolean;
};

export type WeatherSnapshot = {
  city: string;
  date: string;
  tempMinC: number;
  tempMaxC: number;
  condition: string;
  rainProb: number;
  humidity?: number;
  windKph?: number;
  source: string;
};

export type Hotel = {
  id: string;
  destinationName: string | null;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  confirmationNumber: string | null;
  phone: string | null;
  costPerNight: number;
  currency: string;
};

export type Flight = {
  id: string;
  airline: string;
  flightNumber: string;
  originCode: string;
  originCity: string;
  destCode: string;
  destCity: string;
  departAt: string;
  arriveAt: string;
  seat: string | null;
  confirmation: string | null;
  terminal: string | null;
  gate: string | null;
  price: number;
  currency: string;
  status: string;
};

export type Reservation = {
  id: string;
  type: string; // FLIGHT | HOTEL | RESTAURANT | ACTIVITY | TRAIN | TOUR | EVENT
  title: string;
  dateTime: string;
  confirmationNumber: string | null;
  locationName: string | null;
  address: string | null;
  cost: number | null;
  currency: string | null;
  cancellationDeadline: string | null;
  status: string;
  notes: string | null;
};

export type SavedPlace = {
  id: string;
  name: string;
  category: string;
  cuisine: string | null;
  lat: number;
  lng: number;
  address: string | null;
  rating: number | null;
  priceLevel: number | null;
  openHours: string | null;
  notes: string | null;
  createdAt: string;
};

export type JournalEntry = {
  id: string;
  date: string;
  title: string;
  body: string | null;
  locationName: string | null;
  photos: string; // JSON string[]
  mood: string | null;
};

export type DocumentFile = {
  id: string;
  name: string;
  kind: string; // PASSPORT_NOTE | FLIGHT | HOTEL | RESTAURANT | TOUR | TICKET | INSURANCE | NOTE | OTHER
  fileName: string | null;
  content: string | null;
  mime: string | null;
  sizeBytes: number | null;
  sensitive: boolean;
  linkedType: string | null;
  linkedId: string | null;
  createdAt: string;
};

export type ChecklistItem = {
  id: string;
  section: string; // BEFORE_TRIP | PACKING
  text: string;
  category: string | null;
  checked: boolean;
  aiGenerated: boolean;
  order: number;
};

export type Traveler = {
  id: string;
  name: string;
  email: string | null;
  isOwner: boolean;
  colorKey: string;
};

export type TripBundle = {
  trip: {
    id: string;
    title: string;
    subtitle: string | null;
    coverEmoji: string;
    coverTheme: string;
    status: string;
    startDate: string;
    endDate: string;
    budgetAmount: number;
    homeCurrency: string;
    pace?: string;
    interests?: string;
    travelersCount: number;
    notes?: string | null;
  };
  /** The planning interview's answers; null for trips planned before it existed. */
  brief: TripBrief | null;
  destinations: Destination[];
  hotels: Hotel[];
  flights: Flight[];
  days: ItineraryDay[];
  expenses: Expense[];
  reservations: Reservation[];
  savedPlaces: SavedPlace[];
  journal: JournalEntry[];
  documents: DocumentFile[];
  checklist: ChecklistItem[];
  travelers: Traveler[];
  weather: WeatherSnapshot[];
};

export type POI = {
  poiId: string;
  name: string;
  category: string;
  city: string;
  neighborhood: string;
  lat: number;
  lng: number;
  rating: number;
  priceLevel: number;
  avgCost?: number;
  currency?: string;
  hours: string;
  cuisine?: string;
  blurb: string;
  durationMin: number;
  walkMin?: number | null;
  saved?: boolean;
};

export type CreateTripPayload = {
  title?: string;
  subtitle?: string;
  destinations: { name: string; country?: string; lat?: number; lng?: number }[];
  startDate: string;
  endDate: string;
  budgetAmount?: number;
  homeCurrency?: string;
  pace?: "relaxed" | "balanced" | "packed";
  interests?: string[];
  travelersCount?: number;
  /** When given, the server takes pace, interests and head count from it. */
  brief?: TripBrief;
  coverEmoji?: string;
  coverTheme?: string;
};

export type CurrencyRateResponse = {
  rates: Record<string, number>;
  currencies: string[];
  updatedAt: string;
  source: string;
};

export const SUPPORTED_CURRENCIES = [
  "PHP",
  "USD",
  "JPY",
  "EUR",
  "GBP",
  "KRW",
  "SGD",
  "THB",
  "AUD",
  "CAD",
  "CHF",
  "HKD",
  "NZD",
  "TWD",
  "VND",
  "IDR",
  "MYR",
];

export const EXPENSE_CATEGORY_COLORS: Record<string, string> = {
  FOOD: "#F59E0B",
  TRANSPORT: "#38BDF8",
  HOTEL: "#A78BFA",
  FLIGHT: "#34D399",
  ACTIVITY: "#FB7185",
  SHOPPING: "#E879F9",
  ENTERTAINMENT: "#FBBF24",
  MISC: "#94A3B8",
};

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  FOOD: "Food & Dining",
  TRANSPORT: "Transit & Transport",
  HOTEL: "Hotels & Stays",
  FLIGHT: "Flights",
  ACTIVITY: "Activities & Tours",
  SHOPPING: "Shopping",
  ENTERTAINMENT: "Entertainment",
  MISC: "Other / Misc",
};