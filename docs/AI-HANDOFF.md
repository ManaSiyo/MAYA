# MAYA handoff — October 5, 2026

## Current request: inline notes, simpler drawer and consistent panel/table controls

Started clean at 5ab0aef, matching origin/maya-v2. Latest Notes now opens a textarea directly within its cell. Enter/blur/Save persist through authenticated lead-update; Escape/Cancel discard; failed saves retain the draft. Explicit Dictate still pauses Hey Maya and never saves speech automatically. Active refresh preserves the draft; frozen Name cells release while editing to avoid covering controls at phone widths.

Messages has circular Share and Phone actions. Share reveals booking link (unsent composer draft) and existing reviewed Invoice. Known names use H1 above H2 Messages, with phone hidden from the header but retained as recipient. Content scrolls independently above the bottom voice dock; drawer scrollbars are hidden.

Panels now groups Outer panel, Inner panel and Table with shared numeric/select Edit grids. Material controls include background, opacity, border, corners, blur, saturation and X/Y padding; Table remains independent and its formatting bar follows Inner. Table section edits selected row/column text and cell colors. Drag header edges or use arrow keys to set 80–800px semantic widths; Save persists and applies them to live Leads, preserving reordering and old schemas. Table restore includes widths. Runtime v16/gallery v30 load across served pages; authored role locations regenerated.

Changed paths: backend/status.html; aesthetics/aesthetic-control/{gallery.js,gallery.css,overlay.js,surface-editors.js,table-cell-editor.js,typography-usage.json}; typography-controls.js and served HTML cache revisions; docs/server/design-config.mjs; targeted regression fixtures and project documentation.

Validation: all 32 exact Cloud Build checks pass (26 unit/communications plus six browser suites), along with full app-regression and local server smoke. Gallery covers eleven widths, save/reload and pointer resizing; Leads covers four widths, typing/dictation, failed drafts, Enter/blur save, drawer floor/circles and exact live widths. Outbound/status filters pass seven widths; CRM exercises 10,000 contacts and account/expiry failures. Drawer screenshot visually reviewed. git diff --check passes.
Limitations: fake providers and isolated Chromium only; no personal Chrome, microphone, actual SMS/calls, credentials or production settings accessed. Local changes need owner Push and exact-commit live verification after Cloud Build finishes. No push/deploy performed.
Exact next step: Fromsa presses Push in GitHub Desktop for the prepared local commit. Check Cloud Build success and run tests/verify-live.mjs --wait for that exact commit.

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
