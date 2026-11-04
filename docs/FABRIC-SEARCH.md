# Fabrics — worldwide main search and separate optional retailers

## Owner's current intent

The main Sourceable experience is image → identify the dominant body-cloth color and apparel use →
search broadly worldwide → show useful source-linked fabric photographs. Closer
weave/motif and secondary textile options follow; bespoke embroidery is not a
mandatory feature of the cloth. Local and
named shops are optional searches the owner may explicitly choose later. They
have no default priority, domain restriction, feed work or waiting time in the
main path. This supersedes older all-five-selected filter and universal inventory-
verification requirements. It is an image-led sourcing assistant, not a default
nine-merchant inventory matcher.

## Main path

`docs/server/fabric-worldwide.mjs` owns one Responses request using the existing
configured text/vision model and OpenAI key. It receives the canonical selected dissected image first when available, the
original look as context, the selected garment name, client fabric preferences
and refinements. Canonical IDs and saved garment metadata stay on the server for
scope and exclusions; speculative saved fabric descriptions are not sent as
search requirements. The sourcing instruction explicitly asks for photographs and
selects their source_website_url pages. Text-only website recommendations must not
pad the shortlist. Explicit client
exclusions remain authoritative; known contradictions are rejected without another
model call. Scope/account/submission checks happen before provider work. No piece
generation or assignment writes occur on read or browsing.

The request uses web_search with image-only content, page-linked image results,
source lists and streaming. It has no allowed_domains, preferred merchant list or
local bias. Five search tool calls, 6000 output tokens and up to 32 requested image results
bound the single request. Counts are limits, not a promised result minimum.
There is no retailer keyword-feed fan-out, arbitrary seller fetch, or second paid
photo-ranking request on this path. There is no automatic paid fallback/retry.
The provider starts with dominant color/shade plus apparel/body-cloth use and
several plausible constructions, then considers closer motifs and other textiles.
Automatic worldwide requests retain explicit request/history words instead of
replacing them with verbose saved fabric guesses. Canonical garment metadata is
sent separately. Latest request exclusions are explicitly checked alongside saved
preferences/history. Actual bounded tool queries are available in private search
details data for diagnostics; none are logged.

Model output consists of small NDJSON interpretation and URL/title/reason records;
the model need not reconstruct garment IDs, materials or seller records. The server
accepts candidate links only when they appear in provider search sources or URL
citations. Product photos come only from raw image_result image/thumbnail URLs
whose source_website_url matches that product page. Tracking fields/fragments and
a trailing slash spelling may normalize; distinct hosts and meaningful query/
variant identities cannot be merged. Canonical photographs precede thumbnails;
same-page images with known different primary colors are not fallback choices. A model-supplied image URL is
ignored. Useful raw image-result pages can stream as soon as tool evidence and a resolved
color are available, without waiting for model candidates or completion. These need positive apparel/yardage evidence,
a recognized primary color family and no known exclusion, editorial/category,
decor/finished-garment or ambiguous multi-color variant evidence. They receive a
qualified color-alternative reason and no guessed garment IDs or seller facts.
Model candidates have priority within the photo pool. The viewer selects up to
12 distinct website hosts (www aliases grouped), with at most one product per
website in each response; it never pads a sparse result. Accent colors mentioned
first do not automatically override the body color. Later conflicting variant
evidence retracts automatic raw suggestions, including on an interrupted stream. Photo-bearing cards take
display slots ahead of links without photographs; browser order keeps photos ahead
of retained or newly failed source links without replacing healthy DOM nodes; displaced links are removed
from retained current results. Missing/exhausted photographs keep a compact
two-row source link with the shared Photo unavailable fallback. Unsafe schemes, credentials, ports, private/local host forms and IP
literal destinations are rejected. Crucially, this server never requests an
arbitrary discovered host with or without credentials.

These are **web-sourced suggestions**, not independently verified current seller
inventory. Model output cannot set price, currency, unit, stock or composition
fields; they stay unknown. A photo never proves exact fiber, GSM, stretch, quantity
or delivery. Finished clothing, footwear, tools, patterns/hardware and swatch-only
suggestions remain excluded. Upholstery, furnishing and decor evidence in the
source path (including escaped words), title, reason or image caption rejects every
worldwide card, including model-selected links. Late evidence retracts already
published cards through the existing retained-result/cache removal path. A completed
response containing only links explicitly reports no fabric photographs returned.
No generated replacement photo is used. A useful
alternative should be described as uncertain, not turned into an exact match.

## Streaming and interruption

The same request reads response.output_text.delta, response.output_item.done and
response.completed events. Candidate records can arrive before source evidence;
they are queued until grounded. Once grounded, an incremental products event
publishes the existing cards before overall completion. Some provider responses
may expose complete source/image data only at the end; those candidates wait for
evidence rather than guessing it. JSON nonstream responses are also handled.

SSE input is capped at 2 MiB, model text at 100k characters, pending candidate
model records at 48, raw photo candidates at 48, combined model/photo candidates at 96 and displayed
suggestions at 12 distinct websites per response. The existing browser retains at most 48 unique
results across explicit refreshes. These are bounds, not an artificial minimum. Terminal completion releases the
reader without waiting for EOF. Failed/incomplete/early-ended streams stay failures;
already source-backed cards can remain visible and cached, without marking the
search complete or automatically retrying. If later source captions reveal a known
client exclusion, an incremental removedUrls list retracts those products. The
client removes them from current and retained cards and evicts the prior garment
cache before remembering any remaining results. A later error must not resurrect
them. Request-local exclusions also survive replayed earlier source items in the
provider completion. This exception preserves useful unknown suggestions while known conflicting
materials cannot hide behind retention. Exclusion captions are retained
independently of the four displayed image URL candidates; fifth/later evidence
cannot be discarded by the fallback limit. Provisional optional-retailer results
are still hidden until their old checks finish.

Worldwide provider work has a 50-second deadline inside the existing 55-second
route/60-second browser bounds. Parent cancellation settles even when fetch/read
ignores abort. The Node20 WeakMap lifetime guard retains timeout sources; the
forced-GC suite exercises both the world deadline and optional legacy deadlines.
No request, image, search terms, source URL or account IDs are logged. Fixed numeric
context/web/retailer/webSeller/visual/firstResult/total timings remain aggregate
service diagnostics. Overlapping phases cannot be added together; browser
preparation/upload, auth and cold start are outside these timings. World retailer
and second-visual phases are zero.

## Explicit optional retailer searches

The existing nine approved merchants and seller verification remain available
only when `mode: retailers` is explicitly requested. Browser buttons run one
separate group search on a click: Local (Britex/Brightex, Stonemountain, Harts),
Mood, Swatchon, Amazon, Others (Blackbird, The Fabric Store, Tessuti). Opening the
choices makes no provider call. Clicking an already-loaded group reuses its own
results; Refresh explicitly reruns it. Returning to Sourceable restores worldwide
results, without another main call. Store groups never filter the global grid.

`mode` defaults to worldwide. Old client storeGroups/stores fields cannot silently
restrict that default. Retailer mode retains validated nonempty groups, current
scope overriding earlier shop-only restrictions, approved HTTPS/product URL policy,
revalidated redirects, source-backed seller pictures and seller-only price/unit/
stock. Swatches and out-of-stock products remain excluded. Optional variant facts
have 1.2 seconds within an 8-second listing budget. Retailer feed/web work overlaps;
eight balanced seller/visual slots, one bounded photo comparison and collection/
direct identity dedup remain. Explicit alias reads preserve literal URLs and
selected variants remain separate. No production credentials/config changed.

## UI, continuity and sealed data

`aesthetics/ui/fabric-assistant.js` is shared by Brief and Operations. Main defaults
to worldwide with no shops selected. The existing optional shop icon opens their
buttons; Sourceable returns to global. In House and Favorites remain independent.
Worldwide, each selected group, garment metadata, preferences and reference have
separate bounded in-memory result contexts for the current account/submission.
Switching scope never mixes their results. Actual account/project changes clear
private state; nothing private enters localStorage or a shared public catalog.
Explicit new search clears prior mode caches for that garment; new references
return to worldwide. Same-account token renewal retains state and drafts.

Confirmed/source-backed card and image nodes remain mounted during Refresh when
unchanged. A model title/reason arriving after a raw tool photo updates its text
without replacing the healthy image. Saved-look searches expose the same shared
follow-up field and Stop as manual searches. Typed refinements retain canonical
saved-context validation and previous conversation, but start a fresh result set
so old matches cannot contradict a new exclusion. Explicit Refresh retains the
existing result set and latest submitted refinement. Failed/empty refreshes keep existing cards. Prepared photos remain a
two-reference project-bound cache; the result cache holds 24 contexts. Recent
empty completion is reusable for 30 seconds. Partial cached searches retain their
interrupted state and need explicit Refresh to continue, never an automatic retry.
These are memory caches, not promises of permanent saved search history.

The existing P1 observation region is one clipped row; Search details contains
the full qualified interpretation. Every card has exactly two visible text rows:
H4 name and P3 source/known-unit price. Full garment/material/reason context is in
the accessible source link name. Photos use a responsive auto-fit grid, crop with
object-fit:cover and fill available rows; three results do not reserve a fourth
empty column. Cards use Inner and controls Glass. Eager browser image requests each have an eight-second deadline and
try at most four validated source-backed URLs once each, with no referrer or
provider retry. Timeout/revocation detaches the old image so late callbacks cannot
replace a newer photograph. Removed cards cancel their image deadlines. Missing
links use content-sized full-width rows even in a mixed photo grid. Detached old-account cards cannot start fallback work. Healthy
image/card nodes survive additional evidence and Refresh; explicit source-backed
wrong-color revocations override retention, including loaded/loading photos and
late callbacks. Explicit Refresh can retry exhausted photographs. The bounded
results scroll area keeps first-row desktop titles/sources visible and avoids
nested outer scrolling at all six tested widths. Active Aesthetic
Control previews the same P1 interpretation and existing card/pill families. No new
style family/editor was introduced. Default/saved styling, actual Save, six widths,
focus/error and inline/expanded behavior remain mandatory checks. JS/CSS references
are v11 and Search details v2 under their exact no-cache Hosting rules. New runtime module ships in Docker.

Private legacy books remain at
private/fabrics/<encoded authenticated Google sub>/<submissionId>/lookbook.json.
Their generation-checked Save/Use compatibility API and explicit Remove are
unchanged. Browser cards have no Save/Use controls. Historical garment assignments
remain fingerprint-bound and feed the actual selected Operations garment; browsing
worldwide suggestions never creates or changes one. Do not delete migration or
legacy records. Original photos/words and canonical saved IDs remain intact.

## Verification / honest limits

Run fabric-sourcing, fabric-search and fabric-search-gc on release Node20 and local
Node; new tests/fabric-worldwide.mjs is imported by the existing search gate and
its forced-GC child. Run fabric-search-ui, fabric-images-ui, fabric-workflow-ui, existing routing,
container/domain/release contracts, full regression/smoke and final standalone
Aesthetic Control last. The November 3 negative fixtures reproduced a three-record answer dropping
fourteen usable source photos, a failed thumbnail discarding a valid canonical
image, multiline captions and a phantom empty column. New tests cover these,
same-page mixed-color fallbacks, fifth-caption exclusions, photo-first display
limits, explicit refinements and unknown-color/decor/product rejection. Fixtures
also cover unapproved-but-public global merchants,
one main call, no feed/rank work, source-only images/facts, canonical context,
progress before completion, private URL rejection, interruption, both deadline
sources, explicit separate shop calls and scope restoration without paid retries.

This implements the requested public API workflow; it does not copy ChatGPT's
private prompts, backend or hosting. Exact live speed, OpenAI account entitlement,
search quality and retailer availability remain empirical. No paid live test or
owner Chrome access was resumed. After owner Push, verify exact release/API/asset
identity, then compare the same look and constraints for first useful result,
coverage and factual accuracy. Do not claim a fake-provider test proves parity.

Official API contracts read for this implementation:
- https://developers.openai.com/api/docs/guides/tools-web-search
- https://developers.openai.com/api/docs/guides/streaming-responses
