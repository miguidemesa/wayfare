# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Leisure travelers, mostly couples and small groups of friends, on multi-city trips (Tokyo · Kyoto, Rome · Florence · Venice, Seoul). They use Wayfare equally in two phases:

- **At home, planning:** weeks or months out, deciding cities, dates, pace and interests, and shaping each day.
- **On the ground, travelling:** one-handed, often outdoors or in transit. They check what's next, when to leave, how to get there, and log what they just spent.

## Product Purpose

Wayfare keeps a trip's plan, map, money and paperwork in one place and turns them into a day-by-day itinerary the traveler can follow. Success means the traveler always knows what's next and roughly what they can spend, without juggling apps.

## Positioning

The plan is geographically aware and actionable, not a list of saved places. A deterministic geo planner lays out and tidies days (ordering stops, estimating transit between them), a planning interview captures the trip brief, and alerts change what you do next ("leave in 12 min", rain on an outdoor day, budget pace). The same itinerary drives the map, the day timeline and the per-day spending allowance.

## Operating Context

- Trip lifecycle: before (countdown, planning, packing), during (today's page, now line, next stop, leave-in time, log expense), after (recap).
- Money is tracked in the traveler's home currency (e.g. PHP) with local-currency entries and a currency converter.
- Offline and poor-connectivity use on the ground is realistic.
- A companion Next.js web app shares the same API and data.

## Capabilities and Constraints

- Expo SDK 54 / React Native 0.81, expo-router, Reanimated 4, expo-image; also runs on react-native-web.
- One Wayfare brand language on both iOS and Android. Only native navigation, gestures, transitions and system controls adapt per OS. The user declined a per-OS design language.
- Every current feature and flow must survive unchanged: sign in; trips list; the 12-step new-trip planning interview; per-trip Plan / Map / Spend tabs with a shared day strip; stop detail; add stop; add expense; AI suggest and "ask" to change a day; trip brief; bookings; documents; packing and to-dos; places; journal; currency converter; recap; alerts.
- Destination photos come from `shared/images.ts`. Some destinations (e.g. New York) have no photo, so layouts must hold without one.
- Undecided: whether the "Wayfare" name is a binding commitment (not confirmed); whether both dark and light themes must remain (not confirmed).

## Evidence on Hand

- Real seeded trips in the dev database: "Tokyo & Kyoto", "Seoul Food Crawl", "Italy Grand Tour", "New York", with full itineraries, bookings, expenses and packing lists.
- Destination photography via `shared/images.ts`.
- No testimonials, metrics or press exist; do not invent them.

## Product Principles

1. **What's next beats what's possible.** On a trip, the next action (go, leave, pay, log) outranks browsing.
2. **One plan drives everything.** The itinerary, map and money views are one object seen three ways and must feel connected.
3. **Honest numbers.** Times, distances and money are estimates with provenance, shown precisely and never inflated.
4. **One hand, bad light, weak signal.** On-trip screens must work glanced at while walking.

## Accessibility & Inclusion

The app already meets 44pt touch targets, 4.5:1 text contrast on its grounds, and labelled controls for screen readers (including web). Treat these as the floor for any redesign.
