# Conversational fabric sourcing — October 7, 2026

From the Brief or Operation Room, choose Fabrics. Describe a fabric, attach/paste
a photograph, use the submission's reference, or combine them. Dissection is not
required. A second message refines the existing request; New search clears it.
Dictate uses explicit browser speech recognition where supported and does not
submit a search automatically. Add photo never calls image generation.

## Runtime

- `aesthetics/ui/fabric-assistant.{js,css}` is shared by both served screens.
- `docs/server/fabric-search.mjs` owns `/api/admin/fabrics/search` (NDJSON),
  `/api/admin/fabrics/lookbook` (GET/POST), seller parsing and storage.
- Search requires Admin authentication and the existing account rate limit.
  It uses the existing OpenAI server key and `MODEL_TERRA || TEXT_MODEL`; no new
  credentials or environment setup was performed. A bounded Responses API request
  uses web_search, at most three tool calls, original photo plus words, and six
  prior refinements. No secondary paid model or automatic paid retry is added.
- Britex, Stonemountain, Harts, Amazon, Mood, Blackbird, The Fabric Store and
  Tessuti are the allowed discovery domains. Amazon is web discovery, NOT a
  Creators API integration or a promise of exhaustive Amazon inventory.
- An initial literal Shopify pass runs alongside web reasoning for text input.
  Products are streamed before the full search finishes. Refinements bypass this
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

The Brief's Operation Room action carries the submission ID. Opening Fabrics in
that room loads the same account/submission lookbook. Use for design supplies the
chosen seller description to the existing grounded pattern prompt. This is
material context, not proof of sewability, fit, shrinkage or laser readiness.
Standalone searches work without a submission; saving requires opening one.
Legacy in-house fabric access remains available. Old browser favorites are not
silently imported into a client's private lookbook.

Switching account or submission clears conversation, photo and results; stale
search/save/load responses cannot paint into the next context. Nothing private
is written into localStorage. The server uses `store:false` for Responses calls;
this is not a claim of zero provider retention. Logging contains result counts
and durations only. Client upload is resized to 1200 px, up to 3 MB on the server.

## Verification and owner evaluation

Run `node tests/fabric-search.mjs`, `node tests/fabric-search-ui.mjs`, the existing
fabric/AI routing suites, container-contract, app-regression and smoke. Both new
suites are Cloud Build gates. UI tests use isolated Chromium and fake services,
covering image+text, refinement, saved selection across screens, failures, stale
accounts/submissions, and six viewport sizes. Real page parser checks used public
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
