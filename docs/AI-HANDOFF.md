# MAYA handoff — September 30, 2026

## Standing Chrome access rule

Fromsa requires a permission notification and an explicit answer **before each
new access session** to either of his Chrome profiles. Never treat a prior yes,
silence, or a sign-in on the MAYA profile as permission for World of CEO (or
vice versa). Do not use Chrome while he is working in it. This is recorded in
root `AGENTS.md` for future MAYA tasks and `~/.codex/AGENTS.md` for future
Codex projects. The initial release audit used local tools and read-only APIs.
On September 30 Fromsa explicitly authorized one MAYA Chrome session for live
Admin verification. That permission does not carry to another session.

## Live release audit — September 30

The remote `maya-v2` head is now `f38b2fe` (Sep 30, 5:25 PM Pacific). GitHub
reports a Vercel deployment success for that SHA, which is not the Firebase
Hosting/Cloud Run release. Cache-bypassed public HTML (Firebase `x-cache: MISS`)
still has the old Admin, Frontend and Outbound bytes shared by `149314e` through
`3168ded`; the public component preview is older still (`8901d44`, gallery v4).
The new Aesthetic Control URL serves the client homepage fallback. The new
authenticated booking-pending route answers 404 without a token, while
`/api/healthz` is healthy. The signup-alert POST was not probed: automatic
approval review rejected it because it could send a call or text.

`c388619` had a reproduced container packaging failure (missing new modules).
`f38b2fe` includes that Dockerfile correction. Its public GitHub Cloud Build
check, build `8bc3a65d-7572-4d38-9e69-f08194f6a935`, failed in step 1,
**Test release contracts**, at 5:29 PM Pacific. All server and Hosting steps
remained queued. The sole test failure was `maya-hands-smoke.mjs` expecting the
card-editor heading's computed font weight to be at least 600, after the
approved Aesthetic Control change capped it at 400. The build log showed the
other two checks in that assertion were true. The local test now expects the
approved 400 weight. All 16 non-browser release contracts pass locally.
Admin's September 16 changelog is hard-coded even in `f38b2fe` and therefore
a separate stale-content bug. Also, the open-tab update watchdog compared only
the `14.40` display version, unchanged across these pushes, so an already open
tab would not refresh automatically even after a successful same-version deploy.
Locally prepared Admin notes now start September 30, and the Hosting step
creates a public `release.json` with the actual published commit and time.
Admin shows that commit above the notes after deployment. The same stamped
commit lets Admin and Frontend detect a new build even with an unchanged
display version, while their existing active-work safeguards remain. The
release-stamp test, Admin contract and container contract pass. Full `app-regression.mjs`
could not start locally because Playwright is absent. These fixes are saved in
one local commit ahead of `origin/maya-v2`; nothing was pushed.

Admin's MAYA Logs tab calls `/api/admin/maya-features` and sorts real feedback
newest first. In the owner-authorized MAYA Chrome session, the live Admin page
still opened Recent Changes with Sep 16 first. Its Lead Station displayed a
Sep 30 lead, and Logs displayed entries from that afternoon. This confirms
live data can change while Hosting serves old page code; the Logs tab is an
owner-feedback list, not Cloud Run operational logs. Chrome control stopped
when Fromsa took focus; do not resume without a new explicit invitation. The
latest Cloud Build log was read from its public GitHub check. Cloud Run logs
and actual notification delivery remain unchecked. Next step: only after
Fromsa explicitly requests a push, publish the local release fix, verify Build/Run/Hosting
and the new API routes, then test actual notification delivery. Do not open
Chrome without a fresh explicit answer for a later session.

## Current request: missed signup call and owner-approved booking link

The recent Wix Call back submission was present in the existing lead feed, but
there was no automatic owner call or text when a form arrived. Locally prepared
`docs/server/lead-alerts.mjs` now checks fresh Wix submissions, claims each
submission durably, texts and calls the configured owner number, and retries
only definite provider refusals. It runs with the existing authenticated
Outbound scheduler; Admin also has a manual Alerts check and a five-minute
foreground fallback. This is not a Wix webhook, and prompt delivery without
an open Admin page still depends on the production scheduler being configured
and running. That scheduler could not be checked: the Google Cloud console
required owner sign-in. No live call/text was placed.

`docs/server/booking-link.mjs` uses only the exact owner-provided URL
`https://wix.to/wT2lSqE`. A unique Lead Station contact gets a stored preview.
Owner SMS command `Send the booking link to Nick` returns the full recipient,
text and a one-use `BOOK` approval code. On an authenticated owner call, Maya
reads the same preview and texts it to the owner; a spoken approval after the
preview releases the exact client text. Admin Messages shows pending previews
with an explicit Approve button. A changed phone, opt-out, blocked contact,
expired preview or duplicate approval cannot silently send. Carrier acceptance
is reported as acceptance, not delivery. Call transcripts are shown in the
Messages thread after each call, in addition to their existing GCS archive.

Changed files: `docs/server/lead-alerts.mjs`, `booking-link.mjs`,
`server.js`, `maya-phone.mjs`, `maya-messages.mjs`, `owner-crm.mjs`,
`crm-intelligence.mjs`, `Dockerfile`, `backend/status.html`, `cloudbuild.yaml`,
matching tests, and refreshed Aesthetic Control style/typography inventories.
The Docker image now includes the new modules.

Validation: focused booking, alert, owner CRM, CRM intelligence, design,
container, Admin contract and other release tests passed; API smoke passed;
isolated fake Twilio/OpenAI phone (54 checks), messages (55 checks) and transfer
passed. The non-browser style inventory scanned 11 pages and the typography
role audit passed across 18 files. No browser visual test was run after the
owner asked us to stop using Chrome. Live Aesthetic Control opened the client fallback before deployment,
consistent with the previous handoff's unpushed local changes. No credentials,
production configuration, real SMS/call, commit or push changed.

Open risks and exact next step: verify the production Cloud Scheduler and
Twilio sender/voice bridge after an owner-authorized push. Then check the missed
signup once in Admin, confirm one owner text and call, carrier delivery status,
and an owner-approved booking preview to a controlled test lead. The owner
number uses existing `FROMSA_PHONE` or the repository's `+15104917540`
fallback; it has not been read from production. Existing invoice composer is
available in Admin, but phone-driven invoice preview is not implemented.

## Current state

The owner-approved web preview is now [Aesthetic Control](../aesthetics/aesthetic-control.html). It is the visual editor for typography, pills, overlays, icons and page examples. Its supporting files live in `aesthetics/aesthetic-control/`; `docs/design.md` is the sole written specification. Admin → Systems opens the new page. The old `/playground/components/index.html` address has a Hosting rewrite to the new HTML. The existing authenticated `/api/admin/design` Save and public `/api/design` read contract are unchanged. Saving on the live service still needs verification after an owner-requested deployment.

The repository audit moved obsolete audits, retired design files, the duplicate `CLAUDE.md`, a Claude patch archive and dormant pattern-making research into `_to_delete/repo-cleanup-2026-09-29/`. That folder is ignored by Git and Firebase Hosting; the original working files remain locally recoverable. No migration, Storage cleanup, credentials, tokens, billing or production environment settings were touched. The full previous handoff and history are preserved in the same local cleanup folder. See `docs/REPO-MAP.md` for the map and exact move list.

`frontend/`, `backend/`, `docs/`, and `aesthetics/` are the primary product folders. Root `AGENTS.md`, `cloudbuild.yaml`, `robots.txt` and `.firebaserc` remain because the tools or deployment need those names and locations. Root `tests/` remains because Cloud Build and test imports expect it. Root `playground/` remains the active staging copy at `/playground.html`; moving it would require a separate release migration. Do not delete either just to make the root look shorter.

## Validation

`tests/design-contract.mjs`, `tests/typography-usage.mjs`, `tests/container-contract.mjs`, `tests/style-inventory.py`, `tests/component-gallery.mjs` and full `tests/app-regression.mjs` passed locally after the moves. The gallery browser check covered Save/reload, Admin application and widths 320–1920px. `docs/firebase.json` parsed successfully. Production Hosting and Cloud Run have not changed; no push was made.

## Open risks and exact next step

The typography Save endpoint was tested locally with mocked authenticated requests, not yet against live Cloud Run. The `_to_delete` backup is intentionally local and ignored; Git history retains tracked source after a local commit. The next step, only when Fromsa requests it, is to push the verified branch and check the live Aesthetic Control route, old preview URL, Admin link, owner Save and shared styles on client/Admin/Outbound. Keep the sealed-project/account rule intact.
