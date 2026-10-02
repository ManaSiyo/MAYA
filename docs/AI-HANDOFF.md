# MAYA handoff — October 2, 2026

## Release status

Current checked source and actual remote maya-v2 both equal 601784c12b4a124f9d6bfae6c25d38263c360c17.
The owner pushed the final handoff as well as implementation 19ff3a1. The working
tree started clean for the October 2 shipment/margin audit.

LIVE HOSTING IS STALE: repeated cache-bypassed public release.json reads report
497066020b006f59c5e7b21a7a441f66397b02e6, published 2026-10-02T04:45:16.127Z
(October 1, 9:45 PM Pacific). Deployed editor HTML still has Reset, gallery CSS/JS
v16 and typography runtime v3, rather than current v18/v4. Isolated live-browser
read reproduces H1 editor clipping at 1100px: left=-69.265625px, right=250.734375px.
No authenticated production browser or user Chrome was accessed. Public healthz
returns ok:true; liveness does not prove build freshness or provider readiness.
Cloud Build/deploy cause was not established. No Codex push/deploy or live Save.

## Current prepared change

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

Latest code is pushed, but public Hosting is still at 4970660. Owner next step:
inspect Cloud Build/deployment for 19ff3a1 and 601784c, publish the current code,
then verify release.json, v18/v4 editor assets and the live dropdown/table behavior.
Do not infer deployment from a successful Push or healthz. Code passed local
responsive checks; the current deployed site still contains the known clipping
bug. This verification/incident documentation is committed locally; no push is
authorized in this request. After deployment, save the desired live Admin design.
No live Save was performed. Designs lacking the optional inner/filter/table keys
receive bounded defaults on read without production migration writes. New default
name font/inner geometry/table styling should be reviewed before live Save.
History/undo is deferred; Reset is removed as requested.

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
