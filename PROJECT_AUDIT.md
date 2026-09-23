# Project Audit - Wayfare (AI Travel OS)

> Audit performed on d:\Downloads\travel-app as-is. No code was modified during this phase.
> Verification performed: recursive source inspection, flow tracing (auth, trip CRUD, itinerary,
> expenses, AI agent, uploads), `npm run typecheck`, `npm run lint`, live runtime probe against
> prisma/dev.db, and dependency usage analysis.

---

## 1. Executive Summary

**Wayfare** is an unusually ambitious solo-built product: an "AI travel operating system" that
combines trip planning, geographic itinerary generation, budget tracking with live FX, document
vaulting, reservations, journaling, a trip-wrapped recap, a full offline story (outbox + service
worker), and a tool-using AI concierge with graceful degradation to a deterministic local engine.
The design system (warm paper palette, Instrument Serif display face, CSS-generated cover art)
is distinctive rather than template-generic, and the backend shows genuinely good instincts:
ownership-scoped Prisma queries, scrypt password hashing, honest data provenance labels
(`seasonal-estimate`, `source: cached`), and rate limits on expensive endpoints.

However, **the application is currently broken and cannot ship.**

- `npm run typecheck` fails with **~60 TypeScript errors**, including broken/stray import
  statements appended mid-file in four feature screens and unfinished edits referencing names
  that do not exist.
- A verified runtime defect makes **every `/t/[tripId]/*` page return 404**:
  `src/lib/trip-service.ts:48` orders Travelers by `createdAt`, a column that does not exist on
  the Traveler model. Prisma raises `PrismaClientValidationError`; both `t/[tripId]/layout.tsx`
  and `t/[tripId]/page.tsx` swallow it and call `notFound()`. Confirmed by live probe.
- The git repository has **zero commits** - there is no version-control safety net.

Beneath the breakage sits a solid-but-unpolished foundation with one architectural hot spot
(the full 12-table TripBundle is fetched twice per navigation), a handful of authorization gaps
(AI tools mutate itinerary items without verifying they belong to the owning trip; one route
deletes travelers without any ownership filter), and zero test coverage.

**Bottom line:** stop adding features; repair to green (types, runtime, lint), commit to git,
close the authorization gaps, then invest in the two highest-leverage improvements: fixing the
TripBundle double-fetch architecture and building a real marketing/login surface for first visit.

---

## 2. Current Architecture

### Stack

| Layer | Technology | Notes |
| --- | --- | --- |
| Framework | Next.js 16.3.3 (App Router, RSC) | Correctly uses Promise-based `params` throughout |
| UI | React 19.2.8, Tailwind CSS v4 | CSS-variable token system in `src/app/globals.css` |
| DB | Prisma 6.19 + SQLite (`prisma/dev.db`) | Comment documents Postgres swap intent |
| Auth | Custom cookie sessions (scrypt) | `src/lib/auth.ts`, `src/lib/auth-hash.ts` |
| AI | Provider-agnostic agent (`src/lib/ai/*`) | OpenAI-compatible / Anthropic / Gemini / Ollama + local brain fallback |
| Maps | Leaflet + react-leaflet | Dark-mode tile filter in `globals.css` |
| Charts | Recharts | `wrapped-client.tsx`, `expenses-client.tsx` |
| PWA | Hand-written `public/sw.js` + `manifest.json` | Cache-first static, network-first API/navigate |
| Dead deps | `zustand`, `framer-motion`, `date-fns` | Installed, **never imported anywhere** |

### Directory shape (all business logic lives in `src/`)

```
src/
  app/
    page.tsx                    trip list (RSC)
    login/page.tsx              login/register (client)
    new-trip/page.tsx           6-step creation wizard (client)
    api/                        27 route handlers (auth, trips CRUD, 16 sub-resources)
    t/[tripId]/                 layout + 13 section pages (each = thin RSC page + fat client component)
  components/                   ui.tsx primitives, app-shell, command-palette, covers, theme, local-time
  lib/
    auth.ts / auth-hash.ts      sessions, scrypt hashing, HttpError, requireUser
    api-helpers.ts              handle() error mapping, json(), readJson(), in-memory rateLimit()
    db.ts                       singleton PrismaClient
    trip-service.ts             requireTrip / listTrips / getTripBundle / computeAnalytics
    planner.ts                  deterministic geo itinerary generator + optimizer (greedy insertion + 2-opt)
    currency.ts / weather.ts    DB-cached FX + Open-Meteo seasonal-estimate fallback
    notifications.ts            computed notification rules over TripBundle
    client-api.ts               fetch wrapper + localStorage outbox + flushOutbox()
    ai/                         agent.ts, providers.ts (5 providers), tools.ts (14 tools), local-brain.ts
    data/pois.ts                ~25 KB hand-curated POI dataset (Tokyo/Kyoto-centric + Seoul/Rome/Florence/Venice)
prisma/                         schema.prisma (19 models), seed.ts (rich demo world), 1 migration
public/                         sw.js, manifest.json, icon-512.svg
```

### Rendering / data-flow model

Every trip page is `export const dynamic = "force-dynamic"` and follows one pattern:

```
Request -> layout.tsx (getTripBundle FULL) -> AppShell(notifications)
         -> page.tsx (getTripBundle AGAIN) -> serialize ENTIRE bundle -> client component
client mutation -> api() fetch -> route handler -> db write -> router.refresh() -> BOTH loads rerun
```

There is no middleware, no caching layer, no React `cache()` deduplication between layout and page.
Section 10 quantifies the cost.

### Security posture summary

Cookie sessions are httpOnly/sameSite=lax/secure-in-prod with opaque 32-byte tokens stored server-side;
passwords use per-user salted scrypt(64) compared with `timingSafeEqual`. Ownership filtering is
near-universal via nested `where: { trip: { userId } }`. Gaps are concentrated in the AI tool layer,
one travelers route, missing security headers, upload trust model, and login/register abuse controls.

---

## 3. Product Understanding

### What it is

An opinionated travel planner for people who take international trips to dense cities and want one
place holding the whole trip: days grouped geographically, live budget in their home currency,
reservations/documents/flights/hotels, and an AI concierge that edits the plan via tools
("move dinner to 8 PM", "optimize day 3").

### Target user / personas

1. **The meticulous planner** (primary, reflected everywhere): builds the trip weeks ahead, cares
   about neighborhood grouping, transit estimates, packing lists, budgets in home currency.
   The product assumes PHP as a common home currency (defaults, seed) - likely Philippine traveler
   abroad persona (user.homeCurrency default `"PHP"` in schema).
2. **The companion traveler**: modeled only as a name row in `Traveler` (split-target). No account,
   no login, no invite flow - a stub today.
3. **The in-trip operator**: deferred audience. Notifications exist (flight in 48h, reservation in
   24h, hotel check-in day, rain alerts, budget thresholds) but the app has no push channel, so the
   in-trip moment depends on the user voluntarily opening the PWA.

### Core workflows (as implemented)

1. Sign up / sign in (`login/page.tsx`, prefilled demo credentials) -> trip dashboard (`page.tsx`).
2. Create trip: 6-step wizard (`new-trip/page.tsx`) -> `POST /api/trips` -> redirect into trip.
3. Generate itinerary: AI page (or generate route) -> planner algorithm fills days with
   neighborhood-grouped activities + meals from the curated POI dataset.
4. Daily use: itinerary drag-reorder / edit times (`api/trips/[tripId]/itinerary`), log expenses
   (optionally receipt-scan with vision model), save places from Discover, journal.
5. Ask AI: chat persists conversations/tools-used per trip (`AIMessage.toolCalls`, `data`).
6. Reflect: Trip Wrapped aggregates distance/category/day stats with charts.

### Business model signals

None implemented. Obvious futures: freemium AI quota (rate limit `chat:${userId}` already exists),
paid tiers keyed to provider costs, multi-user collaboration paid seats (Traveler model ready).

### Implemented vs incomplete

- **Implemented well**: trip CRUD, itinerary engine + manual editing, expenses + splits + FX,
  discover/save places, checklist + generated packing list, journal, documents vault (upload/download
  with masking), reservations, weather intelligence, wrapped analytics, AI chat with 14 tools,
  offline outbox + PWA shell, dark mode, command palette (Cmd-K).
- **Incomplete / half-done**: travelers collaboration (no invites/sharing), notifications (computed,
  never pushed, never marked read), trip editing beyond title/budget via API (`PATCH` exists but no
  settings UI referenced on trip cards), login -> marketing surface, tests (zero), seed-only cities.
- **Feels unnecessary**: little - feature sprawl is not the problem; polish and correctness are.
  Candidates to cut or merge: separate Hotels page vs Reservations vs Itinerary flight/hotel items
  (three surfaces show overlapping data).
- **Missing core functionality**: multi-device conflict handling for the offline outbox, sharing /
  collaboration, calendar export (.ics), currency revaluation of historical expenses when rates
  change (amountHome frozen at entry), image hosting for journal photos (photos stored as URL strings
  with no uploader), account settings (name/password/currency/home).

---

## 4. Current Features (inventory with health)

| Area | Where | Health |
| --- | --- | --- |
| Auth (register/login/logout/me) | `api/auth/[action]/route.ts` | Works; hardened below |
| Trips list/create/update/delete | `page.tsx`, `api/trips/*` | Works; GET-performs-writes smell |
| Dashboard/overview | `t/[tripId]/overview-client.tsx` (+24 KB) | Works visually; hierarchy dilution |
| Itinerary (days/items/reorder/optimize) | `itinerary-client.tsx`, planner | Core strength; keyboard gap |
| AI concierge | `ai-client.tsx`, `lib/ai/*` | Impressive; tool-scope flaw |
| Discover + saved places | `discover-client.tsx`, places API | Works; case-sensitive search |
| Expenses + splits + receipts scan | `expenses-client.tsx` (28 KB) | Largest page; split math nits |
| Stays & flights | `hotels-client.tsx` | **Broken build state (unfinished EditHotelModal)** |
| Reservations CRUD | `reservations-client.tsx` | **Broken build state (duplicate imports)** |
| Documents vault | `documents-client.tsx`, file download route | **Broken build state (duplicate imports)** |
| Packing/checklist | `packing-client.tsx` | **Broken build state (duplicate identifiers)** |
| Journal | `journal-client.tsx` | **Broken build state** |
| Trip Wrapped | `wrapped-client.tsx` + computeAnalytics | **Runtime crash (Badge not imported)** |
| Map | `map-view.tsx` (Leaflet) | Functional; markers/mode UIs built |
| Currency converter | `currency-client.tsx` | Works; line 72 dead symbol render |
| Notifications center | `app-shell.tsx`, notifications lib | Computes but never marks-read/pushes |
| Offline mode | `client-api.ts`, `use-online.ts`, `sw.js` | Bold and mostly working; flush drops bad records |
| Search/command palette | `command-palette.tsx`, search API | Fast path exists; SQLite `contains` is case-sensitive |
| PWA installability | manifest + sw registration | Present; iOS meta tags missing |


## 5. UI/UX Audit

### What works (do not lose this)

- **Real visual identity**: warm off-white canvas (#f7f6f2) + teal accent + Instrument Serif for
  display numerals/titles gives a distinct "field notes" feel; gradient cover art system with grain
  (`components/covers.tsx`) replaces stock photos entirely and renders offline at zero payload.
- **Token discipline**: nearly all color goes through CSS variables with light/dark pairs
  (`globals.css:6-56`); radius (`--radius-card: 14px`), two-tier shadows, and selection/focus ring
  are consistent. This is *not* generic-AI slop and not glassmorphism-heavy (glass used once,
  functionally, for sticky bars).
- **Design-system primitives actually used**: Button/Card/Badge/Input/Field/Modal/Tabs/Switch/
  Skeleton/EmptyState/Spinner in `components/ui.tsx` are consumed consistently by feature screens.
- **Motion restraint**: fade-up/scale-in keyframes (150-350 ms, expressive cubic-bezier) plus a
  global `prefers-reduced-motion` kill-switch. Intentional, communicative, not decorative.

### Problems, in priority order

1. **Unauthenticated first visit is abandoned** - `src/app/page.tsx:17-25`: signed-out users get a
   centered link reading "Sign in ->". No hero, no product explanation, no screenshots/demo CTA,
   no value proposition. The login page contains excellent marketing copy ("Your whole trip, one
   beautiful system") that first-time visitors never see. This is the weakest conversion surface
   in the product.
2. **Overview hierarchy is flat** (`t/[tripId]/overview-client.tsx`): the dashboard renders a cover
   banner, countdown chips, budget card, Next Up card, weather strip, category breakdown,
   upcoming reservations, quick convert ticker, AND a 4-cell MiniStat row (transit/packing/journal/
   plus more) - roughly nine equal-weight modules. Nothing reads as "what do I do next"; the
   Next Up card competes with decorative stat tiles. Recommendation below (Quick Wins QW-1).
3. **Sidebar information architecture** (`components/app-shell.tsx:42-54`): 12 ungrouped nav entries
   (Overview, Itinerary, Map, Discover, Expenses, Currency, Stays & Flights, Reservations,
   Documents, Packing, Journal, Trip Wrapped). Related concepts scatter: *Stays & Flights*,
   *Reservations*, and itinerary flight/hotel items overlap; *Discover* (pre-trip research) mixes
   with *Currency* (on-the-ground utility). Group into PLAN / ON TRIP / MONEY / VAULT / MEMORY
   sections with subheads; fold Currency into Expenses or a utilities cluster.
4. **Demo-account affordances leak into the product frame**: login form ships with hard-prefilled
   `demo@wayfare.app / wanderlust` (`login/page.tsx:13-14,163-167`) and a visible credential card.
   Great for evaluators; confusing for real signups who see someone else's credentials front-and-
   center. Gate behind `NODE_ENV`/query param or reduce to a subtle "try demo" button.
5. **Type-scale fragmentation**: body text at 13px/13.5px/12.5px/11px/10px appears ad hoc across
   files (e.g. `text-[13px]`, `text-[13.5px]`, `text-[12.5px]`). Consolidate to a stepped scale
   (11/12/13/15/17/20/24) mapped to semantic classes so density stays intentional.
6. **Destination lock-in undermines the wizard promise**: `new-trip/page.tsx` autosuggest only
   curated `CITY_META` cities (seed-era: Tokyo, Kyoto, Seoul, Rome, Florence, Venice); unsupported
   inputs fail silently (`addDestination` no-op when meta missing). Users cannot plan an unlisted
   city even though `POST /api/trips` accepts free-text destinations with coordinates. Show an
   explicit "City not supported yet" + freeform entry fallback, or support geocoding.
7. **Budget step forces a number**: wizard Step Budget gate `canNext` requires `Number(budget)>0`
   (`new-trip/page.tsx:68`) yet schema allows 0 and the trips API clamps to >=0. "Skip for now"
   should be legal.
8. **Dark mode** is complete and tuned (Leaflet tiles inverted) - no issues found.
9. **Print styles** exist (`.no-print`) - good instinct; no obvious consumer page labeled print-ready.

### Empty/loading/error states

Empty states are consistently designed via `EmptyState` (emoji tile + title + description + action)
and the zero-trips home state is friendly. Loading skeletons exist (`Skeleton`, shimmer) but most
pages have no loading.tsx skeletons wired (RSC navigation shows stale content then pop) - add
`loading.tsx` per trip section. Error states: client mutation failures usually vanish (`catch {}`
in `journal-client.tsx:22`, `itinerary-client.tsx:119` - delete failure is silently ignored), while
the login/wizard surfaces inline errors. Unify a toast/banner primitive; there currently is none.

---

## 6. UX Interaction Audit

### Friction inventory

| Flow | Friction observed | File |
| --- | --- | --- |
| First visit | Dead-end wall (see 5.1) | `app/page.tsx` |
| Sign in | Prefilled stranger credentials; no password manager hints beyond autoComplete | `login/page.tsx` |
| New trip | 6 mandatory steps before payoff; cities constrained; no preview of generated day until after submit | `new-trip/page.tsx` |
| Reorder itinerary | Mouse-drag only; no keyboard handle, no move-up/down buttons; invisible until hover (GripVertical) | `itinerary-client.tsx:74-112` |
| Log expense | Solid sheet/modal; receipt scan degrades gracefully (explicit `available:false` messaging) | `expenses-client.tsx`, `receipt-scan/route.ts` |
| Find anything | Cmd-K palette with debounced search + quick jumps - good; undermined by case-sensitive backend matching | `command-palette.tsx`, `api/trips/[tripId]/search/route.ts` |
| Manage trip (rename/delete/budget/dates) | API exists (`PATCH/DELETE /api/trips/[tripId]`) but no discoverable settings entry point on cards or overview | `t/[tripId]/*` |
| Remove traveler/companion | API only | `api/trips/[tripId]/travelers/route.ts` |
| Delete actions | Single-click destructive deletes for items/places/journal; no undo toast, no confirm for expensive-to-recreate things | various clients |
| Offline | Clear badge states (Offline - Xm ago, Syncing N); mutations queued transparently; no way to view/reject the queue | `app-shell.tsx:191-200` |
| AI | Chat history/conversations persist per trip; suggestions templated; long generations have typing indicator; no streaming | `ai-client.tsx`, `api/trips/[tripId]/ai/route.ts` |

### Feedback loops that need attention

- After every mutation, `router.refresh()` re-runs the full server pipeline; combined with
  `force-dynamic` this makes fast repeated actions (ticking several packing checkboxes) feel laggy
  versus optimistic-first architectures already half-present (`persistOrder` sets state optimistically).
- The notification bell shows a pulsing coral dot for *any* computed notification and a count badge
  equal to list length forever; there is no read/unread model (`notifications.ts` computes fresh each
  render, `NotificationCenter` holds no seen-set).
- Success feedback is inconsistent: moving an itinerary item shows nothing (state just changes),
  generating packing items returns `{generated: N}` but the UI relies on refresh; copying confirmation
  numbers has no copied-toast pattern.

---

## 7. Responsive Design Audit

Verified responsive patterns: desktop rail (232 px) collapses into glass bottom tab bar with five
anchors (Home/Trip/Map/Money/AI) plus top-bar brand link; fixed wizard footer stacks safely;
grids downgrade 3->2->1 (`sm:` breakpoints used widely); modals cap at 88 vh with internal scroll.
Genuine risks:

1. **Trip card covers + 32px cover emojis scale fine**, but `TripCard` date string uses an en dash
   and will wrap awkwardly at 320 px width; acceptable.
2. **Itinerary day-picker tabs** scroll horizontally with `hide-scrollbar` - affordance for overflow
   (gradient edge) missing; users on small phones may not realize more days exist to the right.
3. **Modal forms with 3-column grids** (e.g. hotel edit) compress to stacked fields on narrow
   widths via grid collapse - visually fine, but combined height on a 667 px-tall phone makes the
   Save button require inner scrolling; consider bottom-sheet treatment below `sm`.
4. **Tables/charts**: Wrapped pie/bar sections assume chart min-height; Recharts ResponsiveContainer
   handles resize, but tooltips on touch are awkward (no tap-out behavior) - standard fix is
   pointer-events tuning + dismiss-on-scroll.
5. **Tap targets**: bottom nav hits ~48 px; icon buttons in headers are 36 px (`h-9 w-9`) - under the
   44 px iOS/48 px Android comfort zone; increase interactive hit areas via padding, not visual size.
6. No landscape/tablet-specific layouts exist; at iPad widths the desktop sidebar + max-w container
   yields generous margins - acceptable but wasteful for Map/Itinerary which could go wider.

---

## 8. Accessibility Audit (WCAG-focused)

Good foundations: `lang="en"`, semantic landmarks, `aria-current="page"` on nav, `role="switch"`,
visible `:focus-visible` rings globally, reduced-motion honored, dialog `aria-modal` + Esc close,
baby-label pattern in `Field` wraps inputs so labels are programmatically associated.

Defects (by severity):

1. **Modals do not manage focus** (`components/ui.tsx:215-272`): no focus moved into the dialog on
   open, no focus trap (Tab reaches background controls), no restoration on close, no
   `aria-labelledby` linkage to the title element. Keyboard/SR users land outside the overlay.
2. **Contrast**: `--ink-3: #9aa1ad` (light) on `--bg/#fff` measures roughly 2.7-2.9:1 and is used for
   substantive microcopy (hints, timestamps, empty-state descriptions, 11px labels) - fails AA for
   normal text and even large-text thresholds in spots. Dark variant (#5d6875 on #12161e) is worse
   on secondary text. Raise ink-3 toward ~#767e8a (light) / shift usage to ink-2 for content-bearing text.
3. **Emoji-as-icon semantics**: functional icons rendered as raw emoji strings (notification icons,
   `MiniStat`, mood picker, type dots are fine with aria-hidden but `ResIcon`/weather chips are not
   consistently hidden); SR output includes "airplane", "hundred points", etc. inconsistently.
4. **Drag-only reordering** (ItineraryClient) lacks a keyboard alternative (aria roving handle with
   arrow-key move is the established pattern).
5. **Toast-free operation** means async outcomes are announced nowhere via `aria-live`.
6. Canvas/SVG cover art carries `aria-hidden` correctly only when childless (covers.tsx:63).
7. Touch target sizes above; scroll-lock is applied on open (body overflow hidden) but restored
   incorrectly if two overlays stack (palette opens over modal -> close of one unlocks scroll).

---

## 9. Frontend Architecture Audit

### Strengths

- Clean separation server/client: thin RSC pages (~30-60 lines) fetch bundles; heavy interaction
  lives in clearly-named `*-client.tsx` siblings. Consistent, predictable, easy to navigate.
- Server-only guardrails: `import "server-only"` on auth/db/currency/weather/notifications/AI libs.
- One typed fetch wrapper (`client-api.ts`) centralizes error shaping (`ApiError{status}`), JSON
  handling, and offline queueing; callers consistently use it.
- Design tokens centralized; utilities (`cn`, fmtMoney, fmtTime12, haversine) consolidated in utils.
- Next 16 conventions respected (Promise params, metadata/viewport exports, next/font).

### Weaknesses (architectural, ranked by leverage)

1. **Bundle-from-server prop drilling** - RSC pages serialize the entire `TripBundle` into client
   components (incl. documents contents, every journal body, every expense). Payload grows O(trip);
   hover-to-refresh repeats it. Introduce per-section queries (server functions fetching only what
   that page renders) with `React.cache()` dedup; keep the bundle only where genuinely needed
   (overview). This also fixes the double-fetch in Section 10.
2. **State layer ambivalence**: server props + `router.refresh()` for everything, zero client cache.
   Consequence: checkbox toggles, saves, and moves each trigger a full RSC round trip. Either adopt
   a normalized client store fed by the server snapshot (the unused zustand dep suggests this was
   considered) or make toggles fully optimistic against a merged snapshot. Today both patterns mix:
   `persistOrder` is optimistic-local + refresh; checkbox flows are await-then-refresh.
3. **God components at the edges**: `overview-client.tsx` (558 lines), `expenses-client.tsx` (~28 KB),
   `itinerary-client.tsx` (~28 KB) each bundle data-shaping + 4-8 modals + domain formatting.
   Extract per-domain hooks (`useExpenses`, `useItineraryActions`) and modal components; keep pages
   compositional. Not urgent pre-launch, but Sections 12/17 recommend tests which need seams.
4. **Route-handler duplication**: every route repeats `requireUser -> assertOwned pattern` with three
   divergent implementations (returns json 404, throws plain Error, throws HttpError) - leading to
   the 500-vs-404 inconsistency flagged in Section 11. Standardize one `withTrip(tripId)` guard.
5. **Dead/unfinished artifacts** (current breakage): trailing duplicate import blocks in
   `documents-client.tsx:261-263`, `reservations-client.tsx:316-317`, `packing-client.tsx:~205`,
   `journal-client.tsx` duplicate icon imports; `wrapped-client.tsx` uses `<Badge>` without importing;
   `hotels-client.tsx:201` references undefined `typeof hotels[0]` and `useRef` un-imported.
   These read like an interrupted mechanical refactor; finish or revert them.
6. **Minor dead code**: `currency-client.tsx:72` renders `(rates[from] && rates[to] ? "" : "") || ""`
   (always empty) where a From-symbol belongs; `planner.ts` place-item order ternary is identical in
   both branches; `notifications.ts:122` `void dayOfTrip;` residue; `travelers/route.ts:14-16` empty
   validation branch.


## 10. Backend Audit

### Overall shape

27 route handlers follow a consistent micro-pattern: `requireUser()` -> optional ownership probe ->
validate -> Prisma mutation -> `json(...)`, all wrapped by `handle()` for error mapping
(`api-helpers.ts`). There is no service layer below `trip-service.ts`/`planner.ts`; business logic
lives directly in handlers (acceptable at this scale, but it produced the inconsistencies below).
No middleware exists, so validation/auth duplication is copy-paste per file.

### Findings

| # | Severity | Finding | Where |
| --- | --- | --- | --- |
| B1 | High | **Ownership guards return wrong status codes.** Items/expenses/itinerary/saved-places helpers throw plain `Error("... not found")`; `handle()` maps any non-HttpError to 500. A user requesting someone else-s item id gets `500 Internal Server Error` instead of 404, and the server logs a stack trace as if it were a fault. | `api/items/[itemId]/route.ts:9`, `api/expenses/[expenseId]/route.ts:10`, `api/trips/[tripId]/itinerary/route.ts:26`, `api/trips/[tripId]/saved-places/route.ts:7` |
| B2 | High | **GET performs writes.** `GET /api/trips` loops trips and `db.trip.update`s status changes while listing - side effects in GET break HTTP semantics, cause cache-invalidation chaos under any future CDN/rate limit, and run N+1 updates. | `api/trips/route.ts:11-18` |
| B3 | Medium | **Duplicated/misleading auth code**: `PATCH /api/trips/[tripId]` calls `requireUser()` twice with the comment `// ownership check` on the second call, which does no such thing. | `api/trips/[tripId]/route.ts:34-49` |
| B4 | Medium | **Unvalidated enum-ish fields**: trip `status`, `pace`, `homeCurrency` accept arbitrary strings and are persisted verbatim (`body.status != null ? patch.status = body.status`). Same for expense `category`, reservation `type`. Types exist in `lib/types.ts` but are never enforced server-side. | `api/trips/[tripId]/route.ts:55-58`, expenses/reservations routes |
| B5 | Medium | **Non-atomic multi-write flows**: expense creation + N split inserts (loop of awaits), itinerary reorder loop (`updateMany` per item), packing-list generation loop of creates, FX rate refresh upsert-loop, currency reference seeding. Any mid-flight failure leaves inconsistent rows; SQLite local-file makes this invisible today, Postgres later will surface partial states. Use `$transaction([])` / `createMany`. | `expenses/route.ts:75-85`, `itinerary/route.ts:106-112`, `checklist/route.ts:46-59`, `currency.ts:71-77` |
| B6 | Medium | **In-memory rate limiter leaks and lies**: `buckets` Map grows without eviction (unbounded memory under attacker-churned keys like `login:<email>`); per-instance state means multi-process/serverless deployments each get fresh buckets. Login limiting is keyed by email only - an attacker rotating emails bypasses it entirely; `/register` has none. | `api-helpers.ts:31-44`, `auth/[action]/route.ts:24,36` |
| B7 | Medium | **Weather backfill is synchronous and serial** inside trip GET when snapshots are empty: up to 21 sequential Open-Meteo calls plus 21 row upserts before first paint of the bundle. Batch forecast per city once; move backfill off the request path. | `weather.ts:183-222`, called from `trips/[tripId]/route.ts:21-27` |
| B8 | Low | Search backend uses Prisma SQLite `contains`, which is **case-sensitive** for SQLite - lowercased queries fail against mixed-case stored data ("ramen" will not match "Ichiran Ramen"). Palette feels broken because of DB collation, not algorithm. Options: store normalized columns or fetch+filter in memory at this data size. | `search/route.ts:19-59` |
| B9 | Low | Currency defaults inconsistent: hotels POST and AI tools default `currency: "JPY"` while flights default to `trip.homeCurrency` - multi-trip users get yen-denominated hotels silently. | `hotels/route.ts:49`, `ai/tools.ts:227,619,801` |
| B10 | Low | Session expiry cleanup is lazy-only (delete when presented); expired rows accumulate forever. Notifications API recomputes the full bundle per poll; nothing marks notifications read/deduped. | `auth.ts:52`, `notifications/route.ts` |
| B11 | Info | Money stored as Float everywhere (schema-wide). Rounding happens ad hoc (`Math.round(*100)/100`) after conversion math - classic drift vector for a budget product. | schema.prisma all amount fields |
| B12 | Info | `getTripBundle` travelers sort orders by nonexistent column (see CRITICAL section 20/P0-2); `computeAnalytics` km math hardcodes flights at 3000 km and train items at 8 km - honest-ish estimates that should be labeled as such in Wrapped UI. | `trip-service.ts:48,113`, analytics blocks |
| B13 | Info | Documents DELETE unlinks using raw `doc.fileName` from DB while download guards via `path.basename` - normalize both paths through one safe helper. | `documents/route.ts:113` vs `[docId]/file/route.ts:24` |

### What is done right

`handle()` centralizes JSON error mapping; `rateLimit` guards exactly the expensive endpoints (chat,
vision, upload); upload route enforces size cap + MIME whitelist + random filenames; documents GET
returns metadata masking file contents and the download route scopes by owner; reservations/flights/
hotels validate date coherence (checkOut > checkIn etc.); the receipts endpoint refuses to persist
without confirmation and states availability honestly.

## 11. Database Audit

### Schema quality (prisma/schema.prisma - 19 models)

Strengths worth keeping: every child FK cascades from Trip ownership deletion (no orphan risk);
`@@index([tripId])` on all children; `Session.token @unique` with index; `WeatherSnapshot` uses
`@@unique([tripId, city, date])` making idempotent caching correct; join model `ExpenseSplit`
indexed both directions.

Issues:

1. **Traveler lacks createdAt yet code orders by it** - direct cause of the P0 runtime failure
   (`getTripBundle`, seed-writers assumed it existed). Either add the column + migration or change
   the query; right now the code cannot run.
2. **Money precision**: `Float` for amounts across Expense/Flight/Hotel/Trip.budgetAmount/Splits.
   For a budgeting app prefer integer minor units (or Decimal on PG migration). Conversion already
   rounds twice per save.
3. **String enums**: acknowledged trade-off documented in schema comments with canonical unions in
   `types.ts` - but nothing validates at the boundary (B4). On the promised Postgres swap, convert
   to native enums + CHECK-style validation via zod at handlers.
4. **Denormalized split logic**: `Expense.splitWith` stores `"ALL"` while concrete `ExpenseSplit`
   rows duplicate shares; travelers added/removed afterwards never rebalance; rounding remainder
   (share = round(amount/n)) loses cents vs total. Pick one source of truth (splits table), compute
   equal-split at query time, keep remainder on payer row.
5. **ItineraryDay.dayIndex** is `count+1` computed outside transactions - concurrent day creation
   duplicates indexes; days also ordered by `date` in reads while items carry independent `order`
   ints with gaps allowed (count+10 spacing in checklist). Harmless locally; document or serialize.
6. **Session hygiene**: no TTL sweep job; table grows indefinitely (low stakes until many devices).
7. **Hotel.currency default "JPY"** hardcoded at schema level and route level - defaults belong to
   the domain service (trip home currency), not storage defaults.
8. **Documents**: `fileName` random UUID + extension derived from client MIME only; consider storing
   sniffed mime/size post-read and content-hash for dedupe later.
9. Naming is consistent and readable throughout; audit timestamps missing on most child models
   (createdAt present selectively: Hotel/Items/SavedPlace/Documents have them; Flight/Reservation/
   JournalEntry partially). Not blocking; standardize when touching migrations anyway.

Migration state: single clean init migration (`20260826121614_init`) matching schema; dev.db seeded
with realistic multi-country world (Japan/Korea/Italy trips, complete expenses/splits/journal/docs)
via a genuinely excellent 33 KB seed script (`prisma/seed.ts`) including deterministic ids and
password-free demo auth wiring. Keep and extend it as the E2E fixture.


## 12. Security Audit

Classified per requested scale. Ownership model is the backbone: nearly every query nests
`trip: { userId }` and pages verify before render - the failures are edge skips, not a missing model.

### Critical

| ID | Issue | Detail / fix |
| --- | --- | --- |
| S1 | **P0 runtime failure breaks all authed surfaces** | `src/lib/trip-service.ts:48` orders Travelers by nonexistent `createdAt`. Every `/t/*` request throws -> caught -> `notFound()`. Not attacker-caused but blocks any security posture review of real behavior. Fix column/query first. |
| S2 | **AI tools can mutate items across trips** | `lib/ai/tools.ts` `update_itinerary_item` (:265), `delete_itinerary_item` (:285), `move_itinerary_item` (:335) call `assertTrip(ctx)` then update/delete/move `where: { id: item_id }` with **no check that the item belongs to ctx.tripId**. Tool args originate from LLM output; a prompt-injected message (user message content is stored/replayed in history) can carry another tenant-s item id (visible in logs/history or brute-forced rarely) and cause cross-tenant writes/deletes. Fix: verify `item.tripId === ctx.tripId` inside each executor (and ideally `item.day.tripId`) before write; consider deny-by-default `updateMany({ where: { id, tripId } })`. |
| S3 | **No security headers anywhere** | `next.config.ts` is empty. Missing CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, frame-ancestors. An app holding passport notes should ship strict headers from day one. |

### High

| ID | Issue | Detail / fix |
| --- | --- | --- |
| S4 | **Traveler deletion lacks ownership filter** | `api/trips/[tripId]/travelers/route.ts:38` finds by `{ id, tripId, isOwner:false }` without nesting `trip:{userId}`; possession of ids allows deleting other users- companions. Add `trip: { userId: user.id }`. |
| S5 | **Login/register abuse surface** | Rate limit keyed by email only (rotatable), register unlimited -> spam/credential-stuffing + DB pollution. Add IP+email composite limiter, lockout backoff, and Argon2id/scrypt cost review. No CSRF token on cookie mutations: SameSite=Lax mitigates classic CSRF for POSTs but explicit Origin check or double-submit token is prudent given document/AI write endpoints. |
| S6 | **Upload trust model** | `documents/route.ts` trusts client-declared `file.type` for both whitelist and stored extension/mime; no magic-byte sniffing; download serves bytes back with that mime inline and **no nosniff header** (`[docId]/file/route.ts`). While text/html is blocked by whitelist today, defense-in-depth demands server-side sniffing, forced extension mapping, and `X-Content-Type-Options:nosniff`; also sanitize file download Content-Disposition (encodeURIComponent already used - good). |
| S7 | **Destructive AI actions lack hard confirmation gates** | System prompt *asks* the model to confirm destructive ops; only `apply_optimization` technically enforces `confirm:true`. `delete_itinerary_item`, `add_expense`, `add_reservation` execute on a single tool call. Enforce server-side confirm tokens for deletions/expenses above a threshold. |

### Medium

| ID | Issue | Detail / fix |
| --- | --- | --- |
| S8 | Prompt-injection amplification via persisted history | User messages stored verbatim and replayed as chat history with tool access (S2). Add per-message sanity limits, strip tool-call affordances from untrusted spans, treat itinerary/notes/place names as untrusted strings in system context. |
| S9 | Sessions never rotate; 30-day fixed expiry | Sliding-window rotation + revoke-all-devices endpoint missing; stale rows linger (B10). |
| S10 | Demo credentials shipped in UI | Fine for demos; gate behind env flag. Also `console.error("[api]", e)` can leak Prisma internals into logs - trim to safe summaries in prod. |
| S11 | `.env` hygiene is good | Only DATABASE_URL present locally; `.gitignore` covers `.env*` and `*.db`; `.env.example` documents AI keys properly. Keep it that way when keys get added. |
| S12 | Rate limiter memory growth (Map unbounded) -> local DoS vector on login route (see B6). |

### Low

- Map page loads Leaflet CSS/JS fine; no third-party scripts otherwise (privacy-positive).
- Service worker caches API GETs including auth-scoped JSON in shared caches - scoped cache entries
  in a single-user browser are acceptable; ensure `Cache-Control: private, no-store` (present) stays.
- Path-traversal guard on download uses basename + prefix check correctly; replicate in DELETE (B13).
- Emoji/status fields rendered raw - React escapes; no dangerouslySetInnerHTML found anywhere (XSS-clean markup). AI markdown rendered how? (ai-client) - if using a markdown renderer, re-check sanitization once streaming lands.

## 13. Performance Audit

### The dominant cost: TripBundle everything, twice, always

For every authenticated page view under `/t/[tripId]/*`:

1. `t/[tripId]/layout.tsx:22` -> `getTripBundle()` = 12 Prisma queries incl. all days/items,
   expenses, journal bodies, document metadata - to compute sidebar shell data + notifications.
2. Section `page.tsx` -> `getTripBundle()` again -> serializes the whole object graph to the client
   component props (RSC flight payload grows linearly with trip size and repeats per navigation).
3. Any mutation -> `router.refresh()` -> steps 1-2 again.

At seed scale this is ~40-90 ms; at 200 expenses/100 journal entries/30 documents with photos URLs it
is hundreds of ms of pure serialization repeated constantly. This one refactor outperforms every
other optimization available:

- Split bundle loaders per concern: `getTripShell(tripId)` (title/meta/destinations),
  `getNotifications(tripId)` (the 4 tables the rules actually read), and per-section queries used by
  each page (`page.tsx` for itinerary fetches days/items only, etc.). Wrap with React `cache()` so
  layout+page share identical reads within one request.
- Replace broad `include: { messages: ... }` conversation list load (all messages of 20 convs just
  to count them) with `_count` + fetch messages only for active conversation (`api/trips/[tripId]/ai/route.ts:13-37`).
- `listTrips` pulls full expense rows to sum in JS - use `groupBy(tripId)` aggregate.

### Secondary findings

| Area | Finding | Where |
| --- | --- | --- |
| Weather | Serial per-day live fetch + row upserts on critical path (B7); batch per city, background-populate, serve estimates immediately with provenance labels (already designed for honesty). | `weather.ts` |
| Currency | 19 sequential upserts per refresh; wrap in transaction/createMany; fine thereafter thanks to TTL design. | `currency.ts:71-77,101-107` |
| Client JS | Route-level code splitting automatic; Recharts + Leaflet are the two heavy deps and map is dynamically imported via `map-loader.tsx` (good). Charts live on wrapped/expenses pages which bundle Recharts eagerly - lazy-import chart sections. Unused deps (zustand/framer-motion/date-fns) cost install+supply chain only. | map-loader, package.json |
| Fonts | next/font self-hosting Geist/Mono/Instrument Serif = correct (zero external requests). | layout.tsx |
| Images | None served except SVG icon - cover art system means near-zero image payload; excellent LCP profile once backend latency is fixed. | covers.tsx |
| DB indexes | Adequate today; add `[dayId, order]` and Expense(date desc)+tripId composite as data grows; SQLite over network FS would be pathological - fine for demo, swap PG before any shared hosting. | schema.prisma |
| Caching | Everything `force-dynamic`; fine for correctness-first launch, but read-mostly pages (wrapped, journal view, discover POIs) could use `revalidate` tags after mutations instead of zero-cache. | all pages |
| PWA sw.js | Stray `self.__WB_MANIFEST;` line 1 (undefined global read), background-sync listener registered but nothing ever calls `sync.register('wayfare-sync')` - dead path; navigation fallback resolves cached `/` even when offline-auth failed (ghost dashboard risk after session expiry offline). | public/sw.js:1,84-91,64-76 |


## 14. Feature Opportunities

### Missing core features (the product feels unfinished without these)

| Feature | Problem it solves | User | Why now | Complexity | Priority |
| --- | --- | --- | --- | --- | --- |
| Trip settings surface | Rename/redate/budget/delete trips is API-only today; users who mistype the wizard are stuck. | All | Cheap win completing existing backend | S | P1 |
| Calendar export (.ics) / Add to calendar | Travelers live in calendars; flights/hotels/reservations belong there automatically. | Planner persona | Differentiator vs manual copy; builds on existing Reservation/Flight/Hotel models with dateTimes already normalized. | M | P1 |
| Sharing/collaboration v1 | `Traveler` rows exist but companions cannot see or edit anything; groups are the norm for trips. | Groups/families | Split-tracking without shared view forces spreadsheet regression. Requires invite tokens + viewer/editor roles (schema ready-ish). | L | P2 |
| Journal photo upload | Photos stored as URL strings but no uploader exists; journal stays text-only despite UI camera affordances in copy. | Memory keeper | Reuses documents upload pipeline nearly as-is. | M | P2 |
| Real notification channel | Computed rules only render inside an open tab; no push/email/SMS for flight T-48h etc. | In-trip operator | The highest-stakes moment (airport, deadline) has zero delivery path. Web Push on top of existing computeNotifications is straightforward once jobs exist. | M (needs scheduling infra) | P2 |
| Account settings | Cannot change name/password/home currency anywhere. | All | Parity hygiene; schema fields exist untouched. | S | P1 |

### High-value features (differentiators on an existing spine)

- **Budget revaluation**: today `amountHome` freezes at entry-time rate; currency page shows a clean
  converter but budgets silently drift from reality. Recompute option + display of FX drift per trip.
  Builds directly on CurrencyRate history (store daily snapshot table). Complexity M, value high,
  unique vs competitors (most freeze like this app does - making it a *feature* to fix is rare).
- **Offline-first upgrade**: outbox exists; add queue inspection UI + conflict policy + server-side
  idempotency keys so flushOutbox (currently drops non-5xx failures = silent loss) becomes safe;
  register background sync that sw.js already waits for. Complexity M; aligns with the product-s stated
  travel edge-case audience where connectivity is genuinely bad.
- **AI streaming + action cards**: chat responses arrive whole-route; stream tokens and materialize
  tool results into tappable cards ("Apply optimization", "Undo move") instead of markdown-only.
  Complexity M, delight+usability both up; local-brain data payloads (`place-cards`) already hint at it.

### Delight features (post-polish)

- Day-detail timeline printing ( print stylesheet exists); PDF itinerary export from wrapped data.
- Trip Wrapped share card (og:image generated from analytics) - free virality loop.
- Packing list learn mode: derive defaults from logged items by city/climate over time.
- Map-mode "Day N playback" animation along transport legs (data model already stores lat/lng order).

### AI opportunities (where AI genuinely helps here)

| Opportunity | Justification |
| --- | --- |
| Receipt scan expansion (already built) | Vision fallback flow is honest and confirm-before-save; extend to e-ticket/PDF parsing with same confirm gate. |
| Natural-language trip import | Paste confirmation email -> structured reservation via one-shot extraction + user confirm. High friction removed, bounded risk. |
| Weather-aware auto-rescheduling suggestions | Data already joined (rainProb x outdoor ACTIVITY items); propose swaps, keep human-in-loop apply. Do NOT auto-apply. |
| Expense anomaly nudges | "Todays spend is 3x your running average" using byDay aggregates already computed. Deterministic, no LLM needed. |
Avoid: generative POI content (dataset blurbs are curated quality), AI summaries nobody asked for.

### Competitive benchmarking (pattern reference)

- **TripIt**: forwarding/import pipelines + calendar sync - this app beats it on native data entry and
  geographic day planning; loses on booking-import automation (add email parse) and sharing.
- **Wanderlog**: collaborator editing + place research depth. Wayfare-s differentiators: budget realism
  (live FX), offline outbox, wrapped-style memory recap. Borrow their map-first day building.
- **Notion-template planners**: flexibility minus structure. Keep Wayfare opinionated - its speed-to-day-
  plan wizard is the wedge versus template-driven tools.
- **Google Travel era products**: realtime flight status - out of scope until partnerships/integrations;
  do not fake it (the app correctly labels estimates everywhere - keep that honesty rule).

## 15. Design System Recommendations

The token layer is done; formalize the component contract around it:

1. **Promote primitives to a documented kit** - ui.tsx is the de-facto library; extract storybook-free
   docs page (route `/design` under dev flag) listing Button variants in use vs defined. Buttons found:
   primary(ink bg), secondary(surface-2), outline, ghost, danger + gradient hero button overrides
   scattered inline (`bg-gradient-to-r from-accent to-sky text-white` appears 4x) - make it a variant
   (`variant="brand"`) so the glow used for AI surfaces stays consistent.
2. **Type scale unification** (see 5.5): define utility classes `.t-caption/.t-small/.t-body...`
   mapping to rem steps; replace ad-hoc bracket values.
3. **Status color semantics**: EXPENSE_CATEGORY_META hardcodes hexes while notifications/Badges use
   token tones - bridge them through CSS vars so dark mode/category colors stay coherent.
4. **Modal & overlay contract**: one Modal used everywhere except command palette (own implementation)
   and drawer-less sheets; consolidate + add focus-trap, aria-labelledby, nested-open handling (a11y 8.x).
5. **Toast/banner primitive missing** - build on aria-live; wire mutation success/error uniformly.
6. **Motion tokens**: durations/easings exist as CSS vars for three animations; document usage rules:
   entrance (fade-up 350ms), interactive feedback (scale-in 220ms), ambient (pulse dot). Everything
   else should stay static - current restraint is correct, do not add scroll-triggered parallax.
7. **Cover art system**: THEMES registry maps 4 palettes; new-city onboarding should assign via
   deterministic hash (already seeded code does modulo hack) rather than `(name.length+n)`.
8. **Iconography**: lucide throughout at 12-22px with strokeWidth 2-2.4 mixing deliberate; hold the line
   (no filled icon imports) and standardize interactive affordance icons sizes at 16px within buttons.


## 16. Code Quality and Technical Debt

### Actual bugs (must fix, not debt)

| Bug | Location | Effect |
| --- | --- | --- |
| Traveler orderBy createdAt | `trip-service.ts:48` | Every trip page 404s (runtime-verified) |
| Missing `<Badge>` import in WrappedClient | `wrapped-client.tsx:61,63` | /wrapped crashes on render |
| Undefined `hotels` type ref + missing useRef import | `hotels-client.tsx:201,210` | Stays page cannot compile |
| Stray duplicate import blocks appended mid-file | documents:261-263, reservations:316-317, packing:~205, journal duplicate lucide ids | Duplicate identifier errors; ~60 TS errors total |
| Always-falsy expression rendered as From symbol | `currency-client.tsx:72` | Silent UI gap (dead element) |
| ProviderInfo.live mismatch | `t/[tripId]/page.tsx:24-29` vs providers.ts:416-422 (returns `configured`, code reads `.live`) | AI status badge always shows offline mode even with live key set |
| Outbox drops failed replays silently | `client-api.ts:123` (`res.ok \|\| res.status < 500` discards on 4xx) | Data loss disguised as sync |
| Expense split remainder/rounding drift + no re-split on traveler change | `expenses/route.ts:75-85` | Split totals diverge from expense over time |
| Hotel/AI-tool currency default JPY regardless of trip | hotels route, tools.ts | Wrong-currency defaults for non-Japan trips |
| Case-sensitive search on SQLite contains | search route + palette | Feature appears broken to users |

### Technical debt (deliberate deferrals, tracked)

1. Float money + string enums + missing createdAt columns (schema-level upgrade bundle before PG).
2. Per-handler copy-paste auth/validation instead of shared guard helpers (introduce
   `withOwnedTrip(reqHandler)` once S2/S4/B1 are fixed so hardening lives in one place).
3. Whole-bundle prop flow (see 9.1) - refactor is a project, listed in Section 20.
4. No transactions on multi-write flows (B5) - mechanical, safe conversions.
5. Dead deps zustand/framer-motion/date-fns installed but unimported - remove or actually adopt one
   deliberately (store or motion) rather than leaving decision residue.
6. sw.js artifact line + unregistered background sync; decide the offline contract properly.
7. Minor dead code sweeps listed in 9.6.

### Architectural problems (bigger than either above)

- **Request-cost symmetry**: nothing distinguishes 12-table reads from single-column reads; every
  concern pays worst-case cost. Introduce tiered data-access functions (shell/slice/bundle) per 13.
- **Error-handling tri-state**: json-404, throw-plain-Error, throw-HttpError coexist; pick HttpError
  everywhere and delete raw `new Error(...Not found)` guards (B1) - it also fixes noisy 500 logs.
- **No validation library boundary**: manual `if (!body.x)` checks scattered; zod (or std-schema)
  parsers co-located with route files would collapse B4/S-risks and give typed request bodies.

## 17. Testing Audit

**Current state: zero tests of any kind.** No test runner config, no CI. The seed script is the only
executable verification that exists. Given the deterministic core (planner/currency/optimizer are pure
functions), high-value coverage is cheap:

Priority order (critical workflows first, not coverage theater):

1. **Authorization regression tests** (P0): hit each mutating route with a second user-s session;
   assert 404/403. Directly locks S2/S4 fixes against future regressions - this suite would have caught
   both current gaps. Vitest + route-handler unit style (mock cookies/db) is enough initially.
2. **Pure-function units**: `planner.optimizeDay` (2-opt invariant: never worsens travel),
   `planner.generateItinerary` determinism given fixed dates/cities, `currency.convert` cross-rate
   math incl. unknown-code fallbacks, `notifications.computeNotifications` windows (T-48h flight,
   T-24h reservation, budget>=80pct). ~30 focused cases cover the product brain.
3. **Route handler integration**: expense create->split totals; hotel nights computation;
   checklist generate dedupe behavior; itinerary reorder applying exact order. SQLite in-memory via
   prisma `$transaction`-safe temp DB or better-sqlite3 fixture per file.
4. **E2E smoke (Playwright)** once types/runtime green: register -> wizard -> auto-itinerary ->
   add expense -> wrapped renders. This is the demo-defensibility suite; keep under 15 specs.
5. Component tests: skip until god-components are decomposed; UI layers change fastest and provide
   least safety-per-effort right now.

Tooling recommendation: Vitest (+ @vitejs/plugin-react for later component work), Playwright,
GitHub Actions running typecheck+lint+unit on PR - roughly half a day to stand up against this
already-clean script surface (`npm run typecheck/lint` exist; add `test`, `test:e2e`).

## 18. Documentation and Developer Experience

| Item | State | Action |
| --- | --- | --- |
| README.md | Stock create-next-app boilerplate - factually wrong for this repo (mentions app/page geist marketing copy verbatim) | Rewrite: what Wayfare is, quickstart (npm i / db:migrate / db:seed / dev), env table (AI providers documented well already in .env.example), architecture map from Section 2, demo credentials note, scripts list |
| Architecture docs | None; tribal knowledge inside good code comments (documented design intents in planner/weather/client-api headers are excellent starts) | One ARCHITECTURE.md capturing bundle-flow, offline contract, AI provider matrix, tool registry |
| API reference | None | Low priority pre-launch; route names self-describe; if added, generate from zod schemas chosen in 16.x |
| Env vars | .env.example thorough (providers/model override/vision model/base urls) | Add NODE_ENV-dependent behavior notes (demo creds flag from S10) |
| Scripts | dev/build/start/lint/typecheck/db:migrate/db:seed present | Add `db:reset` (migrate reset + seed), `postinstall prisma generate`; remove friction for new devs |
| Seed story | Exceptional - multi-country realistic world with cross-references | Keep; split into modules by country before it doubles again |
| Git hygiene | Zero commits; AGENTS.md/CLAUDE.md agent-file block uncommitted (auto-regenerated by next dev) | Initial commit excluding nothing needed; then branch-per-fix workflow |
| Editor/build feedback | tsconfig strict OK; eslint configured (24 errors today) | Fix + wire lint to fail build in CI; add prettier or adopt eslint stylistic to end format debates early |


## 19. Quick Wins (high value / low effort)

| # | Win | Change | Impact |
| --- | --- | --- | --- |
| QW-1 | Rebuild dashboard hierarchy | In overview-client: make Next Up + budget the only hero row; demote MiniStats to a single compact strip; move low-frequency links into contextual menu. Files: overview-client.tsx only. | Perceived speed and clarity of primary workflow |
| QW-2 | Marketing-grade sign-in surface | Port login page brand panel to signed-out `/` with value props + one CTA. Keep `/login` as-is. | First-visit conversion from ~zero to credible |
| QW-3 | Real loading states | Add `loading.tsx` skeleton shells per trip section (Skeleton primitives already exist) | Navigation feels instant vs blank-flash |
| QW-4 | Friendly 404/not-found trip page | Trip layout currently renders default notFound UI on any bundle failure | Turns the current breakage class into a humane state |
| QW-5 | Undo-destructive toast pattern | One aria-live toast util; wire deletes (journal/places/items) with 5s undo where cheap | Trust for destructive moments |
| QW-6 | Case-insensitive search | Normalize query+columns or in-memory filter on small sets; palette immediately feels fixed | Core discovery flow credibility |
| QW-7 | Budget step optional + city fallback message | Wizard gate tweak + explicit unsupported-city feedback in new-trip | Removes two silent dead-ends in onboarding |
| QW-8 | Gate demo credentials | Show prefilled demo box only when `NEXT_PUBLIC_DEMO=1` (default in .env.example) | Cleaner story for real users without losing demo path |
| QW-9 | Focus-trap + labelled Modal | Small hook in ui.tsx Modal; reuse palette | A11y pass on every dialog at once |
| QW-10 | Contrast bump ink-3 + hit-area padding | Token change + header button padding classes | AA-closer text, mobile comfort |
| QW-11 | Grouped sidebar IA labels | Pure markup grouping of existing NAV array (+section headers) | Cognitive load cut across every screen |
| QW-12 | Remove dead code/exprs | currency-client line 72 symbol fix, empty branch travelers:14, void residue, sw artifact line | Codebase honesty; zero-risk edits |

## 20. Major Improvements (engineering projects)

With dependency order:

1. **Green build pipeline** -> everything else (P0): types+runtime+lint+initial commit.
2. **Authorization hardening + shared guard** (`withOwnedTrip` zod-parse wrapper) -> depends on 1;
   unblocks S2/S4/B1 fixes and the test suite below.
3. **Data-access refactor** (shell/slice/bundle split, React cache() dedupe, conversation _count fix,
   listTrips aggregate) -> depends on 1; the single biggest perf/architecture unlock; makes step 6 sane.
4. **Validation boundary + transactions** (zod schemas per route, $transaction wraps B5 sites,
   HttpError-uniform errors) -> partially parallel with 3; required before multi-user hardening.
5. **Test harness** (Vitest units incl. auth-regression suite + Playwright smoke + GH Actions CI)
   -> depends on 1-2 so suites test real behavior rather than broken baseline.
6. **State/cache architecture decision** (server-slice-per-page + optimistic client actions w/ one
   chosen store OR SWR-style fetch cache) -> depends on 3; removes router.refresh() round-trip feel.
7. **Postgres migration + money-precision upgrade** (enums, minor-unit integers or Decimal,
   missing createdAt columns, session sweep job) -> after schema is validated by tests from 5;
   before any public hosting that shares SQLite expectations.
8. **Security headers/CSP + upload sniffing + session rotation** -> parallel anytime after 1;
   merge with 2 rollout since both touch auth/session edges.
9. **Notifications delivery infra** (job scheduler e.g. Vercel cron/queue + Web Push using
   computeNotifications) -> after 7/PG realistically; biggest product gap once core works.
10. **Collaboration v1** (invite tokens, roles, share surfaces across all sections respecting the new
   guard helper from 2 - which is why 2 must land first) -> largest net-new capability.
11. **Offline contract completion** (idempotency keys, queue inspector UI, background-sync wiring,
   conflict policy) -> after 6 (state layer) because both touch mutation flow; after 8 (headers do not
    matter but auth endpoints used offline do).
12. **AI upgrades** (streaming + action cards + injection-hardened tool ids + confirm tokens) ->
    partially lands inside 2 (S2/S7); streaming separate once cache layer settles.

Deliberately excluded: design-system rebuild (tokens/components are good), framework swaps, POI
content expansion via AI generation, analytics dashboards nobody asked for.


## 21. Prioritized Roadmap

### P0 - Critical (do before anything else)

| Priority | Area | Problem | Recommendation | Impact | Complexity |
| --- | --- | --- | --- | --- | --- |
| P0-1 | Build | ~60 TS errors; four screens carry interrupted-refactor artifacts (duplicate imports, undefined refs, missing Badge/useRef) | Finish or revert the mechanical refactor per file (documents/journal/packing/reservations/hotels/wrapped/currency); fix planner + local-brain type errors; resolve Recharts formatter signatures once in a shared helper type | Unblocks compile and all QA | S-M |
| P0-2 | Data/Runtime | getTripBundle crashes every trip page at runtime (Traveler.createdAt) | Add createdAt to Traveler schema + migration OR change orderBy to name/id. Runtime probe confirms 404 cascade today | App becomes usable at all | S |
| P0-3 | VCS/DX | Zero git commits | Initial commit after P0-1/P0-2 green; enable branch workflow + CI running typecheck/lint/unit | Safety net forever | S |
| P0-4 | Security | AI tools mutate items across trips (S2); traveler DELETE no ownership filter (S4) | Verify item.tripId === ctx.tripId inside update/delete/move executors; nest trip:{userId} in travelers DELETE; add cross-tenant regression tests (Section 17 item 1) | Closes real cross-tenant write path | S |
| P0-5 | Security | No security headers (S3) | next.config headers(): CSP report-then-enforce, HSTS, nosniff, Referrer-Policy, Permissions-Policy, frame-ancestors self | Baseline hardening for document vault claims | S |
| P0-6 | Data integrity | Offline flush discards 4xx failures silently (client-api.ts:123) | Only drop on explicit 4xx-confirm codes with queue-item error surfacing; hold others for retry | Prevents silent user data loss | S |

### P1 - High priority

| Priority | Area | Problem | Recommendation | Impact | Complexity |
| --- | --- | --- | --- | --- | --- |
| P1-1 | Perf/Arch | Double full-bundle fetch per navigation; whole graph serialized to client | Section 20 project 3 (shell/slice split + React cache()) | Largest perf lever; enables everything else | M-L |
| P1-2 | UX | Signed-out dead-end wall on / | Marketing surface from login panel copy + demo CTA (QW-2) | First impression/conversion | S |
| P1-3 | UX | Overview hierarchy flat; 12-item sidebar IA ungrouped | QW-1 + QW-11 | Daily clarity | S |
| P1-4 | Feature | Trip settings surface missing though PATCH/DELETE APIs exist | Settings modal/sheet from overview header (rename/dates/budget/status/delete-with-confirm) | Completes CRUD loop users assume exists | S-M |
| P1-5 | Backend correctness | B1 status-code tri-state; B4 enum validation absent; B5 transactions missing | withOwnedTrip guard + zod schemas + $transaction wraps (one sweep) | API predictability + integrity | M |
| P1-6 | Product trust | Login abuse controls weak; register unlimited (S5); rate limiter leaks (B6) | Composite IP+email limiter w/ eviction; register limits; lockout backoff | Abuse resistance before any public URL | S-M |
| P1-7 | A11y | Modal focus management absent; contrast fails on meaningful text; drag-only reorder | Focus-trap hook (QW-9), ink-3 bump (QW-10), keyboard move buttons for items | WCAG baseline dignity | M |
| P1-8 | Docs | README boilerplate wrong for repo | Real quickstart/architecture README (Section 18 rows) | Contributor onboarding | S |

### P2 - Medium

| Priority | Area | Problem | Recommendation | Impact | Complexity |
| --- | --- | --- | --- | --- | --- |
| P2-1 | State/perf | router.refresh() round trips for micro-mutations | Section 20 project 6 optimistic layer | Snappy interactions | M |
| P2-2 | Schema/money | Float money, string enums, split drift | Section 20 project 7 bundle ahead of PG swap | Financial correctness | L |
| P2-3 | Notifications | Computed only; never delivered/read | Push infra (project 9) + read-state model | In-trip value activation | M-L |
| P2-4 | Features | .ics export; account settings; journal photos reusing upload pipeline; budget revaluation view | Per Section 14 table | Parity-to-differentiator batch | M each |
| P2-5 | Search/palette | Case-sensitive matching; POI pool in-memory hacks acceptable but dataset capped | Fix collation now; later expose pluggable provider interface when adding cities beyond curated set | Discovery scales | S-M |
| P2-6 | Uploads | Client-trusted MIME (S6); DELETE unlink normalization (B13) | Magic-byte sniff, forced extension map, shared safe-path helper | Vault credibility | S-M |
| P2-7 | Testing | Zero suites | Vitest unit pack (planner/currency/notifications/authz) + Playwright smoke + CI gate | Change confidence forever | M |
| P2-8 | AI | Whole-response waits; destructive tool gates prompt-only | Streaming + action cards + server-side confirm tokens (S7) | Premium feel + safety | M |

### P3 - Nice to have

Wrapped share card og:image; map day-playback animation; packing learn-mode; PDF/print itinerary export;
email-parse import of bookings; i18n beyond demo bias (currency defaults already favor PHP/JPY personas);
NLU local-brain expansion; PODS-style analytics page. Nothing here blocks launch.

## 22. Recommended Architecture (target state)

Keep the current skeleton (it is right); formalize three layers:

```
RSC pages (thin)
   |- lib/data/*          tiered query fns: getTripShell | getXSection(tripId) | legacy getTripBundle(overview only)
   |     wrapped in React cache(); zod-parsed inputs; owned via requireUser()
Route handlers (uniform)
   |- withOwnedTrip(schema)(handler)  single guard: auth, trip ownership, body validation, HttpError mapping
   |- services (trip-service/planner/currency/weather/notifications) stay pure-ish, transaction-aware
Client (per-section slices)
   |- props = section slice only; mutations optimistic against slice; ApiError toast contract
AI agent unchanged structurally, plus: tool executors deny-by-default scope checks (ctx.tripId),
confirm-token ops for destructive intents, streaming facade over provider.complete().
```

Migration-friendly notes: `getTripBundle` remains as composition of the new functions so Overview is a
wrapper rather than a rewrite; notifications rules keep consuming an explicit minimal bundle type.

## 23. Final Assessment

### Scores (current state, honest)

| Dimension | Score /10 | Rationale |
| --- | --- | --- |
| Product | 6.5 | Strong concept+scope for solo build; core loop nearly complete; sharing/settings/delivery gaps keep it pre-product |
| UI/UX | 7.5 | Distinctive identity, disciplined tokens, good empty states; flat dashboard hierarchy + dead-end entry hold it back |
| Frontend | 6.0 | Clean structure/conventions today broken by unfinished refactor; state model half-evolved; heavy prop flow |
| Backend | 6.0 | Sensible patterns + honest degradation; guard duplication, GET-writes, transaction gaps, tri-state errors |
| Database | 6.5 | Solid relations/indexes/cascades; Float money, missing column breaking app, denormalized splits |
| Security | 5.0 | Right instincts (scrypt, scoped queries, no innerHTML); real gaps: AI tool IDOR, travelers delete, headers, upload trust, limiter leaks |
| Performance | 5.5 | Zero-image architecture + font discipline vs double-bundle-everything cost center |
| Accessibility | 5.5 | Foundations present; focus traps/contrast/targets/reorder need work |
| Code Quality | 4.0 | Excellent comments/naming/dedup habits... currently does not compile; zero tests amplify |
| Scalability | 5.0 | PG swap documented not done; in-process limiters; force-dynamic everywhere; fine under 100 users |
| Production Readiness | 2.5 | Cannot ship as-is (build+runtime broken, no CI/VCS commits/tests). Weeks, not months, from credible with roadmap above |

### Product-owner direct answers

1. **Biggest weakness?** The product exists only for its author-s context: PHP/JPY defaults, six seeded
   cities, single-user assumptions baked into IA. It demos beautifully inside its diorama.
2. **Biggest UX problem?** Two: signed-out visitors hit a dead end, and inside the product nine equal-
   weight modules dilute the Next Up moment. Both are days of work, not months.
3. **Biggest technical problem?** The data-access monolith (full TripBundle, twice per request,
   serialized wholesale) - it taxes latency, payload, and future feature work simultaneously.
4. **Biggest security concern?** The AI tool executor mutation scope gap (S2) - it is the one finding
   where capability and trust boundary intersect novel software attack surface.
5. **Biggest missing feature?** Collaboration/sharing - travel is social by default, and companions are
   modeled but inert today.
6. **Highest-value feature for users?** Calendar sync (.ics) of flights/stays/reservations - high
   frequency value, cheap given normalized datetime models already exist.
7. **What should be removed?** Nothing user-facing yet; remove the dead deps (zustand/framer-motion/
   date-fns), sw artifact lines, and redundant Stays&Flights-vs-Reservations overlap once a unified
   bookings surface exists.
8. **What should be simplified?** The wizard (collapse Budget+Travelers into one optional step), and
   route-handler auth boilerplate into one guard.
9. **What should be redesigned?** The overview dashboard hierarchy (QW-1 spec) and the offline outbox
   contract (currently a leaky abstraction risking silent loss).
10. **Production-grade vs portfolio?** Green build+CI, commits, tests guarding authorization, security
    headers, delivery channel for notifications, real README, monitoring/error tracking (none today).
11. **Premium feel?** AI action cards with streaming, undo toasts everywhere, calendar round-trip,
    wrapped-share-card virality - on top of the existing restraint-and-typography identity.
12. **Why choose this over alternatives?** Honest-data travel planning: geographic day generation with
    provenance-labeled estimates, live-FX budgets, offline-first durability, and a concierge that acts
    through typed tools instead of chat theater. No mainstream competitor combines those four.

### Top 10 improvements (ranked by impact)

1. Restore green: types/runtime/lint fixes + first commit + CI gate (P0-1..P0-3).
2. Cross-tenant tool-scope verification + ownership test suite (P0-4).
3. Data-access split: shell/slice/cache() dedupe ending double-bundle reads (P1-1).
4. Security headers + upload sniffing + session rotation wave (P0-5,P2-6,S9).
5. Signed-out marketing surface on `/` (P1-2).
6. Dashboard hierarchy + grouped sidebar IA (QW-1,QW-11).
7. withOwnedTrip uniform guard: validation schemas, transactions, HttpError consistency (P1-5).
8. Trip settings surface completing the CRUD loop (P1-4).
9. Optimistic mutation layer replacing refresh() round trips (P2-1).
10. Vitest+Playwright harness incl. authorization regressions (P2-7).

### Recommended execution order

```
Phase 0 (day 1)      -> P0-1/2/3: make it run, commit, CI red/green visible
Phase 1 (week 1)     -> P0-4/5/6 + QW-9/10/12: safe + humane basics
Phase 2 (weeks 2-3)  -> P1-1 data-access refactor + QW loading states + P1-4 settings
Phase 3 (weeks 3-4)  -> P1-2 marketing entry + QW-1/11 dashboard+IA + P1-7 a11y pass
Phase 4 (weeks 5-6)  -> P1-5 guard consolidation + zod + transactions + P2-7 test harness grown here
Phase 5 (weeks 7+)   -> P2-1 optimistic layer, then P2-2 PG/money migration, then P2-3 push infra
Phase 6              -> Sharing v1 on top of hardened guards; AI streaming/action cards parallel track
```

Dependencies: Phase 2 requires Phase 1 commit baseline (tests need stable runtime); Phase 4 guard must
precede collaboration (Phase 6) because all new surfaces inherit it; PG migration follows test harness
so schema upgrades ship verified; push notifications require scheduler infra decided alongside hosting.

---

*End of audit. Implementation intentionally withheld pending approval of this roadmap.*
