import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth-hash";

const db = new PrismaClient();

// Deterministic ids for stable cross-references in seed data.
const uid = (() => {
  let n = 0;
  return (p: string) => `${p}_${String(++n).padStart(3, "0")}`;
})();

function D(dateStr: string, time = "00:00"): Date {
  return new Date(`${dateStr}T${time}:00`);
}

async function main() {
  console.log("Seeding…");
  await db.expenseSplit.deleteMany();
  await db.aIMessage.deleteMany();
  await db.aIConversation.deleteMany();
  await db.session.deleteMany();
  await Promise.all([
    db.checklistItem.deleteMany(),
    db.documentFile.deleteMany(),
    db.journalEntry.deleteMany(),
    db.savedPlace.deleteMany(),
    db.reservation.deleteMany(),
    db.expense.deleteMany(),
    db.itineraryItem.deleteMany(),
    db.itineraryDay.deleteMany(),
    db.flight.deleteMany(),
    db.hotel.deleteMany(),
    db.traveler.deleteMany(),
    db.destination.deleteMany(),
    db.weatherSnapshot.deleteMany(),
    db.trip.deleteMany(),
    db.user.deleteMany(),
    db.currencyRate.deleteMany(),
  ]);

  // ------------------------------------------------------------------ user
  const miguel = await db.user.create({
    data: {
      email: "demo@wayfare.app",
      name: "Miguel",
      passwordHash: hashPassword("wanderlust"),
      homeCurrency: "PHP",
    },
  });

  const rates: [string, number][] = [
    ["USD", 1], ["PHP", 58.3], ["JPY", 156.4], ["EUR", 0.92], ["GBP", 0.78],
    ["KRW", 1382], ["SGD", 1.34], ["AUD", 1.52], ["CAD", 1.37], ["THB", 36.1],
    ["TWD", 32.4], ["HKD", 7.81], ["CNY", 7.24],
  ];
  for (const [code, rateToUsd] of rates) {
    await db.currencyRate.create({ data: { code, rateToUsd, updatedAt: new Date(Date.now() - 12 * 60 * 1000) } });
  }

  // ================================================================== JAPAN
  const japan = await db.trip.create({
    data: {
      userId: miguel.id,
      title: "Tokyo & Kyoto",
      subtitle: "Tokyo · Kyoto",
      coverEmoji: "🇯🇵",
      coverTheme: "sakura",
      status: "UPCOMING",
      startDate: D("2027-03-14"),
      endDate: D("2027-03-23"),
      budgetAmount: 100000,
      homeCurrency: "PHP",
      pace: "balanced",
      interests: JSON.stringify(["Food", "Anime & Pop Culture", "Photography", "Shopping", "Nightlife"]),
      travelersCount: 2,
      notes: "Cherry blossom season! Book popular restaurants early.",
    },
  });

  await db.destination.createMany({
    data: [
      { tripId: japan.id, name: "Tokyo", country: "Japan", lat: 35.6762, lng: 139.6503, arrivalDate: D("2027-03-14"), order: 0 },
      { tripId: japan.id, name: "Kyoto", country: "Japan", lat: 35.0116, lng: 135.7681, arrivalDate: D("2027-03-19"), order: 1 },
    ],
  });

  const alex = await db.traveler.create({
    data: { tripId: japan.id, name: "Miguel", email: "demo@wayfare.app", isOwner: true, colorKey: "teal" },
  });
  const alexPartner = await db.traveler.create({
    data: { tripId: japan.id, name: "Alex", colorKey: "coral" },
  });

  await db.flight.createMany({
    data: [
      {
        tripId: japan.id, airline: "Philippine Airlines", flightNumber: "PR 426",
        originCode: "MNL", originCity: "Manila", destCode: "HND", destCity: "Tokyo (Haneda)",
        departAt: D("2027-03-14", "09:30"), arriveAt: D("2027-03-14", "14:55"),
        seat: "32K", confirmation: "QLP9Z7", terminal: "3", price: 28400, currency: "PHP",
      },
      {
        tripId: japan.id, airline: "Philippine Airlines", flightNumber: "PR 427",
        originCode: "HND", originCity: "Tokyo (Haneda)", destCode: "MNL", destCity: "Manila",
        departAt: D("2027-03-23", "15:40"), arriveAt: D("2027-03-23", "19:25"),
        seat: "33A", confirmation: "QLP9Z7", terminal: "3", price: 28400, currency: "PHP",
      },
    ],
  });

  const hotelShibuya = await db.hotel.create({
    data: {
      tripId: japan.id, destinationName: "Tokyo",
      name: "Shibuya Stream Excel Hotel",
      address: "3-1 Shibuya, Shibuya-ku, Tokyo 150-0002",
      lat: 35.658, lng: 139.7017,
      checkIn: D("2027-03-14"), checkOut: D("2027-03-19"), nights: 5,
      confirmationNumber: "HTL-88213-TK", phone: "+81 3-5728-5109",
      costPerNight: 21000, currency: "JPY",
    },
  });
  const hotelKyoto = await db.hotel.create({
    data: {
      tripId: japan.id, destinationName: "Kyoto",
      name: "Hotel Kanra Kyoto",
      address: "190 Kitamachi, Shimogyo Ward, Kyoto 600-8016",
      lat: 34.9975, lng: 135.7598,
      checkIn: D("2027-03-19"), checkOut: D("2027-03-23"), nights: 4,
      confirmationNumber: "KNR-44107-KY", phone: "+81 75-344-3815",
      costPerNight: 26000, currency: "JPY",
    },
  });

  // ------------------------------------------------------------- itinerary
  type ItemSeed = {
    type?: string; title: string; start?: string; durMin?: number;
    placeName?: string; neighborhood?: string; lat?: number; lng?: number;
    cost?: number; currency?: string; notes?: string; confirmed?: boolean;
    transportMode?: string; transportMin?: number; transportCost?: number;
  };
  async function addDay(
    dateStr: string, city: string, title: string, items: ItemSeed[]
  ) {
    const dayIndex = Math.round((D(dateStr).getTime() - D("2027-03-14").getTime()) / 86400000) + 1;
    const day = await db.itineraryDay.create({
      data: { tripId: japan.id, date: D(dateStr), city, title, dayIndex },
    });
    let order = 0;
    for (const it of items) {
      const startTime = it.start
        ? Number(it.start.split(":")[0]) * 60 + Number(it.start.split(":")[1] ?? 0)
        : null;
      const dur = it.durMin ?? 60;
      await db.itineraryItem.create({
        data: {
          tripId: japan.id, dayId: day.id, type: it.type ?? "ACTIVITY",
          title: it.title, startTime, endTime: startTime != null ? startTime + dur : null,
          durationMin: dur, placeName: it.placeName ?? it.title,
          neighborhood: it.neighborhood, lat: it.lat, lng: it.lng,
          cost: it.cost, currency: it.currency ?? "JPY", notes: it.notes,
          confirmed: it.confirmed ?? true, order: order++,
          transportMode: it.transportMode, transportMin: it.transportMin, transportCost: it.transportCost,
        },
      });
    }
    return day;
  }

  await addDay("2027-03-14", "Tokyo", "Arrival — Shibuya", [
    { type: "FLIGHT", title: "Land at Haneda (PR 426)", start: "14:55", durMin: 90, placeName: "Haneda Airport Terminal 3", neighborhood: "Haneda", lat: 35.5494, lng: 139.7798, confirmed: true, notes: "Immigration + Suica setup" },
    { type: "TRANSPORT", title: "Airport → Shibuya (Keikyu + JR)", start: "16:30", durMin: 45, placeName: "Shibuya Station", neighborhood: "Shibuya", lat: 35.658, lng: 139.7017, cost: 520, transportMode: "TRAIN", transportMin: 45 },
    { type: "HOTEL", title: "Check-in — Shibuya Stream Excel Hotel", start: "18:00", durMin: 40, placeName: "Shibuya Stream Excel Hotel", neighborhood: "Shibuya", lat: 35.658, lng: 139.7017, notes: "Confirmation HTL-88213-TK" },
    { type: "RESTAURANT", title: "Late dinner at Ichiran Shibuya", start: "19:30", durMin: 50, placeName: "Ichiran Ramen Shibuya", neighborhood: "Shibuya", lat: 35.6614, lng: 139.701, cost: 1200, notes: "Open 24h — perfect jet-lag fuel" },
    { type: "ACTIVITY", title: "Shibuya Crossing at night", start: "20:45", durMin: 40, placeName: "Shibuya Crossing", neighborhood: "Shibuya", lat: 35.6595, lng: 139.7005, transportMode: "WALK", transportMin: 4 },
  ]);

  await addDay("2027-03-15", "Tokyo", "Harajuku & Omotesando", [
    { type: "ACTIVITY", title: "Meiji Shrine", start: "09:30", durMin: 80, placeName: "Meiji Shrine", neighborhood: "Harajuku", lat: 35.6764, lng: 139.6993, transportMode: "TRAIN", transportMin: 12, transportCost: 180 },
    { type: "ACTIVITY", title: "Takeshita Street & crepes", start: "11:15", durMin: 75, placeName: "Takeshita Street", neighborhood: "Harajuku", lat: 35.6712, lng: 139.7031, transportMode: "WALK", transportMin: 8 },
    { type: "RESTAURANT", title: "Lunch at Harajuku Gyoza Lou", start: "12:45", durMin: 50, placeName: "Harajuku Gyoza Lou", neighborhood: "Harajuku", lat: 35.6699, lng: 139.704, cost: 1000, transportMode: "WALK", transportMin: 3 },
    { type: "ACTIVITY", title: "Omotesando & Koffee Mameya", start: "14:15", durMin: 90, placeName: "Omotesando", neighborhood: "Omotesando", lat: 35.666, lng: 139.708, transportMode: "WALK", transportMin: 10 },
    { type: "ACTIVITY", title: "Yoyogi Park stroll", start: "16:15", durMin: 60, placeName: "Yoyogi Park", neighborhood: "Harajuku", lat: 35.6685, lng: 139.7005, transportMode: "WALK", transportMin: 7 },
    { type: "RESTAURANT", title: "Dinner — Uobei conveyor sushi", start: "18:30", durMin: 55, placeName: "Uobei Genki Sushi Shibuya", neighborhood: "Shibuya", lat: 35.67, lng: 139.698, cost: 1500, transportMode: "TRAIN", transportMin: 9, transportCost: 180 },
    { type: "PERSONAL", title: "Pokémon Center Shibuya run", start: "20:00", durMin: 60, placeName: "Nintendo Tokyo / Pokémon Center", neighborhood: "Shibuya", lat: 35.658, lng: 139.701, confirmed: false, notes: "Plush hunting 🎮", transportMode: "WALK", transportMin: 6 },
  ]);

  await addDay("2027-03-16", "Tokyo", "Asakusa & Skytree", [
    { type: "ACTIVITY", title: "Sensō-ji Temple early visit", start: "08:45", durMin: 85, placeName: "Sensō-ji Temple", neighborhood: "Asakusa", lat: 35.7148, lng: 139.7967, transportMode: "TRAIN", transportMin: 32, transportCost: 240 },
    { type: "ACTIVITY", title: "Nakamise shopping street", start: "10:15", durMin: 50, placeName: "Nakamise Shopping Street", neighborhood: "Asakusa", lat: 35.7131, lng: 139.7962, transportMode: "WALK", transportMin: 3 },
    { type: "RESTAURANT", title: "Tempura lunch at Tsunahachi", start: "12:00", durMin: 65, placeName: "Tsunahachi Tempura", neighborhood: "Asakusa", lat: 35.7118, lng: 139.7935, cost: 2800, transportMode: "WALK", transportMin: 8 },
    { type: "ACTIVITY", title: "Tokyo Skytree observation deck", start: "14:15", durMin: 95, placeName: "Tokyo Skytree", neighborhood: "Sumida", lat: 35.7101, lng: 139.8107, cost: 2400, transportMode: "TRAIN", transportMin: 14, transportCost: 220 },
    { type: "ACTIVITY", title: "Solamachi mall wander", start: "16:00", durMin: 70, placeName: "Tokyo Solamachi", neighborhood: "Sumida", lat: 35.7106, lng: 139.8085, transportMode: "WALK", transportMin: 2 },
    { type: "RESTAURANT", title: "Dinner — Kura Sushi Asakusa", start: "18:15", durMin: 55, placeName: "Kura Sushi Asakusa", neighborhood: "Asakusa", lat: 35.7118, lng: 139.793, cost: 1600, transportMode: "TRAIN", transportMin: 12, transportCost: 200 },
  ]);

  await addDay("2027-03-17", "Tokyo", "Toyosu & teamLab", [
    { type: "ACTIVITY", title: "Sushi Dai breakfast (queue from 6:30)", start: "07:00", durMin: 80, placeName: "Sushi Dai", neighborhood: "Toyosu", lat: 35.6512, lng: 139.7868, cost: 4200, transportMode: "TRAIN", transportMin: 25, transportCost: 320, notes: "Worth the wake-up call" },
    { type: "ACTIVITY", title: "teamLab Planets (timed entry)", start: "10:00", durMin: 115, placeName: "teamLab Planets", neighborhood: "Toyosu", lat: 35.6497, lng: 139.7899, cost: 3800, transportMode: "WALK", transportMin: 12, notes: "Bring shorts! Timed ticket TLM88421" },
    { type: "ACTIVITY", title: "Toyosu market explore", start: "12:15", durMin: 55, placeName: "Toyosu Market", neighborhood: "Toyosu", lat: 35.6505, lng: 139.7822, transportMode: "WALK", transportMin: 10 },
    { type: "RESTAURANT", title: "Lunch — Afuri Ebisu yuzu ramen", start: "13:45", durMin: 50, placeName: "Afuri Ramen Ebisu", neighborhood: "Ebisu", lat: 35.6459, lng: 139.7102, cost: 1300, transportMode: "TRAIN", transportMin: 22, transportCost: 250 },
    { type: "ACTIVITY", title: "Daikanyama T-Site browsing", start: "15:15", durMin: 80, placeName: "Daikanyama T-Site", neighborhood: "Daikanyama", lat: 35.6483, lng: 139.7055, transportMode: "WALK", transportMin: 12 },
    { type: "RESTAURANT", title: "Izakaya night at Omoide Yokocho", start: "18:30", durMin: 110, placeName: "Omoide Yokocho", neighborhood: "Shinjuku", lat: 35.6934, lng: 139.6997, cost: 3000, transportMode: "TRAIN", transportMin: 24, transportCost: 280 },
    { type: "ACTIVITY", title: "Golden Gai bar hop", start: "20:30", durMin: 100, placeName: "Golden Gai", neighborhood: "Shinjuku", lat: 35.6938, lng: 139.7036, cost: 3500, transportMode: "WALK", transportMin: 6, notes: "Cover charges ¥500–1,000 per bar" },
  ]);

  await addDay("2027-03-18", "Tokyo", "Akihabara & Ginza", [
    { type: "ACTIVITY", title: "Akihabara electric town deep-dive", start: "09:30", durMin: 140, placeName: "Akihabara Electric Town", neighborhood: "Akihabara", lat: 35.7022, lng: 139.7745, transportMode: "TRAIN", transportMin: 28, transportCost: 260 },
    { type: "RESTAURANT", title: "Retro game lunch break at Super Potato café", start: "12:00", durMin: 55, placeName: "Super Potato", neighborhood: "Akihabara", lat: 35.6995, lng: 139.7725, cost: 1200, transportMode: "WALK", transportMin: 4 },
    { type: "SHOPPING", title: "Ginza flagship stores", start: "14:00", durMin: 110, placeName: "Ginza", neighborhood: "Ginza", lat: 35.6717, lng: 139.765, transportMode: "TRAIN", transportMin: 20, transportCost: 230 },
    { type: "RESTAURANT", title: "Dinner — Gonpachi Nishi-Azabu", start: "18:30", durMin: 90, placeName: "Gonpachi Nishi-Azabu", neighborhood: "Nishi-Azabu", lat: 35.6605, lng: 139.727, cost: 4000, transportMode: "TRAIN", transportMin: 18, transportCost: 220, notes: "Reserved · GNP77341" },
  ]);

  await addDay("2027-03-19", "Tokyo → Kyoto", "Shinkansen to Kyoto", [
    { type: "ACTIVITY", title: "Shinjuku Gyoen morning sakura walk", start: "08:45", durMin: 90, placeName: "Shinjuku Gyoen", neighborhood: "Shinjuku", lat: 35.6852, lng: 139.71, cost: 500, transportMode: "TRAIN", transportMin: 14, transportCost: 200 },
    { type: "TRANSPORT", title: "Check-out → Tokyo Station", start: "10:30", durMin: 40, placeName: "Tokyo Station", neighborhood: "Chiyoda", lat: 35.6812, lng: 139.7671, transportMode: "TRAIN", transportMin: 18, transportCost: 200 },
    { type: "RESERVATION", title: "Shinkansen Nozomi 217 → Kyoto", start: "11:33", durMin: 135, placeName: "Tokyo Station Platform 17", neighborhood: "Chiyoda", lat: 35.6812, lng: 139.7671, cost: 14210, notes: "Seat 7-E/7-F car 12 · Ticket #SKS-2291", confirmed: true },
    { type: "HOTEL", title: "Check-in — Hotel Kanra Kyoto", start: "14:30", durMin: 40, placeName: "Hotel Kanra Kyoto", neighborhood: "Shimogyo", lat: 34.9975, lng: 135.7598, notes: "Confirmation KNR-44107-KY" },
    { type: "RESTAURANT", title: "Early dinner — Menami Obanzai", start: "17:30", durMin: 85, placeName: "Menami Obanzai", neighborhood: "Nakagyo", lat: 35.002, lng: 135.765, cost: 3000, transportMode: "WALK", transportMin: 9 },
    { type: "ACTIVITY", title: "Pontochō & Kamogawa evening walk", start: "19:15", durMin: 80, placeName: "Pontochō Alley", neighborhood: "Nakagyo", lat: 35.0073, lng: 135.7696, transportMode: "WALK", transportMin: 6 },
  ]);

  await addDay("2027-03-20", "Kyoto", "Fushimi Inari & Gion", [
    { type: "ACTIVITY", title: "Fushimi Inari torii climb (early!)", start: "08:00", durMin: 145, placeName: "Fushimi Inari Taisha", neighborhood: "Fushimi", lat: 34.9671, lng: 135.7727, transportMode: "TRAIN", transportMin: 26, transportCost: 240 },
    { type: "RESTAURANT", title: "Lunch at Nishiki Market stalls", start: "12:30", durMin: 85, placeName: "Nishiki Market", neighborhood: "Nakagyo", lat: 35.005, lng: 135.7649, cost: 2000, transportMode: "TRAIN", transportMin: 24, transportCost: 240 },
    { type: "ACTIVITY", title: "Nijō Castle", start: "14:30", durMin: 100, placeName: "Nijō Castle", neighborhood: "Nakagyo", lat: 35.0142, lng: 135.7481, cost: 1300, transportMode: "TRAIN", transportMin: 12, transportCost: 220 },
    { type: "ACTIVITY", title: "Gion at golden hour + Yasaka Shrine", start: "16:45", durMin: 95, placeName: "Gion District", neighborhood: "Gion", lat: 35.0037, lng: 135.7788, transportMode: "BUS", transportMin: 18, transportCost: 230 },
    { type: "RESTAURANT", title: "Kaiseki dinner — Gion Kappa", start: "18:45", durMin: 105, placeName: "Gion Kappa", neighborhood: "Gion", lat: 35.004, lng: 135.775, cost: 9000, transportMode: "WALK", transportMin: 5, notes: "Reserved · GK-0320" },
  ]);

  await addDay("2027-03-21", "Kyoto", "Arashiyama", [
    { type: "ACTIVITY", title: "Arashiyama Bamboo Grove", start: "08:30", durMin: 80, placeName: "Arashiyama Bamboo Grove", neighborhood: "Arashiyama", lat: 35.017, lng: 135.671, transportMode: "TRAIN", transportMin: 30, transportCost: 340 },
    { type: "ACTIVITY", title: "Tenryū-ji temple & gardens", start: "10:00", durMin: 80, placeName: "Tenryū-ji Temple", neighborhood: "Arashiyama", lat: 35.0159, lng: 135.6725, cost: 500, transportMode: "WALK", transportMin: 5 },
    { type: "RESTAURANT", title: "Riverside soba at Honke Owariya branch", start: "12:15", durMin: 60, placeName: "Honke Owariya", neighborhood: "Arashiyama", lat: 35.0102, lng: 135.6723, cost: 1600, transportMode: "WALK", transportMin: 8 },
    { type: "ACTIVITY", title: "Togetsukyo Bridge & monkey park option", start: "13:45", durMin: 100, placeName: "Togetsukyo Bridge", neighborhood: "Arashiyama", lat: 35.0093, lng: 135.6688, transportMode: "WALK", transportMin: 9 },
    { type: "RESTAURANT", title: "% Arabica coffee stop", start: "15:45", durMin: 35, placeName: "% Arabica Higashiyama", neighborhood: "Arashiyama", lat: 35.0055, lng: 135.6727, cost: 700, transportMode: "WALK", transportMin: 12 },
    { type: "RESTAURANT", title: "Tonkatsu dinner — Katsukura Sanjo", start: "18:30", durMin: 70, placeName: "Katsukura Sanjo", neighborhood: "Nakagyo", lat: 35.0005, lng: 135.759, cost: 1900, transportMode: "TRAIN", transportMin: 28, transportCost: 420 },
  ]);

  await addDay("2027-03-22", "Kyoto", "Higashiyama classic", [
    { type: "ACTIVITY", title: "Kiyomizu-dera at opening", start: "08:15", durMin: 95, placeName: "Kiyomizu-dera", neighborhood: "Higashiyama", lat: 34.9949, lng: 135.785, transportMode: "BUS", transportMin: 22, transportCost: 230 },
    { type: "ACTIVITY", title: "Sannenzaka & Ninenzaka slopes", start: "10:00", durMin: 75, placeName: "Sannenzaka", neighborhood: "Higashiyama", lat: 34.9972, lng: 135.7808, transportMode: "WALK", transportMin: 4 },
    { type: "CAFE" as unknown as ItemSeed["type"], title: "% Arabica Higashiyama second visit (yes, again)", start: "11:30", durMin: 35, placeName: "% Arabica Higashiyama", neighborhood: "Higashiyama", lat: 34.9965, lng: 135.78, cost: 700, transportMode: "WALK", transportMin: 7 },
    { type: "ACTIVITY", title: "Philosopher's Path stroll", start: "13:00", durMin: 80, placeName: "Philosopher's Path", neighborhood: "Higashiyama", lat: 35.0269, lng: 135.7947, transportMode: "BUS", transportMin: 18, transportCost: 230 },
    { type: "ACTIVITY", title: "Souvenir run — Don Quijoto Kawaramachi", start: "15:30", durMin: 75, placeName: "Don Quijote Kawaramachi", neighborhood: "Nakagyo", lat: 35.0016, lng: 135.7688, transportMode: "BUS", transportMin: 20, transportCost: 230 },
    { type: "RESTAURANT", title: "Farewell dinner — Ippudo Nishikikoji", start: "18:30", durMin: 60, placeName: "Ippudo Nishikikoji", neighborhood: "Nakagyo", lat: 35.0046, lng: 135.766, cost: 1100, transportMode: "WALK", transportMin: 8 },
  ]);

  await addDay("2027-03-23", "Kyoto → Home", "Departure", [
    { type: "TRANSPORT", title: "Kyoto → Kansai Express (Haruka)", start: "10:00", durMin: 80, placeName: "Kyoto Station", neighborhood: "Shimogyo", lat: 34.9858, lng: 135.7588, cost: 2900, transportMode: "TRAIN", transportMin: 80, transportCost: 2900 },
    { type: "FLIGHT", title: "Fly home HND→? via Haneda connection (PR 427)", start: "15:40", durMin: 230, placeName: "Kansai / Haneda", neighborhood: "", lat: 34.9858, lng: 135.7588, confirmed: true, notes: "PR 427 departs Haneda 15:40" },
  ]);

  // ------------------------------------------------------------ reservations
  await db.reservation.createMany({
    data: [
      { tripId: japan.id, type: "FLIGHT", title: "PR 426 MNL → HND", dateTime: D("2027-03-14", "09:30"), confirmationNumber: "QLP9Z7", locationName: "NAIA Terminal 1", cost: 28400, currency: "PHP", cancellationDeadline: D("2027-03-07"), notes: "Check-in opens 3h prior" },
      { tripId: japan.id, type: "HOTEL", title: "Shibuya Stream Excel Hotel", dateTime: D("2027-03-14", "15:00"), confirmationNumber: "HTL-88213-TK", locationName: "Shibuya", cost: 105000, currency: "JPY", cancellationDeadline: D("2027-03-12") },
      { tripId: japan.id, type: "RESTAURANT", title: "Gonpachi Nishi-Azabu", dateTime: D("2027-03-18", "18:30"), confirmationNumber: "GNP77341", locationName: "Nishi-Azabu, Tokyo", cost: 4000, currency: "JPY", cancellationDeadline: D("2027-03-17") },
      { tripId: japan.id, type: "ACTIVITY", title: "teamLab Planets timed entry", dateTime: D("2027-03-17", "10:00"), confirmationNumber: "TLM88421", locationName: "Toyosu, Tokyo", cost: 3800, currency: "JPY", cancellationDeadline: D("2027-03-16"), notes: "Non-refundable after Mar 10" },
      { tripId: japan.id, type: "TRAIN", title: "Shinkansen Nozomi 217 Tokyo → Kyoto", dateTime: D("2027-03-19", "11:33"), confirmationNumber: "SKS-2291", locationName: "Tokyo Station", cost: 14210, currency: "JPY" },
      { tripId: japan.id, type: "HOTEL", title: "Hotel Kanra Kyoto", dateTime: D("2027-03-19", "15:00"), confirmationNumber: "KNR-44107-KY", locationName: "Shimogyo, Kyoto", cost: 104000, currency: "JPY", cancellationDeadline: D("2027-03-17") },
      { tripId: japan.id, type: "RESTAURANT", title: "Gion Kappa kaiseki", dateTime: D("2027-03-20", "18:45"), confirmationNumber: "GK-0320", locationName: "Gion, Kyoto", cost: 9000, currency: "JPY", cancellationDeadline: D("2027-03-19") },
      { tripId: japan.id, type: "FLIGHT", title: "PR 427 HND → MNL", dateTime: D("2027-03-23", "15:40"), confirmationNumber: "QLP9Z7", locationName: "Haneda Terminal 3", cost: 28400, currency: "PHP" },
    ],
  });

  // ---------------------------------------------------------------- expenses
  // JPY→PHP ≈ 0.373 (156.4 JPY/USD, 58.3 PHP/USD)
  const jpy = (amount: number, date: string, merchant: string, category: string, extra?: Partial<{ locationName: string; paymentMethod: string; paidById: string; description: string }>) => ({
    category, amount, currency: "JPY", amountHome: Math.round(amount * 0.3728), date: D(date, "12:30"), merchant, ...extra,
  });

  const expenseSeeds = [
    jpy(28400 * 58.3 / 0.3728 / 1000, "2027-02-10", "Philippine Airlines ×2 (roundtrip)", "FLIGHT", { description: "Both tickets", paymentMethod: "CARD" }),
    jpy(105000, "2027-02-12", "Shibuya Stream Excel Hotel ×5n", "HOTEL"),
    jpy(104000, "2027-02-12", "Hotel Kanra Kyoto ×4n", "HOTEL"),
    jpy(14210, "2027-02-20", "Shinkansen Nozomi Tokyo→Kyoto ×2", "TRANSPORT", { description: "Roundtrip seats both travelers" }),
    jpy(3800, "2027-02-21", "teamLab Planets ×2", "ACTIVITY"),
    jpy(1200, "2027-03-14", "Ichiran Shibuya", "FOOD", { locationName: "Shibuya" }),
    jpy(520, "2027-03-14", "Keikyu + JR to Shibuya", "TRANSPORT", { paymentMethod: "CASH" }),
    jpy(1500, "2027-03-15", "Uobei Genki Sushi", "FOOD", { locationName: "Shibuya" }),
    jpy(1000, "2027-03-15", "Harajuku Gyoza Lou", "FOOD", { locationName: "Harajuku" }),
    jpy(4500, "2027-03-15", "Nintendo Tokyo plush haul", "SHOPPING", { locationName: "Shibuya Parco", description: "Mario kart + Snorlax" }),
    jpy(800, "2027-03-15", "Streamer Coffee", "FOOD", { locationName: "Shibuya" }),
    jpy(2400, "2027-03-16", "Tokyo Skytree tickets ×2", "ACTIVITY", { locationName: "Sumida" }),
    jpy(2800, "2027-03-16", "Tsunahachi Tempura set ×2", "FOOD", { locationName: "Asakusa" }),
    jpy(1600, "2027-03-16", "Kura Sushi Asakusa", "FOOD"),
    jpy(4200, "2027-03-17", "Sushi Dai omakase", "FOOD", { locationName: "Toyosu", paymentMethod: "CASH", description: "Breakfast of champions" }),
    jpy(1300, "2027-03-17", "Afuri yuzu ramen", "FOOD", { locationName: "Ebisu" }),
    jpy(3000, "2027-03-17", "Omoide Yokocho yakitori crawl", "FOOD", { locationName: "Shinjuku" }),
    jpy(3500, "2027-03-17", "Golden Gai bars ×2 covers", "ENTERTAINMENT", { locationName: "Shinjuku" }),
    jpy(1200, "2027-03-18", "Super Potato retro games", "SHOPPING", { locationName: "Akihabara" }),
    jpy(6800, "2027-03-18", "Akihabara gacha + figures", "SHOPPING", { locationName: "Akihabara" }),
    jpy(4000, "2027-03-18", "Gonpachi dinner", "FOOD", { locationName: "Nishi-Azabu" }),
    jpy(230, "2027-03-18", "Metro day passes", "TRANSPORT"),
    jpy(500, "2027-03-19", "Shinjuku Gyoen ×2", "ACTIVITY", { locationName: "Shinjuku" }),
    jpy(3000, "2027-03-19", "Menami Obanzai", "FOOD", { locationName: "Kyoto" }),
    jpy(2000, "2027-03-20", "Nishiki Market grazing", "FOOD", { locationName: "Kyoto" }),
    jpy(1300, "2027-03-20", "Nijō Castle ×2", "ACTIVITY", { locationName: "Kyoto" }),
    jpy(9000, "2027-03-20", "Gion Kappa kaiseki", "FOOD", { locationName: "Gion", description: "Anniversary-style splurge" }),
    jpy(340, "2027-03-21", "JR to Arashiyama ×2", "TRANSPORT", { paymentMethod: "CASH" }),
    jpy(1600, "2027-03-21", "Honke Owariya soba", "FOOD", { locationName: "Arashiyama" }),
    jpy(700, "2027-03-21", "% Arabica lattes", "FOOD", { locationName: "Arashiyama" }),
    jpy(1900, "2027-03-21", "Katsukura tonkatsu", "FOOD", { locationName: "Kyoto" }),
    jpy(400, "2027-03-22", "Kiyomizu-dera ×2", "ACTIVITY", { locationName: "Higashiyama" }),
    jpy(5600, "2027-03-22", "Souvenirs — Don Quijote", "SHOPPING", { locationName: "Kyoto" }),
    jpy(1100, "2027-03-22", "Ippudo farewell ramen", "FOOD", { locationName: "Kyoto" }),
    jpy(2900, "2027-03-23", "Haruka express to KIX ×2", "TRANSPORT", { paymentMethod: "CASH" }),
  ];
  for (const e of expenseSeeds) {
    await db.expense.create({
      data: { tripId: japan.id, ...e, paidById: e.paidById ?? undefined } as never,
    });
  }
  void alex;
  void alexPartner;

  // -------------------------------------------------------------- saved places
  const savedSeeds: [string, string, number, number, number, number | null][] = [
    ["Sushi Dai", "RESTAURANT", 35.6512, 139.7868, 4.7, 4],
    ["teamLab Planets", "ATTRACTION", 35.6497, 139.7899, 4.7, 3],
    ["Golden Gai", "BAR", 35.6938, 139.7036, 4.3, 3],
    ["% Arabica Higashiyama", "CAFE", 34.9965, 135.78, 4.4, 2],
    ["Don Quijote Shibuya", "ESSENTIAL", 35.6616, 139.6998, 4.3, 1],
  ];
  for (const [name, category, lat, lng, rating, priceLevel] of savedSeeds) {
    await db.savedPlace.create({
      data: {
        tripId: japan.id, name, category, lat, lng, rating, priceLevel,
        address: category === "ESSENTIAL" ? "Shibuya, Tokyo" : "",
        openHours: "See details",
      },
    });
  }

  // ------------------------------------------------------------------ journal
  await db.journalEntry.createMany({
    data: [
      {
        tripId: japan.id, date: D("2027-03-15"), title: "First full day — Harajuku energy",
        body: "Meiji Shrine was a pocket of silence right next to Harajuku chaos. Takeshita street crepes lived up to the hype. Alex found a limited-edition Pokémon plush and hasn't stopped smiling.",
        locationName: "Harajuku, Tokyo", mood: "✨",
      },
      {
        tripId: japan.id, date: D("2027-03-17"), title: "Best. Breakfast. Ever.",
        body: "Queued 40 minutes for Sushi Dai at Toyosu. Twelve courses of melt-in-your-mouth perfection for less than a Manila dinner. teamLab Planets after — walking through knee-deep water in an infinite digital garden. Unforgettable.",
        locationName: "Toyosu, Tokyo", mood: "🤯",
      },
      {
        tripId: japan.id, date: D("2027-03-20"), title: "Ten thousand torii",
        body: "Beat the crowds up Fushimi Inari by 8 AM — the mountain gates were all ours in soft morning light. Kaiseki dinner in Gion tonight; nine tiny perfect courses.",
        locationName: "Fushimi, Kyoto", mood: "⛩️",
      },
    ],
  });

  // ---------------------------------------------------------------- checklist
  const beforeItems: string[] = [
    "Passports valid 6+ months ✓", "Book flights ✓", "Book hotels ✓", "Install Japan eSIM",
    "Buy travel insurance", "Notify bank of travel dates", "Download offline maps (Tokyo/Kyoto)",
    "Set up Suica in Apple Wallet", "Print Shinkansen tickets",
  ];
  const packingItems: string[] = [
    "Layers for 8–16°C March weather", "Comfortable walking shoes", "Packable rain jacket",
    "Universal power adapter (Type A)", "Portable battery", "Coin pouch for cash",
    "Camera + extra batteries", "Medications + first aid", "Day backpack",
  ];
  let order = 0;
  for (const text of beforeItems) {
    await db.checklistItem.create({
      data: { tripId: japan.id, section: "BEFORE_TRIP", text, checked: text.includes("✓"), order: order++ },
    });
  }
  order = 0;
  for (const text of packingItems) {
    await db.checklistItem.create({
      data: { tripId: japan.id, section: "PACKING", text, checked: false, order: order++ },
    });
  }

  // ---------------------------------------------------------------- documents
  await db.documentFile.createMany({
    data: [
      {
        tripId: japan.id, name: "Passport notes", kind: "PASSPORT_NOTE",
        content: "Miguel — Passport XX1234567, expires Jan 2033.\nAlex — Passport YY7654321, expires Aug 2029.\nJapan visa-free entry (PH passport ≤90 days). JESTA not required until 2028.",
        sensitive: true,
      },
      {
        tripId: japan.id, name: "Travel insurance policy", kind: "INSURANCE",
        content: "SafetyWing Nomad Insurance · Policy #SW-88291-2027 · Covers both travelers Mar 14–23.", sensitive: false,
      },
      {
        tripId: japan.id, name: "JR Pass exchange note", kind: "NOTE",
        content: "Decided AGAINST JR Pass — point-to-point shinkansen cheaper for this route. Keep Suica topped up ≥¥3,000.",
      },
    ],
  });

  // Weather snapshots (seasonal estimates)
  const weatherDays: [string, string, number, number, string, number][] = [
    ["2027-03-14", "Tokyo", 8, 15, "partly", 20],
    ["2027-03-15", "Tokyo", 9, 16, "clear", 10],
    ["2027-03-16", "Tokyo", 7, 14, "cloudy", 35],
    ["2027-03-17", "Tokyo", 8, 15, "rain", 60],
    ["2027-03-18", "Tokyo", 9, 17, "partly", 25],
    ["2027-03-19", "Kyoto", 7, 15, "clear", 15],
    ["2027-03-20", "Kyoto", 8, 16, "clear", 10],
    ["2027-03-21", "Kyoto", 9, 18, "partly", 30],
    ["2027-03-22", "Kyoto", 10, 19, "rain", 65],
    ["2027-03-23", "Kyoto", 9, 17, "cloudy", 40],
  ];
  for (const [date, city, tmin, tmax, cond, rain] of weatherDays) {
    await db.weatherSnapshot.create({
      data: {
        tripId: japan.id, city, date: D(date), tempMinC: tmin, tempMaxC: tmax,
        condition: cond, rainProb: rain, humidity: 58, windKph: 12, source: "seasonal-estimate",
      },
    });
  }

  // ================================================================== SEOUL
  const seoul = await db.trip.create({
    data: {
      userId: miguel.id,
      title: "Seoul Food Crawl",
      subtitle: "Seoul",
      coverEmoji: "🇰🇷",
      coverTheme: "sunset",
      status: "PLANNING",
      startDate: D("2027-04-08"),
      endDate: D("2027-04-14"),
      budgetAmount: 60000,
      homeCurrency: "PHP",
      pace: "packed",
      interests: JSON.stringify(["Food", "Shopping", "Nightlife", "Culture"]),
      travelersCount: 1,
    },
  });
  await db.destination.create({
    data: { tripId: seoul.id, name: "Seoul", country: "South Korea", lat: 37.5665, lng: 126.978, arrivalDate: D("2027-04-08"), order: 0 },
  });
  await db.flight.create({
    data: {
      tripId: seoul.id, airline: "Cebu Pacific", flightNumber: "5J 188",
      originCode: "MNL", originCity: "Manila", destCode: "ICN", destCity: "Seoul (Incheon)",
      departAt: D("2027-04-08", "06:20"), arriveAt: D("2027-04-08", "11:45"),
      confirmation: "CEB-QQ4RT", price: 14200, currency: "PHP", status: "CONFIRMED",
    },
  });
  await db.hotel.create({
    data: {
      tripId: seoul.id, destinationName: "Seoul", name: "L7 Hongdae",
      address: "Mapo-gu, Seoul", lat: 37.5563, lng: 126.9235,
      checkIn: D("2027-04-08"), checkOut: D("2027-04-14"), nights: 6,
      confirmationNumber: "L7-HD-9911", costPerNight: 98000, currency: "KRW",
    },
  });

  // ================================================================== ITALY
  const italy = await db.trip.create({
    data: {
      userId: miguel.id,
      title: "Italy Grand Tour",
      subtitle: "Rome · Florence · Venice",
      coverEmoji: "🇮🇹",
      coverTheme: "amber",
      status: "PLANNING",
      startDate: D("2027-05-20"),
      endDate: D("2027-06-02"),
      budgetAmount: 180000,
      homeCurrency: "PHP",
      pace: "relaxed",
      interests: JSON.stringify(["Food", "History", "Art", "Relaxation"]),
      travelersCount: 2,
      notes: "Two weeks — Rome 5n, Florence 4n, Venice 4n.",
    },
  });
  await db.destination.createMany({
    data: [
      { tripId: italy.id, name: "Rome", country: "Italy", lat: 41.9028, lng: 12.4964, order: 0 },
      { tripId: italy.id, name: "Florence", country: "Italy", lat: 43.7696, lng: 11.2558, order: 1 },
      { tripId: italy.id, name: "Venice", country: "Italy", lat: 45.4408, lng: 12.3155, order: 2 },
    ],
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
