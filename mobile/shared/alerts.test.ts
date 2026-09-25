import { tripAlerts } from "./alerts";
import type { ItineraryItem, TripBundle } from "./types";

// A trip 14–18 March 2027, stored at UTC midnight (server offset 0 here).
const day = (n: number, items: Partial<ItineraryItem>[] = []) => ({
  id: `d${n}`,
  date: `2027-03-${String(13 + n).padStart(2, "0")}T00:00:00.000Z`,
  city: "Tokyo",
  title: null,
  dayIndex: n,
  items: items.map((i, k) => ({
    id: `i${n}-${k}`,
    type: "ACTIVITY",
    title: `Stop ${k}`,
    startTime: null,
    endTime: null,
    durationMin: 60,
    neighborhood: null,
    placeName: null,
    cost: null,
    currency: null,
    notes: null,
    confirmed: false,
    transportMode: null,
    transportMin: null,
    ...i,
  })) as ItineraryItem[],
});

function bundle(over: Partial<TripBundle> = {}): TripBundle {
  return {
    trip: {
      id: "t1",
      title: "Tokyo",
      subtitle: null,
      coverEmoji: "",
      coverTheme: "",
      status: "",
      startDate: "2027-03-14T00:00:00.000Z",
      endDate: "2027-03-18T23:59:59.000Z",
      budgetAmount: 1000,
      homeCurrency: "USD",
      travelersCount: 2,
    },
    brief: null,
    destinations: [],
    hotels: [],
    flights: [],
    days: [day(1), day(2, [{ title: "Temple" }]), day(3), day(4), day(5)],
    expenses: [],
    reservations: [],
    savedPlaces: [],
    journal: [],
    documents: [],
    checklist: [],
    travelers: [],
    weather: [],
    ...over,
  } as TripBundle;
}

// "now" from local components, so the tests hold in any timezone.
const at = (m: number, d: number, h = 9, min = 0) => new Date(2027, m - 1, d, h, min);
const iso = (date: Date) => date.toISOString();

const flight = (departAt: Date) => ({
  id: "f1",
  airline: "ANA",
  flightNumber: "NH820",
  originCode: "MNL",
  originCity: "Manila",
  destCode: "HND",
  destCity: "Tokyo",
  departAt: iso(departAt),
  arriveAt: iso(departAt),
  seat: null,
  confirmation: "ABC123",
  terminal: "3",
  gate: null,
  price: 0,
  currency: "USD",
  status: "",
});

describe("tripAlerts", () => {
  it("warns about a flight leaving within 48 hours, most urgent first", () => {
    const now = at(3, 13, 9);
    const alerts = tripAlerts(bundle({ flights: [flight(at(3, 13, 12))], checklist: [{ id: "c", text: "Passport", checked: false, section: "PACKING" } as never] }), now);
    expect(alerts[0]).toMatchObject({ id: "flight-f1", tone: "danger", title: "ANA NH820 leaves in 3h" });
    expect(alerts[0].body).toContain("Terminal 3");
  });

  it("says nothing about a flight three days away", () => {
    expect(tripAlerts(bundle({ flights: [flight(at(3, 16, 9))] }), at(3, 13, 9)).find((a) => a.id === "flight-f1")).toBeUndefined();
  });

  it("flags free cancellation that's about to end", () => {
    const r = { id: "r1", type: "RESTAURANT", title: "Kikunoi", dateTime: iso(at(3, 17, 19)), confirmationNumber: null, locationName: null, address: null, cost: null, currency: null, cancellationDeadline: iso(at(3, 15, 18)), status: "", notes: null };
    const a = tripAlerts(bundle({ reservations: [r] }), at(3, 14, 22)).find((x) => x.id === "cancel-r1");
    expect(a).toMatchObject({ tone: "warning", title: "Free cancellation for Kikunoi ends in 20h" });
  });

  it("reminds you to check in on the day, with directions", () => {
    const hotel = { id: "h1", destinationName: "Tokyo", name: "Hotel Gracery", address: null, lat: 35.69, lng: 139.7, checkIn: "2027-03-14T15:00:00.000Z", checkOut: "2027-03-18T11:00:00.000Z", nights: 4, confirmationNumber: "HG-1", phone: null, costPerNight: 0, currency: "JPY" };
    const a = tripAlerts(bundle({ hotels: [hotel] }), at(3, 14, 8)).find((x) => x.id === "checkin-h1");
    expect(a?.action.to).toMatchObject({ kind: "directions", lat: 35.69, name: "Hotel Gracery" });
  });

  it("warns of rain only from a real forecast, for a day with plans", () => {
    const rain = (source: string, date: string) => ({ city: "Tokyo", date, tempMinC: 8, tempMaxC: 14, condition: "Rain", rainProb: 70, source });
    const now = at(3, 14, 20);
    // Tomorrow (the 15th) has a stop planned.
    expect(tripAlerts(bundle({ weather: [rain("live-open-meteo", "2027-03-15T00:00:00.000Z")] }), now).map((a) => a.id)).toContain("rain-Tokyo-2027-03-15");
    // A seasonal estimate is climate, not a forecast.
    expect(tripAlerts(bundle({ weather: [rain("seasonal-estimate", "2027-03-15T00:00:00.000Z")] }), now).some((a) => a.id.startsWith("rain"))).toBe(false);
    // Nothing planned that day: nothing to swap.
    expect(tripAlerts(bundle({ weather: [rain("live-open-meteo", "2027-03-14T00:00:00.000Z")] }), now).some((a) => a.id.startsWith("rain"))).toBe(false);
  });

  it("tells you to leave for the next stop, counting the way there", () => {
    const days = [day(1, [{ title: "Lunch", startTime: 12 * 60, transportMin: 20 }, { title: "Museum", startTime: 14 * 60 }]), day(2), day(3), day(4), day(5)];
    const a = tripAlerts(bundle({ days }), at(3, 14, 13, 15)).find((x) => x.id.startsWith("leave-"));
    // 14:00 start, 20 min to get there, it's 13:15: leave in 25 min.
    expect(a?.title).toBe("Leave in 25 min for Museum");
  });

  it("watches the budget once the trip has started, not before", () => {
    const expenses = [{ id: "e", category: "FOOD", merchant: "x", amount: 850, currency: "USD", amountHome: 850, date: iso(at(3, 14)), description: null }];
    expect(tripAlerts(bundle({ expenses }), at(3, 15)).find((a) => a.id === "budget-80")?.title).toBe("You've used 85% of the budget");
    expect(tripAlerts(bundle({ expenses }), at(3, 10)).some((a) => a.id.startsWith("budget"))).toBe(false);
  });

  it("helps you get ready in the last days before you leave", () => {
    const checklist = [
      { id: "a", text: "Passport", checked: false, section: "PACKING" },
      { id: "b", text: "Adapter", checked: true, section: "PACKING" },
    ] as never[];
    const ids = tripAlerts(bundle({ checklist }), at(3, 10)).map((a) => a.id);
    expect(ids).toEqual(["unplanned", "packing"]);
    expect(tripAlerts(bundle({ checklist }), at(2, 1)).length).toBe(0);
  });
});
