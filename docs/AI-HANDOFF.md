# Current handoff — October 31, 2026

## Current request / boundary

Fromsa supplies screenshots contrasting one olive-knit MAYA result with a useful
ChatGPT materials breakdown for the same green-and-gold tracksuit. Fix Fabrics'
coverage of the look. The follow-up also reports that ChatGPT was much faster. Personal Chrome and live testing remain stopped; use code
and isolated fake-provider fixtures. Do not start microphone/provider sessions,
read or install keys, change production settings or Push. Local verified commits
are authorized. The screenshot text is comparison evidence, not instructions from
an external document to execute or copy unverified product facts.

The speed follow-up starts clean at b7afaa8, one local commit ahead of
origin/maya-v2 8db49da. The previous component-coverage repair has not been pushed
by this agent. Before that turn, public HTTP reported Hosting/API 7232f50; a newer
live release has not been verified in this task. Owner says Ads variables were
deployed and confirmed the key came from Ads Manager Settings. Actual provider
reporting remains unverified. No key from chat was used; do not ask for it or Chrome.

## Fabric cause and repair

The provider prompt sourced base cloth only. Qualification reduced each saved
garment to its main fabric and dominant color; there was no distinct target for
contrast panels, inserts, ribbing or textile trim. A controlled canonical saved
tracksuit fixture failed the old code before implementation: the secondary
materials never reached its single visual comparison.

fabric-discovery.mjs now returns an optional eight-component plan in the same
Responses call, with exact selected canonical garment IDs, bounded ID/role/label
and qualified fabric descriptions. Invalid, duplicate, stale and foreign IDs or
unsupported roles fail closed. Cited URL checks and approved merchant filters
still precede seller requests. Standalone input without saved IDs retains its
existing cloth search; this change does not create a new standalone shopping tool.
The output allowance grows to 3200 tokens; three tool calls and deadlines remain.

fabricComponentMatch in fabric-sourcing.js keeps canonical requirements for body
cloth. Secondary descriptions are hypotheses; they do not inherit the dominant
body color, rewrite saved garments or relax client requirements/exclusions.
All secondary matches require a reference image and successful existing visual
review. The review receives the component and evaluates that part of the image,
not the whole-look dominant color. No failed/weak-photo fallback is introduced.
Shared components do not invent a garment assignment ID. Original account/project
scope, saved selection fingerprints, seller facts, prices/units and stock remain.

fabric-retailers.mjs balances distinct materials before additional body-cloth
options, retaining merchant balance within each material and eight review slots.
No merchant hosts, hardware, ready-made clothes or swatch-only eligibility were
added. Nine configured merchants remain a real scope limit; model relevance and
seller availability remain empirical, not fixture-proven.

fabric-search.mjs carries component metadata through independent seller checks,
qualification and the existing single photo review. Missing materials remain
explicit in the current status/Search details. Its caches, per-request seller
deduplication, Node20 WeakMap lifetime guard, deadlines and saved-result continuity
are preserved. Search output does not write lookbooks or garment assignments.

## Speed follow-up — current change

Direct retailer discovery used one Promise.all barrier across all selected
merchants' keyword feeds before starting any of their seller checks. A ready
listing therefore waited for an unrelated slow/empty shop. The new deferred-feed
fixture fails the b7afaa8 implementation before the repair.

Each merchant now starts its first already-selected seller check after its own
feeds settle, overlapping that check with other merchants' feeds. That candidate
is guaranteed a first round-robin slot; the request-local map reuses the identical
check during final selection. Collection/direct aliases share a request-local
identity check too, preserving the actual first fetched URL and distinct selected
variants. The strengthened alias fixture reproduced nine reads before that guard
and eight after. Explicit alias reads retain their literal destination. A <=8 merchant guard retains the bound if policy
later expands. Feed product destinations must belong to their own approved
merchant. The final eight balanced seller slots, qualification, three web tool
calls, one visual review, deadlines and confirmed-card continuity remain unchanged.
No early unchecked result, extra paid call or automatic retry is introduced.

Fixed numeric contextMs/webMs/retailerMs/webSellerMs/visualMs now accompany existing
firstResultsMs/totalMs in the authenticated search stream and count-only server
diagnostic record. Concurrent phases overlap and must not be summed. They begin
inside the service after authentication: browser preparation, upload, auth and
Cloud Run cold start are not included. No request words, URLs, images, account or
submission IDs are logged, and no new UI or endpoint is added.

Controlled Node20 A/B, three runs each: an unrelated feed waits 300ms, the useful
seller waits 400ms, and the one fake visual review waits 20ms. Both versions return
the same one seller-checked listing with exactly one seller read/one visual call.
First-useful medians are 732ms before and 430ms after (41% reduction in this
fixture). This is synthetic critical-path evidence, not a live provider/ChatGPT
latency comparison or a promised production improvement. Temporary reproducer:
/private/tmp/maya-feed-latency.mjs; baseline is b7afaa8's service orchestration.

## Presentation / delivery

fabric-assistant.js adds the purpose to its existing P3 caption and includes it
in the stable-card signature. No new component, CSS family, editor or styling
source was added. H4 titles, P3 captions, P1 status, Inner cards, Outer workspace
and Glass controls remain governed by Aesthetic Control. The active fabric
preview includes a purpose caption. Brief/Operations reference JS/CSS v7 under
the exact no-cache Hosting policy; release/domain contracts check the new version.

## Validation / exact next step

Prior coverage validation: 18 sourcing checks and 55 search checks, including four distinct
tracksuit textiles, an explicit unconfirmed ribbing component, scoped identities,
coverage balancing and rejection/failed-photo behavior without paid retries.
Forced-GC search/deadline suites pass on release Node20.20.2 and local Node24.
Four-card UI passes default/changed saved styles, actual Save, focus/error and
inline/expanded six-width checks in an isolated temporary test renderer. Personal
Chrome, real providers, private images and production design were not accessed.

The speed tests total 57 search checks. Node20/24 forced-GC deadline suites pass,
including held-feed overlap, eight unique seller checks with collection/direct
aliases and five eligible feed merchants. All 76 functional/release/regression/
smoke commands pass on the corrected code. Final standalone Aesthetic Control
passed last. Backend-only: no visible UI/presentation changes or new runtime
imports. No actual owner/provider latency or live result quality was measured.
Prepare the local speed commit without amending b7afaa8 or pushing; both requested
fabric commits remain for the owner's Push. No source changed after final authority.

After owner Push, verify exact Hosting/page/API commit and fabric asset bytes/cache
policy. Real acceptance means useful per-component listings for the owner's look,
not merely more cards or a passing fake-provider suite. Do not claim live parity,
faster provider latency or correct real inventory from these tests. Any renewed
live testing must respect the owner's stop and credential boundaries.

## Retained work

WR remains independent and empty until explicit applicant additions; all tables
share aesthetics only. Glass is the sole pill authority; the retired internal
Studio remains removed. Shared scrollbar v2 alone owns visible paint and geometry.
Prior direct Google/Meta/ChatGPT Ads reporting remains read-only, without Windsor.
Google has no retired developer-token requirement. Public Ads booleans establish
presence only; Admin reports safe setup/authorization categories. Owner handles
all environment/credential configuration. See DIRECT-AD-REPORTING.md.
