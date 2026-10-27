# Conversational fabric sourcing — October 21, 2026

October 18 owner review: Sourceable exposes exactly five independent filters:
**Local (Bay Area), Mood, Swatchon, Amazon, Others**. All start enabled. Local
contains only Britex (also recognized as “Brightex”), Stonemountain and Harts;
Others contains the existing Blackbird, The Fabric Store and Tessuti sources.
These are merchant groups, not a live pickup or stock promise. Filter changes
only narrow the displayed results and cancel stale searches. **Refresh** explicitly
searches the selected groups; filter clicks and expansion make no paid calls.
An empty selection never falls back to an unrestricted search. Explicit filters
replace earlier merchant-only constraints while retaining material refinements
and any unsent draft. Favorites and In House are independent of Sourceable filters.

Fabric cards no longer expose Save or Use. Existing private favorites and garment
assignments remain readable; Favorites retains explicit Remove. Browsing never
creates or changes assignments. Product links keep their real destinations and
verified unit price when known, without long duplicate hover copy. View tabs use
the shared segmented-control contract. The inline workspace fills the same host
as the garment; small viewports scroll its content rather than enlarging that host.
An authorized live crocodile-trouser search returned a relevant listing; a newer embellished-coat search returned no confirmed products before the October 21 repair. See AI-HANDOFF.md
for the current release state.

From the Brief or Operation Room, choose Fabrics after a dissection has been
saved successfully. The selected garment, original look and client preferences
start the search automatically; Full view uses all saved garments. A failed or
unacknowledged save does not unlock this workflow. Reading a saved dissection
never generates missing garment images.

Sourceable, In House and Favorites use the same inline viewer. Refresh reruns
the current garment request; Filter stores restricts merchants. Expand enlarges
that same DOM/view into an optional dialog and Escape/Collapse returns it intact,
without another search. Cards have a larger photo and two concise caption rows.
Stable saved garment IDs keep duplicate garment names distinct. Fresh dissections
use UUIDs; legacy saved pieces without IDs retain compatible index-based reads.
Refinements separate positive requirements, exclusions and the latest replacement; “no wool”
never requests wool. Missing retailer images never become invented image URLs,
and a failed favorite thumbnail keeps its management actions. Cards
show garment purpose and available seller facts, not duplicate inventory
labels, match percentages or guessed delivery. Tools/notions and unrelated
materials are rejected. No weak fallback is relabeled as a good match.

The separate bottom Fabrics button and Dictate/Find Fabric flow are retired.
The shared assistant retains optional photo/text refinement for standalone
programmatic access; saved-look mode uses its automatic context. Photo attachment
never calls image generation. No purchase capability is added.

## Runtime

Saved dominant fabric_hex contributes only a clearly chromatic color-family hint
when saved words do not already name a color. Ambiguous hues/neutrals stay with
visual comparison; explicit latest color instructions override the hint. Seller
facts with an opposite known color fail qualification even if an AI likes the
texture. Validated discovery color families are scoped to canonical garment IDs;
ambiguous repeats are omitted, and legacy garments without hex can use these
qualified hints. Requalify initial retailer candidates after discovery. Ranking receives the resolved search and qualified reference observation
alongside the selected crop, and rejects a visibly wrong dominant color. No exact
fiber, shade, stock or price is inferred from the image. Bounded public seeds keep
crocodile/snakeskin/long-pile vocabulary from the base cloth, never secondary trim
or private prose. Known notions are filtered before the three-item feed budget;
missing feed metadata still reaches normal seller verification. Search begins
across the allowed merchant scope rather than consuming all calls on local shops
unless the owner actually selected that scope.

- `aesthetics/ui/fabric-assistant.{js,css}` is shared by both served screens.
- `docs/server/fabric-search.mjs` owns `/api/admin/fabrics/search` (NDJSON),
  `/api/admin/fabrics/lookbook` (GET/POST), seller parsing and storage.
- Search requires Admin authentication and the existing account rate limit.
  It uses the existing OpenAI server key and `MODEL_TERRA || TEXT_MODEL`; no new
  credentials or environment setup was performed. A bounded Responses API request
  uses web_search, at most three tool calls, original photo plus words, and six
  prior refinements. At most eight source-verified products enter one visual
  comparison against the selected saved garment crop (the full original photo
  remains discovery context). This uses the existing fabric.visual_rank route,
  capped at one attempt and eight seconds; there is no automatic paid fallback.
  Weak, invalid or failed comparisons return an explicit empty result, not
  unrelated alternatives. Missing or inaccessible retailer images can prevent
  comparison; the UI reports that limit rather than claiming a match.
- Requests contain bounded garment metadata instead of nested piece images,
  patterns or meshes. The integrated large-piece fixture sends 6,000 bytes rather
  than more than 5.6 MB; the server obtains canonical saved pieces/crops itself.
  Original reference photo and structured client preferences remain separate
  inputs. In House inventory loads independently, so reference or lookbook failure
  does not prevent available inventory photos from appearing.
- Britex, Stonemountain, Harts, Amazon, Mood, Swatchon, Blackbird, The Fabric Store and
  Tessuti are the allowed discovery domains. Amazon is web discovery, NOT a
  Creators API integration or a promise of exhaustive Amazon inventory.
- A bounded material-vocabulary Shopify pass runs alongside web discovery for
  saved looks and initial text requests (at most two seeds/four eligible stores).
  Up to three feed products per query are eligible for balanced selection; at
  most eight distinct seller listings are verified concurrently.
  It never sends client names or free-form private prose to retailer feeds.
  Early retailer candidates remain hidden while photo comparison is pending;
  only completed matches appear as cards. Empty later web discovery cannot
  erase eligible direct candidates. Refinements bypass seeds rather than replay
  stale literal terms. The browser search stream has a 60-second read deadline. Seller redirects and
  optional variant facts share one eight-second verification budget; the route
  terminates at 55 seconds even if private reads or a provider never settle.
  Preparation, active search, interruption and completed no-match are distinct
  states. A terminal done event completes without waiting for EOF; interrupted
  streams discard provisional candidates and explicit Refresh can retry. Late
  reference completion after leaving Fabrics never starts a hidden search; queued
  native dialog-close events cannot abort an already reopened search. No
  automatic paid retry is introduced.
- Sourceable hover/focus/tap details show saved descriptions, retailer queries,
  provider-exposed web queries, resolved search, qualified interpretation, stores
  and stage. Missing provider query metadata remains explicit. Hover is free.
  The actual presenter is also an active Aesthetic Control preview using H4/P3,
  Inner material and Glass; no separate presentation settings are introduced.
- fabric-retailers.mjs owns public merchant policy, fabric-discovery.mjs owns
  the fabric-only Responses contract; low reasoning effort is confined to that
  request for supported GPT-5/6 models. Both original photo and selected crop
  inform discovery; base cloth is distinguished from applied embellishments.
  domain-boundaries is a release gate; see MODULE-BOUNDARIES.md for limits.
- Only product URLs present in web source evidence become web candidates.
  Server reads are restricted to exact approved merchant hosts, HTTPS, bounded
  response sizes and revalidated redirects. Source links are preserved on cards.
- Seller JSON-LD/metadata supplies title, photo, description and availability.
  AI-supplied prices/composition/stock are not accepted. Prices need both currency
  and a selling unit. Multiple offers never default to the cheapest offer.
  Shopify variants distinguish swatches from yardage; a known unit on the seller
  page is required. Out-of-stock and swatch-only listings are excluded.
- A blocked seller page yields a clearly labeled search link with unknown facts.
  Missing prices, units and stock remain explicit. A photo interpretation is
  separate from the seller description. No exact composition/GSM/stretch is
  inferred as a fact from a photograph. Local pickup and delivery are not guessed.
- Public parsed listings alone cache for five minutes. No private conversation,
  image, preference or search phrase enters a shared catalog/cache. Failed reads
  are not cached. Existing legacy catalog objects are not deleted or migrated.

## Sealed lookbook and production handoff

Historical Save/Use records and the compatible authenticated API persist under
`private/fabrics/<encoded authenticated Google sub>/<submissionId>/lookbook.json`.
Submission existence is checked using its marker; Admin access to submissions
follows the existing atelier authorization. Lookbooks remain separate even when
two authorized admins can open the same client submission. Browser Storage rules
do not expose these private objects. Generation preconditions prevent another
window from overwriting a newer selection. A book holds at most 100 fabrics.

The current browser serializes explicit Remove actions for each account/submission.
A reviewed removal keeps its identity if the user selects another garment before it runs.
Same-account token renewal preserves work; account/submission changes cancel
unsent actions and reject late UI updates. Writes have a 15-second deadline.
An unconfirmed response invalidates the cached generation and reloads the book;
it never automatically repeats the uncertain write. A failure retains retryable controls. The retained API still verifies a new seller
listing before its first Save/Use; this is compatibility, not a newly exposed card action.

selectedByGarment maps saved garment IDs to product URLs. A private, stored-only
selectedGarmentFingerprints map binds each selection to its saved garment
metadata; it is not returned by the API. Changed garments or reused legacy IDs
cannot silently inherit another material. Legacy selections are inferred only
when unambiguous, without migration writes during reads. Removing a fabric clears
every assignment to it. Fresh dissection IDs do not reuse array positions. Brief
rejects a dissection above 25 MiB by UTF-8 byte size and keeps the full generated
draft, including patterns, rather than claiming a save after dropping output.

The Brief embeds Operation Room below it and also retains the standalone route.
A same-origin, exact-source, account/submission/revision-bound bridge carries only
acknowledged saved pieces. Operations prepares the actual selected garment and
full saved piece list. Lookbook hydration survives a picker change while its
first read is pending; the selection label and pattern context use that garment's
assignment. Opening Fabrics loads the same account/submission lookbook. An existing saved selection supplies its seller description to the existing grounded pattern prompt. This is
material context, not proof of sewability, fit, shrinkage or laser readiness.
Programmatic standalone searches work without a submission; private lookbook operations require one.
In-house inventory uses the same shared cards; its source URLs remain traceable. Old browser favorites are not
silently imported into a client's private lookbook.

The superseded Brief sourcing implementation lost 589 unreachable JavaScript
lines. Its removal does not retire local-folder/legacy migration support, active
CSS, the shared viewer or saved dissection loading.

Switching account or submission clears conversation, photo and results; stale
search/save/load responses cannot paint into the next context. Nothing private
is written into localStorage. The server uses `store:false` for Responses calls;
this is not a claim of zero provider retention. Logging contains result counts
and durations only. Client upload is resized to 1200 px, up to 3 MB on the server.

## Verification and owner evaluation

Run `node tests/fabric-search.mjs`, `node tests/fabric-search-ui.mjs`,
`node tests/fabric-workflow-ui.mjs`, `node tests/brief-operation-races.mjs`, the
existing fabric/AI routing suites, container-contract, app-regression and smoke.
The fabric suites and brief-workspace-ui are mandatory Cloud Build gates. UI tests use isolated Chromium and fake services,
covering saved-look automatic search, selected/whole garment context, same-view
inline/expanded tabs, exact five filters with free toggles/explicit Refresh,
empty groups and stale streams, image+text refinement, historical saved selection
across screens, failures, stale accounts/submissions, default/changed shared styles
and six viewport sizes. tests/brief-workspace-ui.mjs checks the saved-only bridge. Real page parser checks used public
Britex, Stonemountain and Swatchon listings, not private client inputs or paid model calls.

The workflow fixture uses deferred responses and realistically large nested
piece data. It seeds historical favorites through the real local service and checks
request bytes, independent inventory, Remove followed by a garment switch, serial
writes, generation conflicts, failure/retry, same-account
renewal, account/project cancellation and selection persistence across reloads.
These gaps were missed by small images, immediate acknowledgements and a fixture
with only one global selected URL. Server fixtures cover private selection maps,
changed garment fingerprints, seller re-verification and legacy compatibility.
These are behavior checks, not live product-quality evidence. Finish all functional
checks before Aesthetic Control authority; current helper-copy edits reuse existing
roles/settings and introduce no new presentation authority.

Before calling the live result quality equivalent to ChatGPT, run the same ten
owner-approved cases through each after deployment:

| Case | Input | Check |
|---|---|---|
| 1 | Description: matte burgundy wool twill | Color, weave and composition |
| 2 | Description: lightweight ivory silk, no polyester | Hard material constraint |
| 3 | Description: local coating for a jacket | Britex/Stonemountain relevance |
| 4 | Description: printed cotton from Amazon | Real product links; unknowns honest |
| 5 | Swatch photo alone | Qualified visual description and close texture |
| 6 | Garment render alone | No invented fiber/GSM; useful alternatives |
| 7 | Photo + "less shiny than this" | Words override pictured sheen |
| 8 | Photo + "only Britex" | Named merchant restriction |
| 9 | "Cheaper" then "less shiny" | Refinements preserve original intent |
| 10 | Rare fabric, no available matches | No invented inventory or swatch price |

Record first-useful-result time, total time, useful options among the first five,
number of user actions, and factual errors. The server reports firstResultsMs and
totalMs, not a promised latency. Automated fixtures prove behavior, not live
search relevance, live OpenAI entitlement, microphone behavior or ChatGPT parity.
The requested real private fur/green-pants demonstration still needs fresh,
specific permission before accessing an owner's Chrome window/profile. Neither a
passing fixture nor an exact public release check completes that acceptance.

October 18 Swatchon evidence: the official [catalog](https://www.swatchon.com/fabric)
links current `/fabric/QL-061078` product pages; legacy
[`/wholesale-fabric/14620`](https://swatchon.com/wholesale-fabric/14620) remains
recognized. [How Swatchon works](https://www.swatchon.com/help/articles/how-swatchon-works)
distinguishes swatches, sample yardage and wholesale quantity pricing. The checked
[Enzyme Cotton Twill listing](https://www.swatchon.com/fabric/QL-061078) exposes an
AggregateOffer range and omits JSON-LD photos. The parser leaves that range/unit
and unconfirmed stock blank; a seller-authored thumbnail naming the exact SKU can
supply the photo, but the generic site logo cannot. No private endpoint or supplier
API is guessed, and no shipping/availability is inferred from an operator address.
Local merchant locations were rechecked on [Britex](https://britexfabrics.com/),
[Stonemountain](https://stonemountainfabric.com/) and [Harts](https://hartsfabric.com/).

Sources checked: [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search),
[Britex swatches](https://britexfabrics.com/pages/swatch),
[Stonemountain FAQ](https://stonemountainfabric.com/faq/),
[Amazon Creators API](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction).

Lifecycle/persistence references checked in this audit:
[MDN AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController),
[MDN Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API),
[Cloud Storage request preconditions](https://docs.cloud.google.com/storage/docs/request-preconditions).
Aborting a client request does not prove the server rolled back a write. Hidden
page scheduling can be throttled; use identity checks and generation preconditions
with explicit reconciliation rather than relying on timer order or blind retries.

October 17 dissection save audit: /api/admin/subfile exposes X-Maya-Generation
and mutable JSON uses private,no-store. /api/admin/savepieces requires the reviewed
generation, returns the acknowledged generation, rejects stale writes with 409 and
missing review with 428. Brief pins raw-dissection lineage; never rebase a retained
draft automatically, publish an unacknowledged snapshot or remove generated
patterns to fit the 25 MiB UTF-8 limit. Legacy saved files remain readable; old
open clients must reload before saving. Run admin-storage, brief-operation-races
and brief-workspace-ui with the existing release and final aesthetic gates.

October 21 inventory payload audit: the eight source JPGs total 23,769,818 bytes;
the existing thumbnail JPGs total 835,190 bytes (96.49% less). Catalog v2 declares
thumbnail paths. The shared assistant displays these photographs, keeps each
original as the card link and retains that link if a preview fails. Legacy catalog
items without a thumbnail retain their original image behavior. Metadata uses a
versioned fetch and exact no-cache Hosting rule so an old week-cached manifest
cannot hide this repair; photograph caching stays unchanged. This is a transfer
reduction, not a measured live AI latency or matching-quality claim.

October 21 real-retailer follow-up: brocade and jacquard are recognized textile
constructions in both eligibility and matching constraints. Their omission could
reject actual source-backed listings before visual review. Unknown seller price
or unit stays unknown; unrelated weaves/tools remain excluded.

October 21 live criteria follow-up: the saved base cloth and applied trims are not
one required compound fabric. Matching strips secondary clauses for qualification
only; original descriptions, client words and fingerprints remain intact. In
saved-look mode, unscoped whole-look directions do not override the selected
base cloth. Explicit/named requirements, blends/percentages and exclusions remain
strict. Unknown inferred traits may only proceed to the single visual comparison;
failed/missing comparison never confirms them. Search details include original
client preferences and store scope. Material seeds include a bounded broader
query, with balanced stores and grounded web candidates before supplements.

October 26: A reviewed Sourceable listing remains visible with “Photo unavailable”
and its source link if the browser cannot load its seller image. This does not
allow listings without a source-backed image through server verification, or
guarantee a seller match. Store filters use the shared selected Glass pill state.

The browser independently observes the existing 60-second search abort while
waiting for response headers and streamed reads, including transports that do not
reject promptly on cancellation. This is recovery, not proof of faster matching.

October 26 search latency: after checking the submission marker, saved preferences
and the canonical dissection are read concurrently. No provider starts before
both are validated. The existing web, feed and seller deadlines are enforced even
when a transport ignores abort; a late result cannot initiate a redirect or
replace completed output. Verified direct results still pass the one bounded
visual review. This reduces avoidable waits in the reproduced fixtures, but does
not establish the cause or measured duration of the live stalled search.
