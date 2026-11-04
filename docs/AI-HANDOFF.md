# Current handoff — November 3 simple Fabrics relay

## Owner request and implementation

Fromsa approved implementing the simpler image → OpenAI search → Fabrics viewer
plan after the read-only audit. The same saved dissected piece should work as the
primary reference, with useful source photos and conversational refinements.
No extra search provider, second model stage, ChatKit dependency or generated
fabric imagery was added. This uses the public Responses web/image tool already
in MAYA; it does not embed the owner's personal ChatGPT session.

`docs/server/fabric-worldwide.mjs` now sends the canonical selected dissected
image first and the original look as supporting context. A short sourcing task,
client preferences/history and selected garment name replace the verbose prompt
and speculative saved-fabric payload. Canonical IDs/metadata remain on the server
for scope and exclusions. The small output records need only interpretation and
URL/title/reason. The request still uses the configured model, one Responses call,
five-tool-call/6000-token/32-image ceilings, cancellation and no automatic retry.

Source photos may publish with qualified apparel/color evidence before a written
shortlist or completion. The display selects up to 12 different website hosts,
photos first, with modeled choices preferred within the photo pool. Accent-first
captions no longer automatically disqualify the main color. Known wrong variants,
private/ungrounded URLs and explicit client exclusions remain protected. Later
ambiguous variants or excluded material evidence retract automatic raw cards;
failed streams retain only remaining sourced results and never become success.
Seller facts stay unknown and raw alternatives invent no garment IDs.

`aesthetics/ui/fabric-assistant.js/.css` exposes the existing follow-up field and
Stop for saved looks. Typed requests reach the server without being overwritten by
the default prompt; canonical saved-garment validation remains active. A new
refinement clears old results; explicit Refresh retains the last request/results.
Healthy images survive model title/reason updates. Each eager image URL gets an
eight-second deadline, with at most four source-backed attempts; detached cards
cancel deadlines and late timed-out images cannot restore themselves. Missing
links have content-sized full-width tracks below worldwide photos, including in
mixed grids. Phone Favorites reserve space for existing Remove controls.

The sole active Fabric preview in `workspace-previews.js` now includes the shared
P1 field and P3 Glass Find fabric/Stop controls. H4/P3/Inner photo cards, field
material, focus and Glass remain under existing saved authority. Desktop places
follow-up field/actions in one row; phones stack them. No saved schema/editor or
new visual authority was added. Brief, Operations and gallery CSS references are
v11; Search details remains v2. Hosting already revalidates these assets.

## Changed files and checks

Runtime: fabric-worldwide.mjs, fabric-assistant.js/.css, Brief/Operations version
references, aesthetic-control.html and workspace-previews.js. Instructions/docs:
AGENTS.md, FABRIC-SEARCH.md, design.md, this handoff, requests/fixes and COMMIT-REVIEW.
Tests: worldwide, images UI, search UI, domain/release asset contracts,
app-regression and final aesthetic-authority. Typography-role regeneration made
no count/output changes. No Docker import was added; existing world module ships.

All 77 functional/syntax commands in the Cloud Build test step, full
app-regression and smoke pass. Worldwide (26), legacy/conversational search (57),
forced-GC and sourcing checks pass on both Node20.20.2 and Node24.22.1. Isolated
image/search UI and workflow checks pass, including six widths, default and actual
saved styles, active preview controls, focus/errors and shared Save propagation.
Default/saved desktop and phone captures were visually inspected. Locked root
npm ci passed offline; typography-role regeneration produced no output changes.

The integrated Aesthetic Control checks also pass within app-regression. The
standalone tests/aesthetic-authority.mjs remains the required final command after
all file edits and before the local commit; commit only if it succeeds. No
functional test or live acceptance is substituted for that final authority gate.

The tests use fake providers and temporary headless Chromium profiles. No personal
Chrome, live paid search, credentials, provider configuration, push or deployment.
The same original green owner image was not provided to this task. These checks
prove adapter/UI behavior, not identical ChatGPT relevance, live image availability
or latency. The actual production model override remains uninspected.

## Release state and exact next step

The preceding read-only research verified Hosting, API and served Fabric v10
assets at cb1c0d2320396184774bb0b9170538f574560fef, published
2026-11-04T01:30:25.440Z. Earlier notes saying production remained 41df1a5 were
stale; the notification fixture repair and earlier Fabric/Admin changes deployed.
This implementation is local and is not part of that verified production release.

Run standalone tests/aesthetic-authority.mjs last, then commit only these verified
task files. The owner controls Push; there are no remaining functional edits.
After the owner's Push: require successful Cloud Build, exact release/App/Admin/API
commit and Fabric v11 bytes/no-cache; then compare the same dissected piece and
request with the owner's ChatGPT example. Inspect returned tool photos versus
visible cards if the result differs; do not add another provider before that
comparison. No claim of live acceptance until the intended revision is deployed.

## Preserved continuity

Admin drawer stays Settings, Messages, Logs. Private fixed-state notification
history, H3 headings, shared circular D/W/M and closed-section spacing remain.
The cb1c0d2 fixture helper distinguishes bounded authenticated notification writes
from owner actions without weakening any release, blocked-GIS or send guard.
Separate explicit retailer searches and historical private lookbooks stay intact.
Sealed account/submission/garment boundaries and Node20 combined-signal lifetime
protection remain unchanged. Google and ChatGPT Ads were owner-confirmed visible;
Meta remains unconfigured. No credential/environment work is part of this task.
