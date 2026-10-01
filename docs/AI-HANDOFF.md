# MAYA handoff — September 30, 2026

## Release status

`maya-v2` and `origin/maya-v2` both point to `f1a36b5`. The live
`/release.json` names that exact commit, published 2026-10-01 02:30:54 UTC.
The live Aesthetic Control page opens, and its link appears near the top of
Admin → Systems. Public `/api/healthz` reports a healthy `maya-api` with
OpenAI, submissions, Drive and Stripe configured; configuration alone does
not prove an end-to-end provider action. The repository's read-only live
verification script passes all checks. Live `/verify.html` still shows one
wall-hover warning because its selector was stale; the frontend actually has
the hidden-until-hover rule. This false-positive checker is fixed locally.

Aesthetic Control Save was tested against production without changing any
design value: it accepted the approved default configuration, `/api/design`
returned that exact configuration, and an already-open Admin tab had the
24px H1 and 18% glass tokens. The saved values apply without a code deploy:
same-origin open tabs receive a BroadcastChannel update, and new page loads
fetch `/api/design` without caching. Another browser needs a refresh. Changes
to the editor, style runtime or menu markup still require a normal deploy.

The independent browser could not verify owner-only Gmail, Twilio delivery,
booking approval, lead alerts, Cloud Scheduler or operational logs. Admin's
Owner tools asked for owner sign-in. Fromsa explicitly approved one MAYA Chrome
session. The Chrome UI reported that the user changed the app as owner checks
started, so interaction stopped immediately; no owner-only state was read.
Fresh permission and an idle window are required for another session. No real
email, call or text was sent.

## Local changes prepared for the next push

- `backend/status.html`: the existing Aesthetic Control link becomes a clear
  glass quick link directly under the Systems checks. Its long helper line is
  removed; the shared live glass tokens still control its finish.
- `backend/verify.html`: match the actual `.community-card .cc-meta` selector
  so a working wall no longer appears broken.
- `tests/component-gallery.mjs` checks the quick link destination and shape.
  `tests/app-regression.mjs` checks that the deploy checker recognizes the
  frontend wall rule. No credential, billing or production environment change.

## Validation

Current `tests/component-gallery.mjs` and full `tests/app-regression.mjs`
pass in isolated headless Chromium. `tests/verify-live.mjs` passes against
production. The previous audit also passed all 17 non-browser release
contracts, the frontend/Playground hands battery, CRM, Outbound and Canon UI
browser suites, 55 fake-carrier message checks and transfer tests. None of
these is proof of actual Gmail or carrier delivery. `tests/maya-phone.mjs`
remains unrun locally because the optional `ws` test dependency is absent;
Cloud Build runs it when that dependency installs. Temporary test symlinks
were removed after testing.

## Exact next step

**Do not push without Fromsa's explicit request.** After the next push, check
Cloud Build and `/release.json`, then confirm the glass quick link and corrected
`/verify.html` warning live. With a newly approved, idle MAYA Chrome
session, inspect owner-only Gmail connections, Scheduler/alert status, booking
previews and operational logs without sending to anyone. A controlled real
call/text test needs an explicitly chosen recipient. The signup-alert endpoint
may send a real notification; do not probe it casually.

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
