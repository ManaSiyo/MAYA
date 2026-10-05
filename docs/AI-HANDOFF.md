# MAYA handoff — October 5, 2026

## Current request: dismiss lingering model hover cards

Started clean at 21fd7f7, one local commit ahead of origin/maya-v2. The hover
close guard treated mouse-click focus as keyboard focus and left cards pinned.
Pointer interactions now use actual pointer coordinates (not stale :hover state)
and dismiss 100ms after leaving both trigger and card,
even when the clicked trigger/detail retains focus. Keyboard interaction keeps
its focus behavior; Escape closes and returns focus. Outside wheel/touch scroll and resize also
closes; scrolling inside the card remains usable. Pending model data cannot open
an already closed card. Admin Systems JS ref advances to v4.

## Changed paths and validation

admin-systems.js, backend/status.html, admin-systems-ui and app-regression;
design/requests/fixes/COMMIT-REVIEW. Validation passed: pointer leave after trigger/detail clicks, keyboard/Escape,
outside wheel/resize, seven widths and landscapes; full app-regression.
Log: /private/tmp/maya-hover-dismiss-regression.log. Git diff checks passed.

## Exact next step

Verified work is prepared as a local commit. Fromsa pushes the two local commits; no push is
authorized. After deployment check live model hover dismissal. No Chrome,
credentials, production env, model configuration or client sends used here.

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
