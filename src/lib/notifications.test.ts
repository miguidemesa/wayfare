import test from "node:test";
import assert from "node:assert/strict";
import { computeNotifications } from "./notifications";
import type { TripBundle } from "./trip-service";

test("notifications - computes flight, reservation, and weather alerts", () => {
  const now = new Date("2027-03-14T10:00:00Z");

  const mockBundle: Partial<TripBundle> = {
    trip: {
      id: "trip-1",
      userId: "u-1",
      title: "Japan Trip",
      subtitle: "Tokyo · Kyoto",
      coverEmoji: "🇯🇵",
      coverTheme: "sakura",
      status: "ACTIVE",
      startDate: new Date("2027-03-14T00:00:00Z"),
      endDate: new Date("2027-03-24T00:00:00Z"),
      budgetAmount: 100000,
      homeCurrency: "PHP",
      pace: "balanced",
      interests: "[]",
      travelersCount: 2,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    flights: [
      {
        id: "f-1",
        tripId: "trip-1",
        airline: "Philippine Airlines",
        flightNumber: "PR 426",
        originCode: "MNL",
        originCity: "Manila",
        destCode: "HND",
        destCity: "Tokyo",
        departAt: new Date("2027-03-14T14:00:00Z"), // 4h away
        arriveAt: new Date("2027-03-14T19:00:00Z"),
        seat: "32K",
        confirmation: "QLP9Z7",
        terminal: "3",
        gate: null,
        price: 28000,
        currency: "PHP",
        status: "CONFIRMED",
      },
    ],
    reservations: [
      {
        id: "r-1",
        tripId: "trip-1",
        type: "RESTAURANT",
        title: "Sushi Yoshitake",
        dateTime: new Date("2027-03-14T18:00:00Z"), // 8h away
        confirmationNumber: "SY-9912",
        locationName: "Ginza, Tokyo",
        address: null,
        lat: null,
        lng: null,
        cost: 35000,
        currency: "JPY",
        cancellationDeadline: null,
        status: "CONFIRMED",
        notes: null,
      },
    ],
    expenses: [
      {
        id: "e-1",
        tripId: "trip-1",
        category: "HOTEL",
        amount: 85000,
        currency: "PHP",
        amountHome: 85000, // 85% of 100k budget
        date: new Date("2027-03-14T08:00:00Z"),
        merchant: "Hotel Tokyo",
        description: null,
        locationName: null,
        lat: null,
        lng: null,
        paymentMethod: "CARD",
        paidById: null,
        splitWith: "ALL",
        receiptUrl: null,
        aiCategorized: false,
        createdAt: new Date(),
      },
    ],
    weather: [
      {
        id: "w-1",
        tripId: "trip-1",
        city: "Tokyo",
        date: new Date("2027-03-14T00:00:00Z"),
        tempMinC: 10,
        tempMaxC: 16,
        condition: "rain",
        rainProb: 80,
        humidity: 85,
        windKph: 15,
        source: "live",
      },
    ],
    days: [],
    hotels: [],
    destinations: [],
    savedPlaces: [],
    journal: [],
    documents: [],
    checklist: [],
    travelers: [],
  };

  const notifications = computeNotifications(mockBundle as TripBundle, now);

  // Should have flight alert
  const flightNotif = notifications.find((n) => n.id.startsWith("flight-"));
  assert.ok(flightNotif, "Flight notification should be generated");
  assert.ok(flightNotif.title.includes("PR 426"));

  // Should have reservation alert
  const resNotif = notifications.find((n) => n.id.startsWith("res-"));
  assert.ok(resNotif, "Reservation notification should be generated");
  assert.ok(resNotif.title.includes("Sushi Yoshitake"));

  // Should have budget alert (>80%)
  const budgetNotif = notifications.find((n) => n.id === "budget-80");
  assert.ok(budgetNotif, "Budget threshold notification should be generated");

  // Should have rain weather alert
  const weatherNotif = notifications.find((n) => n.id.startsWith("weather-"));
  assert.ok(weatherNotif, "Weather rain notification should be generated");
});
