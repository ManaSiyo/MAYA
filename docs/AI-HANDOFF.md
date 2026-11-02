# Current handoff — November 1 worldwide Fabrics verification

## Owner request and boundaries

Verify logically whether the image-led worldwide Fabrics flow works in Brief and
Operation Room, including the OpenAI connection. Personal Chrome and paid/live
provider searches remain stopped. No microphone, credential/environment access,
account mutations or Push. Local verified commits are authorized. No previously
pasted key was used or stored.

## What is actually deployed

At the start the checkout and origin/maya-v2 both point to 8c2586a, with no changes.
Public tests/verify-live.mjs passed: release.json, App/Admin build stamps and API
health all match 8c2586ac7461772002de37e9701a120ff957ea5b. OpenAI/storage presence
booleans are true; they do not prove authorized model requests or result quality.
Public Brief/Operation Room HTML bytes exactly equal the checkout, include fabric
v8, and shared JS/CSS bytes match with no-cache delivery. Those two pages have no
per-page build meta even locally; an initial stamp-only probe was corrected to
exact byte comparison, not treated as a deployment failure.

The worldwide main rewrite is deployed. It receives the original image, canonical
selected crop, saved client words and selected garment through the same shared
assistant from Brief and Operation Room. Service branches to one streamed OpenAI
Responses image/text/image-web-search request before optional feeds, seller reads
or the second visual rank. No allowed-domain filter or selected shops applies to
the main branch. Local/named-shop searches are explicit independent modes/caches.
API fields and source-linked image-result shape were checked against current
OpenAI Docs. Existing configured model is preserved; no deployment environment
values were inspected. This verifies wiring/contract, not a paid production search.
See FABRIC-SEARCH.md for the complete active architecture.

## New reproduced defect and local repair

Late source evidence was not rechecked for a card already published without a
photo. A later caption could identify client-excluded polyester and still leave
that card visible. A new fake-provider server fixture fails the deployed code at
missing retraction. A UI fixture also fails when a removal followed by a stream
error restores the old retained card. Empty interrupted results could leave a
previous private cache entry intact too.

fabric-worldwide.mjs keeps each accepted URL's canonical parent garment context.
Later raw source image captions re-run known client exclusions. Conflicting URLs
are deleted and emitted in incremental removedUrls alongside the remaining cards.
Request-local exclusion tombstones prevent an earlier source item replayed at
completion from resurrecting the URL; the strengthened fixture reproduces this
ordering too.
No added provider call, seller fetch, retry, source URL relaxation or private shared
cache. Unknown facts remain unknown; this corrects known contradictions only.

fabric-assistant.js removes explicit retractions from retained cards, uses the
remaining published list and evicts its prior private mode/garment cache before
remembering survivors. A subsequent stream error or focus switch cannot resurrect
the material. Other loaded/source-backed cards retain their existing behavior.
Brief/Operation Room references become v9 under the same exact no-cache rules;
release/domain assertions follow. There is no new visible component, CSS family,
material, role or editor: existing P1/H4/P3/Inner/Glass remain the authority.

New world test covers initially unknown fiber, later source contradiction, removal
and final empty results. UI covers removal followed by failure and silent garment
round trips without restoring cached copies. app-regression records this request.
AGENTS, design and FABRIC-SEARCH document the explicit retention exception.

## Verification and next step

Before repair, code-only reruns passed 18 sourcing checks and Node20/24 forced-GC
search/deadline suites. The new negative server and UI fixtures failed the old
behavior before implementation. After repair all 11 worldwide checks and the
focused UI workflow pass, including private cache invalidation and replayed earlier
source evidence. All 76 exact functional/release/regression/smoke commands pass.
Forced-GC behavior/deadline gates pass on release Node20.20.2 and local Node24.
Final standalone Aesthetic Control passes last, re-executing the changed workflow
and shared default/saved styles at six widths. Default desktop and deliberately
different saved expanded/phone captures were visually inspected. No new UI family
or production design change; no runtime source changed after final authority.
Prepare the local commit with COMMIT-REVIEW aligned, then leave Push to the owner.

After local verification, leave the repair committed for owner Push. The main
8c2586a flow is live; this late-evidence correction will be local until that Push
and successful Cloud Build. Then verify exact release/API stamps and v9 asset
bytes/cache policy. Do not claim a local repair is already deployed.

Actual provider entitlement, real materials coverage, image relevance and first
useful latency have not been exercised with a paid production request. Code tests
and correct deployment identity cannot establish identical ChatGPT speed/quality.
Respect the existing stop on live testing rather than silently resuming it.

## Retained scope

Private account/submission boundaries, canonical saved IDs/photos/words, Node20
combined abort lifetime guard, 50/55/60-second bounds, optional approved retailer
verification and generation-checked historical lookbooks remain intact. No missing
pieces generate on read. Browsing does not create fabric assignments. Independent
WR, sole Glass/table/scrollbar authority, retired Studio/Outbound, direct Ads and
communications/voice configuration remain unchanged.
