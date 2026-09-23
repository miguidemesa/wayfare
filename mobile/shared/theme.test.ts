import { daysUntil, fmtClock, fmtDate, fmtDistance, fmtDuration, fmtMoney, hexA, tripDayCount } from "./theme";

describe("fmtMoney", () => {
  it("drops decimals for whole amounts", () => {
    expect(fmtMoney(1200, "USD")).toBe("$1,200");
  });

  it("keeps two decimals for fractional amounts", () => {
    expect(fmtMoney(19.5, "USD")).toBe("$19.50");
  });

  it("falls back to a plain string for an unknown currency code", () => {
    expect(fmtMoney(500, "NOT_A_CURRENCY")).toBe("NOT_A_CURRENCY 500");
  });
});

describe("fmtClock", () => {
  it("renders null as a placeholder", () => {
    expect(fmtClock(null)).toBe("--:--");
  });

  it("pads hours and minutes", () => {
    expect(fmtClock(0)).toBe("00:00");
    expect(fmtClock(90)).toBe("01:30");
    expect(fmtClock(600)).toBe("10:00");
  });
});

describe("fmtDistance", () => {
  it("renders sub-kilometer distances in meters", () => {
    expect(fmtDistance(0.35)).toBe("350 m");
  });

  it("renders kilometer distances with one decimal", () => {
    expect(fmtDistance(2.456)).toBe("2.5 km");
  });
});

describe("fmtDuration", () => {
  it("renders sub-hour durations in minutes", () => {
    expect(fmtDuration(45)).toBe("45 min");
  });

  it("renders whole hours without a minutes component", () => {
    expect(fmtDuration(120)).toBe("2h");
  });

  it("renders hours and minutes together", () => {
    expect(fmtDuration(135)).toBe("2h 15m");
  });
});

describe("tripDayCount", () => {
  it("counts inclusively, so a single day trip is 1 day", () => {
    expect(tripDayCount("2026-10-01", "2026-10-01")).toBe(1);
  });

  it("counts a multi-day range inclusively", () => {
    expect(tripDayCount("2026-10-01", "2026-10-05")).toBe(5);
  });
});

describe("hexA", () => {
  it("converts a 6-digit hex color to rgba", () => {
    expect(hexA("#C2593F", 0.5)).toBe("rgba(194, 89, 63, 0.5)");
  });

  it("expands a 3-digit hex color", () => {
    expect(hexA("#fff", 1)).toBe("rgba(255, 255, 255, 1)");
  });

  it("passes an rgba string through unchanged", () => {
    expect(hexA("rgba(1, 2, 3, 0.4)", 0.9)).toBe("rgba(1, 2, 3, 0.4)");
  });

  it("falls back to a default color for empty or invalid input", () => {
    expect(hexA("", 0.5)).toBe("rgba(28, 25, 23, 0.5)");
    expect(hexA("#zzzzzz", 0.5)).toBe("rgba(28, 25, 23, 0.5)");
  });
});

describe("fmtDate", () => {
  it("formats an ISO date as a short month and day", () => {
    expect(fmtDate("2026-03-15")).toBe("Mar 15");
  });
});

describe("daysUntil", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("counts full days remaining until a future date", () => {
    expect(daysUntil("2026-01-11T00:00:00Z")).toBe(10);
  });

  it("never returns a negative count for a past date", () => {
    expect(daysUntil("2025-01-01T00:00:00Z")).toBe(0);
  });
});
