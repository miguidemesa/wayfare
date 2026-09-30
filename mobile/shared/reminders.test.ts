import { reminderSchedule } from "./reminders";
import type { TripBundle } from "./types";

// Days stored at UTC midnight (server offset 0 in this test file).
function bundle(over: Partial<TripBundle> = {}): TripBundle {
  return {
    trip: { id: "t1", title: "Tokyo", subtitle: null, coverEmoji: "", coverTheme: "", status: "", startDate: "2027-03-14T00:00:00.000Z", endDate: "2027-03-18T23:59:59.000Z", budgetAmount: 0, homeCurrency: "USD", travelersCount: 1 },
    brief: null,
    destinations: [],
    hotels: [],
    flights: [],
    days: [],
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

const stop = (id: string, startTime: number | null, transportMin: number | null = null) => ({
  id,
  type: "ACTIVITY",
  title: id,
  startTime,
  endTime: null,
  durationMin: 60,
  neighborhood: null,
  placeName: null,
  cost: null,
  currency: null,
  notes: null,
  confirmed: false,
  transportMode: null,
  transportMin,
});

const day = (date: string, items: ReturnType<typeof stop>[]) => ({ id: date, date: `${date}T00:00:00.000Z`, city: "Tokyo", title: null, dayIndex: 0, items });

describe("reminderSchedule", () => {
  it("reminds you to leave ten minutes before you need to set off", () => {
    const b = bundle({ days: [day("2027-03-15", [stop("temple", 9 * 60, 25), stop("lunch", 12 * 60)])] });
    const [first, second] = reminderSchedule(b, new Date(2027, 2, 14, 20, 0));
    expect(first).toMatchObject({ id: "leave-temple", title: "Leave in 10 min for temple" });
    expect([first.at.getHours(), first.at.getMinutes()]).toEqual([8, 50]);
    // Lunch at 12:00, 25 min from the temple: set off 11:35, reminded 11:25.
    expect([second.at.getHours(), second.at.getMinutes()]).toEqual([11, 25]);
  });

  it("never schedules anything in the past, or more than a week out", () => {
    const b = bundle({ days: [day("2027-03-15", [stop("past", 8 * 60)]), day("2027-03-30", [stop("far", 10 * 60)])] });
    expect(reminderSchedule(b, new Date(2027, 2, 15, 9, 0))).toEqual([]);
  });

  it("covers flights the day before and three hours before", () => {
    const depart = new Date(2027, 2, 18, 18, 0);
    const b = bundle({
      flights: [{ id: "f1", airline: "ANA", flightNumber: "NH820", originCode: "HND", originCity: "", destCode: "MNL", destCity: "", departAt: depart.toISOString(), arriveAt: depart.toISOString(), seat: null, confirmation: null, terminal: "3", gate: null, price: 0, currency: "USD", status: "" }],
    });
    const ids = reminderSchedule(b, new Date(2027, 2, 16, 12, 0)).map((r) => [r.id, r.at.getDate(), r.at.getHours()]);
    expect(ids).toEqual([
      ["flight-24h-f1", 17, 18],
      ["flight-3h-f1", 18, 15],
    ]);
  });

  it("reminds you on check-in morning and check-out morning", () => {
    const b = bundle({
      hotels: [{ id: "h1", destinationName: null, name: "Gracery", address: null, lat: null, lng: null, checkIn: "2027-03-14T15:00:00.000Z", checkOut: "2027-03-18T11:00:00.000Z", nights: 4, confirmationNumber: null, phone: null, costPerNight: 0, currency: "JPY" }],
    });
    const r = reminderSchedule(b, new Date(2027, 2, 13, 12, 0));
    expect(r.map((x) => [x.id, x.at.getDate(), x.at.getHours()])).toEqual([
      ["checkin-h1", 14, 9],
      ["checkout-h1", 18, 8],
    ]);
  });

  it("stays under the phone's limit, soonest first", () => {
    const items = Array.from({ length: 60 }, (_, i) => stop(`s${i}`, 8 * 60 + i * 10));
    const r = reminderSchedule(bundle({ days: [day("2027-03-15", items)] }), new Date(2027, 2, 14, 12, 0));
    expect(r.length).toBe(40);
    expect(r[0].id).toBe("leave-s0");
  });
});
