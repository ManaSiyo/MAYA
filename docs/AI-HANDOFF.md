# Current handoff — October 18, 2026

## Current task and release state

Owner screenshot review: persist Leads filters, govern checkbox/scrollbar styles,
retire redundant dashboard sections without losing prompting settings, restore
embedded Brief/Operations navigation and Fabrics placement, repair Settings
readability, and investigate slow loading. This supersedes the earlier prohibition
on aesthetic changes for these requested surfaces.

Main screenshot repair a62431164cdb0d7fc319c39dd516bbfb446eb0ab deployed successfully:
Cloud Build fe6e037d passed all 68 gates; exact Firebase/page/API SHA, 11 assets,
six pages and signed-out phone/desktop checks passed. Local full regression had
639 named checks plus imported assertions. Initial baseline was 7533e38.

Final live visual inspection then caught a standalone phone stacking issue:
page header (z50) painted over Settings (z40), despite passing computed styles and
bounds. The current follow-up raises Settings above the header, exposes its shared
Glass Close settings control, hides the background hamburger and removes obsolete slide logic.
It preserves active input focus on repeated/delayed open requests and restores focus only
after the opener is visible. Paint hit-tests and real close-click/keyboard checks
now cover the actual overlap, including the existing embedded workspace.
All 68 exact release commands and full integrated regression (639 named checks
plus imported assertions) pass locally for this follow-up. Gallery passes eleven
widths; final standalone authority passed. Follow-up b621e5051c04d128eb4f010a17f8df139c153a7b
is pushed; its Cloud Build is running. This documentation-only follow-up adds no
visible UI. Verify the eventual published HEAD against release.json, page stamps
and /api/healthz; Vercel success is insufficient.

## Implemented screenshot repairs

- backend/status.html: validated local Leads status preferences keyed by authenticated
  Google subject, including an empty filter. Reload and same-account renewal retain
  choices; account changes restore that account's choices. The six status choices remain one vertical list. Storage denial retains
  immediate filtering but cannot promise persistence.
- Prompting and Architecture dashboard folds, dead editor SDK/startup/CSS and obsolete
  gallery usage previews retire. Feature Requests and Recent Changes remain. Complete
  retired editor fragments/logic are backed up in _to_delete/admin-dashboard-retired-
  2026-10-17 (Hosting-excluded). Live config/prompting and private draft documents,
  Firestore rules and App/Playground rendering readers remain unchanged. There is no
  replacement Admin prompt editor; current live rendering directions remain active.
- Shared optional checkbox/scrollbar schema: design-config.mjs, presentation-runtime.js,
  typography-controls.js, gallery/input-controls.js and component previews. Old saves
  normalize without writes. Dark empty unchecked boxes, centered indicators, keyboard,
  mixed/disabled and forced-colors states; saved geometry/colors. Scrollbars default
  to transparent tracks. Explicit content scrollers use data-maya-scrollbar=visible;
  intentionally hidden navigation retains its native hidden-width/display contract.
- backend/backend.html: fixed shared H1 changes Backend/Operation Room with scrolling.
  Remove duplicate Operation Room subheading and Brief pill; active-room hamburger
  opens Settings via same-origin/source-checked bridge. Embedded room fills viewport
  width; preserve selection/results across navigation. Fabrics sits next to Full view
  and garment controls, opening the same inline viewer.
- backend/operations.html: Fabrics beside view controls; Measurements opens/focuses
  actual Settings. Settings and shared gallery Drawer use Edit dropdown backing,
  border/radius/padding, retaining overlay blur/saturation. Measurement/Logic fields
  explicitly follow P1/Editor and warnings P3. Closed Settings is inert; its source-checked state bridge toggles the fixed hamburger; Escape restores
  focus and Tab wraps actual native focusable controls. Deferred samples cannot replace pending uploads or active runs; actual visible
  keyboard targets include the visible shared Close settings button. Bright pattern fixtures cover
  the previously missed contrast failure.
- Removed obsolete full-size fabric-photo warmup (~23.77 MB of originals). Sandbox
  sample images load asynchronously with run/account/upload-intent guards only on standalone non-submission Operations;
  saved work/embedded Operations never downloads these unused samples. Actual loader,
  original assets and legacy/local-folder compatibility remain intact.

## Verification and evidence

Focused checks pass: account/reload filter, active prompting readers/races, new
checkbox/scrollbar and Settings Save/Restore/propagation, component gallery, workspace
previews, design schema, Brief/Operations six widths/default and different saved
settings, scoped storage failures and no paid generation on reads. Full integrated
and all 68 exact release checks pass; standalone aesthetic-authority must run last
before commit/handoff. See COMMIT-REVIEW.txt for recorded validation.

New gates: tests/operation-controls.mjs, tests/admin-status-preferences.mjs and tests/input-controls-ui.mjs in
Cloud Build/app-regression; input-controls is also imported by final authority.
Existing admin-prompt-saves now executes active App/Playground readers, never backup
code. Changed role inventory regenerated with typography-role-usage.py (15 H1 uses).

Isolated cold-load comparison, 4 Mbps/50 ms, baseline 7533e38 vs actual repaired tree:
27.15 MB / 54.45 s full load -> 2.76 MB / 5.65 s. Embedded Operations first contentful
paint ~7.62 s -> 1.48 s. Brief first paint remains ~0.3 s. Public CDN modules mirrored
locally; fonts/GSI/API/analytics blocked, no real account/providers. This proves
bandwidth waste, not a universal production latency promise. Traces:
/private/tmp/maya-load-waterfall-results.json, maya-load-variants-results.json and
maya-ui-current-load.json. Bright Settings/phone/desktop screenshots are in
/private/tmp/maya-room-settings-{default,saved}-{390,1440}.png.

Platform references: MDN scrollbar-color documents that a non-auto inherited
standard color disables WebKit pseudo-element styling; runtime resets color for
that branch. scrollbar-width exposes native thin/auto fallback. Exact pixel width/
thumb radius uses Chromium/WebKit. Firefox/Safari engines were not run. MDN inert
supports excluding closed settings from interaction/accessibility.
https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-color
https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-width
https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert

## Preserved safety and prior repairs

Sealed account/submission/garment scope, original photo/client words, source-backed
seller facts, qualified matching and private generation-checked lookbooks remain.
Per-garment fabric fingerprints prevent a coat's material entering pants. New
pieces have UUIDs; legacy IDs remain readable. No uncertain mutation is replayed
automatically. Serialized writes/reconciliation and cancellation remain intact.
Brief saves require reviewed generation, reject stale/missing reviews (409/428),
fail on unreadable state, retain oversize 25 MiB drafts and publish exact acknowledgements.
Project saves coalesce only covered versions, preserve later edits and account identity.
Operations Logic/measurements keep scoped memory/keys and truthful storage errors.
Owner SMS SEND gates, STOP/recipient revalidation, non-retryable claims and archives
remain. Current message-stress has 44 passing transport invariants; synthetic founder
corpus is not model semantic accuracy. No private production messages/calls were sent.

## Open limits and exact next step

Functional/release/smoke and default/saved screenshot checks have passed. The
behavioral repairs and retired-editor backups are committed and pushed. Run the
shared Aesthetic Control authority last for this documentation-only correction,
commit and Push under existing authorization, then await Cloud Build success for
the resulting HEAD. Verify release.json, page stamps, API SHA and public asset
bytes, then repeat the live authority and inspect the phone/desktop Settings
screenshots. Update deployment state only from evidence; fixtures do not prove it.

No personal Chrome access this session. Private fur/green-pants demo, actual logged-in
production acceptance, owner/carrier delivery and live audio/model quality remain
unverified. Never borrow browser credentials. Credentials, billing, provider setup,
production environment and stored prompting configuration were untouched. Remaining
cold-load costs include the ~2 MB shared background and eager 3D/export modules;
these were measured but not redesigned in this focused screenshot repair.
