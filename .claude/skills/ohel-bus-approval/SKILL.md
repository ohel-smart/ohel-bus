---
name: ohel-bus-approval
description: Replace only the post-QR-scan bus departure loading spinner in the existing OHEL SMART bus system with the supplied dark gold animated bus verification overlay and confirmed green success state. Use when asked to install or update the Ohel Bus departure animation.
---

# OHEL SMART — Bus departure approval animation

## Objective
Implement the supplied design in the existing project, not a new application. Replace the spinning circle shown after scanning a bus QR and submitting the departure, while the existing server operation is pending. The QR scanner itself, login, navigation, unrelated loaders, forms, database and backend must remain unchanged.

## 1. Inspect before editing
- Read the project's instructions (including CLAUDE.md), package scripts, existing architecture and current diff. Preserve all unrelated user changes.
- Find the QR scan handler, departure submission handler, actual pending state, existing spinner/overlay, success and failure handling, and any navigation or reset triggered by the response. Trace both dispatcher and driver views only to identify which actually renders this spinner; do not add it to other screens simply because they use QR.
- Identify the existing response contract and source of truth for successful departure. An HTTP 200 alone is not sufficient when the response can report a business rejection. Respect existing idempotency and duplicate-scan protection.
- Find existing localization, overlay/portal and focus-management conventions. If React is present, adapt the supplied assets; otherwise reproduce their SVG and CSS in the existing framework without migrating it. No new packages are needed.

## 2. Design (mandatory)
Read `assets/BusApprovalAnimation.tsx` and `assets/BusApprovalAnimation.css` in full. They are the visual implementation, not a new API or backend. Keep the geometry, icon paths, layout, motion and palette. Center the graphic over the actual current page, no simulated page, phone frame, card, ticket, confetti or stamp. Use a translucent black scrim and 5px backdrop blur. At mobile widths keep the graphic around 290–320px wide with safe margins. The layout must fit a standing phone and adapt to short screens, tablets and desktop.

- Background/scrim: #0B0C10 / rgba(3,4,7,.73); node surfaces #1B1C22.
- Gold: #E7B453, #FFDFA0, #A47835; muted borders #7B6949.
- Success: #49E79E, #79FFC0; failure: #F87171.
- Confirmed node (changed at the owner's request): a DARK blue glass square - #3A6BD8 border, #2A4FB5 / #14286B fill, #9DBBF7 icon, #5C8DF0 light line; only the small check badge is green.
- Look (changed at the owner's request): transparent Apple glass - near-black frosted scrim (rgba(1,2,4,.88), blur 22px, saturate 110%), glass squares and centre disc (white sheen .12/.045/.02, hairline border, bright 1px top edge, soft shadow), subtle light sweep, materialize entrance; text white / white .68; `prefers-reduced-transparency` makes the scrim near-solid.
- Progress line (changed at the owner's request): determinate and honest - empty at the start, +25% for each real confirmation (driver, passengers, route, saved), 100% (green) the moment the system confirms, then fades. Never driven by time.
- Central bus outline with two rotating gold rings, four surrounding rounded square icons: passengers, driver, data, location. Animated light travels along the four curved connections toward the bus. A completed node gets a small green check only when completion is actually known. No arbitrary time-based verification.
- Brand OHEL SMART above, status title and subtle subtitle below, indeterminate gold progress line. Keep current localization (Hebrew/English if available), RTL text and actual project font.
- Final success: loading graphic crossfades/scales away, green circular check draws itself, gentle expanding ring, text «האוטובוס אושר ליציאה!» and «נסיעה טובה ובטוחה». No ticket. Keep success visible about 1.5 seconds, then continue existing UI/navigation. This is post-confirmation visual feedback only: never delay submission or backend processing. Avoid an artificial minimum loading time.

## 3. Wire to actual states
- Mount overlay when the existing departure submission starts after scanning and any required user input. If scan only opens a form, do not show overlay while the user fills it. Keep overlay up while the actual existing request is unresolved, however long it takes.
- If actual stage events exist, pass them into the visual component (`passengers`, `driver`, `data`, `location`, `approval`) and only mark stages confirmed by those events as `completed`. Do not change request ordering, split a request, add network calls, or invent server stages.
- If a single request handles the entire departure, use `pending` and neutral text «מעבד את נתוני הנסיעה...» / «ממתין לאישור המערכת». The gold connections and rings still animate; the four icons illustrate the data involved, not completed checks. Never present simulated verification or fake percentage. Use completed checks only if the existing response explicitly confirms them; a final business success may directly transition to success without showing intermediate checks.
- Show `success` only when the existing authoritative success predicate confirms departure. A rejection, timeout, offline failure, cancellation, thrown exception, or unconfirmed submission is NOT success. On failure retain existing handling, show existing localized error text if appropriate, and let the user dismiss/return via the existing error flow. Do not automatically retry a potentially committed operation.
- Retain the existing request lock/idempotency behavior throughout. Clear/reset presentation state and timers on unmount, cancellation or a new legitimate operation. Ignore stale responses as appropriate using the app's existing lifecycle strategy. Do not let an older response approve a newer scan.
- Ensure existing success navigation does not prematurely unmount the overlay; coordinate its timing at the existing UI boundary only. If successful navigation must happen immediately, place overlay in an existing persistent presentation layer, or preserve the required navigation contract and report the limitation. Do not alter data semantics.
- Use accessible announcements, an existing modal/focus/inert convention if available (assets provide status text, not a complete modal focus trap), prevent interaction with background while blocking, restore focus and release locks on close. Ensure error dismissal works with keyboard. Honor reduced motion.

## 4. Scope and safety
Do not change server, API contracts, Firebase rules, database schema, QR contents, auth, permissions, passenger counts, GPS collection, driver selection, logs, trip handling, or other features. Never log QR secrets or location data just to debug animation. No deployment, production writes, package installs, destructive commands, or git commits without explicit authorization. Use local/mock data for validation. Keep changes isolated; do not reformat unrelated code. The supplied CSS uses an `obs-` prefix; check collisions and adapt namespaces if necessary.

## 5. Verify before reporting
Use project's existing typecheck/build/lint/test tooling where available. Add focused tests consistent with existing conventions; use safe mocks, do not submit real trips. Verify a slow request retains loading, a fast success transitions correctly, a business rejection even with HTTP 200 shows no green approval, network/timeout failure, duplicate scan, dismissal, stale response/unmount, RTL/English where available, narrow portrait view, desktop, reduced motion and no effect on unrelated spinners. Verify success shows once and navigation happens once. Check no extra network requests or writes. If browser testing is available, visually inspect both loading and final success. Report concrete files edited, actual state/response predicate used, test results and any blockers. Never claim tests passed if not run.

## Deliverable
Make the actual targeted changes in the existing project, not just a plan. Reuse the supplied assets faithfully and adapt only integration details. If a necessary fact cannot be established from the repo, do not invent it: preserve the existing contract, report the uncertainty and make only safe changes.
