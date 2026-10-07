# Wayfare

An AI travel planner. Plan a trip, get a day-by-day itinerary ordered by location, track the budget in any currency, and keep every booking and document in one place, online or off.

## Features

- **Itinerary generation** — builds each day's stops from a points-of-interest dataset and orders them by distance using greedy insertion and 2-opt route optimization.
- **AI travel assistant** — works with OpenAI-compatible, Anthropic, Gemini and Ollama models and uses 14 tools to read and change trip data. Falls back to a built-in rule-based engine when no AI provider is configured.
- **Budget and expenses** — expense tracking with live currency conversion (cached exchange rates) and charts.
- **Trip workspace** — itinerary, map, reservations, hotels, documents, packing list, journal, a discover page and an end-of-trip "Wrapped" recap.
- **Works offline** — a service worker caches the app, and changes made offline are queued and synced when the connection returns.
- **Mobile app** — a companion React Native (Expo) app with interactive maps and a step-by-step itinerary builder.
- **Security** — cookie sessions with scrypt password hashing, every query scoped to the trip owner, and rate limits on costly endpoints.

## Tech stack

| Area | Technology |
|---|---|
| Web | Next.js 16 (App Router, Server Components), React 19, TypeScript, Tailwind CSS v4 |
| Data | Prisma ORM, SQLite (dev) |
| Maps and charts | Leaflet, Recharts |
| Mobile | React Native, Expo, NativeWind |
| Tests | Node test runner (planner, currency, notifications, calendar, AI security) |

## Project structure

```
src/app/       pages and 27 API route handlers
src/lib/       planner, currency, notifications, auth, AI agent and tools
prisma/        schema and seed data
mobile/        Expo app
```

## Configuration

Create a `.env` file in the project root:

```bash
DATABASE_URL="file:./dev.db"
```

The app runs without any AI keys, using the built-in rule-based assistant. To use a hosted or local model, set one provider:

| Variable | Purpose |
|---|---|
| `AI_PROVIDER` | Optional. Force a provider: `openai`, `openrouter`, `nim`, `anthropic`, `gemini`, `ollama` |
| `OPENAI_API_KEY`, `OPENAI_BASE_URL` | OpenAI or any OpenAI-compatible endpoint |
| `ANTHROPIC_API_KEY` | Anthropic |
| `GEMINI_API_KEY` | Google Gemini |
| `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | Local models through Ollama |
| `AI_MODEL` | Optional model override |

## Run locally

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:3000.

```bash
npm test
npm run typecheck
```
