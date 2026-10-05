# MAYA handoff — October 5, 2026

## Current request: simplify table material controls

Started clean at e920e3c, matching origin/maya-v2. The table-wide Background and
Opacity inputs are removed. Selected top-row/column Background and Opacity remain
editable and saved. Existing table-wide material fields remain readable for saved
schema compatibility; no migration or automatic material reset occurs.

Table geometry now has two stacked rows: Outer border thickness/color/opacity,
corners and X/Y padding; then Inner border thickness/color/opacity. Each row scrolls
horizontally at narrow widths. The fixed selection formatting row stays below them.
Gallery cache refs advance to v28; shared runtime remains v14.

## Changed paths and validation

Gallery table-cell-editor.js/css and HTML cache refs; component-gallery and
app-regression assertions; AGENTS/design/requests/fixes/COMMIT-REVIEW.
Validation passed: gallery Save/reload, selection materials and eleven-width
bounds; full app-regression including the new two-row/material assertion. Git
diff checks passed. Logs: /private/tmp/maya-border-rows-{gallery,regression}.log.
No server, credentials, provider, account-bound data or production environment edits.

## Exact next step and remaining live verification

This request is verified and prepared as a local commit. Fromsa pushes from
GitHub Desktop; no push is authorized in this turn. After deployment, verify
release.json and the two border rows with selected Background/Opacity controls.
Actual Gmail mailbox connection and Gemini/image inference remain unverified.
Personal Chrome access needs fresh session approval; no Chrome is needed here.

Prior live owner verification remains: MAYA HELP/INBOX/THREAD Nick/MORE/ACTIONS,
normal memory recall and separately authorized client REPLY/SEND; scheduler/signup/
booking alerts, microphone wake/audio, SMS delivery/carrier receipt and owner transfer.
Read docs/OUTBOUND-SETUP.md for owner-only connection/setup steps. No automatic
sending was introduced; account/project boundaries remain sealed.

## Standing constraints

Ask and wait before each user Chrome session; never use Chrome while Fromsa works
in it. MAYA and Worldofsiyo profiles are separate. Keep project/account data
sealed; no credentials, billing, production variables or legacy migration/Storage
cleanup changes. docs/design.md is the sole active design specification.
Approved booking URL: https://wix.to/wT2lSqE.
