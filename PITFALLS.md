# Pitfalls & dead code paths

Working notes for anyone (human or Claude) touching this codebase, grounded in bugs actually hit and fixed in git history (`git log --oneline` has the full trail). Check here before assuming something is broken, or before building on top of something that looks like a feature but isn't wired up.

## Functions that look real but are no-ops or dead code

`src/services/db.ts` has several methods kept only for API-compatibility with older UI code. Calling them does nothing — don't build a new feature assuming they work without first checking the current source:

- `updateActiveLocation()` — no-op. There is no live GPS broadcasting; a driver's map position/status/ETA are all *derived* from their latest `Scan` in `getActiveLocations()`, not pushed from a device.
- `updateDriverEta()` — no-op. ETA is fixed once at scan-creation time (`addScan`), not updated mid-trip.
- `sendEmail()` — no-op from the UI. The only outbound email is the daily manager summary, sent server-side by `api/daily-email.js` (Vercel Cron), not triggered from the client.
- `triggerSOS()` / `getSOSAlerts()` / `clearSOSAlert()` / `sendSMS()` — dead code, no UI calls them. `LiveMap.tsx` has SOS-alert rendering code that will never fire from current app code.

If a future task is "make the SOS button work" or "show the driver's real GPS position," that's a from-scratch feature, not a bug fix — the plumbing isn't there.

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

## Coupled Firestore writes need to be awaited in order, not fired in parallel

`handleApproveRegistration` in `App.tsx` (approving a `/join` self-registration) used to call `dbService.saveUser(...)` and `dbService.deletePendingRegistration(...)` back-to-back without `await`, then show a success toast unconditionally. Both `db.ts` methods do an *optimistic* local-cache update synchronously before their real `setDoc`/`deleteDoc` call, so the UI looked instantly successful regardless of whether either network write actually completed. Since the two writes were unrelated promises racing each other, a failed user-create (e.g. a transient network blip) could still let the pending-request delete succeed — permanently destroying the only record of the request with no user ever actually created. First fix: `await`ing the create, only deleting the pending doc after that resolves, wrapped in try/catch. When one write's completion should gate another (especially a delete that removes the only copy of some data), await the first and handle its rejection — never fire both and assume success.

**That first fix wasn't enough on its own** — see the next entry.

## A client-side `setTimeout` safety-net doesn't protect against the failure mode that matters most

The first fix above also wrapped every Firestore call in a `Promise.race`-based `withTimeout()` helper, so a hang would surface as an error instead of staying silent forever. This felt like it closed the gap, but a live repro (guaranteed `.click()` on the confirmed, non-disabled button + console/network instrumentation) proved it didn't: zero Firestore writes were ever attempted, AND the 10-second timeout itself never fired, for 30+ seconds. Root cause: **the timeout races the real operation using the exact same mechanism (`setTimeout`) that both are equally subject to.** Browsers throttle JS timers when a tab is backgrounded — the admin switches apps, the phone screen locks — which is a completely ordinary thing to happen mid-approval on a phone. When that happens, the real write AND its own "safety net" stall together; the timeout can't rescue you from a failure mode it shares.

The actual fix (`api/approve-registration.js`): move the real work (create user + delete pending doc, as one atomic Firestore batch via `firebase-admin`) to a Vercel serverless function. The client just does a single `fetch()` POST. Once that request is sent, the outcome no longer depends on the browser tab's lifecycle at all — the batch completes server-side regardless of whether the tab backgrounds, and being a single atomic batch also means the earlier "user created but pending-delete failed" partial state is impossible by construction, not just handled. General lesson: a client-side timer-based timeout only protects you from failures that don't also affect timers — for anything that could stall due to the tab itself losing CPU/timer priority (backgrounding, sleep, throttling), the guard needs to live somewhere whose execution doesn't depend on that tab's JS event loop, i.e. server-side.

## CSS

`body`'s `direction` must never be hardcoded to `rtl` in `src/index.css` — `lang` state toggles `<html dir>` in `App.tsx`, and a hardcoded body direction silently overrides it, breaking bidi layout in English mode (numbers/words reordering, e.g. "min 16" instead of "16 min"). This already happened once.

## Blob-URL PDF/print windows

The self-report PDF (`handleExportDriverPdf`/`handleExportDispatcherPdf`) is opened as `window.open(URL.createObjectURL(new Blob([html])))`, not `document.write()` (which Chrome handles unreliably for this use case). Any asset `src` inside that HTML string must be a fully-qualified absolute URL — a root-relative path (`/assets/foo.png`) does not reliably resolve against the real site origin from inside a `blob:` document. Already broke the report logo once (`438f611`).

## User-entered text in exports

Any driver/dispatcher/admin-entered free text (names, especially) that gets interpolated into a print-window HTML string or a CSV cell must go through `escHtml()` / `csvCell()` (defined near the top of `App.tsx`) — this codebase had a real stored-XSS and CSV-formula-injection bug here, fixed in `c27b344`.

## Two-repo coupling

This site and the separate WhatsApp-bot service both read/write the same Firestore project directly, with no API layer between them. There's no schema migration tooling — if you change what a `Scan` or `User` field means (not just adding a new optional field), the bot-side code that reads the same collections needs a matching update, or it will silently misinterpret data.

The bot also independently *reimplements* the Erev Shabbat/Erev Yom Tov early-cutover check (`getEarlyTriggerMoment` in the bot's `index.js`, mirroring `getEarlyCutover` in this repo's `src/services/db.ts`) to decide when to fire its daily WhatsApp summary — the two aren't shared code, just the same algorithm copy-pasted into both runtimes (one ESM/browser, one CommonJS/Node). If that erev-detection logic ever needs to change, update it in both places.

The site's `api/daily-email.js` (see that section above) has this same erev-detection logic as a THIRD independent copy, plus its own trigger-moment computation. It is deliberately **not** called by the bot (rejected on purpose, to avoid making the email depend on the bot's uptime) — it's triggered by a GitHub Actions workflow instead. If that erev-detection logic ever needs to change, update it in all three places (site, bot, email function).

## A same-day-only trigger check silently missed almost every night

`api/daily-email.js` originally computed `target = nyDateStr(now)` (today's NY date) on every ping, then skipped unless `now >= today's trigger moment`. That looks right, but the real send window it created was **about one minute per day**: between 23:59 NY (the trigger moment) and local midnight a minute later, after which `target` itself silently rolled over to tomorrow's date - so a ping landing even a few minutes late compared today's *new* trigger moment (tomorrow's 23:59) against `now`, saw it wasn't time yet, and yesterday's email was gone for good. GitHub Actions' cron pings on this repo land 30-90+ minutes apart in practice (not the configured `*/10`), so that one-minute window was missed almost every night - confirmed live: `bot_state/daily_email.lastEmailDate` was stuck three days stale.

The fix: check `yesterday` first. Yesterday's trigger moment is necessarily already in the past (it was up to a full day ago) - if `lastEmailDate` doesn't match yesterday, send for yesterday right now regardless of what time it is, then let the following ping fall through to the normal today-vs-trigger-moment check. This makes the send self-healing against arbitrary ping gaps instead of depending on one landing inside a specific one-minute window. General lesson: a "not yet time" gate that recomputes both the target date and the cutoff from `now` on every check has no memory of a window it already missed - it needs to also ask "is there a still-unsent day behind us," not just "have we reached today's moment."
