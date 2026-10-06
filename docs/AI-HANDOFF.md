# MAYA handoff — October 5, 2026

## Current request: pushed changes missing from production

October 5 deployment audit: local/origin maya-v2 both at dd7ba48. Cache-bypassed
public release.json still reports 13116205e54e5b6ebd9d80347ef800b3b3b3bed1,
published 2026-10-05T23:20:06.325Z. Live Admin has no editLatestLeadNote, and
shared typography/gallery assets differ from the pushed source.

Public GitHub Cloud Build check 5912fb44-0764-46af-9328-ef423bd879fe failed
at Test release contracts (admin-ui-contract.mjs), before server/website deploy.
The outdated contract required category badges removed at the owner's request.
Vercel was successful; that did not publish Firebase Hosting.

Updated that contract to assert Contact/H5/H6, full-cell notes and reviewed
Messages actions. Added design-contract, note persistence and note UI checks to
the Cloud Build gate. Live verification now compares release.json and page build
stamps to the exact Git commit; unchanged 14.40 is no longer sufficient. A local
HTTP fixture proves older same-version commits fail and matching commits pass.

Validation: 25 pre-existing/updated unit and communications deployment contracts
passed, plus the new exact-commit verifier fixture. All six browser checks passed: both hands batteries, Outbound, reviewed notes,
10,000-contact CRM, account/expiry failure UI and 11-page canon. Including the new
verifier fixture, 26 deployment unit/communications checks pass. Public live
verification correctly fails for 1311620. Full app-regression passed.
No personal Chrome, credentials, production settings, push or deploy used.

## Previous request: editable Leads notes, Contact, name/date roles and message actions

Started clean at c9d43df, matching origin/maya-v2. Prior owner SMS/numeric-phone
fix is now pushed; no live trace or delivery verification was accessed here.

Leads now shows Full name, Contact (stored phone), Status and Latest Notes.
Existing saved column orders retain their order and gain Contact after Name.
Names use H5, dates use H6 below the name; category ?/SI/CE/SU badges are removed.
Aesthetic Control previews the same four columns and exposes H5/H6 with authored
source locations. Shared runtime v15/gallery v29 preserve old saves and semantic
column indexes; Contact adds a fourth optional saved column style.

Click anywhere in a Latest Notes cell to open its reviewed textarea. Dictate
starts browser recognition only on a click, fills the unsaved draft and pauses
Hey Maya recognition. Cancel/close stops recognition; auth changes close the
editor. Save uses authenticated lead-update with the exact stable lead ID and
only paints success after the server accepts it. Failures retain the draft.
Reviewed note replacements are timestamped; refresh cannot overwrite them with
older recorded notes. A newer recorded touchpoint updates both note and wrote,
so dashboard and Maya read the same enriched feed.

Messages preserves known Lead names through empty/Caller provider responses.
Call is now the existing handset SVG in its pill, with accessible label and
existing explicit call confirmation. Booking Link puts the approved consultation
URL into the visible unsent composer, retains existing text and avoids duplicate
links. It does not call the booking preview or send endpoints; blocked/STOP
contacts cannot receive that draft action. Explicit Send and carrier-status
checks remain. Existing separately approved booking workflows are preserved.

## Changed paths and validation

backend/status.html; docs/server/server.js and design-config.mjs; shared typography
runtime and cache references on served pages; gallery/editor/CSS/usage inventory;
focused lead note UI/persistence suites and updated affected regression fixtures;
AGENTS/design/requests/fixes/COMMIT-REVIEW.

Passed: full app-regression (gallery at eleven widths and lead note editor at
four widths); outbound-ui/lead-filter-ui at seven widths; phone (57), messages
(55), transfer/feedback, owner conversation/SMS, wake, design and container checks;
frontend/Playground hands batteries. Note persistence fixtures cover manual/Wix
replacements, older-note refresh precedence and newer touchpoints. All providers
are fake and Chromium is isolated; no personal Chrome, live calls/SMS, credentials,
billing or production environment changes. Shared cache references and diff checks
passed.
## Exact next step

The verified deployment-gate fix is prepared as a local commit for Fromsa to Push. dd7ba48 is already pushed but failed deployment. Never push automatically.
After Cloud Build deploys, verify release.json; check note typing/dictation,
Save/reload, H5/H6 changes, contact numbers and an unsent Booking Link draft.
Owner must verify actual microphone capture and explicit SMS/call delivery;
carrier acceptance is not delivery confirmation. Prior owner SMS verification:
"Send me the last 5 leads", THREAD Nick/MORE/ACTIONS and phone-requested numeric
contact texts. No real sends ran in this task.

## Standing constraints

Ask and wait before each personal Chrome session; MAYA and Worldofsiyo are
separate. Preserve account/project boundaries, client preview/SEND/STOP gates,
non-retryable claims, private archives, migrations and Storage cleanup paths.
No credentials, billing or production variables. docs/design.md is the sole
active aesthetic specification; local commits are authorized, pushes are not.
