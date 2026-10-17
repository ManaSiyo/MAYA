# Conversational fabric sourcing — October 17, 2026

From the Brief or Operation Room, choose Fabrics after a dissection has been
saved successfully. The selected garment, original look and client preferences
start the search automatically; Full view uses all saved garments. A failed or
unacknowledged save does not unlock this workflow. Reading a saved dissection
never generates missing garment images.

Sourceable, In House and Favorites use the same inline viewer. Refresh reruns
the current garment request; Filter stores restricts merchants. Expand enlarges
that same DOM/view into an optional dialog and Escape/Collapse returns it intact,
without another search. Cards have a larger photo and two concise caption rows.
Stable saved garment IDs keep duplicate garment names distinct. Refinements
separate positive requirements, exclusions and the latest replacement; “no wool”
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
- Britex, Stonemountain, Harts, Amazon, Mood, Blackbird, The Fabric Store and
  Tessuti are the allowed discovery domains. Amazon is web discovery, NOT a
  Creators API integration or a promise of exhaustive Amazon inventory.
- An initial literal Shopify pass runs alongside web reasoning for text input.
  Verified and visually compared products are streamed before the full search finishes. Refinements bypass this
  literal pass, so an old literal query cannot override the new request.
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

Save and Use for design persist under
`private/fabrics/<encoded authenticated Google sub>/<submissionId>/lookbook.json`.
Submission existence is checked using its marker; Admin access to submissions
follows the existing atelier authorization. Lookbooks remain separate even when
two authorized admins can open the same client submission. Browser Storage rules
do not expose these private objects. Generation preconditions prevent another
window from overwriting a newer selection. A book holds at most 100 fabrics.

The Brief embeds Operation Room below it and also retains the standalone route.
A same-origin, exact-source, account/submission/revision-bound bridge carries only
acknowledged saved pieces. Opening Fabrics in that room loads the same
account/submission lookbook. Use for design supplies the
chosen seller description to the existing grounded pattern prompt. This is
material context, not proof of sewability, fit, shrinkage or laser readiness.
Programmatic standalone searches work without a submission; saving requires opening one.
In-house inventory uses the same shared cards; its source URLs remain traceable. Old browser favorites are not
silently imported into a client's private lookbook.

Switching account or submission clears conversation, photo and results; stale
search/save/load responses cannot paint into the next context. Nothing private
is written into localStorage. The server uses `store:false` for Responses calls;
this is not a claim of zero provider retention. Logging contains result counts
and durations only. Client upload is resized to 1200 px, up to 3 MB on the server.

## Verification and owner evaluation

Run `node tests/fabric-search.mjs`, `node tests/fabric-search-ui.mjs`, the existing
fabric/AI routing suites, container-contract, app-regression and smoke. All three UI/service
suites, including brief-workspace-ui, are mandatory Cloud Build gates. UI tests use isolated Chromium and fake services,
covering saved-look automatic search, selected/whole garment context, same-view
inline/expanded tabs and store filtering, image+text refinement, saved selection
across screens, failures, stale accounts/submissions, default/changed shared styles
and six viewport sizes. tests/brief-workspace-ui.mjs checks the saved-only bridge. Real page parser checks used public
Britex and Stonemountain listings, not private client inputs or paid model calls.

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

Sources checked: [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search),
[Britex swatches](https://britexfabrics.com/pages/swatch),
[Stonemountain FAQ](https://stonemountainfabric.com/faq/),
[Amazon Creators API](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction).
