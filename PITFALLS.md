# Pitfalls & dead code paths

Working notes for anyone (human or Claude) touching this codebase, grounded in bugs actually hit and fixed in git history (`git log --oneline` has the full trail). Check here before assuming something is broken, or before building on top of something that looks like a feature but isn't wired up.

## Functions that look real but are no-ops or dead code

`src/services/db.ts` has several methods kept only for API-compatibility with older UI code. Calling them does nothing — don't build a new feature assuming they work without first checking the current source:

- `updateActiveLocation()` — no-op. There is no live GPS broadcasting; a driver's map position/status/ETA are all *derived* from their latest `Scan` in `getActiveLocations()`, not pushed from a device.
- `updateDriverEta()` — no-op. ETA is fixed once at scan-creation time (`addScan`), not updated mid-trip.
- `sendEmail()` — no-op from the UI. The only outbound email is the daily manager summary, sent server-side by `api/daily-email.js` (Vercel Cron), not triggered from the client.
- `triggerSOS()` / `getSOSAlerts()` / `clearSOSAlert()` / `sendSMS()` — dead code, no UI calls them. `LiveMap.tsx` has SOS-alert rendering code that will never fire from current app code.

If a future task is "make the SOS button work" or "show the driver's real GPS position," that's a from-scratch feature, not a bug fix — the plumbing isn't there.

## Destructive operations to treat with care

- `dbService.resetTrips()` deletes **every** document in the `scans` collection (not just "today's"). It's wired to an admin "reset for new day" button. Never call this, or extend anything to call this automatically, without explicit user confirmation — there's no undo and no soft-delete.

## Timezone / date bugs already hit once

- **"Day" boundaries are America/New_York midnight — except on Erev Shabbat/Erev Yom Tov**, where the day ends 15 minutes before that evening's sunset instead (`getEarlyCutover()` in `src/services/db.ts`, using `isAssurBemlacha` to detect the not-yet-forbidden→forbidden transition at sunset, not a hardcoded "is it Friday" check, so it correctly covers Rosh Hashana/Yom Kippur/Sukkot/Pesach/Shavuot/Shmini Atzeret too). Always derive a trip's day via `dbService.getLogicalDate()` (or read `Scan.logicalDate`, already computed) — don't slice an ISO string or use `Date#getDate()`.
- **Weekly parsha must use the scan's actual `scannedAt` timestamp**, not "noon of logicalDate." `getWeeklyParsha()` in `src/services/hebrewDate.ts` rolls a Saturday timestamp into next week's parsha once it's 4:00 PM or later in America/New_York (a fixed org-specific cutoff, not halachic nightfall/tzeit) — feeding it a synthetic noon timestamp means that branch can never trigger, silently misdating every row scanned Saturday afternoon or evening.

## ETA field confusion (already caused a live countdown-drift bug, fixed in `8c79651`)

Two fields named similarly but meaning different things:
- `Scan.etaMinutes` — the trip's original total duration in minutes, fixed once at scan time.
- `ActiveLocation.etaMinutes` — minutes *remaining as of right now*, recomputed fresh on every `getActiveLocations()` call.

Never add `ActiveLocation.etaMinutes` onto a stale start time as if it were the fixed duration — always recompute the end time from `Scan.etaMinutes` + the scan's actual start time (`dbService.parseScannedAt`).

## Derive one "latest scan," don't recompute it twice

A driver-card bug (fixed in `2618c85`) came from `direction` being read from `ActiveLocation` state while `time remaining` was independently recomputed from `Scan[]` state elsewhere in the same component — two separate "what's the driver's latest scan" derivations that could transiently disagree during a re-render. When a UI block needs several derived values about "the current trip," compute them from one `latestScan` lookup, not several.

## CSS

`body`'s `direction` must never be hardcoded to `rtl` in `src/index.css` — `lang` state toggles `<html dir>` in `App.tsx`, and a hardcoded body direction silently overrides it, breaking bidi layout in English mode (numbers/words reordering, e.g. "min 16" instead of "16 min"). This already happened once.

## Blob-URL PDF/print windows

The self-report PDF (`handleExportDriverPdf`/`handleExportDispatcherPdf`) is opened as `window.open(URL.createObjectURL(new Blob([html])))`, not `document.write()` (which Chrome handles unreliably for this use case). Any asset `src` inside that HTML string must be a fully-qualified absolute URL — a root-relative path (`/assets/foo.png`) does not reliably resolve against the real site origin from inside a `blob:` document. Already broke the report logo once (`438f611`).

## User-entered text in exports

Any driver/dispatcher/admin-entered free text (names, especially) that gets interpolated into a print-window HTML string or a CSV cell must go through `escHtml()` / `csvCell()` (defined near the top of `App.tsx`) — this codebase had a real stored-XSS and CSV-formula-injection bug here, fixed in `c27b344`.

## Two-repo coupling

This site and the separate WhatsApp-bot service both read/write the same Firestore project directly, with no API layer between them. There's no schema migration tooling — if you change what a `Scan` or `User` field means (not just adding a new optional field), the bot-side code that reads the same collections needs a matching update, or it will silently misinterpret data.

The bot also independently *reimplements* the Erev Shabbat/Erev Yom Tov early-cutover check (`getEarlyTriggerMoment` in the bot's `index.js`, mirroring `getEarlyCutover` in this repo's `src/services/db.ts`) to decide when to fire its daily WhatsApp summary — the two aren't shared code, just the same algorithm copy-pasted into both runtimes (one ESM/browser, one CommonJS/Node). If that erev-detection logic ever needs to change, update it in both places.
