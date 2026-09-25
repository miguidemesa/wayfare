import {
  addDays,
  dailyAllowance,
  dayKey,
  daysBetween,
  learnServerOffset,
  missingDays,
  nextStop,
  todayDayIndex,
  tripPhase,
} from "./trip";
import type { ItineraryDay, ItineraryItem } from "./types";

// Calendar dates arrive as the server's local wall-clock time, serialized to
// UTC. These fixtures are what each server writes for a trip running 14–23
// March 2027: start at local midnight, end at 23:59:59 (seed data: midnight),
// hotel check-in at 15:00.
const SERVERS = {
  "UTC+8 (dev machine)": {
    start: "2027-03-13T16:00:00.000Z",
    end: "2027-03-23T15:59:59.000Z",
    seedEnd: "2027-03-22T16:00:00.000Z",
    checkIn: "2027-03-14T07:00:00.000Z",
  },
  "UTC (production)": {
    start: "2027-03-14T00:00:00.000Z",
    end: "2027-03-23T23:59:59.000Z",
    seedEnd: "2027-03-23T00:00:00.000Z",
    checkIn: "2027-03-14T15:00:00.000Z",
  },
  "UTC−5": {
    start: "2027-03-14T05:00:00.000Z",
    end: "2027-03-24T04:59:59.000Z",
    seedEnd: "2027-03-23T05:00:00.000Z",
    checkIn: "2027-03-14T20:00:00.000Z",
  },
};

describe.each(Object.entries(SERVERS))("dayKey, server at %s", (_, s) => {
  beforeEach(() => learnServerOffset(s.start));

  it("reads the trip's first day", () => {
    expect(dayKey(s.start)).toBe("2027-03-14");
  });

  it("reads a 23:59:59 end as that same day", () => {
    expect(dayKey(s.end)).toBe("2027-03-23");
  });

  it("reads a midnight end (seed data) as that day", () => {
    expect(dayKey(s.seedEnd)).toBe("2027-03-23");
  });

  it("reads an afternoon check-in as that day", () => {
    expect(dayKey(s.checkIn)).toBe("2027-03-14");
  });
});

describe("dayKey", () => {
  it("passes a YYYY-MM-DD key through untouched", () => {
    learnServerOffset(SERVERS["UTC+8 (dev machine)"].start);
    expect(dayKey("2027-03-14")).toBe("2027-03-14");
  });
});

describe("addDays / daysBetween", () => {
  it("steps across month and year ends", () => {
    expect(addDays("2027-02-27", 2)).toBe("2027-03-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
  });

  it("counts whole days, ignoring daylight saving", () => {
    expect(daysBetween("2027-03-01", "2027-04-01")).toBe(31);
    expect(daysBetween("2027-03-14", "2027-03-14")).toBe(0);
    expect(daysBetween("2027-03-14", "2027-03-10")).toBe(-4);
  });
});

// `now` is built from local components, so these hold in any test timezone.
const at = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m - 1, d, h, min);
const { start, end } = SERVERS["UTC+8 (dev machine)"];

describe("tripPhase", () => {
  beforeEach(() => learnServerOffset(start));

  it("is before until the first day", () => {
    expect(tripPhase(start, end, at(2027, 3, 13, 23, 59))).toBe("before");
  });

  it("is during on the first and last days", () => {
    expect(tripPhase(start, end, at(2027, 3, 14, 0, 1))).toBe("during");
    expect(tripPhase(start, end, at(2027, 3, 23, 23, 59))).toBe("during");
  });

  it("is after the last day", () => {
    expect(tripPhase(start, end, at(2027, 3, 24))).toBe("after");
  });
});

function item(id: string, startTime: number | null, transportMin: number | null = null): ItineraryItem {
  return {
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
  };
}

// Day n of the trip (from 1 = 14 March) as the UTC+8 server stores it: local
// midnight, which is 16:00Z the day before.
function day(n: number, items: ItineraryItem[] = []): ItineraryDay {
  const date = new Date(Date.UTC(2027, 2, 12 + n, 16));
  return { id: `d${n}`, date: date.toISOString(), city: "Tokyo", title: null, dayIndex: n, items };
}

describe("todayDayIndex", () => {
  beforeEach(() => learnServerOffset(start));

  it("finds the day matching the phone's date", () => {
    expect(todayDayIndex([day(1), day(2), day(3)], at(2027, 3, 15))).toBe(1);
  });

  it("is null outside the trip", () => {
    expect(todayDayIndex([day(1), day(2)], at(2027, 4, 1))).toBeNull();
  });
});

describe("nextStop", () => {
  beforeEach(() => learnServerOffset(start));

  it("finds the next timed stop today and when to leave for it", () => {
    const days = [day(1, [item("temple", 9 * 60, 20), item("lunch", 12 * 60)])];
    const next = nextStop(days, at(2027, 3, 14, 11, 0));
    expect(next?.item.id).toBe("lunch");
    // Starts 12:00, 20 minutes to get there, it's 11:00.
    expect(next?.leaveInMin).toBe(40);
  });

  it("still counts a stop that started under 30 minutes ago", () => {
    const days = [day(1, [item("temple", 9 * 60), item("lunch", 12 * 60)])];
    expect(nextStop(days, at(2027, 3, 14, 9, 20))?.item.id).toBe("temple");
  });

  it("moves on to a later day, with no leave-by time", () => {
    const days = [day(1, [item("temple", 9 * 60)]), day(2, [item("market", 10 * 60)])];
    const next = nextStop(days, at(2027, 3, 14, 18, 0));
    expect(next?.item.id).toBe("market");
    expect(next?.leaveInMin).toBeNull();
  });
});

describe("dailyAllowance", () => {
  beforeEach(() => learnServerOffset(start));

  it("spreads what's left over the days remaining, today included", () => {
    // 14–23 March; on the 19th, 5 days remain.
    expect(dailyAllowance({ budget: 1000, spent: 400, startIso: start, endIso: end, now: at(2027, 3, 19) })).toBe(120);
  });

  it("uses the whole trip before it starts", () => {
    expect(dailyAllowance({ budget: 1000, spent: 0, startIso: start, endIso: end, now: at(2027, 3, 1) })).toBe(100);
  });

  it("is null once the budget is spent or the trip is over", () => {
    expect(dailyAllowance({ budget: 1000, spent: 1000, startIso: start, endIso: end, now: at(2027, 3, 19) })).toBeNull();
    expect(dailyAllowance({ budget: 1000, spent: 0, startIso: start, endIso: end, now: at(2027, 3, 24) })).toBeNull();
  });
});

describe("missingDays", () => {
  beforeEach(() => learnServerOffset(start));

  it("counts trip dates with no day yet", () => {
    expect(missingDays({ startDate: start, endDate: end }, [day(1), day(2), day(5)])).toBe(7);
  });

  it("is zero when every date has a day", () => {
    const all = Array.from({ length: 10 }, (_, i) => day(i + 1));
    expect(missingDays({ startDate: start, endDate: end }, all)).toBe(0);
  });
});
