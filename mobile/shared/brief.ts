// The trip brief, as the app sees it: what the traveller tells Wayfare while
// planning. Mirrors src/lib/brief.ts on the server, which validates every
// brief it's sent and is the source of truth for the shape.

export type Pace = "relaxed" | "balanced" | "packed";

export type Stay = {
  city: string;
  hotelName: string | null;
  hotelId: string | null;
  placeId: string | null;
  lat: number | null;
  lng: number | null;
  /** Neighbourhood, when the hotel isn't booked yet. */
  area: string | null;
  booked: boolean;
};

export type MustDo = { name: string; city: string | null; poiId: string | null; placeId: string | null };

export type Moment = { date: string; time: number | null; where: string | null };

export type TripBrief = {
  version: 1;
  stays: Stay[];
  party: { adults: number; childrenAges: number[]; seniors: number };
  interests: Interest[];
  mustDos: MustDo[];
  avoid: Avoid[];
  pace: Pace;
  rhythm: { dayStart: number; dayEnd: number; lateNights: boolean };
  food: { diet: Diet[]; priceLevel: 1 | 2 | 3 | 4 | null; mustTry: string[] };
  mobility: { maxWalkMin: number | null; avoidStairs: boolean };
  arrival: Moment | null;
  departure: Moment | null;
  dailyActivityBudget: number | null;
};

/** The parts of a brief that describe the traveller; saved to prefill the next trip. */
export type TravellerPreferences = Pick<TripBrief, "party" | "interests" | "avoid" | "pace" | "rhythm" | "mobility"> & {
  food: Pick<TripBrief["food"], "diet" | "priceLevel">;
};

// ----------------------------------------------------------- vocabularies
// Keys are what the server and the place guide use; labels are what people read.

export const INTERESTS = [
  { key: "Food", label: "Food & drink" },
  { key: "History", label: "History" },
  { key: "Culture", label: "Art & culture" },
  { key: "Architecture", label: "Architecture" },
  { key: "Nature", label: "Nature & parks" },
  { key: "Shopping", label: "Shopping" },
  { key: "Nightlife", label: "Nightlife" },
  { key: "Photography", label: "Photo spots" },
  { key: "Relaxation", label: "Slow & relaxing" },
  { key: "Adventure", label: "Adventure" },
  { key: "Luxury", label: "Treat yourself" },
  { key: "Anime & Pop Culture", label: "Anime & pop culture" },
] as const;
export type Interest = (typeof INTERESTS)[number]["key"];

export const DIETS = [
  { key: "vegetarian", label: "Vegetarian" },
  { key: "vegan", label: "Vegan" },
  { key: "halal", label: "Halal" },
  { key: "kosher", label: "Kosher" },
  { key: "gluten-free", label: "Gluten-free" },
  { key: "no-pork", label: "No pork" },
  { key: "no-seafood", label: "No seafood" },
  { key: "no-alcohol", label: "No alcohol" },
] as const;
export type Diet = (typeof DIETS)[number]["key"];

export const AVOIDS = [
  { key: "crowds", label: "Big crowds" },
  { key: "long-queues", label: "Long queues" },
  { key: "early-starts", label: "Early starts" },
  { key: "late-nights", label: "Late nights" },
  { key: "stairs", label: "Lots of stairs" },
  { key: "tourist-traps", label: "Tourist traps" },
] as const;
export type Avoid = (typeof AVOIDS)[number]["key"];

export const DEFAULT_RHYTHM = { dayStart: 9 * 60, dayEnd: 21 * 60, lateNights: false };

export function emptyBrief(): TripBrief {
  return {
    version: 1,
    stays: [],
    party: { adults: 1, childrenAges: [], seniors: 0 },
    interests: [],
    mustDos: [],
    avoid: [],
    pace: "balanced",
    rhythm: { ...DEFAULT_RHYTHM },
    food: { diet: [], priceLevel: null, mustTry: [] },
    mobility: { maxWalkMin: null, avoidStairs: false },
    arrival: null,
    departure: null,
    dailyActivityBudget: null,
  };
}

/** A fresh brief that starts from what this traveller told us last time. */
export function briefFromPreferences(prefs: TravellerPreferences | null): TripBrief {
  const b = emptyBrief();
  if (!prefs) return b;
  return {
    ...b,
    party: { ...prefs.party },
    interests: [...prefs.interests],
    avoid: [...prefs.avoid],
    pace: prefs.pace,
    rhythm: { ...prefs.rhythm },
    mobility: { ...prefs.mobility },
    food: { ...b.food, diet: [...prefs.food.diet], priceLevel: prefs.food.priceLevel },
  };
}

export function partySize(brief: Pick<TripBrief, "party">): number {
  return Math.max(1, brief.party.adults + brief.party.childrenAges.length + brief.party.seniors);
}

/** "2 adults, 2 kids (6, 9)" */
export function describeParty(party: TripBrief["party"]): string {
  const bits: string[] = [];
  if (party.adults) bits.push(`${party.adults} ${party.adults === 1 ? "adult" : "adults"}`);
  if (party.childrenAges.length) {
    const n = party.childrenAges.length;
    bits.push(`${n} ${n === 1 ? "child" : "children"} (${party.childrenAges.join(", ")})`);
  }
  if (party.seniors) bits.push(`${party.seniors} ${party.seniors === 1 ? "older traveller" : "older travellers"}`);
  return bits.join(", ") || "Just you";
}
