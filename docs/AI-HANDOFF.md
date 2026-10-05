# MAYA handoff — October 5, 2026

## Current request: audit active aesthetics, tables, dropdowns and Systems

Started clean at 2cbd234, matching origin/maya-v2. Public release.json also reports
2cbd2344f1726f3975cdaefbe0184501247b0e5d (published 2026-10-05T03:41:56.501Z).
This request is prepared and committed locally; not pushed. Runtime v14 and gallery
v27 are referenced across served pages; gallery modules/new status picker revalidate.

Table material/geometry is now the first row of the fixed formatting toolbar,
above selection typography/background/opacity. The separate Table Edit is removed.
Table outer/grid border widths (0–8px), colors/opacity, radius and X/Y cell padding
are independent. Existing rim/borderColor saves remain compatible. Outbound name,
status and other body-column backgrounds now apply; semantic status colors remain.
Header and body column settings visibly apply and survive Save/reload. Table housing
and formatting toolbar remain independent of Inner material. Inner usage links
identify actual preview/Outbound/Operation Room/Pattern Operations locations.
H2 sections and H3 Edit labels match shared typography; H0 preview stays on one line.

Outbound drawer actions share pill material. Navigation tabs/Close keep their roles.
Owner tools is removed from live Admin, while SMS/server owner capabilities remain.
Vault grouping is restored with <=4-word descriptions. Existing connected mailbox
counts take precedence over OAuth setup/reconnection warnings, scoped to the owner.
Systems/API/Images show authenticated configured models and transports; models
load independently of mailbox lookup. Loading/error states and Submissions details
are explicit. Configuration metadata does not claim successful inference.

Both the Leads header filter and row status picker anchor to their trigger's left
edge when space permits, clamp/flip to viewport bounds, and use shared dropdown
material and X/Y padding. New aesthetics/ui/lead-stage-menu.js retains the native
select and its authenticated save/rollback handler. Picker keyboard arrows,
Enter/Space, Escape/focus return, scrolling and actual status persistence are tested.
Padding debug remains active-field-only and preview-only.

## Changed paths

Aesthetic gallery: gallery.js/css, finishes.js, restore-controls.js,
surface-editors.js, table-cell-editor.js, typography-usage.json and gallery HTML.
Shared runtime: typography-controls.js, admin-systems.js/css, lead-stage-menu.js.
Admin/Outbound: backend/status.html, outbound.js; served HTML cache version refs.
Server validation: docs/server/design-config.mjs; hosting cache rules: firebase.json.
Regression: component-gallery, admin-systems-ui, outbound-ui, lead-filter-ui,
crm-failure-ui, design-config/contract and app-regression. AGENTS/design/requests/
fixes/COMMIT-REVIEW reflect this task. No secrets or production environment changed.

## Validation

Passed full app-regression (including gallery eleven widths and Admin hover seven
widths/short landscapes); Outbound populated filters, status picker saved change,
shared padding, seven widths and keyboard/scroll/fallback; canon 11 pages/7 widths
320–1920; CRM 10,000-contact UI, failure/account isolation and 19 intelligence
checks; design schema/contract and container contract through full regression.
Source syntax and git diff checks passed. All operational providers/auth are fixtures.

Test Node: /Users/fromsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.
Loader: /private/tmp/maya-audit-loader.mjs. Both PW_CHROMIUM and CHROMIUM_PATH:
/private/tmp/maya-audit-browsers/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell.
Isolated browsers use local fixtures, never personal Chrome. Temporary test runtime
is not a deployment requirement. Logs: /private/tmp/maya-*-audit.log.

## Exact next step and remaining live verification

Fromsa pushes this local commit from GitHub Desktop; Cloud Build can deploy it.
Then verify release.json matches that commit and live authenticated Save/provider
cards/status dropdowns. User approved MAYA Chrome session access this turn, but
Chrome tab binding was unavailable. Automatic review rejected broad Google Chrome
app access because it could expose another profile/window. A narrower window/profile
inventory permission request is pending; no personal Chrome page was inspected.
Actual Gmail mailbox connection and Gemini/image inference remain unverified here.
No OAuth grants, credentials, client messages, production saves or env changes ran.

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
