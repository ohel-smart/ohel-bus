# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # vite --host (dev server, LAN-accessible)
npm run build     # tsc -b && vite build — type-check then bundle; this is the real correctness check (no test suite exists)
npm run lint      # oxlint (not eslint) — see .oxlintrc.json
npm run preview   # serve the production build locally
```

There is no test runner configured in this project. Treat `npm run build` as the primary automated check before committing — `tsconfig.app.json` has `noUnusedLocals`/`noUnusedParameters` on, so unused variables fail the build, not just lint.

To verify a UI change, prefer running the actual dev server and clicking through it (or fetching against the live Vercel deployment) over reasoning from the diff alone — this app has no component tests to lean on.

## What this is

"אוהל בוס" (Ohel Bus) — a shuttle-dispatch tracker for a nonprofit shuttle service running between two fixed locations (`770` / Crown Heights and `Ohel` / Chabad Ohel Lubavitch, coordinates hardcoded in `src/services/db.ts`). Dispatchers scan a QR code when a driver's shuttle leaves with N passengers; the app tracks the trip live and shows ETAs to waiting riders and staff.

This repo is one half of a two-service system: this site (deployed on Vercel) and a separate Node.js WhatsApp bot service that posts trip updates to a WhatsApp group. Both read/write the **same Firestore project** (`ohel-smart`, config in `src/services/firebase.ts`) — there is no API boundary between them, so changing a `Scan`/`User` field's shape or meaning here can silently affect the bot too.

## Architecture

### Three independent entry points, one bundle

`src/main.tsx` picks one of three top-level components to render based on the URL, with no router:

- `App.tsx` (default) — the full dispatcher/driver/admin dashboard, behind a personal numeric-code login.
- `ReturnReport.tsx` — reached via `?report=return`; a standalone driver self-report form that calls `dbService.addScan` directly, bypassing the dispatcher scan flow.
- `BoardView.tsx` — reached via `/board` (rewritten to `index.html` in `vercel.json` so a direct hard-load resolves correctly); a read-only public arrival board meant to be left open on a lobby screen.

All three import `dbService` and render independently of each other — there is no shared layout or router state between them.

### `App.tsx` is a single ~6,300-line component

There is no code-splitting or per-role file separation. Role-specific UI (admin / driver / dispatcher / `screen`) is all in this one file, switched via `currentUser.role` checks and a string `activeTab` state (e.g. `'scan'`, `'qr'`, `'my-trips'`, `'my-history'`, `'central'`, `'users'`). When making a role-specific change, search for the existing `activeTab === '...'` block for that tab rather than assuming a dedicated component exists.

Translation strings live in one `TRANSLATIONS` object (`he`/`en` keys) near the top of the file, looked up via a `t()` helper; every user-facing string must be added to both locales. `lang` state drives both `t()` and `<html dir>` — **never hardcode `direction: rtl` in CSS** (`src/index.css`'s `body` rule used to do this and broke English-mode layout; it must inherit from `<html dir>`).

### `src/services/db.ts` — the single data layer

`DBService` is a singleton (`export default dbService`) that every component talks to instead of touching Firestore directly. It:
- Keeps an in-memory cache (`usersCache`/`scansCache`/`configCache`) seeded from `localStorage` on construction so the UI never blank-flashes before Firestore responds.
- Subscribes to Firestore `onSnapshot` listeners that keep the cache (and `localStorage`) live.
- Exposes a `subscribe(callback)` pub/sub — components call this in a `useEffect` and re-read `dbService.getX()` on every notification; there is no global state library.
- Computes derived state on read rather than storing it: `getActiveLocations()` recomputes each driver's live status/ETA from their latest `Scan` every time it's called.

**Two different "ETA" fields that must not be confused** (root cause of a real bug, fixed in `8c79651`):
- `Scan.etaMinutes` — the trip's original total duration, fixed once when the scan was created.
- `ActiveLocation.etaMinutes` — minutes *remaining right now*, recomputed fresh on every `getActiveLocations()` call. Adding this to a stale start time (instead of the fixed `Scan.etaMinutes`) makes a countdown drift.

Other conventions in this layer:
- `logicalDate` is NOT the calendar date — it's the day bucket per `getLogicalDate()`, which normally rolls over at midnight **America/New_York**, not UTC or the browser's local time — **except** on Erev Shabbat/Erev Yom Tov, where it rolls over 15 minutes before that evening's sunset instead (computed via `@hebcal/core`'s `Zmanim`/`isAssurBemlacha`, detecting the transition from melacha-permitted to melacha-forbidden at sunset — not simply "is Friday," since this also correctly covers movable holidays). Always use `getLogicalDate()` (or `parseScannedAt`) rather than slicing an ISO timestamp when grouping trips by "day".
- Auth is a flat numeric `code` lookup (`loginWithCode`), not real accounts. Firebase anonymous auth (`firebase.ts`, `authReady`) exists only to satisfy Firestore security rules, not to identify the user.
- ETA is computed via the Google Routes API (`getRouteEtaMinutes`, live traffic-aware) with a Haversine-distance fallback if that call fails or returns no route — the fallback is meaningfully less accurate and logs a `console.warn` when it's used, so check the browser console before assuming a wrong ETA is a Google API bug.

### Self-service PDF reports (driver/dispatcher "my report" download)

`handleExportDriverPdf`/`handleExportDispatcherPdf` in `App.tsx` build a full HTML string and open it via `URL.createObjectURL(new Blob([html]))` + `window.open(blobUrl)` (not `document.write`, which was unreliable in real Chrome). Anything referenced inside that HTML string must be a **fully-qualified absolute URL** (`new URL(assetPath, window.location.origin).href`) — a root-relative path like `/assets/logo.png` does not reliably resolve from inside a `blob:` document (this broke the report logo once; see `438f611`). The report renders only the current UI language (`section(lang)`), not both.

### Hebrew calendar (`src/services/hebrewDate.ts`)

Wraps `@hebcal/core`. `getWeeklyParsha(date)` rolls a Saturday timestamp into next week's parsha once it's **4:00 PM or later in America/New_York** — a fixed org-specific cutoff (not halachic nightfall/tzeit), even though the calendar day is still Saturday. When computing a per-row parsha, pass the scan's actual `scannedAt` timestamp — passing "noon of logicalDate" will never trigger this branch.

### `api/daily-email.js` — separate runtime, self-triggered

A Vercel Function (not part of the Vite/React bundle) that emails the manager a daily rides summary via Resend. Uses `firebase-admin` (not the client SDK) with a service-account key from `process.env.FIREBASE_KEY`, and reimplements a few helpers (Hebrew date, NY date, HTML-escaping, and the Erev Shabbat/Erev Yom Tov trigger-moment check) locally rather than importing from `src/` — keep all of these in sync manually if the logic changes.

It is **not** invoked by Vercel Cron and **deliberately not** invoked by the WhatsApp bot (separate repo) either — both were considered and rejected: Vercel's Hobby plan can only run a cron once/day with up to ±59 minutes of imprecision (a hard platform limit — see [Vercel's cron docs](https://vercel.com/docs/cron-jobs/usage-and-pricing)), and coupling the trigger to the bot would make the email depend on that service's uptime. Instead, `.github/workflows/daily-email-trigger.yml` pings this endpoint every 10 minutes via GitHub Actions (free/unlimited on a public repo), and the function decides for itself whether "now" is today's actual trigger moment (`getTodaysTriggerMoment`: 23:59 New York time, or 15 minutes before sunset on Erev Shabbat/Erev Yom Tov) — most pings are harmless no-ops. A Firestore doc (`bot_state/daily_email`, field `lastEmailDate`) guards against sending the same day's summary twice.

The endpoint isn't behind a real secret — it accepts any caller whose `user-agent` includes `vercel-cron` (no `CRON_SECRET` env var is configured). This is publicly visible in this repo's source, so treat it as a soft gate, not real authentication.

### Self-registration (`/join`) + admin approval

`src/RegisterRequest.tsx` is a public, unauthenticated form (reached via `/join?role=driver` or `/join?role=dispatcher` — two links meant to be shared separately, each locking the role and defaulting the page language driver→English/dispatcher→Hebrew; bare `/join` falls back to a role picker). Submitting writes a `pending_registrations` Firestore doc (via `dbService.submitRegistration`) and calls `api/registration-notify.js` to email the manager — it does **not** create a real `User`. The registrant picks their own login code (7+ chars, must contain a letter, checked for uniqueness against both `users` and other pending requests) but can **not** set "big bus" — only an admin can, when approving or editing.

An admin sees pending requests in an auto-popping modal (opens whenever `pendingRegistrations.length > 0` and the admin hasn't already dismissed those specific ids this session — see the `showPendingRegModal`/`dismissedRegIdsRef` effect in `App.tsx`) and in a card in the Users tab; both render the same `PendingRegistrationCard` component, which supports approving as-is, editing the fields first, or rejecting.

**Approval itself is deliberately server-side**, not a direct client Firestore write: `handleApproveRegistration` POSTs to `api/approve-registration.js`, which does the create-user + delete-pending-request as one atomic Firestore batch via `firebase-admin`. This used to be two sequential client-side Firestore calls (even guarded by a client-side timeout) — see PITFALLS.md's "client-side setTimeout safety-net" entry for why that failed under real conditions (a backgrounded tab throttles the JS timer the timeout itself depends on) and why moving the actual writes server-side, not just guarding them more carefully, was the real fix.

### Security-sensitive spots

- `escHtml()`/`csvCell()` helpers near the top of `App.tsx` neutralize HTML injection and CSV-formula injection (`=+-@` prefix) for any admin-entered free text (driver/dispatcher names) that gets interpolated into a print-window HTML string or a CSV cell. Any new export/report code that interpolates user-entered strings should reuse these, not `${value}` directly.
- The public `/board` view and the `?report=return` self-report page are both reachable without the main login — they gate access with their own numeric-code check against `dbService.getUsers()`, not Firestore security rules.

### Styling

Global styles live in `src/index.css` (no CSS modules/Tailwind); component-specific layout is mostly inline `style={{ ... }}` objects directly in JSX. Shared classes to reuse rather than reinvent: `.card`, `.btn`/`.btn-primary`/`.btn-secondary`/`.btn-danger`, `.badge`, `.bottom-nav`/`.bottom-nav-item` (mobile), `.sidebar-item` (desktop), `.toast`/`.toast-danger` (Apple-style frosted-glass notifications — `backdrop-filter: blur(28px) saturate(1.8)`, no progress bar).

### Not part of the app runtime

`scripts/extension-server.cjs` is an unrelated local dev-tool HTTP server (syncs Apps Script code for a separate monitoring project) — it isn't imported by or deployed with the site.

## Before touching data-layer or export code, read PITFALLS.md

[PITFALLS.md](PITFALLS.md) is a checklist of specific bugs this codebase already had once (ETA field confusion, timezone/day-boundary mistakes, blob-URL asset paths, XSS in exports, no-op/dead-code methods in `db.ts` that look like real features) — grounded in the actual commits that fixed them. Worth a skim before working in `src/services/db.ts`, the PDF/CSV export functions, or anything date-related.
