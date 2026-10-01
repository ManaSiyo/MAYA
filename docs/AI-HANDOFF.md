# MAYA handoff — October 1, 2026

## Release status

The last pushed `origin/maya-v2` is `f66e7c1`. Public `/release.json`
confirms that exact full commit, published 2026-10-01 04:29:16 UTC
(September 30, 9:29 p.m. Pacific). Public `/api/healthz` is healthy;
OpenAI, submissions, Drive and Stripe report configured. This does not
prove Gmail OAuth, Gemini inference, SMS or calls.

## Current prepared change

Aesthetic Control now has H1–H4 and P1–P4. The old standalone technical
P3 is merged into P1 while preserving monospace examples; old P4 pills
become P3 and old P5 captions become P4. Existing saved settings migrate
on read without a production write. The API accepts both old and new
schemas so an already-open old editor can still save.

Typography rows use 6px vertical padding and show role, sample and location.
Each category has one Edit dropdown beside its heading and one settings
summary on the right. Repeated per-row appearance/spacing copy is removed.
Usage evidence, font comparison, status history and source inventory collapse.
Settings panel separately controls the edit rectangle fill/rim/radius/padding.
The review page starts centered; every role has a Centered/Left button with
aria-pressed. Explicit role alignment applies to shared selectors only after
Save. The populated table preview follows P1/P2/P3/P4 edits and alignment.
Shared runtime URLs are bumped to v2 across all 11 served pages and Hosting
now marks that runtime no-cache, preventing a week-old role mapping after deploy.
No live design Save, provider configuration or push occurred.

Changed paths: aesthetics/aesthetic-control.html; gallery.js/gallery.css,
overlay.js/style-reference.js and typography-usage.json in its support folder;
aesthetics/ui/typography-controls.js; docs/server/design-config.mjs;
tests/component-gallery.mjs, design-config.mjs, app-regression.mjs and
typography-role-usage.py. Design/README/requests/fixes/handoff/commit review
are updated in the same local commit. The other served HTML pages only change
the shared runtime version; docs/firebase.json adds its no-cache rule and
tests/design-contract.mjs verifies both.

## Environment and validation

Use bundled Node at
/Users/fromsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.
Isolated headless Chromium is available at
/private/tmp/maya-pw-browsers/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell.
It uses temporary test profiles, never Fromsa's Chrome. The temporary ESM
loader /private/tmp/maya-oct1-loader.mjs resolves Playwright and Express/ws
without adding repository dependencies. It is a local convenience, not a
repository or production requirement. Browser/server tests need sandbox
approval for macOS browser processes or loopback listeners.

Passed: full app-regression including component-gallery/design contracts;
design validation for old/new schemas, alignment and editor ranges;
owner-crm and crm-intelligence fake-provider checks; owner-crm-ui Gmail/Gemini
fixtures. Gallery checks cover legacy role conversion, single settings summary,
center/left preview, housing updates, table data, Save/reload, shared Admin/
frontend/Outbound application and seven widths (320–1920), including open
settings dropdowns. Server smoke, role evidence audit, Outbound UI, CRM UI,
CRM failure UI and Canon UI also pass. Syntax and whitespace
checks are recorded in the commit review. No real mail, call or text sent.

## Open risks and exact next step

**Do not push without Fromsa's explicit request.** Review the local editor,
then push the prepared commit from GitHub Desktop when desired. Verify Cloud
Build and release.json before treating editor changes as live. Live Save requires
Admin auth and can change typography/alignment across shared text selectors;
no production design changes were made in this session.

Chrome permission notification was sent for a fresh MAYA session; no explicit
approval has arrived, so Chrome was not accessed. Owner-authenticated Gmail
connection readiness/mailboxes and a real Test Gemini response remain pending.
After explicit approval and confirmation that the MAYA Chrome window is idle,
inspect Systems → Owner tools and Outbound → Gmail. Read state and use the
existing Test Gemini action; do not send email or reconnect/configure credentials
without the owner handling those steps. Keep Worldofsiyo separate.
Booking, Scheduler/alerts, operational logs and actual call/text receipt remain
unverified, as in the previous handoff.

## Standing constraints and repository map

Before each new access session to Fromsa's Chrome, send a permission
notification and wait for an explicit answer. MAYA and World of CEO profiles
are separate; do not use Chrome while he is working. Do not touch credentials,
billing, production variables, or legacy migration/Storage cleanup paths.
Keep project and account data sealed. See root `AGENTS.md` and
`docs/REPO-MAP.md`.

The visual design anchor is `aesthetics/aesthetic-control.html`, supported by
`aesthetics/aesthetic-control/`; `docs/design.md` is the sole written design
specification. Main folders are `frontend/`, `backend/`, `docs/`,
`aesthetics/`, `playground/`, and `tests/`. Root `AGENTS.md`,
`cloudbuild.yaml`, `robots.txt`, and `.firebaserc` stay at the root for build
and hosting. Obsolete local material remains recoverable in ignored
`_to_delete/repo-cleanup-2026-09-29/`. Do not move served images into `docs/`.

The approved booking URL is `https://wix.to/wT2lSqE`. Owner-controlled booking
preview and alert code are in the deployed release but have not been verified
end to end in production. Phone-driven invoice preview is not implemented.

Local review URL: http://127.0.0.1:8767/aesthetics/aesthetic-control.html.
A Python loopback-only server was started for review; Codex browser opening
was queued. Restart with the bundled Python http.server if the session ends.
