# MAYA handoff — September 30, 2026

## Release status

`maya-v2` and `origin/maya-v2` both point to `0d0ec66`. That push **did not
reach production**: Cloud Build `fbbce9f4-deb5-4a24-b82b-ee1c2e76bdc6`
failed in **Test release contracts**, before the server and Hosting deploys.
The remaining failure expected an Outbound person link to be 11px; the approved
typography sets it to 12px. Related stale 11px and 500-weight assertions were
corrected locally. The full local release and browser checks now pass, but the
fixes in this handoff have not been pushed. Do not describe the current live
site as carrying this HEAD.

On the live site, Admin Recent Changes still begins September 16 and the new
`/aesthetics/aesthetic-control.html` URL falls back to the client sign-in.
Live Outbound does show 262 prospects, a September 30 Sheet sync, its columns,
filters and Email History dial. The data can refresh without the latest page
code. Live `/verify.html` reports version 14.40 with one attention item (wall
hover detail); it does not compare deployed commits. An unauthenticated
browser cannot verify owner Save, Gmail, calls, texts, booking approval, or
Cloud Scheduler. No real message or call was sent during this audit.

## Local changes prepared for the next push

- Updated outdated assertions in `tests/outbound-priority-ui.mjs`,
  `tests/outbound-ui.mjs`, and `tests/canon-ui.mjs` to the approved 12px
  Outbound text and maximum 400 font weight.
- Updated the `wixLeads` source assertion in `tests/app-regression.mjs` to
  recognize its current optional-arguments signature. Functional lead tests
  remain in place.
- Regenerated `aesthetics/aesthetic-control/style-inventory.json` and
  `typography-usage.json` so the visual editor's counts and source locations
  reflect the current files.
- Removed the temporary test-only `tests/node_modules` symlinks after testing.
  No product behavior, credentials, billing, or production configuration was
  changed in this audit.

## Validation

All 17 non-browser Cloud Build release contracts passed locally. The full
`tests/maya-hands-smoke.mjs`, `tests/app-regression.mjs`,
`tests/outbound-ui.mjs`, `tests/component-gallery.mjs`, `tests/crm-ui.mjs`,
`tests/crm-failure-ui.mjs`, and `tests/canon-ui.mjs` browser suites passed in
an isolated headless Chromium. The Canon UI suite covered 11 pages at seven
widths; CRM UI covered 10,000-record continuous scrolling, dataset-wide
search, reviewed sending and meter behavior. `tests/maya-messages.mjs` passed
55 fake-carrier checks and `tests/maya-transfer.mjs` passed. These are local
tests, not proof of live carrier or Gmail delivery. The live site was checked
in a separate Codex browser. Fromsa was using his Chrome, so no further
Chrome access occurred. `tests/maya-phone.mjs` remains unrun locally because
the optional `ws` test dependency is absent; this should run in Cloud Build.

## Exact next step

Fromsa plans to review the summary and push himself. **Do not push without his
explicit request.** After the next push, watch the Google Cloud Build check
through server and Hosting deploy, then verify `/release.json` equals the
pushed commit and live Admin shows the September 30 notes. Recheck the
Aesthetic Control route and authenticated Save, owner-only CRM and Gmail
connections, Cloud Scheduler, and one controlled alert/booking approval with
carrier delivery evidence. Investigate the live verify page's wall hover
attention if it remains after deployment. The signup-alert endpoint may send
a real notification; do not probe it casually.

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
preview and alert code are prepared locally from earlier work but have not
been verified in production. Phone-driven invoice preview is not implemented.
