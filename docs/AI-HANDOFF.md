# MAYA handoff — October 1, 2026

## Release status

This task began clean at 259c824, matching origin/maya-v2. Earlier owner
conversation and SMS access commits are now pushed by the owner; production
release was not rechecked here. Do not infer live deployment from origin.
This Aesthetic Control update is local only. No push, production design Save,
real text/call, credentials/environment change or Chrome access occurred.

## Current prepared change

Visuals is first: Glass Panels and Tables is one dropdown. Glass Section holds
preset buttons, material/padding controls, icons, five distinct pill colors and
collapsed states. A divider separates Panels, with independent controls,
surface previews, working drawer/filter dialogs and a populated table.
Remove glossary, email-history/status reference lists, page descriptors, usage
rows, source inventories and font-comparison copy from the UI. Evidence files
and the retired style-reference module remain unlinked maintainer resources.

Typography has one sample and one Edit beside each H1–H4/P1–P4. H3 previews
Campaign details with Lead Station context. Font offers Jost/Cormorant; Case
Normal/ALL CAPS. H1 defaults uppercase, H2/H3/H4 Normal, P3/P4 uppercase and
P1/P2 Normal. Normal preserves authored text while overriding CSS uppercase.
Font/case are validated enums, optional for older saved designs and completed
with role defaults on read. No production migration write is needed.

Preserve Centered/Left controls and the separately adjustable editor rectangle.
Neutral paragraph/label/caption colors and shared family/case settings now
actually apply to mapped roles; status colors and technical monospace remain.
Shared buttons and icons receive saved glass fill/rim/frost/tint/highlight.
Gallery finish samples retain their separate local preset styling, and panel
controls affect separate surfaces/table. Padding is moved into Edit glass;
the preview-only fallback toggle and detached Fine adjustments area are removed.

Changed paths: aesthetics/aesthetic-control.html; gallery.js/gallery.css,
finishes.js/overlay.js; aesthetics/ui/typography-controls.js; server/design-config;
tests/component-gallery/design-config/design-contract/app-regression; design,
README, AGENTS, requests/fixes/handoff/commit review. All 11 served HTML pages
bump typography runtime to v3; editor CSS/JS bump to v16. Existing Hosting
no-cache policy continues. No served page moved or URL changed.

## Validation and preview

Passed design-config and design-contract (legacy compatibility, enum rejection,
shared runtime); component-gallery (single-row roles, five unique colors,
working material/panel controls, font/case/color, alignment/housing, local
Save/reload, shared Admin/client/Outbound application, authenticated save fixture,
seven widths 320–1920px with editor open); full app-regression; local server
smoke; edited JavaScript syntax and diff checks. Browser fixtures use isolated
headless Chromium and fake provider/auth data. Google web fonts are blocked in
fixtures, so live font loading/rendering still needs owner review.
Screenshot reviewed at /private/tmp/maya-typography-controls.png.

Local preview: http://127.0.0.1:8767/aesthetics/aesthetic-control.html.
An existing loopback server returns the updated v16/v3 HTML; Codex browser
opening was queued. No user Chrome is involved. If the server stops, restart
with the bundled Python http.server bound to 127.0.0.1, repository as cwd.

Bundled Node: /Users/fromsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.
Resolver: /private/tmp/maya-oct1-loader.mjs maps express, Playwright and bundled
WebSockets. Chromium: /private/tmp/maya-pw-browsers/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell.
Temporary runtime files are not deployment requirements; CI installs dependencies.

## Exact next step and open risks

Do not push without Fromsa's explicit request. Completed verified work is
committed locally so only owner Push remains in GitHub Desktop. Review the
preview, push when desired, then verify Cloud Build and /release.json. A live
Admin Save is needed to persist owner-selected values across shared pages;
no live save was performed. Older designs get new role font/case defaults on
read, so check default capitalization after deployment as well as saved edits.
The runtime changes text/material presentation and does not change account
boundaries, data, communication behavior or permissions.

Owner SMS access from 259c824 still needs live verification: MAYA HELP, INBOX,
THREAD Nick, MORE pages, ACTIONS, normal memory recall and a separately authorized
client REPLY/SEND test. Explicit controls bypass inference; normal conversation
uses existing AI availability/$1 CRM text cap. Record history and actual carrier
receipt remain separate; prior discarded records cannot be recovered.
Gmail owner mailbox readiness, real Gemini inference, scheduler/booking/signup
alerts and live call audio remain owner verification items.

## Standing constraints

Before every Chrome session ask and wait for explicit session approval. Do not
use Chrome while Fromsa works in it. MAYA and Worldofsiyo profiles are separate.
Keep project/account data sealed; never touch credentials, billing, production
variables or legacy migration/Storage cleanup paths. docs/design.md is the sole
active visual specification. Root AGENTS.md preserves layout/checks. The approved
booking URL remains https://wix.to/wT2lSqE.
