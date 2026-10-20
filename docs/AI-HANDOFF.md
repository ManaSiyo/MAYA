# Current handoff — October 20, 2026

## Current task and release state

Implement the October 18 owner screenshot review. The deployed baseline is
4b4867f5f8d310ca32467414eedbf8b1d03d7c63: its Cloud Build 8e6a9a47 succeeded
October 18, and exact Firebase release/page/API commit, assets and live screenshots
were verified. This release candidate contains the cleanup below. Its deployment
state must be established from the exact current commit and live markers, not
from a pending/success label in this preparation record.
Existing explicit owner authorization covers local commits and automatic Push.
A push can deploy production; never infer success from Vercel.

## Current implementation

- Deleted Playground's served implementation and all Affiliates view/loader/nav.
  Permanent legacy-path redirects go to MAYA/Admin. No staged experiment is
  promoted; active client pg* filing-cabinet functions and shared APIs remain.
  Old tests now exercise the active frontend. The duplicate legacy Operations HTML
  is also removed; its aliases redirect to /operations.html and shared knowledge/
  CLO/sample assets remain intact. Historical docs are labeled;
  third-party legal references and legacy migration/data paths remain.
- Every real hamburger drawer is governed by data-maya-drawer and independent
  validated shared drawer settings. Defaults follow MAYA's navy/gradient material,
  with active Drawer Edit/Restore/usage preview. Field Editor, panels and tables
  stay independent. All hamburgers share glyph color/weight/size settings.
- Removed Operations pipeline subtitle and duplicate Measurements trigger/form
  from Settings, plus the Brief Operation Room scroll pill and Saved metadata.
  Saved projects read actual Brief measurements (inch/cm/mm normalization), never
  browser drafts or example numbers. Standalone uploads keep a separate manual
  entry panel. Brief name/date share H3 on one row; Biography/Vision use white P2.
- Embedded Settings temporarily fills the actual parent viewport, including a
  partly scrolled room, without reloading/reparenting its iframe. Close restores
  exact scroll, selected garment, run/results and focus. Shared material is tested
  over a white pattern. Remove obsolete mobile adapter geometry overrides.
- Full view, dissected view and inline Fabrics retain identical dimensions. Five
  initially enabled filters: Local (Bay Area: Britex/Stonemountain/Harts), Mood,
  Swatchon, Amazon and Others. Filtering is free and preserves drafts; Refresh
  explicitly searches the current group scope. No new paid calls on toggles.
- Fabric cards have no Save/Use actions or verbose hover text. Verified price/unit
  captions wrap. Private historical Favorites/material assignments remain readable;
  Remove preserves serialized/CAS/account/submission/fingerprint guards. Swatchon
  product links/photos are seller-backed; missing price units/stock stay unknown.
- Scrollbars use shared v2 settings: 4px both axes, half-length painted native
  handle, transparent track and 800ms idle hiding. Earlier saved widths halve
  once on read, without a migration write. Native drag/keyboard behavior remains;
  forced colors restore a native handle. Firefox keeps its native handle length.
- Active segmented preview changes its real selected state/content and opens the
  Glass editor. Fixed preset specificity, immediate editor dismissal and a
  detached Restore. Editing another control preserves an unsaved Drawer preview.
- Removed automatic hover snapshots and submission metadata overlays/native
  title tooltips. Named keyboard links still open the scoped Brief. API/Image
  configuration remains an explicit authenticated click/keyboard action. Gmail
  titles use white P2 and Account mailboxes gray P1. Narrow shortcut menus and
  submission tiles cannot pan the whole Admin page on keyboard focus.

## Files and verification

Shared runtime/components/gallery: presentation-runtime.js, typography-controls.js,
pill-runtime.js, maya-canon.css, components.*, gallery.js, shared-surfaces.js,
input-controls.js, finishes.js, surface-editors.js and workspace-previews.js.
Pages: frontend/index.html and backend/{status,backend,operations,outbound}.html.
Fabrics: shared fabric-assistant.js/css and docs/server/fabric-search.mjs.
Routing: docs/firebase.json. Retired playground/index.html is deleted. Role usage
is regenerated with typography-role-usage.py; retired uses are no longer counted.

Focused checks passed: fabric search 34, sourcing 12, AI routing 9, browser fabric
and historical-favorite workflow; real Brief/embedded Settings geometry and saved
material; standalone save failures/keyboard; actual no-hover Admin configuration;
retired-page navigation/submission keyboard; shared input Save/failure/Restore and
idle scroll behavior; client voice with default/saved actual Drawer material.
All browser work uses isolated Chromium, fake accounts/providers and local files.
Pinned npm ci and smoke passed. Full integrated regression passes all 607 named
checks plus imported behavior assertions. All 71 exact Cloud Build Node commands
pass locally. Default/different saved phone/desktop screenshots were inspected.
Run standalone Aesthetic Control authority last after final documentation, before
commit/Push; do not infer deployment from this preparation record.

New release gates: retired-workspaces.mjs, retired-workspaces-ui.mjs and
component-gallery.mjs. Final aesthetic-authority re-executes changed visible
fixtures, including retired UI and explicit model details, after functional gates.
The exact Cloud Build list now has 71 Node commands.

## Open limits and exact next step

Preserve strict assertions. Run standalone aesthetic-authority last after these
final records, commit only task files and Push under existing authorization. Wait for the exact Cloud Build, then verify
release.json, page stamps, API commit, changed asset bytes and retired redirects.
Run final live shared-surface authority and inspect actual phone/desktop images.

No personal Chrome, credentials, provider/billing settings, production environment,
private owner data, live SMS/calls or paid generation were accessed. Private
fur/green-pants matching and real audio/provider acceptance remain unverified.
Public live appearance checks cannot substitute for private matching quality.
See FABRIC-SEARCH.md for source-backed merchant facts and retained data guarantees.
