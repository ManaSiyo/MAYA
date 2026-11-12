# MAYA

MAYA turns client references and an avatar into garment visualizations, favorites,
community designs and private atelier submissions. Admin manages submissions,
leads, messages and advertising. The Brief includes dissection, pattern work and
Fabrics; there is no separate public Operation Room or WR workspace.

## Source layout

| Location | Purpose |
|---|---|
| frontend/index.html | Client app: Inspo → Favorites → Community, drawer and sharing |
| backend/status.html | Admin at /status.html |
| backend/backend.html | Brief at /backend.html |
| backend/backend2.html | Separate Backend 2 playground at /backend2.html |
| backend/operation-workspace.html | Brief's embedded pattern workspace; direct visits return to Brief |
| backend/privacy.html | Privacy and Terms; old Terms URLs redirect to #terms |
| backend/verify.html | Public deployment check page |
| backend/server | Cloud Run API, storage rules and Maya's runtime instructions |
| docs/aesthetics | Shared visuals, fabric photos, UI modules and Aesthetic Control |
| docs/AGENTS.md, design.md | Working rules and visual canon |
| docs/CHANGELOG.md | The only maintained history |
| docs/check.mjs | One release-check command, with runtime/UI helpers |
| docs/build-site.mjs, firebase.json | Explicit public build and Hosting route map |
| _to_delete | Ignored local copies of retired code, for owner review |

Root cloudbuild.yaml and .firebaserc remain because the existing Google deployment
uses them. node_modules is dependency software, retained. .hosting is generated,
ignored output; it is safe to rebuild. Browser asset addresses remain
/aesthetics/* even though their sources moved into docs. Private documentation,
server code, test helpers and dependencies never enter .hosting.

## Hosting and deployment

Vercel is retired for MAYA. The source has no Vercel config, functions, analytics
scripts or dependencies; obsolete deployment comments were removed on November 8.
The external Vercel project/GitHub connection still requires account access to
remove. Repository cleanup alone does not stop that external connection's builds.

Project **pro-maya**, Firebase Hosting **maya.manasiyo.com** and **pro-maya.web.app**.
/api/** and /mcp rewrite to Cloud Run **maya-api**, region **us-west1**. Storage is
**pro-maya.firebasestorage.app**. The API uses its Cloud Run service account through
the metadata server; no personal browser session is needed for server Storage.

An owner Push of **maya-v2** starts the existing Cloud Build trigger. The branch
guard rejects other branches. The build installs pinned dependencies and
Chromium, runs `node docs/check.mjs`, builds backend/server with its locked
production dependencies, pushes the container, deploys Cloud Run, builds the
public tree with the commit stamp, deploys Hosting, verifies the live release, then
deploys Firestore/Storage rules separately. No credentials or provider environment
settings are changed.

Local commands (Node20 or newer):

```
npm ci --prefix docs
npm ci --prefix backend/server
cd docs && npx playwright install chromium && cd ..
node docs/check.mjs --code-only
node docs/build-site.mjs
```

After Push, compare the full intended commit in `/release.json`, the frontend and
Admin/Brief/workspace `maya-build` metadata, and `/api/healthz`, using
`node docs/check.mjs --deployed <full-commit-sha>`. The build runs this same public
HTTP check after Hosting deployment and fails on any stale or missing stamp.
Dependency installation prints only a failure tail, preserving room in GitHub's
attached log for the actual release checks. Inspect GitHub's commit **check-runs**,
including Google's `output.text` build log;
the combined status can omit a failed Google Cloud Build check.
Health's configured flags indicate
configuration, not successful inference/delivery. `/api/healthz/deep` is admin-only.

## APIs and providers

- **Google Identity / Firebase Auth:** verified identity and account isolation.
  Firestore owns client projects, private avatars and share records; Storage owns
  independent images and submissions. Admin access uses the server allowlist.
- **OpenAI:** text/vision via the protected allowlisted proxy, image generation and
  edits using **gpt-image-2.6-flare**, visual/text reasoning **gpt-6.1-terra**,
  senior pattern logic **gpt-6.1-sol**, and routine text **gpt-6-luna**. Realtime
  voice uses modality-specific configuration. Defaults and legacy tier aliases
  are centralized in server/model-config.mjs; owner-set environment overrides remain.
  Older image clients also upgrade to Flare 2.6 without a paid retry. Sol uses low
  reasoning; routine chat uses none. Current chat callers do not invoke tools;
  unsupported GPT-6.1 tool-chat requests fail before inference. Existing chat
  model-entitlement fallback to gpt-4o-mini remains, on model-shaped 400/404 only.
  CRM's OpenAI economy tier is Luna at $0.10 input / $0.50 output per million tokens,
  retaining cheapest-connected-provider selection and its combined $1 daily cap.
  Fabrics uses one Responses API image search through server/fabrics.mjs. Sourcing
  photographs are independent of the generated-image model.
- **Twilio:** SMS and calls, inbound signature validation, durable delivery/send
  claims. Messages sends and calls require explicit reviewed actions; accepted is
  not delivered. A text AI budget does not cap voice/images/provider invoices.
- **Wix / Google Cloud Tasks / Scheduler:** durable callback lead ingress and
  independent callback alerts. Wix JWT verification, exact installation/form
  scope, queue audience and OIDC identity remain enforced. Code deploy does not
  activate providers. OUTBOUND_SCHEDULER_* still authenticates callback workers.
- **Google Analytics / Google Ads / ChatGPT Ads / Meta:** Admin data integrations
  retain their existing account scope and configuration. No on-page setup dumps.
- **Stripe:** existing tips/checkout integration; billing unchanged.
- **Pinterest, fal.ai and Runway:** existing integration paths retained. Availability
  depends on owner-managed provider configuration; no paid call is retried silently.

Owner-only setup remains in provider consoles/Cloud Run: API keys, Twilio account
and phone, GOOGLE_CLIENT_ID / ADMIN_EMAILS, Wix verification settings, Task/Scheduler
identity and callback recipients. Do not print or change secret values. Callback
alerts use separate durable SMS/call claims; reconcile uncertain provider outcomes
before retrying. Retired Outbound OAuth/Scheduler/private objects and WR stored data
are not deleted by this cleanup.

## Data contracts

Client projects are users/{uid}/projects/{id}; avatars and indexes are private
user settings. Save/open/upload pin account generation and board identity. Project
flush reports failure before navigation; generation/revision checks prevent stale
writes. Shared images are copied into shares/{uid}/{token}; importing makes another
independent copy. Deleting the source cannot break the share or recipient project.

Atelier submissions live under submissions/{id}/ with submission.json ownership,
summary.json, dream-garment, one-pager and optional pieces.json. Admin-only deletion
writes deleted-submissions/{id}.json before removing that exact prefix. Read/write
barriers and late-upload cleanup prevent resurrection. Client originals and public
community designs are separate and are not deleted. A failed physical cleanup
remains hidden and can be retried through the same authenticated API. Warm feed
caches recheck tombstones across server instances before returning old cards.

Exact duplicates are presentation-grouped only when complete authored content and
owner/client/project evidence agree. No approximate destructive deduplication.
Fabric research and garment selections remain private to account/submission/garment, generation-checked,
and respect client exclusions. Saved dissection reads never generate missing work.
New private work is inside the submission prefix:
`patterns/{adminUid}/{garmentId}.json` contains settings, input snapshots and image
passes; `fabrics/{adminUid}/{garmentId}.json` contains research and dismissed URLs;
`fabrics/{adminUid}/lookbook.json` retains legacy bookmarks and garment selections. Legacy private lookbooks are
read without writes and copied into the submission only on an explicit mutation.
Deleting the submission removes its new work through the same tombstone barrier.
Studio Favorites lives separately at `private/fabrics/studio-favorites.json`, behind
Admin-authenticated GET/POST `/api/admin/fabrics/favorites`. It is shared by all
backend admins, independent of clients and garments, and survives submission
removal. Global and In House hearts save source bookmarks here. Generation checks
reject stale writes; failed reads never become empty replacement stores. Client
garment IDs, descriptions and selections are not copied into this shared library.
Existing private lookbooks remain readable and are not automatically published.

Lead stores use generation checks, deletion tombstones and bounded request receipts.
Private Messages overflow is archived before trimming; archive failure blocks trim.
Owner commands verify binding, recipient/STOP status and explicit SEND receipts.
The retained maya-character.md is useful: it supplies conversational behavior and
tool guidance, while server authorization is enforced separately. It cannot grant
itself permissions, reveal secrets or override send/account safeguards.

## Fabrics: one OpenAI search

backend/server/fabrics.mjs replaces five fabric modules and the fabric-only AI
router. MAYA sends the selected saved garment photo and client fabric preferences
to OpenAI's Responses API with web_search, image/text results, max_results: 10,
and include: ["web_search_call.results"]. One provider request, one tool call;
there are no retailer feeds, seller-page fetches, second ranking pass or paid retry.
The gallery reads image_result.image_url, thumbnail_url and source_website_url
from that tool payload directly. Cited source URLs also survive without images;
assistant prose cannot invent a photo or create an uncited source. Optional JSON
metadata enriches only those sourced URLs with OpenAI-reported material/relevance,
price/unit/currency and delivery wording. Unknown commercial facts stay blank.

This follows the [documented OpenAI image-search API](https://developers.openai.com/api/docs/guides/tools-web-search).
It does not reproduce ChatGPT's private implementation or promise identical speed.
OpenAI chooses the search and matches. MAYA keeps authentication, canonical saved
context, cancellation, source links and private favorites. Explicit excluded
materials discovered in later captions retract earlier cards and cached results.
These are sourced suggestions, not independently verified inventory or arrival
promises. Each explicit search asks for up to ten results. Previously saved links
remain until removed, rather than expiring or disappearing on a later search.
Photo cards use the In House gallery layout and two captions. A missing photo
leaves a compact usable source link. CSV exports all researched items in the
submission, including boots/accessories. Loading saved research never searches;
Refresh explicitly starts another search. Dismissals are persisted per item.
Named-shop searches use the same API with an explicit domain filter; they do not
constrain or replace the Global cache. Legacy feed/rank/generated-swatch APIs
return 410. Photo hosts can still fail; their sourced thumbnail is the fallback.

## Operation Room version 2

The original pipeline combines the saved dissected photo, garment vision
classification, shared construction rules, a reviewed piece list, submission
measurements, selected fabric and retrieved excerpts from Helen Joseph-Armstrong's
*Patternmaking for Fashion Design*, fifth edition. The bundled kb.js contains 929
passages and five garment grammars; it is extracted book content, not a fresh PDF
upload on each run. Jacket grammar specifies upper sleeve and undersleeve pieces;
these are editable assumptions, not proof that every coat needs a two-piece sleeve.

Settings now exposes garment category, piece list, grammar JSON, classification
prompt, construction direction, retrieval count, image quality,
waistband/underlap/yoke constants and an optional full drawing-prompt override.
The retrieval trace and saved run include the actual classification, chosen rules,
excerpts, measurements, prompt and generated drawings (including older saved passes). The existing
one-inch grid and lower-body dimension formulas are described in Settings. This
remains an experimental drawing workflow, not a cutting-ready pattern exporter.

New versions generate and save only Mark One, even with legacy multi-pass settings.
There is no automatic paid refinement. The cut list includes pocket components
identified by vision unless the owner explicitly overrides it; rendered left/right
parts each say CUT 1. Start reopens existing work; New version is the explicit new
paid run. Retry Save retries storage only.
Unreadable/conflicting saved work blocks replacement. Version history retains old
runs; changed garment snapshots are marked stale, never silently deleted. Stored
runs are bounded to 25 MB/100 versions per garment and research to 100 links/500
dismissals, with a visible failure rather than silent eviction at the limit.

## Current work

November 12 — demo release verification in progress:
GitHub contains all changes through `87dace3`, but build `d5919532` stopped in the
release-contract step: the expanded UI process exceeded its previous two-minute
overall deadline after the fabric gallery passed. Production remained coherent
at `83c3c94`. The UI gate now has a five-minute overall budget, twelve-second
individual waits and per-section progress, retaining every assertion. Deployment
is not considered verified until the Google check and all live stamps agree.
Build `0b84ee50` then passed frontend/fabric and mobile/tablet Backend 2 checks,
exposing a desktop fixture assumption: the catalog fits, so a 100px scroll is
clamped. The scroll probe now adds temporary fixture tiles to guarantee overflow
and verifies the header moves by the actual offset at every width. All assertions
remain active. The owner requested no further polling after this corrective push.

November 12 — frontend demo polish and reuse (local, not pushed):
Hover-only card descriptions share Community typography and bottom tint. Frontend
fabrics are square; Pinterest/fabric walls have balanced gutters and padding.
Project names/dates center when actions are hidden, with closer unchanged-size
buttons on reveal. Dissect/stack/X share one height and vertical position. Design
Notes is 20% narrower, inset from the bezel, with a symbol-only open trigger and
rightward swipe dismissal. Active Aesthetic Control samples use the same styling.
Pinterest preloads status and one saved page after first paint, warms four images,
and retains actual account-bound pages/photos/scroll/selections across project and
tab changes. Background work never starts a wider search; typing filters locally,
and explicit wider search remains available. Identity changes abort and clear it.
Fabric menus share one pending manifest and retain swatches; viewer close/reopen
retains its photo until an account/project boundary. Community updates retain
unaffected images, including row pause state. Drags paint once per animation frame;
Pinterest drops show immediate temporary previews and cannot land in a later project.
Fixture results: zero repeat Pinterest page reads over 10 project reopenings and
20 tab swaps; 30 fabric opens use one manifest read; 30 viewer reopen cycles use one
source assignment; 240 pointer events coalesce to one paint; a Community caption
update retains all 60 tested photographs. These are local operation counts, not
live latency or frame-rate measurements. The complete Node20 code-only release
gate passed. CI presentation checks were extended but not run locally; owner
visual acceptance remains pending after Push. No Chrome or local browser was used.

November 12 — Backend 2 square sourcing cards and interaction fixes (local):
Fabric tabs/tools now lead the same horizontal rail as square photos and scroll
away with it. Captions use P1/P3, hidden until hover, focus or first touch; heart/X
controls are smaller and grouped at top right while touch targets remain usable.
A 112–152px strip returns vertical space to the image/pattern frames. The title's
numeral 2 is smaller and baseline-aligned. This compact view is scoped to Backend 2;
the original Backend's recent separate layout remains intact.
CLO explicitly requests image search and retains sourced thumbnail alternatives,
with square previews and matching hover/focus details. Old image-less research
requires explicit Refresh; blocked CONNECT metadata is not scraped, guessed or
replaced with generated images. No automatic paid preview retry was added.
Pipeline cells now reflect actual waiting/running/done/saved/unavailable/failed
states, including reopened runs and preflight errors. Shared drawer gestures use
handle/edge-only starts, direction lock, cancellation and one action per wheel
burst; original Backend gestures open the same drawer as its hamburger.
Aesthetic Control has working rail, CLO illustration and pipeline state samples.
Node20 code-only checks pass, including rail transitions, sourced preview
fallbacks, pipeline states and drawer gestures. CI geometry assertions cover
phone/tablet/desktop with changed saved settings; they have not run locally.
These changes are committed locally and are not deployed.


November 12 — original Backend presentation update (local, not pushed):
The original pattern window now has Mark 1 / Logic / SVG with live pipeline and
retrieval details inside the existing frame. Logic stays selected during progress;
SVG can use the finished drawing directly. Original toolbars share P3/Glass sizing
with one pixel less X/Y padding, pointer selections release lingering focus, and
the screen indicator has a white active dot. Fabric photos are square again with
two caption rows and closer heart/X actions. Brief Settings shares the outer
Drawer material; the Operation drawer already matched. Backend 2 is unchanged.
The active Operation and Fabric previews follow these changes. The full Node 20
code-only release gate passed, including navigation, running updates, SVG
transitions and project reset. CI presentation checks were extended for widths,
saved settings and frame geometry; they were not run locally. Visual and
interaction acceptance remains pending owner review after Push.

November 12 — Backend 2 and automatic CLO sourcing live:
Release `006c575799e7eb6f20f4ef3697d3c36f9bc228fe` passed Google build
`47e99920-7633-45d4-80d1-74d0f47bea4d`; all seven public release endpoints
were independently verified. The dedicated us-west1 `maya-clo-assets` queue and
`maya-clo-dispatch` identity are active. Existing runtime enqueue and actAs
permissions were verified; no broad IAM grants or credential changes were needed.
A newly dispatched job for the owner's screenshot submission completed and saved
two source-backed CONNECT assets. Later builds reuse a rollout receipt rather
than repeat a paid test. No asset was purchased or downloaded.
Backend 2 now has Pattern / CLO 3D / Pipeline, one Inner surface per frame,
5px vertical pill padding and 9px toolbar text, a thinner fabric strip/narrower
cards, and Submissions (folder) / Bio / Settings drawer order. Shared materials
remain active. CI checks passed at phone/tablet/desktop widths and changed saved
settings. Owner visual review and match usefulness remain separate from these checks.
Server-side final image/summary uploads schedule sourcing; frontend readiness is
an idempotent fallback. Canonical images accept the existing 25MiB upload bound.
[Successful production build](https://github.com/ManaSiyo/MAYA/runs/131365347622).
No Chrome or local browser was used. This post-release record is documentation-only.

November 11 — integrated CLO asset sourcing in Backend 2 (local):
The right window now switches Pattern → CLO 3D → Pipeline, retaining the larger
pattern area, left reference and lower fabric strip. CLO shows up to ten
OpenAI-ordered CONNECT listings with free/paid and editable-pattern filters,
source links, alteration notes and source-reported price/format/rights evidence.
Selections and dismissed links persist privately per admin and submission.
Opening or switching tabs only reads saved work; Refresh explicitly starts a
new paid search. The original Plan B uses this same component and no longer
claims automatic grading; the old configurable proxy returns 410.

`server/digital-assets.mjs` owns canonical input reads, bounded Responses search,
generation-checked research and durable job claims. A submission-ready request
runs after uploads; saving dissection prepares up to 12 garment jobs. Automatic
worker dispatch needs the dedicated CLO_TASK_* configuration. Pending jobs remain
available for interactive Find without it. No credentials or production settings
were changed. The [integration checklist](clo-assets-integration.md) records routes,
storage, queue setup, provider limits and release acceptance.

Both Backend 2 pushes were verified: `1af6666` completed at 8:53 PM Pacific,
and the newer aesthetic/model commit `27d446e` completed around 9:02 PM Pacific
November 11. Google Cloud Build passed every step for the latter, including seven
live endpoint checks; independent release/API reads matched its full SHA. The
new aesthetic changes are now live at `/backend2.html`. This CLO change is local.
Aesthetic Control includes a functional CLO fixture and CI
checks the three-tab geometry with default/changed settings. No local browser,
live OpenAI search or CLO download was used. Owner visual acceptance, queue
activation and deployment of this change remain pending. Node20 code-only checks
pass, including the new CLO service and DOM checks; no tests were skipped.

November 11 — Backend 2 final code review and current OpenAI tiers:
Fix Full view being replaced by a pending garment pick, stale drawer controls and
submission navigation after account/garment changes, and save-status/history updates
while typing. Engine requests open parent Settings; stored Plan B preferences do
not hide Backend 2's snapshot. Keep pattern-tab keyboard focus and circular drawer
tabs. Fabric captions/actions no longer overlap; short strips remain scrollable;
narrow previews preserve both aligned image/pattern panels. Asset versions updated.

OpenAI defaults were verified against the official November 11 model catalog:
[Flare 2.6](https://developers.openai.com/api/docs/models/gpt-image-2.6-flare),
[Terra 6.1](https://developers.openai.com/api/docs/models/gpt-6.1-terra),
[Sol 6.1](https://developers.openai.com/api/docs/models/gpt-6.1-sol), and
[Luna 6](https://developers.openai.com/api/docs/models/gpt-6-luna).
Flare 2.6 has the same published token rates as Flare 2.5; no MAYA latency or
per-image cost benchmark was run. Source defaults do not establish live provider
entitlement or override production environment choices. Other provider/voice tiers
are unchanged. New logic tiers preserve workload roles instead of routing all work
through the economy model; their rates differ from Luna.

Node20 `node docs/check.mjs --code-only` passes. Focused checks cover adapter races,
settings/error propagation, image builders in both Backends, binary-safe legacy
image upgrades, model parameters/admin gates, owner overrides and CRM metering.
CI geometry checks were extended but not run locally. Owner visual acceptance,
deployment and live inference remain pending; no Chrome, paid calls or Push.
This completed run supersedes the concurrent in-progress fixture failure recorded
in the CLO research note below.

November 11 — Backend 2 playground, prepared locally (not pushed or deployed):
Admin orders Users and traffic → Ad campaigns → Leads. Every collapsed fold uses
the same saved Closed sections spacing, including Recent changes and Feature
requests. Hover/focus on MAYA exposes Backend and Backend 2; touch shows the links.
The existing Backend keeps its layout, with its left-side screen indicator restored
and shared studio fabric hearts added immediately left of each Global dismissal X.
Favorites includes all saved Global/In House bookmarks, across admins and clients.

Backend 2 is a separate copy at `/backend2.html`. The upper snapshot embeds the
existing engine with an opt-in presentation adapter: Full view and dissected
items on the left, Mark 1 / Pipeline on the right. Pipeline contains the live log,
retrieval trace, source passages and composed prompt; its dot pulses only during
an active run. A horizontal In House / Global / Favorites strip sits underneath.
It loads saved fabric research without starting a paid search; Refresh remains an
explicit search. The circular filing drawer tabs are Bio (biography, vision,
measurements), Submissions and Settings. Settings forwards to the same saved
pattern engine; failed saves block submission switching. The original Operation
Room layout is unchanged outside the opt-in adapter.

Aesthetic Control includes functional fabric hearts, a Backend 2 snapshot and
three-tab drawer preview. Shared typography, Glass, Inner, fields and icon settings
remain authoritative. Node20 code-only checks pass, including shared favorites,
conflict/failed-read protection and DOM-based Backend 2 interactions. Linkedom is
pinned for these non-browser DOM tests. CI includes phone/tablet/desktop checks at
default and changed settings; these browser checks were not run locally. Fromsa's
visual/interaction review is pending. No live model calls or Chrome access were
used. Release verification now includes Backend 2 as a seventh endpoint.


November 9 follow-up: Operation Room keeps 34/66 columns and center-view
panning. Shared grid rows align both panels through empty, running and saved
states. Selector/Start stay together at center; Mark One/SVG use the same P3/Glass
controls and balanced vertical spacing. Pipeline Live moved to the first row of
the reference section; Retrieval Trace is a plain heading. The shared delete
dialog is capped at 420px, centered and bounded by phone viewport margins.

The Brief and submissions drawer share one account-bound feed. Reopening retains
loaded cards/photos; one-minute background revalidation reconciles changed cards
without blanking the list. Concurrent opens share a request. Failed reads keep
existing cards; account changes, revoked access and deletion clear private state.
Runtime checks cover these cache and invalidation races. CI checks fixed frames,
shared pill padding, compact dialogs and retained photo nodes at responsive sizes;
no browser was launched locally. Owner visual acceptance is pending.

The earlier cleanup removed the duplicate Operation Room Fabrics UI/initializer;
Brief Fabrics is retained. Project-row action circles are spaced, 5% smaller
visually and their glyphs 5% larger, with full touch targets and shared Glass
settings. Active Aesthetic Control previews cover these changes.

The first photo, import, typed text or microphone action creates a cloud project
without a Save button. Projects refreshes after the first acknowledged write
and index update, including retry; later saves leave editable rows intact. Older
drawer reads cannot replace a newer result or erase a rename in progress. Avatar
selection alone does not create a project. Independent photo/avatar uploads now
run concurrently, retaining account/project guards. Node20 non-browser checks
pass; deployment is checked separately and owner visual acceptance is pending.

The earlier November 9 responsiveness pass retains these improvements:
Reopening the same saved Fabric research retains its loaded state; switching
In House/Global/Favorites retains up to 24 decoded photo cards in memory. Private
cards clear on garment/account/project reset. The public inventory loads once
per page; concurrent lookbook/research reads are shared. Lookbook reads remain
fresh for 30 seconds; explicit Refresh/save reads bypass that window.
Favorites additions/removals and caption updates preserve unchanged image nodes.
Shared image inspection watches new subtrees instead of rescanning the document
on every text update, and Design Notes positioning runs at most once per frame.
Shared CSS settings coalesce simultaneous loads, throttle focus revalidation to
30 seconds, and skip unchanged incoming values. Explicit Aesthetic Control
previews/saves and cross-tab edits remain immediate. No image model, provider,
paid search behavior or production speed setting changed.

Node20 code-only release checks pass, including cache/reset, refresh races,
unchanged CSS, incremental image watching and Favorites reuse. The Google release
gate and matching public versions still establish deployment. CI also checks photo
identity through gallery switches, saved reopening and Favorites edits at the
existing responsive sizes. Fromsa owns visual/interaction acceptance.

November 8 feedback: Fromsa confirmed Global Fabrics now sources photographs.
This revision restores the 34/66 Operation Room proportions and a large
center garment view with horizontal panning. One native dropdown chevron has
reserved text space. The parent Brief uses section snap stops, and ordinary wheel
input over SVG remains vertical scrolling. CPU-heavy SVG tracing moves to a
bounded, cancellable background worker and runs only when SVG is requested.

Fabrics can toggle off; Full View returns to the garment, while switching real
garments keeps Fabrics selected. Expanded Fabrics dismisses on outside click.
Refresh, CSV and Expand share a height in that order. Submission captions use the
saved frontend description with two-line overflow; legacy structured design ideas
are readable fallbacks. The X sits slightly closer to the top-right corner.
Aesthetic Control previews and versioned shared-asset URLs track these changes.
Owner visual/interaction review is pending. Deployment requires the Google build
and matching live commit checks described above.

Image magnification/pinch begins only after expansion, including Operation Room
images expanded in the parent viewport. The pointer lens is 35% larger on both
axes. Design Notes tracks the card's vertical center and uses Glass material.
Both changes have active Aesthetic Control previews. Fabrics and its selected item
remain visibly selected together. Footwear now passes canonical saved-item checks;
cited links and automatically saved research survive missing photographs.

Validation: Node20 code-only packaging, syntax, authorization, storage,
communications, image/voice/avatar, Fabric deadlines/forced-GC and inspection
checks pass. New checks cover one paid drawing, conditional pocket pieces, worker
cancellation/deadlines and Fabrics navigation. The pinned tracer also produced SVG
in an isolated Node smoke check. CI now checks responsive proportions, panning,
dropdown spacing, scrolling while running, toolbar heights and outside dismissal;
these browser assertions have not been run locally. Existing tests cover pattern
history, no-charge reopen, storage failure,
account/garment scope, deletion races, source-only links, CSV and durable dismissals.
CI presentation assertions were updated; no local browser was launched.

The follow-up review fixes dropped settings when changing garments: selection
waits for autosave, failed writes keep the current draft, and fields remain locked
until saved settings load. Identical settings-only save retries acknowledge the
stored result without replacing history. Fabric refresh and late metadata update
existing cards without discarding healthy photographs. Runtime checks cover these
races and retained image nodes; the CI presentation assertion checks refresh too.

No Chrome access or agent visual testing. Fromsa owns visual/interaction review
on phone/iPad/desktop after Push. No live OpenAI search was run in this change;
these concrete fixes do not establish live provider availability, latency or photo
quality. Prices/delivery are only present when returned as sourced metadata.

November 7 deployment diagnosis: after 05a186c was pushed, Hosting and API
still served a71964a45998ab7eeec251ecc1678869d9a7f493. Google's checks prove both
c28322e and 05a186c failed **Test release contracts**, so Build server, Deploy
server and Deploy website never ran. The old provider's preview check was unrelated.
Build d6a00ef3-d1f2-4314-a11b-10e4ab4203bc timed out in the Fabric gallery fixture:
the test checked idle state before asynchronous photo preparation started the
refresh, then reset the gallery and canceled that pending request. The prior build
also reached a renewal test whose direct open omitted the host recovery callback.

The fixture now waits for its actual search response before completion, binds photo
failures to distinct URLs, and retains the host recovery callback. The release build
stamps every app HTML page and verifies six live endpoints after deployment.
On November 8, repair commit 9917a907d26231c0a2541441ad679b1e89b0b841 passed
every Google Cloud Build step, including the full CI checks, Cloud Run, Hosting,
live verification and rules (build 69389664-ccb2-4bdb-aea0-b2fbb7beb8af).
An independent HTTP check confirmed that same commit on all six live endpoints.
This deployed the previously blocked Operation Room version 2 and Fabric changes.
Later pushes must pass the same build and live commit checks; a green unrelated
preview is never deployment evidence. Visual and interaction acceptance still
belongs to Fromsa. Twilio remains owner-managed; no messages or calls were sent.
