# MAYA handoff — October 2, 2026

## Current request: cell-based Aesthetic Control

Prepared locally, not pushed: gallery v21/shared runtime v7. Table preview uses
one fixed formatting row. Full name corner selects top row + first column; other
headers select top row; names select first column; other cells select individually.
Only whole-table Edit remains. Type, case, size, colors, horizontal/vertical
alignment and background opacity update live. Keyboard selection and arrows work.
Optional table.cells overrides validate semantic stage/note row slots 0–99 (max
100 overrides), no identity/customer data. Matching Lead Station slots receive
saved styles after re-render/filtering; Outbound retains shared table/header/type
settings without mapping individual slots to unrelated source fields.

One outer preview contains two direct inner panels, each heading + Contacts pill.
Opening an editor automatically highlights its actual padding, including glass,
outer, inner, filter preview and table. No manual debug toggle or extra material
wrapper. Restore beside every Edit and the fixed cell toolbar returns to that
editor's last successful Save; it does not reset other editors. Role labels show
regenerated authored-use counts. Used icons only. Selected finish shows checkmark
and outlined card. Saved cell runtime handles scripts loaded before body exists.

Changed: gallery, CSS, finishes, overlay, surface editors; new restore-controls.js
and table-cell-editor.js; shared typography runtime and all served cache references;
server design validation; role audit; gallery/design/app regression tests; design,
AGENTS and continuity records.

Validation: design-config/contract; component-gallery 11 widths 320–1920 with
cell selection, independent cell styles, saved restore, Save/reload, actual Admin
propagation, popup bounds/proximity/hit testing and nonwrapping formatting row;
full app regression; canon-ui 11 pages/7 widths; Outbound UI/populated filters;
CRM UI/failure/intelligence. Real-font visual review of selected table/padding.
No personal Chrome, provider calls/messages, credentials or environment changes.

Exact next step: owner Push from GitHub Desktop. Then compare /release.json with
the new commit and verify authenticated Save and desired cell/panel settings.
Nothing in this task has been pushed or saved to the live design API.

## Release status

Public /release.json read October 2 confirms the owner's previous push:
3ecfc8ddf256f269bc3332c9f1e64769660fa18c, published 2026-10-02T20:57:21.849Z.
That release contains the prior anchoring/padding/wake recovery fix. The current
cell-editor request is a new local change. Codex has not pushed or deployed.

## October 2 verified implementation and follow-up

Live Outbound workbook 1G2zfqopOyZNHf78nuEeNdLgRY7ON0JTeegkhhZ4azyg already has
Last email, Category, Company, Full Name, Email, Job Title, Subject, Status, Reason,
Relevance in A:J on Funnel, 9/29 Corporates, 9/23 Fashion Houses, 9/23 Ceremonial
and Others. Native cell inspection preserved hyperlinks, formulas and formats;
no live Sheet edits were needed. Code now reads A:J, imports Reason independently,
and displays/filters/exports the ten source columns in that order. Sync accepts
9/29 Corporate tabs; a renamed dated tab reuses its campaign ID/memberships/drafts
instead of creating a duplicate. Account-scoped CAS storage remains unchanged.

Aesthetic runtime v5 is loaded by all served pages. Saved material variables now
drive legacy surfaces and drawer frost; saved table styles also apply to other
real tables and Outbound's semantic Full name/Status columns. Shared action buttons
use P3 font/case settings. Preview has inner/outer Show padding debug buttons with
light green X/Y bands, excluded from saved settings. Icon size and dropdown height
(24–48px) persist, a native dropdown works, and 21 icon types are represented.
Save follows the selected button finish. Popup focus no longer shifts another
editor before its initiating click. Inactive style-reference.js, style-inventory.json
and tests/style-inventory.py were removed; active adapters/images/role audit remain.

Model Snapshot contains AI meter in Systems; Outbound's meter also begins with the
snapshot. Claude is omitted from its display, with historical billing totals
retained. Owner chose cost/speed; existing GPT-6 Luna text and GPT Image 2.5 Flare,
Medium default, remain. No credentials/environment/billing/model-provider changes.

Design settings and a bounded private audit trail are written together using GCS
generation preconditions. /api/design strips _history; /api/admin/design-history is
Admin-only. Logs merge saved design entries with feature requests and label Saved
separately. Successful live Save notifies that it was recorded. Earlier saves had
no audit trail; their exact time/identity cannot be reconstructed. Local saves stay
same-origin local. No authenticated production Save was performed this turn.

Final follow-up: #adm-scroll scroll-padding-top and Lead Station scroll-margin-top
reserve 76px for the fixed top bar. Populated filter tests navigate after resizing;
headers and filter triggers stay clickable. No provider calls or client messages
were sent during verification.

Validation: app-regression; component-gallery (including live padding highlights,
Save/restore and 17 temporary editor/control bounds at 11 widths); canon-ui (11
pages, seven widths 320–1920); Outbound UI/filter/priority; CRM UI/failure/intelligence;
30 Outbound/model unit checks; all non-browser Cloud Build gates; frontend and
Playground hands batteries; fake phone/messages/transfer/feedback suites. An extra
active-runtime margin audit using the public saved design and actual Google fonts
passes 10 pages at 18 widths 320–2560 and five short/landscape sizes. Syntax and
git diff checks pass. Logs: /private/tmp/maya-followup-<suite>.log.

Exact next step: owner Push this follow-up, check its Google Cloud Build result,
then verify public release.json and v19 gallery/v5 runtime assets. Review the live
Aesthetic Control and Save once as Admin; verify the Saved entry in Logs. Live
signed-in Gmail/Gemini inference/delivery remain owner verification, not proven by
fake-provider tests or a model snapshot.

## Previously verified October 1 implementation

Aesthetic Control removes header Visuals/Typography links, Reset, applied-status
copy and Editor panel controls. Glass, Panels and Tables has the requested comma.
Save is centered. Typography's alignment choices are inside Edit: Left, Centered,
Right and Top/Middle/Bottom. Temporary Edit controls close on outside click,
focus leaving and Escape; section folds and States remain explicitly controlled.
Legacy editor housing settings remain readable, without a separate control UI.

Outer panels have X/Y padding. Inner panel has opacity, border, corners, X/Y
padding and percentage width. Filter has separate material/padding/pixel width.
A divider precedes Table. Preview matches Lead Station's Full name, Status,
Latest Notes columns. Table material/padding, top-row type/background/opacity,
first-column background/opacity and each column's font/case/size/weight/color/
horizontal/vertical alignment are independently saved. Names default Cormorant;
other data Jost. Settings apply to actual Lead Station cells keyed by data-col,
so semantic column styles survive reorder. Status colors remain semantic.

Lead Station removes Forms/Reload/Alerts/Add floating toolbar and aligns the
section caret with its title. Category/date replace long tier/call icons: ? for
Help me decide, SI Signature, CE Ceremonial, SU Suit. The full name cell, including
its padding, opens the exact client's Messages thread. A name button preserves
keyboard activation. Missing phone opens Messages with explicit feedback.
Calls still exist inside Messages. Affiliates retains its own profile reload.

Changed files: aesthetic-control.html; gallery.js/gallery.css, finishes.js,
overlay.js and new surface-editors.js; typography-controls.js runtime v4;
server/design-config.mjs; backend/status.html; all served runtime HTML cache refs;
component-gallery, design-config/design-contract, outbound-ui, lead-filter-ui,
app-regression; AGENTS, README, design, requests/fixes/handoff/commit review.
Gallery assets v18; shared runtime v4. No served page moved or URL changed.

## Validation and preview

October 2 recheck: full app-regression, canon-ui, component-gallery and
outbound-ui all passed. Canon verifies 11 rendered surfaces at seven widths;
gallery verifies all 16 temporary editor popups/fields at eleven widths;
populated Lead Station filters/table have seven-width clipping, pointer,
keyboard, scroll/reorder and fallback coverage.
Additional isolated margin audit passed all ten canon pages at 18 widths
(320,360,375,390,420,568,640,650,700,701,768,900,1024,1100,1280,1440,1920,2560)
and five short/landscape sizes (568x320,667x375,844x390,1024x600,1440x720).
It keeps runtime v4 enabled, uses public saved design values and actual Google
fonts, and checks document overflow plus open drawer bounds/content. Application
scripts are stripped in this broad shell audit; populated interactions are
covered separately by the suites above. Temporary audit source/log:
/private/tmp/maya-runtime-margins.mjs and /private/tmp/maya-runtime-margins.log.
The non-margin master-material probe in the first adapted audit observed saved
Admin blur 22px versus frontend master 28px; it was excluded from the margin-only
pass and did not prompt an unrelated presentation change.
Public live screenshot: /private/tmp/maya-deployed-dropdown.png.
All local check logs: /private/tmp/maya-release-<suite>.log.
No application source changed during this verification.


Component-gallery passed Save/reload, authenticated Save fixture, live inner/
filter/table settings and actual Admin table application. All eight typography
and eight surface Edit popups/fields checked at eleven widths (320–1920px),
including 700/701px, maximum housing padding, collapsed Visuals and outside/Escape
dismissal. Shared role/font/case/color/material checks continue to pass.
Design-config and design-contract passed legacy compatibility and rejection of
invalid geometry, backgrounds, fonts and alignments. CRM intelligence/UI/failure
and fake phone/messages/transfer/feedback suites passed. Full app-regression and outbound-ui passed, including populated/empty tables,
seven widths, scroll/reorder, pointer/keyboard, fallback and exact name-cell routing.
JavaScript syntax checks and git diff --check passed.
Screenshot /private/tmp/maya-typography-controls.png reviewed; fonts are blocked
in browser fixtures, so live web-font rendering remains an owner review item.

Preview: http://127.0.0.1:8767/aesthetics/aesthetic-control.html and
http://127.0.0.1:8767/status.html. Existing loopback server serves current sources.
Bundled Node: /Users/fromsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.
Resolver: /private/tmp/maya-oct1-loader.mjs; Chromium:
/private/tmp/maya-pw-browsers/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell.
Browser checks use isolated Chromium, fake auth/providers and local files.
Temporary runtimes are not deployment requirements; CI installs dependencies.

## Exact next step and open risks

Follow the current request above. Prior release markers below are historical.
Local restore is now supported per editor; it restores saved settings, not a
chronological undo history. Individual cell styles follow visible row slots after
sorting/filtering, not a customer. Authenticated live Save and real microphone
wake behavior still need owner verification after the owner pushes this change.
No live design save or client/provider operation was performed.

Prior SMS access from 259c824 still needs live owner verification: MAYA HELP,
INBOX, THREAD Nick, MORE pages, ACTIONS, normal memory recall and separately
authorized client REPLY/SEND. Explicit commands bypass AI; normal conversation
uses AI availability/$1 CRM text cap. Lost old records cannot be recovered.
Gmail mailbox readiness, real Gemini inference, scheduler/booking/signup alerts,
live audio/SMS/carrier receipt and owner transfer remain owner verification items.

## Standing constraints

Ask and wait before each user Chrome session; never use Chrome while Fromsa works
in it. MAYA and Worldofsiyo profiles are separate. Keep project/account data
sealed; no credentials, billing, production variables or legacy migration/Storage
cleanup changes. docs/design.md is the sole active design specification.
Approved booking URL: https://wix.to/wT2lSqE.
