# Current handoff — October 29, 2026

## Current work — live audit and refresh efficiency

Public release verification found Hosting and API both still at 3873ced while
the tracked maya-v2 head was 8a83820. GitHub's Vercel status was green, but the
available status did not identify the Firebase/Cloud Run build outcome. Do not
claim the later two commits are deployed; inspect the Google Cloud Build for the
head and repair its actual failure before another push. Public health reports
the API and submission storage configured, not authenticated provider success.

Frontend and Admin now check the 95-byte release marker before falling back to
the HTML for old/local releases, retain the existing voice and unsaved-work
deferrals, and skip periodic checks while hidden. Admin submissions use their
documented 15-second regular cadence; arriving submissions keep five seconds.
Message polling pauses in hidden tabs and refreshes when visible; a duplicate
traffic timer and duplicate model-snapshot event were removed. No CSS or visible
UI changed. `tests/refresh-efficiency.mjs` covers these paths and is a release
and app-regression gate.

One signed-out public desktop sample returned first byte in 0.15–0.26 seconds
for the four pages; browser DOM-ready was 0.39–0.58 seconds and the sample ran
approximately 60 animation callbacks per second. At 1024/1440/1920 desktop
widths and 390px frontend, no horizontal overflow or page exceptions appeared;
all Admin stylesheets completed loading. This is neither a field performance
distribution nor an authenticated Admin, live fabric or real microphone test.
Synthetic fabric, voice, project/account isolation and release checks remain the
evidence for those paths. The new update check avoids downloading approximately
985 KB of uncompressed frontend HTML or 361 KB of Admin HTML on each ordinary
check, subject to the legacy fallback; compressed transfer differs.

OpenAI's current guidance recommends evidence-backed dead-code removal and
describes WARP for faster Realtime connection setup. No voice protocol or model
was changed without a compatible-browser and real latency comparison. See
https://developers.openai.com/blog/maintaining-software-with-the-gpt-6-family
and https://developers.openai.com/api/docs/guides/voice-webrtc?voice-api=realtime.
Credentials and external configuration were not accessed or changed.

All Cloud Build Node gates, integrated regression, smoke, the focused refresh
checks and the final Aesthetic Control authority gate passed locally using
isolated Playwright Chromium and fake providers. npm ci, production build,
authenticated live fabric searches and real voice response remain unverified.
Next: inspect the Google Cloud Build for 8a83820, then Fromsa can push the
prepared commit and verify the exact Hosting and API release before live tests.

## Current work — Decisions for pattern-book search

For an unrecognized garment, Operation Room asks OpenAI Decisions for a bounded
category using only short classifier labels. A sufficiently confident valid answer
adds the existing soft chapter boost to passage retrieval; the adaptive grammar and
cut list remain unchanged. Failure, refusal, unknown or uncertain results preserve
the original broad search. The admin-only proxy limits model, request size and
shape, and explicit cache mode avoids implicit shared-prefix caching. The async
result is checked against the current account, submission, garment and run.
Empty garment labels now remain unknown. No new UI or visible styling is added.

`tests/pattern-decisions.mjs` checks the request, fallback and proxy constraints;
it is a release and app-regression gate. The 0.9 confidence cutoff is a cautious
initial guard, not a calibrated accuracy claim: collect labeled garment examples
and evaluate false routing before trusting it as a quality improvement. Provider
entitlement, real decisions, cost, latency and deployed behavior remain unverified.
The existing renderer already uses GPT Image 2.5 Flare. The owner retains Push.

All Cloud Build Node gates, the integrated app regression, smoke, focused
proxy/Operations tests, and the final Aesthetic Control authority gate passed
with isolated Playwright Chromium and fake providers. npm ci, a production
container build and live Decisions were not run. Next: Fromsa pushes the local
commit, then checks the exact deployed commit and provider behavior with labeled
garment examples.

## Current work — compact controls and shared fabric matches

The Admin Systems drawer retains Design Studio 2 while its main door is removed;
Users popup layering is above the Leads table. The Brief omits Direction, marks
Fabrics as the selected view and uses the same shared Glass pill as garments.
Selected pills retain their material and show the hover-style white rim. The
Fabrics toolbar is one responsive row, Search details opens explicitly with
short copy, and a lone product card no longer fills the entire viewer.
Aesthetic Control makes dropdown, checkbox, scrollbar, spacing, shoe and fabric
previews collapsible. The Operation Room's inner windows align, the garment
selector is a Glass pill, and wide source images pan without changing the
pattern input. `tests/operation-controls.mjs` uses synthetic images to check the
pan, keyboard access and alignment.

Fabric matching now retains an otherwise qualified full-look listing for two
distinct garments with identical saved fabric and scoped constraints, without
assigning it to either garment ID. Seller evidence and the single visual pass
remain required; ambiguous duplicate names and differing material requirements
remain separate. The previous version rejected this equal-strength case outright;
fixtures cover the full seller/search/rank path. The owner screenshot alone does
not prove that this was the live request's only failure, and no production latency
or improved real-world relevance has been measured. Do not infer live success.

Operation Room already uses `gpt-image-2.5-flare`, classifies garments and
retrieves locally indexed book passages. The later Decisions work is described
at the top of this handoff; no image model switch or book upload was made.

The Cloud Build test commands and smoke passed locally with installed
dependencies; the final responsive popup and shortened Operation Room copy were
then checked by the integrated regression and focused browser tests. The final
Operation Room selected-tab change passed its focused and Aesthetic Control tests. npm ci,
the production Linux build and live search remain unverified. The final
Aesthetic Control gate passed after functional verification. Next: Fromsa pushes the prepared local commit,
then verify the deployed release and an authorized live fabric search. Do not
access Chrome without fresh per-session permission.

## Current work — blocked Design Studio release

Cloud Build for `6cc66d0` failed in `tests/design-studio-2-ui.mjs` before
deployment: the sign-in panel intercepted the MAYA Operation Room link during
the door's opacity transition. The previous live release is `d255de7`.
`backend/status.html` now puts the door's own stacking context above the panel;
the Studio UI test holds the door at partial opacity while exercising a real
pointer hover, reproducing the relevant stacking condition. No design settings,
backend, or external services changed. All Cloud Build test commands, integrated
regression and smoke passed locally using installed dependencies; npm ci and the
production Linux build have not been rerun. The final Aesthetic Control gate
passed after functional checks.
Next: Fromsa pushes the prepared fix, then verify Cloud Build and the exact
deployed commit, Studio link and page. Local checks cannot confirm deployment.

## Current work — Design Studio 2 preview

`/design-studio-2.html` serves `backend/design-studio-2.html`, linked from the
Admin door row and Systems drawer. It recreates the current Mana Siyo studio's
four experiences, consultation process, stories and form in MAYA's visual
language. Selecting an experience updates the form; the form is explicitly a
preview and cannot send or save data. The page uses site-owned Wix image URLs;
all five loaded in an isolated local browser, but depend on that external host.
It has no backend or real signup integration. Source page:
https://www.manasiyo.com/design. Admin's Maya room menu now opens below its door
so the new door remains reachable.

The page uses Aesthetic Control's existing H0/H1/H2/H3/P1/P2/P3, inner panels,
Glass pills, input/dropdown and checkbox settings. A compact collapsible sample
lives within Fields and drawer spacing; `tests/design-studio-2-ui.mjs` checks
actual selection, no network writes, script failure, shared saved settings and six
widths. Cloud Build test commands, integrated app regression, smoke, and the
final aesthetic-authority gate passed with installed dependencies. npm ci and
the deployed release remain unverified. Next: Fromsa pushes the prepared commit,
then verifies the deployed page and image delivery.

## Previous work — WR Admin layout and applicants

WR now uses the Admin-style horizontal submissions strip, with cards slightly
larger (36vh versus Admin's 34vh), and an Applicants table and form constrained
to Admin's width. The six ordered fields are Wave (number), Number, Name, Look,
Color and Email. Existing private WR records without Email remain readable and
idempotent retries remain compatible. Thumbnail reads start newest-first with a
four-request concurrency bound; this limits competition but local fixtures do not
prove live latency improvement. Same-account and account-change boundaries and
private storage are unchanged.

Changes are in `backend/wr.html`, `aesthetics/ui/wr.{css,js}`,
`docs/server/wr-store.mjs`, shared preview and WR tests. Local fixtures compare
Admin and WR geometry at six widths, synthetic loading concurrency, old/new
records and saved table/panel/field settings. The exact Cloud Build test commands, integrated app regression, smoke, WR
store/UI, gallery and container checks passed with installed dependencies; npm ci
was unavailable. The final `tests/aesthetic-authority.mjs` gate passed after functional checks. Next: Fromsa pushes the prepared local commit, then verifies live layout,
existing applicants and loading performance. The existing thumbnail API returns
original image bytes, so improvement on a slow connection is not established.

## Previous work — frontend avatar camera

Profile's avatar switcher now includes Camera alongside Replace. The camera
requests front-facing video without audio, previews a mirrored photo, and requires
Use photo before the existing avatar upload/analysis flow runs. Cancel, Escape,
page hiding, project/account/client changes, or a late permission response stop
the stream; Retake requests a new one. The ordinary file picker and photo read
are pinned to the original client/project, and later photo processing cannot
replace a newer choice. `aesthetics/ui/avatar-camera.js` owns the camera lifecycle;
`frontend/index.html` owns the integration and layout. The preview uses shared
popup, typography and pill settings; its collapsible sample lives beside the
dropdown preview in Aesthetic Control.

Local synthetic-video coverage is in `tests/avatar-camera-ui.mjs`, integrated in
app-regression, Cloud Build and final aesthetic-authority; no real camera or
Chrome profile was accessed. The Cloud Build test commands, app regression and smoke passed using installed
dependencies; npm ci is unavailable locally. The final standalone Aesthetic
Control gate passed after functional verification. Live camera permission and phone/desktop hardware
remain unverified until deployment and owner testing. Next: Fromsa pushes the prepared local commit, then verifies the deployed build
and camera behavior on real phone and desktop hardware.

## Previous work — WR and CLO research

WR is a single new internal Admin-linked page at `/wr.html` (`backend/wr.html`,
`aesthetics/ui/wr.{js,css}`). It shows the existing Admin submissions and a new
private account-scoped lead list with Name, #, numeric Wave, Color and Look.
`docs/server/wr-store.mjs` stores account-bound records with generation checks and
retained idempotency keys. Account changes clear the page, cancel requests and
revoke image URLs. Aesthetic Control shares the existing field, type, panel and
pill controls and includes a WR field preview. The current Operation Room is
unchanged. `docs/CLO3D-RESEARCH.md` documents desktop CLO SDK, 2D snapshot and
DXF options and the limits of the available evidence.

Local release gates, app-regression and smoke passed using installed pinned
dependencies and isolated browser fixtures. Initial gallery and workspace failures
were corrected and those suites passed on rerun. The final standalone `tests/aesthetic-authority.mjs` passed after the other
functional checks. WR has
synthetic account isolation, idempotency, responsive and Aesthetic Control Save
coverage; default and modified styles were visually inspected. npm is unavailable
in this environment, so npm ci was not rerun. Production deployment, actual WR
account storage and live submissions remain unverified until Fromsa pushes. The
private live fabric search remains unverified and was not run in this request.
Next: Fromsa pushes the prepared local commit, then verifies the deployed
release, WR submissions and private lead persistence.

## Previous work — Aesthetic Control and Outbound retirement

Fromsa requested Outbound removal and a more compact, single-authority Aesthetic
Control. Outbound's UI, dedicated server/Gmail/Sheets integration and obsolete
fixtures were removed; its old page URLs redirect to Admin and its API returns
410. Shared Leads, Messages, owner text, text AI, Wix callbacks and the private
ledger compatibility path remain. Old stored Outbound workspaces, encrypted
mailbox credentials, OAuth grants, Scheduler jobs and Pub/Sub subscriptions were
not changed or deleted. The retired Outbound Scheduler no longer triggers callback
alerts. The owner must confirm the separate callback Scheduler/Wix trigger works,
and can disable retired jobs/subscriptions and revoke grants if desired. Existing
`OUTBOUND_SCHEDULER_*` values are still used by independent callback identity.

Aesthetic Control retains one Fabric workspace sample, moves Pill states beside
Glass/Regular, pairs dropdown and checkbox controls above 700px, removes scrollbar
usage inventory and duplicate typography shortcuts, and shows Admin traffic as
Glass. Glass selection now uses a stronger shared blue fill and accent; Brief
pieces and Admin chart controls update their selected/pressed semantics. Settings,
legacy schemas, semantic status colors, and saved typography remain shared.

Local validation: the Cloud Build checks other than the final authority gate,
integrated app regression, smoke, retirement, selected-pill, Admin, fabric and
responsive saved-style fixtures passed. The final standalone Aesthetic Control
authority runs last before commit. npm is unavailable locally; Cloud Build still
runs its pinned npm ci. Live release remains 076fd31;
no changes have been pushed. The private live fabric search remains unverified.
Next: finish verification and local commit; Fromsa pushes and verifies deployment.

Earlier "Current work" entries below describe previous work and are historical;
the deployed release was verified at 076fd31 on October 26.

## Current work — compact Aesthetic Control

Glass and Regular pill previews, Edit/Restore and usage links share a two-column
layout above 700px and stack at narrower widths. Their existing independent saved
settings, previews, material authority and anchored editors remain intact; headings
and usage labels are shorter. Typography roles pair above 1100px, with H0 spanning
the row; linked pages and source locations remain inside each disclosure. Changed aesthetics/aesthetic-control/{gallery.js,
finishes.js,gallery.css}, tests/{component-gallery,pill-consistency,
aesthetic-authority,app-regression}.mjs and design/handoff/request/commit records.
No client or server styling, storage schema or provider behavior changed.

Local component-gallery and pill-consistency pass, including real Edit/Restore and
responsive layout. Fabric search (48 cases) and Fabric UI passed using fake
providers. The public live release is still cee701a; prior local Fabric fixes are
not yet deployed. Owner is using Chrome, so no owner browser was accessed and live
search quality or latency remain unverified. All other exact Cloud Build release gates passed locally; integrated regression
and the final standalone Aesthetic Control check run before the local commit.
Next: Fromsa pushes, then verify the deployed release and live Fabric search.

## Current work — Sourceable throughput and bounded waits

The public live release remains cee701a and local commits f7b6341, 324b6e8 and
b56b0ee are not deployed. A generic public retailer feed check found a long-haired
faux-fur listing in a third result slot that the old two-product cutoff would drop.
The bounded Shopify feed now considers three candidates per query and verifies at
most eight balanced distinct seller listings, still capped at one eight-candidate
visual pass. This can add up to three concurrent public seller reads; it adds no
AI call or paid retry. It never relaxes image, seller, color, exclusion or relevance
requirements. Optional feed, web and listing reads now independently enforce their
existing timeouts even when the underlying transport ignores cancellation; late
responses cannot initiate redirects or replace completed results. After the marker
check, canonical dissection and preferences read in parallel, with providers gated
on both succeeding. No visible UI or shared design changes.

Synthetic search cases cover third results, independent storage reads and
non-cooperative providers and the eight-listing budget (48 cases); public generic feeds returned within roughly
0.4–1.2 seconds in one local check, not the private live request. The previously
observed multi-minute hang and real relevance/latency remain unproven; no fresh
owner Chrome session was accessed without approval. The code cannot guarantee more
matching stock. Changed docs/server/fabric-search.mjs, tests/fabric-search.mjs,
tests/app-regression.mjs, docs/FABRIC-SEARCH.md and handoff/request/fix/commit
records. All 71 other release checks, integrated regression and server smoke pass.
Run the final standalone Aesthetic Control check after these records, then commit.
Fromsa performs the push; verify exact deployed release and
owner-approved search after deployment.

## Current work — desktop audit and Sourceable selection

Owner reports Sourceable disappearing, one result and slow search, plus unclear
Full view/garment selection. Brief garment pills now use the existing Glass
segmented aria-pressed state, as do store filters. A browser image failure on an
already-reviewed Sourceable listing retains the seller link and shows the existing
P3 unavailable-photo fallback. Server sourcing, source evidence, image requirements,
matching, single visual check and provider budgets are unchanged. Search fetch and
stream reads now independently observe the existing 60-second abort signal even
if a transport ignores cancellation. This fixes reproduced disappearing-card and
non-cooperative transport paths, not necessarily the reported live cause.

The isolated desktop sweep checked initial Client, Admin, Brief, Operations,
Outbound and Aesthetic Control layouts at 1024–3440px (eight widths); it found
no page-level horizontal overflow. It does not establish every populated or live
state. The multiple-result fixture tests three loaded seller cards and a failed
photo; selected garment and store styles use existing active segmented previews
and are tested under default and changed saved settings. Earlier live release is
cee701a; later local changes are not yet deployed. With explicit owner permission,
one live refresh remained at Searching for more than 130 seconds; the cause is not
established. No live result or verified latency improvement was demonstrated. No new aesthetic settings or provider calls.

Changed: backend/backend.html, aesthetics/ui/fabric-assistant.js,
tests/brief-workspace-ui.mjs, tests/fabric-search-ui.mjs,
tests/fabric-workflow-ui.mjs, tests/app-regression.mjs, tests/aesthetic-authority.mjs,
docs/design.md, docs/FABRIC-SEARCH.md and handoff/request/fix/commit records.
All 71 other release checks, integrated regression and server smoke pass. Run the
final standalone Aesthetic Control authority after these records, then commit if
it passes; Fromsa performs any push and live deployment verification.

## Current work — architecture map and owner push

Added `docs/ARCHITECTURE-MAP.md`, linked from `docs/README.md`, showing the
served pages, associated source files, backend modules, storage and deployment
boundaries. Corrected the stale early-card statement in `MAYA-AI-ARCHITECTURE.md`.
This documentation-only change adds no visible UI; Aesthetic Control remains the
final local gate. The earlier Fabrics fix is locally committed as f7b6341 and its
71 other release gates, integrated regression, smoke and final standalone aesthetic
authority passed. The wider audit and dead-code cleanup remain incomplete.
Fromsa retains the final push; never push on his behalf. After push, verify the
exact deployed release and owner-approved live cases.

## Current work — Fabrics reviewed results and fresh audit

The shared Fabrics viewer now waits for the terminal done event before rendering
product links. Preliminary and intermediate products never become actionable;
a failed or interrupted stream cannot briefly expose an unreviewed match. No
CSS or presentation setting changed: pending copy uses the existing P1 authority.
The delayed-comparison browser fixture checks pending and rejected links, and
checks default/changed P1 settings at six widths. The shared authority imports
that fixture. Search, retailer data, visual ranking and sealed lookbooks are
unchanged.

A broad local audit ran 71 Cloud Build checks plus server smoke and reviewed module boundaries,
retired references and recent Fabrics behavior. These checks do not amount to a
manual audit of every feature or proof of live behavior. The retired AI meter is
not loaded by active pages, but remains referenced by release verification and
the typography inventory; retain it until those contracts are deliberately
reconciled. No migration or cleanup path was removed. The actual reported live
search failure and visual relevance remain unverified; no owner Chrome session
was accessed. Local tests use fake providers.

Changed: aesthetics/ui/fabric-assistant.js, tests/fabric-workflow-ui.mjs,
tests/aesthetic-authority.mjs, tests/app-regression.mjs, docs/FABRIC-SEARCH.md,
and handoff/request/fix/commit records. The first integrated run exposed two stale
source assertions expecting provisional cards; these were corrected and the suite
rerun successfully. All 71 other release checks, smoke, integrated regression and the final
standalone Aesthetic Control check passed; f7b6341 is committed locally.
Fromsa may push. After deployment verify the exact release and owner-approved real cases.


## Current work — Fabrics loading and interrupted search lifecycle

Production is 5298c07ad4d705cbb4fc359dfed004b108f746f4 (public release checked).
The owner reports the August 26 displayed submission remaining on Searching while
also showing an empty-results message. Fresh Chrome permission is pending; do not
reuse the prior completed session's approval. No owner browser, record or message
has been accessed in this turn. The actual provider failure is not established.

Reproduced locally: reference preparation paints a completed no-match placeholder;
NDJSON done waits unnecessarily for EOF; a truncated stream retains provisional
candidates. Distinguish preparing/searching/interrupted/completed states, complete
at done and cancel the reader, clear unconfirmed candidates after failure or scope
cancellation, and permit explicit retry. Late reference preparation cannot start a hidden search
after close; a queued native close event cannot abort a reopened dialog. Removing
only this guard in a temporary fixture deterministically fails the new assertion.
Never relabel a timeout as a completed
no-match. Seller redirects and optional variant facts now share eight seconds;
the route has a total 55-second read-only deadline, before the browser's existing
60 seconds. Late provider output is suppressed. No retry or extra paid call.

Changed runtime: aesthetics/ui/fabric-assistant.js and docs/server/fabric-search.mjs
only. Existing P1/Glass/Inner controls and active Fabrics preview remain authoritative;
no CSS, new aesthetic setting, matching threshold, model, dependency, SMS/voice,
credential or production environment change. Original images/client words and
sealed lookbook CAS behavior are preserved. No new server module/package change.

Targeted search passes 43 behavioral cases. Workflow covers held EOF, truncated
and stalled streams, explicit recovery, private reference loading, existing save
and isolation contracts; interrupted copy checks default/changed saved P1 at six
widths. Normal and 8x CPU workflow runs pass. An early full run exposed Search stopped
in the accelerated stream fixture; queued-close cancellation is now independently
reproduced and fixed, and fake transports honor already-aborted signals.
All 72 exact local release gates and full integrated regression pass, including
final changed-surface authority. Search passes 43 cases after the last test refinement.
Run server smoke and standalone Aesthetic Control last after these final records,
then commit/authorized Push.
Then verify exact release/assets/API and the actual owner submission, when Chrome
is explicitly approved and idle. Synthetic providers cannot prove live relevance
or that this is the cause of the owner's current stalled request.

## Previous duplicate listing release

5298c07 deployed through Cloud Build 1482a3fe-3eab-4eda-b2b0-34a99912f403,
all 72 gates. Exact release/page/API/assets/cache and deployed synthetic UI checks
passed. The real crocodile listing appeared once after Shopify alias deduplication.
The burgundy jacket still had no confirmed visual match. The seller's crocodile
vinyl is stiff upholstery; physical trouser suitability is unconfirmed.

## Historical preparation — duplicate Shopify search cards

87f27120b7556b3671c3d1f31004f9840eb98960 deployed successfully via Cloud Build
3780db4e-ffa2-4571-867a-59e2794ac690 (18m41s), with all 72 gates. Exact public
release/page/API and asset/cache checks pass. Deployed-code Fabrics and SMS UI
fixtures pass with synthetic private APIs and intercepted writes. Communications
implementation, shared model/design and lockfiles remain unchanged.

Real owner acceptance: the burgundy jacket now searches red long-pile faux fur
and does not offer the previous ivory fur. No suitable visual match was confirmed
on that run. The crocodile trousers now return the public Britex crocodile-backed
vinyl, but the same product appears under both collection and direct product URLs.
Seller facts describe stiff upholstery; this is a closest visual listing, not a
claim of physical trouser suitability. Never force a weak/failed visual fallback.

Fix only fabric identity: Shopify /collections/<collection>/products/<slug> and
/products/<slug> share an identity, retaining selected variant query parameters.
Use identity for direct-feed and final search deduplication, before the one visual
pass. Keep actual fetch/source URLs, seller facts, redirects, private historical
lookbooks and non-Shopify routes intact. Original service fails the new duplicate
fixture; fixed search passes 40 cases. No visible UI, CSS, independent aesthetic
setting, communications/entry-point/shared model/environment/dependency change.

Changed: docs/server/fabric-retailers.mjs, fabric-search.mjs, tests/fabric-search.mjs,
tests/app-regression.mjs and required handoff/request/fix/commit records. All 72
exact release commands, full integrated regression and smoke pass; sourcing has
15 and search 40 behavioral cases. Final standalone Aesthetic Control runs last
after these final records before the authorized commit/Push. Then verify exact deployment and
that the actual crocodile result renders once. The prior live owner Chrome
permission still covers this same active session; no records/messages/calls were
written and no other profile was accessed.

A separate post-release audit receipt, including five unchanged dependency
advisory entries and their exposure limits, is at:
/Users/fromsa/.codex/visualizations/2026/10/07/01a114f6-f388-7040-af18-3ff9b537ae54/MAYA-fabric-release-audit-2026-10-21.txt

## Previous dominant-color and retailer-seed follow-up

24d84f4d27c49be8728b968ec3a3f31b423c1fb6 deployed successfully: Cloud Build
fa83abfc-88a1-4d99-9ff2-16dc28eb6dae, 17m52s, all 72 release gates. Exact public
release/page/API commit, changed asset bytes/cache and synthetic deployed Fabrics/
SMS browser fixtures pass. The live saved wool coat now returns three black wool
listings. The August crocodile trousers returned no confirmed visual match; the
publicly checked closest Britex vinyl describes stiff upholstery, not confirmed
trouser suitability. Do not force a weak visual fallback.

The same outfit's burgundy shag jacket exposed a real false positive: white/ivory
faux fur passed. The canonical dissection already stores dominant fabric_hex,
but matching and public retailer seeds ignored it. New regression fails original
code. Use clearly chromatic saved color families only when saved words lack color;
neutral/dark/boundary hints remain uncertain. Explicit latest color instructions
still override them. Opposite known seller colors fail before ranking. Qualified discovery base-color
families are validated and bound to canonical garment IDs; they cover legacy
garments without hex. Repeated/ambiguous IDs are omitted, and explicit latest
colors remain authoritative. Requalify direct candidates after discovery too. Pass the
resolved search/qualified observation into the existing single visual review and
make obvious dominant-color mismatches ineligible there.

Retain bounded crocodile/snakeskin/long-pile base descriptors in public seeds.
Real Britex generic leather/smooth feed first returned buttons; filter known
notions before its two-item budget so a third fabric survives. Missing metadata
still reaches seller verification. Include vinyl/leatherette as eligible materials,
without establishing apparel suitability. Web discovery starts across allowed
merchants rather than spending all three calls one local shop at a time. Respect
explicit store scope, all exclusions, source evidence, 8-candidate/one-visual-pass
and existing deadlines. No additional request/cost budget or retry is introduced.

Changed runtime: docs/server/fabric-sourcing.js, fabric-search.mjs and
fabric-discovery.mjs only. Tests: fabric-sourcing, fabric-search and integrated
app-regression assertions. A Brief fixture also captured a still-moving smooth
scroll as its baseline; set the deliberate position instantly, await its actual
destination and retain the exact restoration assertion. No Brief runtime change.
The Operations save fixture now awaits the drawer animation endpoint before
asserting reachability; its existing bounds/content assertions remain.
Docs: FABRIC-SEARCH, MODULE-BOUNDARIES, this state,
requests/fixes and COMMIT-REVIEW. No visible UI, CSS, shared design/model/dependency,
SMS/voice, server entry point, credential or production environment changes.
Existing H4/P3/Inner/Glass Sourceable preview remains the presentation authority.

Validation: sourcing (15), search (39), all 72 exact release gates, full integrated
app-regression and final server smoke pass. Corrected Brief/Operations geometry
fixtures also pass independently; existing assertions remain intact. The first
integrated attempts exposed the original malformed-traits test snapshot and
unsettled drawer geometry, not communications/runtime failures. Final standalone
Aesthetic Control runs
last after final state records, then commit and authorized Push. Exact deployed
release/assets plus actual owner jacket/trouser acceptance are the next step;
passing synthetic providers alone does not prove semantic matching quality.

## Previous base-cloth qualification repair

23b905504a87c229edfd06dacd7cdd7cb1763e73 deployed successfully through Cloud
Build dbe8380d (19m25s), with all 72 gates. The test-only 302cf18 build b468fd55
hit the 20-minute deadline while running tests and never deployed. Its fixed
STOP fixture passes normal and 8x local checks; this work retains that repair.

Authorized live owner acceptance then found the newer coat still empty. Its
visible context showed a black brushed wool body with cognac leather appliqué,
but retailer seeds required denim/leather. The client schema's outfit-wide
fabric_preferences list was promoted into hard single-garment criteria; secondary
appliqué also became a required fiber of the base cloth. Both are independently
reproduced in new matching/service fixtures.

Reduce only qualification text to its base part; preserve original saved/client
words, images and garment fingerprints. Treat unscoped summary directions as
hints in automatic saved-look mode; named requirements, explicit only/must/blend/
percentages and all exclusions stay strict. Unknown inferred material/weave can
reach the one visual check, with no bypass of explicit exclusions or failed
comparison. No comparison means no confirmation. Add a broader material-only
retailer seed within the existing two-query/four-store budget, balance stores and
prioritize grounded web candidates before supplements. A real Britex black wool
twill listing now passes qualification; this is not a visual-equivalence claim.

Search details now include the original client preferences and identify Store
scope correctly. Activation focuses the scrollable region; the existing shared
H4/P3/Inner/Glass preview is extended, not a new presentation authority.

The previous successful build used almost its entire 20-minute budget. Keep all
72 commands and final authority; extend the bounded Cloud Build deadline to
30 minutes and print each gate's start/elapsed time for diagnostics. No worker,
provider, production environment, credentials, billing settings or dependency
versions changed. Sourcing (14), search (38), all 72 exact release commands,
full integrated regression and smoke pass locally. The updated deadline/logger
contract was rechecked after its change. Long preference context caught a hover
panel covering its own trigger; anchor-side bounded height repairs that, with
actual pointer hit-testing, keyboard PageDown, governed 4px scrollbar, default/
saved responsive checks and zero reading-triggered provider calls. Final standalone
authority follows these final state/commit records, then commit/Push and exact
latest-commit/live owner acceptance.

## CI fixture repair

The first push's Cloud Build 7dbc2c19 failed before deployment after 7m48s:
all fabric and other preceding gates passed, but message-compose-ui counted
3 writes instead of 2 at its STOP assertion. A held-response reproduction gives
exactly that failure on unchanged Admin runtime. The fixture cleared the draft,
then directly painted STOP while the reviewed send still awaited an older fake
thread response with consent none. That response could overwrite the synthetic
STOP before the next evaluation. Draft clearing is not send-workflow completion.

The fixture now deliberately holds the reviewed send's refresh, asserts Send is
still busy, releases it, waits for the final carrier-acceptance feedback and enabled
button, then independently paints/checks STOP. Both disabled controls and the exact
zero-extra-write assertion remain. No Admin/SMS/server implementation, provider,
authentication or visible presentation changed. Normal and eight-times-slow browser
runs plus phone/messages/transfer/feedback/race/stress contracts pass. Run final
standalone authority last after these state/commit records.
The second push 23b9055 includes the brocade fix and was already building when this
fixture issue was diagnosed. Read the latest Cloud Build/release/API identity;
neither a push nor a Vercel success establishes production acceptance.

## Follow-up after first push

f177f7a49d38240a33de5764bda0dc56c6deea3b contains the primary fabric repair,
with a tree identical to verified local 03df329. Cloud Build
7dbc2c19-0240-4eaa-b2bd-6f0751ef7bea was running when a read-only real-retailer
check exposed another concrete bug: a genuine Mood brocade listing was rejected
because the fabric vocabulary omitted brocade. Add brocade/jacquard eligibility
and strict weave constraints; the original fails the new focused case. Unrelated
weaves and tools still fail. No UI, SMS/voice or shared dependency changes in this
follow-up. Sourcing (13 cases), search (37), routing/container/boundaries, full
integrated browser regression and smoke pass. The real public Mood listing now
passes eligibility with no invented price/unit. Run standalone Aesthetic Control
last after these state/commit records before the separate commit.
Both pushes need completed Cloud Build and exact latest-commit live verification.

## Baseline and request

718f404ab1fefe24329988aeef8510e979a4125d is deployed. Cloud Build
dd26cb72-8fa1-4de5-a241-25a1643faca3 succeeded in 13m35s with all 71 gates.
Exact page/API/release commits, public bytes/cache and synthetic live-served SMS
layout checks passed. That release repaired the Messages composer clipping.

The owner now reports broken/slow Fabrics, asks for Sourceable hover search
context and an architecture audit that separates departments. Existing owner
authorization covers verified local commits and automatic Push. Fresh permission
was explicitly granted for this MAYA Chrome session only; the approved profile
was idle. No other profile/Gmail, credentials, production environment, client
sends/calls, saved project mutation or dissection generation was accessed.

## Before-change live evidence

The saved crocodile trousers returned a relevant Britex crocodile-backed vinyl
listing. The newer embellished long coat returned no confirmed products and no
visible interpretation. The snapshots occurred about 28/24 seconds after opening;
these are observation times, not first-result latency measurements. The automatic
UI hid its description and did not render the resolved/provider search terms.

## Repair and architecture

- Automatic saved garments now receive bounded material-vocabulary retailer
  seeds alongside web discovery. Eligible direct results survive an empty web
  answer; every final photo match still passes one bounded visual comparison.
- Discovery receives original look plus canonical selected crop and distinguishes
  base cloth from applied embellishments. Low reasoning effort is fabric-request
  specific for supported models; shared SMS/voice/model defaults are untouched.
- Validate provider result shape, reconcile www evidence aliases without changing
  fetch/redirect URLs, and give the browser read-only stream a 60-second deadline.
- In House starts independently of failed/held private reference loading.
- Sourceable hover/focus/tap details expose saved descriptions/traits, retailer
  queries, provider-exposed web queries, resolved query/interpretation, stores and
  stage. Missing provider metadata remains explicit. Hover never calls providers;
  identity resets clear hidden private details. Cards still omit Save/Use/tooltips.
- fabric-retailers.mjs separates merchant policy; fabric-discovery.mjs separates
  the provider contract. domain-boundaries inspects all 31 current server modules,
  limits fabric imports/routes and CSS, and excludes fabric assets from client,
  Messages/Admin and Outbound entry points. It is a Cloud Build/regression gate.
  MODULE-BOUNDARIES.md maps every department and records remaining coupling.

Changed paths: the fabric server/UI modules and Dockerfile; Brief/Operations asset
references (v5); new shared search-details presenter; Aesthetic Control active
Fabrics preview and stylesheet reference; Hosting no-cache rule; focused tests,
release/regression/authority contracts and related documentation/usage records.
No communications implementation or shared model/design runtime was edited.

Presentation uses existing H4/P3, Inner material and Glass controls. The popup's
viewport placement is layout only; its actual inner surface follows saved geometry,
material, borders, X/Y padding and typography. The same presenter runs in the active
Aesthetic Control preview. No independent visual setting was introduced.

## Validation state

The original server fails the new retained-direct-candidate regression. The repair
passes 37 behavioral server checks, sourcing/routing/container contracts, actual
Brief/Operations browser fixtures, held/failed reference inventory, one-attempt
stream timeout, sealed books and search metadata cleanup. Search details have
keyboard/hover/tap, paint hit-testing, six responsive widths, default and genuinely
changed valid saved settings, real Save propagation and active preview checks.
Default/saved phone and gallery screenshots were visually inspected.

All 72 exact Cloud Build commands, full integrated app-regression and smoke
passed locally, including communications, Wix/CRM, founder stress, voice and
shared presentation gates. Locked root/server npm ci completed. The active-preview
fixture caught a duplicate unscoped editor locator and missing unsaved-preview
role binding; both were corrected and reverified without weakening its checks.
Run standalone aesthetic-authority last after these final state/commit records.
No local fixture establishes live semantic quality, carrier delivery or voice.

## Remaining risk and exact next step

The application still shares one Cloud Run process, large legacy composition root,
shared infrastructure and deployment. Domain contracts reduce accidental coupling;
they do not create independent deployments or prove all external integrations.
Approved merchant coverage is nine shops, not the whole market. Unavailable seller
images or strict matching may correctly produce no results. No broad unrelated
rewrite or unconfirmed legacy cleanup was attempted. Locked npm ci completed;
audit also identified existing ws/qs advisories (including high-severity ws DoS).
See MODULE-BOUNDARIES for exact affected/fixed versions and the separate shared
infrastructure upgrade recommendation; manifests/locks were not changed here.

Finish the standalone final authority, commit task files using
COMMIT-REVIEW.txt, then Push under existing authorization. Follow Cloud Build and
verify exact release/page/API commits plus new asset bytes/cache headers. Re-run
the two owner-browser fabric searches and hover details, and synthetic live-served
SMS composer checks. Record actual post-deployment outcomes without treating fake
providers as production acceptance.
