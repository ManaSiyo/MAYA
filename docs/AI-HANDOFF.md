# MAYA handoff — October 1, 2026

## Release status

Started at 12073dc, clean and one local commit ahead of origin/maya-v2 (4970660).
During verification the owner committed implementation as 19ff3a1 (message "y")
and pushed it; HEAD now matches origin/maya-v2. Final tests ran against that code.
Codex did not push/deploy, save a production design, access user Chrome, change
credentials/environment or send a real customer call/text. Deployment remains
unverified. The final verification/handoff documentation is committed locally.

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

Code is already committed/pushed by the owner at 19ff3a1. Commit this final
verification/handoff documentation locally. Do not push without explicit request.
Owner refresh/review previews, check Cloud Build and release.json, then save the
desired live Admin design. Final docs Push remains available in GitHub Desktop.
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
