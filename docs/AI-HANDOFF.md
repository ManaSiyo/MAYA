# Current handoff — October 26, 2026

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
