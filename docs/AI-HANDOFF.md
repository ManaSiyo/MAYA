# Current handoff — October 17, 2026

## Current task and release state

Owner screenshot review: persist Leads filters, govern checkbox/scrollbar styles,
retire redundant dashboard sections without losing prompting settings, restore
embedded Brief/Operations navigation and Fabrics placement, repair Settings
readability, and investigate slow loading. This supersedes the earlier prohibition
on aesthetic changes for these requested surfaces.

Starting release 7533e384d43a017cc0f6ad8fbb4b3bb911667668 was verified on Firebase
and Cloud Run after Cloud Build 2b0e2211 succeeded. The earlier 1b3c01a build failure
was a test timeout leaking into later scenarios; 7533e38 fixed only that fixture.
The screenshot-review source below is release-prepared: all 68 exact Cloud Build
Node commands, full integrated regression (639 named checks plus imported suites),
real-server smoke, pinned npm ci and gallery/syntax/diff checks passed. Standalone
Aesthetic Control runs last before commit. Push is explicitly authorized. This
pre-commit manifest does not establish deployment; read release.json/page stamps
and /api/healthz against the published HEAD. Vercel success is insufficient.

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
  keyboard targets exclude the hidden standalone close button. Bright pattern fixtures cover
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

Functional/release/smoke and default/saved screenshot checks have passed. Run
standalone aesthetic-authority last, commit only task files (force-add exact backup
files), then Push under existing explicit owner authorization. Verify Cloud Build success,
release.json/page stamps/API SHA and changed public asset bytes. Update release state
only from evidence; local fixtures do not prove deployment.

No personal Chrome access this session. Private fur/green-pants demo, actual logged-in
production acceptance, owner/carrier delivery and live audio/model quality remain
unverified. Never borrow browser credentials. Credentials, billing, provider setup,
production environment and stored prompting configuration were untouched. Remaining
cold-load costs include the ~2 MB shared background and eager 3D/export modules;
these were measured but not redesigned in this focused screenshot repair.
