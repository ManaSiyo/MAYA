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
| _to_delete/2026-11-05-cleanup | Retired docs/tests/headshots/pages, kept for owner review |

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
node docs/check.mjs
MAYA_BROWSER=webkit node docs/check-ui.mjs
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
  Global Fabrics uses image-led web search with source/citation evidence. Sourcing
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

## Current work

November 5 cleanup and UI corrections pass the consolidated local release checks. Includes Admin
and Brief submission deletion/captions; corrected page dots and circular logo;
shared Glass icons/dialog; immediate, deduplicated sharing with three concurrent
image copies; landscape row containment and phone header alignment; retired WR, standalone Operations and
preset headshots; merged legal page and reorganized source/deployment packaging.

Active files are reduced by about 51%; maintained documentation by 97% in bytes.
The core runtime is retained; total active text/code is reduced by about 40%.
Retired files are moved, not erased from disk. The archive is ignored by Git and
stays on this Mac; prior commits retain the original versions.

Node20 and Node24 checks pass in about 30 seconds locally. Chromium and WebKit
cover phone/landscape/tablet/desktop, shared dialog Save propagation, explicit
submission deletion, independent sharing, and Global/In House parity with image
failure/recovery. Sharing's dialog opens in 1–3 ms in the fake-network browser
checks; six image copies use three workers and three clicks publish one share.
This is UI timing, not a live AI-generation benchmark. `MAYA_CAPTURE=1` enables
review screenshots separately from the mandatory behavior/style assertions.

Live checks on November 5 still show b7ccf5d in Hosting, app/Admin and API. Public
responses measured roughly 0.44s for the marker, 0.58–0.66s for pages and 1.69s for
health in one sample. f6426d6's Cloud Build failed while capturing a test screenshot
(waiting 30 seconds), before deployment. The consolidated suite keeps the Fabric
behavior/style assertions and separates optional captures from release acceptance.

Production acceptance remains separate: owner Push, verify matching website/API
commits, then check a real share, iPad interaction and Global Fabrics on the saved
hooded-tailcoat submission. The previously reported empty Global gallery and Twilio
configuration failure are not established as resolved by this cleanup. No live
submission has been deleted and no real message/call sent during these checks.
