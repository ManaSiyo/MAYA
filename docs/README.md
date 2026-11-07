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

Project **pro-maya**, Firebase Hosting **maya.manasiyo.com** and **pro-maya.web.app**.
/api/** and /mcp rewrite to Cloud Run **maya-api**, region **us-west1**. Storage is
**pro-maya.firebasestorage.app**. The API uses its Cloud Run service account through
the metadata server; no personal browser session is needed for server Storage.

An owner Push of **maya-v2** starts the existing Cloud Build trigger. The branch
guard rejects other branches. The build installs pinned dependencies and
Chromium, runs `node docs/check.mjs`, builds backend/server with its locked
production dependencies, pushes the container, deploys Cloud Run, builds the
public tree with the commit stamp, deploys Hosting, then deploys Firestore/Storage
rules separately. No credentials or provider environment settings are changed.

Local commands (Node20 or newer):

```
npm ci --prefix docs
npm ci --prefix backend/server
cd docs && npx playwright install chromium && cd ..
node docs/check.mjs --code-only
node docs/build-site.mjs
```

After Push, compare the full intended commit in `/release.json`, the frontend and
Admin `maya-build` metadata, and `/api/healthz`. Health's configured flags indicate
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
from that tool payload directly. Assistant-written links cannot become photos.

This follows the [documented OpenAI image-search API](https://developers.openai.com/api/docs/guides/tools-web-search).
It does not reproduce ChatGPT's private implementation or promise identical speed.
OpenAI chooses the search and matches. MAYA keeps authentication, canonical saved
context, cancellation, source links and private favorites. Explicit excluded
materials discovered in later captions retract earlier cards and cached results.
Price, composition and stock remain unknown; results are suggestions. Up to ten
cards are displayed, using the unchanged In House gallery layout and two captions.
Named-shop searches use the same API with an explicit domain filter; they do not
constrain or replace the Global cache. Legacy feed/rank/generated-swatch APIs
return 410. Photo hosts can still fail; their sourced thumbnail is the fallback.

## Current work

November 6 owner review: Chrome access and agent visual testing are stopped.
Fromsa performs the final visual/interaction review after each Push. Local checks
use `node docs/check.mjs --code-only`; the deployment's existing isolated browser
regression gate remains. Do not confuse either with a live provider acceptance.

Prepared locally: explicit centering for submission deletion confirmation;
Brief header deletion removed (drawer deletion retained); shared hover/focus-only
card controls and adjustable Close icon percentage, default 80%; hover captions;
plain, deduplicated Design Notes behind a vertical left-edge plus/drawer; shared
fullscreen photograph inspection with a rectangular magnifier, pinch/wheel zoom
and pan. App, Brief, fabric images and Aesthetic Control use the same viewer.
Gesture handling excludes board zoom and version swipes. Source changes/removal
close private expanded images. Fabric caption/source links still open the source.

Fabrics: separate Global and In House status messages, wait for inventory before
showing an empty state, retain sourced photos from incomplete provider responses,
and allow 4096 output/reasoning tokens rather than the restrictive 800 cap.
Provider failures record bounded categories only in server logs. There is still
one OpenAI image search, no scraping/ranking/retry engine and no invented photos.
These fix concrete code paths but do **not** establish the cause of the owner's
live Global failure. Its exact final message/provider failure remains unconfirmed.
The owner has been asked for the exact Global message; no live search was run.

Validation: Node20 non-browser packaging, syntax, authorization, storage,
communications, image/voice/avatar, Fabric request/GC and inspection gesture/note
checks pass. CI browser assertions were updated for dialog centering, removal of
the header delete action, notes and fullscreen/lens behavior; not run locally at
the owner's request. Visual/interaction acceptance, physical iPad gestures and
Global provider results remain for the owner after deployment.

Production successfully deployed 9a8bfcef20ea19b6d7e48197de1e4bcc6412b9c1 before
this review (Cloud Build 6ffa411e-3a3f-4a0a-9f61-feaf9e81b9f7). Hosting marker,
frontend/Admin stamps and Cloud Run health matched it. Current changes are not
pushed. Exact next step: owner Push, confirm release/API commit through read-only
HTTP, then owner visual/interaction review and the exact Global Fabrics outcome.
Twilio configuration remains owner-managed; no messages or calls were sent.
