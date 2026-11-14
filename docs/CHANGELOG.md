# MAYA history

Git is the detailed change history. This file records meaningful milestones only;
old request, incident, handoff, research and repeated version histories are archived
under _to_delete/2026-11-05-cleanup for owner review.

- **November 13 — fix visible legacy garments in CLO:** resolve the same
  saved-piece-N IDs and saved image variants used by the Brief, eliminating false
  “Choose a garment” errors without requiring Pattern Start. Preserve CLO/Pipeline
  on garment changes and exclude optional-panel fields from pattern input locking.
  Center CLO content and add a CI fixture using real saved-input lookup and an
  explicit CLO search before any pattern is generated. The previous favorites
  release `28129f9` passed Google deployment build `c8707412`.

- **November 13 — CLO favorites and preview release correction:** replace the
  single-selection heart with multiple durable favorite snapshots and a Favorites
  filter, preserving existing selections and saved results per submission/garment.
  Cover fresh-client restoration, scoped favorites and retained historical assets.
  Build `c5db3d19` blocked `223ca71` on phone viewer height; fix the dense-dialog CSS
  specificity conflict while retaining the full-viewport CI assertion.

- **November 13 — consolidate Backend and repair CLO previews:** move CLO 3D into
  the current pattern frame through an optional panel lifecycle. Separate gallery
  styles and preview scope from pattern/fabric state; expand sourced photos in the
  parent viewer, retain healthy images and fall back only to evidenced alternatives.
  Remove Backend 2's page, assets, route, Admin link and compact fabric rail. Migrate
  the active Aesthetic Control sample and CI geometry checks to the current Backend.
  Add runtime coverage for preview replacement, teardown and stale scope messages.

- **November 12 — frontend regression repair:** restrict photo descriptions to
  image cards, restoring single voice labels, and move white captions down 4px.
  Refresh Favorites after delayed project restoration and recover hidden failed
  photos while retaining healthy media. Bind visualization preparation to the
  latest description and isolate each render's consumed references so newer
  speech remains on the board. Preserve the drawer and backend layouts. The full
  Node20 code-only gate passes with speech/render/Favorites regression fixtures;
  no local browser or live provider calls.

- **November 12 — original fabric release correction:** fix CSS specificity so
  shared Inner padding cannot override edge-to-edge square fabric cards. The
  Google browser gate caught the conflict and blocked deployment of `13a7370`;
  keep its geometry assertions and Backend 2 styling intact.

- **November 12 — original Backend consistency:** four square fabric columns
  (two on phones), white Community-style hover captions, one Submissions/Settings
  drawer across Brief and Operations, Pipeline with a running indicator and SVG
  export in Settings. Align the screen indicator border and move it left. Restore
  frontend saved-heart visibility, white copy and matching line spacing; shrink
  desktop action bubbles 25% while preserving touch targets. Backend 2 unchanged.
  The preceding release `0ddef69` passed all Google deployment/verification gates.

- **November 12 — demo release diagnostics:** the first full frontend build
  stopped on the UI subprocess's old two-minute deadline, after code and fabric
  checks passed. Give the expanded UI gate a bounded five-minute budget with
  twelve-second individual waits and section progress; preserve all assertions.
  The prior public release remains active until deployment verification succeeds.
  The next build exposed a desktop fixture with no overflow; add temporary probe
  tiles so its existing moving-controls assertion exercises a real scroll at
  every width. Owner will check the next deployment without continued polling.

- **November 12 — frontend demo polish and performance (local):** unify hover
  descriptions with Community typography/tint, restore square fabric cards and
  balanced wall insets, center project labels, align card controls, and narrow
  Design Notes with swipe dismissal. Retain account-bound Pinterest pages and
  preload the first page; reuse fabric/viewer/Community images and batch drag
  paints. Cancel imports and clear private retained views at identity boundaries.
  Add working previews and consolidated count/race/gesture regressions. Local
  fixture counts distinguish reduced work from unmeasured live latency/FPS. The
  complete Node20 code-only gate passed; no browser or live provider calls.
  Presentation acceptance and Push remain pending.

- **November 12 — square sourcing and interaction fixes (local):** move Backend 2
  fabric controls into the leading scroll rail, use square hover-caption cards,
  smaller corner actions and a shorter strip. Align the title numeral. Request
  source-backed CLO images explicitly and retain thumbnail fallbacks; use square
  CLO cards without silently researching old results. Restore truthful pipeline
  phase states and replace competing drawer swipe handlers with one scoped,
  cancellation-safe gesture module. Extend functional previews and regressions.
  Node20 code checks pass; no local browser, paid search, Push or deployment.

- **November 12 — original Backend aesthetic pass (local):** put Pipeline Live
  and retrieval details in a Logic tab between Mark 1 and SVG without resizing the
  pattern frame. Keep Logic selected during runs and hydrate the saved drawing for
  direct SVG selection. Match compact P3/Glass toolbars, release pointer focus,
  restore the white page dot and square fabric photos, tighten heart/X spacing,
  and remove Brief Settings' extra dark surface. Update working previews and
  consolidated regression checks; preserve Backend 2. Full Node 20 code-only gate
  passed. No browser or live provider used; owner visual acceptance and Push
  remain pending.

- **November 12 — CLO live verification:** release `006c575` passed full CI,
  Cloud Tasks setup, Cloud Run/Hosting deployment and all seven public release
  checks. A real queued search saved two sourced CONNECT assets. Existing enqueue
  and actAs permissions sufficed; no broader IAM grants. Resolved preview sizing,
  iframe coordinate test and slim-SDK interpreter issues before release.
  Owner visual and match-quality review remain distinct from automated evidence.

- **November 11 — compact Backend 2 and CLO rollout:** remove nested outer
  panels, tighten controls to 5px vertical padding/9px text, thin the fabric strip
  and cards, and order drawer Submissions/Bio/Settings using shared materials.
  Add server-side upload sourcing, concurrent-finalization protection and 25MiB
  references. Add owner-authorized scoped Cloud Tasks provisioning and a one-time
  real-submission release check; no local browser or account-profile access.

- **November 11 — CLO sourcing in Backend 2:** add Pattern / CLO 3D / Pipeline
  tabs and a source-backed CONNECT gallery, OpenAI ordering, filters, private
  selections and dismissals. Add canonical saved-input research, generation
  guards, durable paid-call claims, submission-ready and dissection triggers,
  plus a dedicated OIDC Cloud Tasks adapter. Queue activation remains owner setup;
  interactive searches use the existing OpenAI connection. Replace the old Plan B
  proxy/ranker with the shared component. Add Aesthetic Control previews and
  consolidated storage, authorization, race, deadline and DOM checks. No Push,
  credential changes, native file downloads or local browser testing.

- **November 11 — Backend 2 review and model tiers:** fix pending Full view and
  submission navigation races, scope mirrored Settings to the current operation,
  synchronize save errors/history while typing, and keep engine settings in the
  parent drawer. Fix source-card action overlap, short-strip access, preview
  clipping and circular tabs. Upgrade logic defaults to Terra/Sol 6.1 with Luna 6
  for routine work; update CRM OpenAI pricing and parameters. Route legacy image
  clients to Flare 2.6 without retry or altering reference bytes. Preserve owner
  overrides, admin gates, budgets and existing chat entitlement fallback. Node20
  code-only release checks pass; CI geometry coverage extended. No Push, Chrome,
  live provider inference or claimed visual acceptance.

- **November 11 — CLO asset sourcing research:** document desktop and CLO-SET API
  inventory, distinguish CONNECT marketplace coverage from account libraries,
  inspect the existing Plan B proxy, and propose OpenAI-selected digital garment
  references with durable submission jobs and private evidence-backed research.
  Runtime behavior and provider configuration are unchanged.

- **November 11 — Backend 2 playground and studio fabrics:** add a separate
  single-screen Backend 2 entry under MAYA, preserving the original Brief layout.
  Combine Full view/dissected images, Mark 1/Pipeline and a horizontal fabric strip;
  move Bio, Submissions and engine-backed Settings into three circular drawer tabs.
  Restore the original Backend's screen indicator. Add shared durable Global and
  In House fabric favorites, with hearts left of X, optimistic concurrency and
  failed-read protection; keep private research and selections separate. Order
  Admin Users and traffic → Ad campaigns → Leads and unify collapsed fold spacing.
  Add active Aesthetic Control previews, non-browser DOM/storage tests and CI
  geometry checks. Node20 code checks pass; owner visual acceptance and deployment
  remain pending. No Push or live provider calls.

- **November 9 — stable Operation Room and retained drawer:** align inner/outer
  frames across empty/running/saved states, center the paired garment controls,
  balance header spacing and match Mark One/SVG to P3/Glass. Move Pipeline Live
  into the reference section and use a plain Retrieval Trace heading. Constrain
  the shared delete dialog to a centered 420px popup. Reuse the account-bound
  submissions feed and decoded photos; revalidate without clearing the drawer,
  preserving failure, account and deletion guards. Extend runtime and CI checks.
  Constrain nested grid tracks so intrinsic image widths cannot overflow mobile
  panels. Keep install output bounded so Google attaches actual release-test failures to
  GitHub rather than truncating them behind dependency logs. Preview frame checks
  use panel-relative coordinates so scrolling to Start cannot create a false failure.

- **November 9 — compact workspace and first-action autosave:** move Start beside
  the garment selector, fit pattern frames to raster height and remove Operation
  Room Fabrics. Keep Brief Fabrics, 34/66 proportions and garment panning. Project
  action circles are spaced and scaled through shared controls with active previews.
  Photo-only projects enter the drawer after their first acknowledged save; text
  and microphone use also start autosave. Guard late list updates and inline rename,
  and run independent media uploads together. No local browser access.
- **November 9 — loading and responsiveness:** preserve loaded Fabrics on reopen
  and tab switches, bound and clear private photo retention, share public catalog
  and concurrent private reads, retain unchanged Favorites images, avoid unchanged
  CSS reapplication and duplicate focus requests, and scan only newly added image
  subtrees. Design Notes positioning is frame-coalesced. Current dimensions and
  Aesthetic Control settings are unchanged; regression and CI coverage extended.
- **November 8 — owner feedback:** Global Fabrics confirmed working
  by Fromsa. Restored 34/66 Operation Room panels, centered garment panning and a
  single dropdown chevron; section snapping and normal vertical wheel scrolling.
  SVG tracing is on-demand in a cancellable worker, with size/time bounds.
  New versions make only Mark One; pocket construction and CUT 1 labels are
  explicit. Full View/Fabrics toggles, outside-click collapse and matched toolbar
  heights/order are corrected. Submission hover captions preserve frontend text;
  X moves slightly toward the top-right. Shared previews and asset versions updated.
  Non-browser verification and owner visual review are recorded in README.
- **November 8 — retire Vercel references:** removed obsolete source comments,
  historical folder listings and deployment guidance. No active provider config,
  functions, analytics scripts or dependencies remain in the repository. External
  project/GitHub disconnection is pending Vercel account access; no provider-side
  deletion has been performed. Firebase/Cloud Run deployment is unchanged.
- **November 8 — Google deployment verified:** repair commit 9917a90 passed all
  eight steps in build 69389664-ccb2-4bdb-aea0-b2fbb7beb8af. Independent HTTP
  checks confirmed the same full commit on release.json, API health, frontend,
  Admin, Brief and the Operation Room workspace. Previously blocked changes are
  deployed; owner visual and interaction review remains pending. Corrected the
  stale documentation that still described the repair as unpushed.
- **November 7, deployment repair — deployed November 8:** Google Cloud Build logs
  confirm c28322e and 05a186c failed the Fabric UI fixture before any deployment.
  Corrected the refresh wait and missing recovery callback without skipping tests.
  Every app HTML page now has a build stamp; the pipeline verifies six public
  Hosting/API endpoints after deployment. Code-only and full CI checks pass;
  owner visual acceptance remains pending.
- **November 7 — 05a186c, pushed; deployment failed:** flush pending pattern
  settings before garment changes; retain failed drafts and lock settings during
  hydration. Acknowledge identical settings-only retries. Preserve loaded Fabric
  photos through Refresh and late price/caption updates. Added code regressions
  and updated the CI refresh check; owner visual acceptance remains pending.
  At that time Hosting and API still reported a71964a; the deployment audit above
  identifies the failed release fixture.
- **November 7 — c28322e, pushed — Operation Room version 2:** narrower garment
  column, centered pattern canvas, parent-page scrolling and trimmed controls;
  fullscreen-only inspection with a 35% larger lens; card-centered Glass Design
  Notes. Exposed pattern inputs and room version history. Pattern passes, settings
  and research now persist in submission folders with generation/deletion guards;
  Start reopens saved work and New version explicitly generates. Fabrics keeps both
  item/section selections, accepts footwear, retains cited source links without
  photos, remembers removals and exports per-submission CSV. One OpenAI search
  remains the only sourcing engine. Code-only checks pass; live provider and owner
  visual/interaction acceptance remain unverified. Deployment failed its Fabric
  session-renewal fixture.
- **November 6 — a71964a, pushed:** centered delete confirmation, drawer-only
  Brief deletion, smaller adjustable hover controls, deduplicated Design Notes
  drawer and shared fullscreen magnification/pinch zoom. Separated Fabric tab
  status and retained sourced incomplete results. Non-browser checks passed;
  Chrome is prohibited and Fromsa owns final visual/interaction acceptance.
  Global's live failure is still unconfirmed, not declared fixed.
- **November 6 — 9a8bfce, deployed:** replaced five Fabric modules and
  the fabric-only router with one direct OpenAI image-search adapter, up to ten
  source-linked photographs; preserved private favorites and cancellation. Bundled
  Fabric details, flattened knowledge assets, retired empty CLO manifest and old
  feed/rank/generated-swatch APIs. Corrected physical page order and removed the
  deferred home reset; browser checks now exercise actual navigation.
- **November 5 — f8eadbd, pushed; deployment failed the indicator test:** submission delete controls and
  captions, page-dot ordering, circular frontend logo, Glass controls/share dialog,
  immediate single-flight sharing and parallel image copies, iPad gallery sizing
  and phone header alignment. Deleted submissions stay hidden across server caches.
  Consolidated repository/docs/checks, moved assets under docs and API under backend,
  merged Privacy/Terms, retired WR and standalone Operations (Brief retains it),
  removed preset headshots. Deployment acceptance was not reached.
- **November 5 — f6426d6:** automatic avatar persistence, photo-only visualization,
  shared larger touch controls, shorter speech-tail handling, bounded image-reference
  preparation and phone/iPad layout checks.
- **November 5 — b7ccf5d:** GPT Image 2.6 Flare for generation and editing.
- **November 5 — 42622c7:** removed on-page reporting and duplicate Fabric loading
  copy; repaired private Fabric resets/refresh.
- **November 4 — bb7c678 / 3663a5d:** Admin simplification, shared submission photo
  cards, Global renamed and matched to the In House layout.
- **October 27:** Outbound retired; independent Leads, Messages, callback alerts and
  owner phone/SMS retained. Private external provider cleanup remains owner-managed.
- **Earlier:** Cloud Run/Firebase replaced the legacy deployment; private client
  projects, independent shared images, generation-checked saves, public Community,
  atelier Brief and shared Aesthetic Control established.
