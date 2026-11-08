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
Inspect GitHub's commit **check-runs**, including Google's `output.text` build log;
the combined status can omit a failed Google Cloud Build check.
Health's configured flags indicate
configuration, not successful inference/delivery. `/api/healthz/deep` is admin-only.

## APIs and providers

- **Google Identity / Firebase Auth:** verified identity and account isolation.
  Firestore owns client projects, private avatars and share records; Storage owns
  independent images and submissions. Admin access uses the server allowlist.
- **OpenAI:** text/vision via the protected allowlisted proxy, image generation and
  edits using **gpt-image-2.6-flare**, text default **gpt-6-luna**; Realtime voice
  uses modality-specific configuration. Defaults are in server/model-config.mjs.
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
Fabrics lookbooks remain private to account/submission/garment, generation-checked,
and respect client exclusions. Saved dissection reads never generate missing work.
New private work is inside the submission prefix:
`patterns/{adminUid}/{garmentId}.json` contains settings, input snapshots and image
passes; `fabrics/{adminUid}/{garmentId}.json` contains research and dismissed URLs;
`fabrics/{adminUid}/lookbook.json` contains favorites. Legacy private lookbooks are
read without writes and copied into the submission only on an explicit mutation.
Deleting the submission removes its new work through the same tombstone barrier.

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
prompt, construction/review direction, retrieval count, pass count, image quality,
waistband/underlap/yoke constants and an optional full drawing-prompt override.
The retrieval trace and saved run include the actual classification, chosen rules,
excerpts, measurements, prompt, critique and generated image passes. The existing
one-inch grid and lower-body dimension formulas are described in Settings. This
remains an experimental drawing workflow, not a cutting-ready pattern exporter.

Each pass saves before another paid refinement. Start reopens existing work;
New version is the explicit new paid run. Retry Save retries storage only.
Unreadable/conflicting saved work blocks replacement. Version history retains old
runs; changed garment snapshots are marked stale, never silently deleted. Stored
runs are bounded to 25 MB/100 versions per garment and research to 100 links/500
dismissals, with a visible failure rather than silent eviction at the limit.

## Current work

November 7: Operation Room version 2 (c28322e) is pushed. The garment column is
27.2% instead of 34% (20% narrower); the pattern receives 72.8%. Images are centered,
the parent Brief owns vertical scrolling, and hidden iframe overflow no longer
clips the retrieval area. Upload, Redrawn, duplicate Mark badge and Export SVG
controls are removed. Settings includes a dedicated Operation Room version history.

Image magnification/pinch begins only after expansion, including Operation Room
images expanded in the parent viewport. The pointer lens is 35% larger on both
axes. Design Notes tracks the card's vertical center and uses Glass material.
Both changes have active Aesthetic Control previews. Fabrics and its selected item
remain visibly selected together. Footwear now passes canonical saved-item checks;
cited links and automatically saved research survive missing photographs.

Validation: Node20 code-only packaging, syntax, authorization, storage,
communications, image/voice/avatar, Fabric deadlines/forced-GC and inspection
checks pass. Added tests cover pattern history, no-charge reopen, storage failure,
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
