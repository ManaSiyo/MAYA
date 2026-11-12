# CLO asset sourcing for MAYA

Research and proposed integration, November 11, 2026. Runtime implementation and
live matching validation are pending.

MAYA should prepare a shortlist of digital garment assets when a completed client
submission arrives. OpenAI should choose the closest references and explain the
alterations needed. Start with up to ten useful results, including free and paid
assets; return fewer when the evidence is weak. This gives the atelier a reusable
starting point while image-to-pattern remains experimental.

## Which CLO library

**CLO-SET CONNECT Store** is the public marketplace the request describes. Its
categories include Garment, Fabric, Trim, Avatar and Scene. It carries free and
paid assets. **CLO-SET Company Library** is a separate account-accessible content
repository. **CLO desktop Library** is the software's asset panel. Access to one
does not establish access to the others. See the [CONNECT Store](https://connect.clo-set.com/store)
and [CLO service explanation](https://support.clo3d.com/hc/en-us/articles/115012666347-What-other-services-do-you-have-other-than-CLO).

For the first release, prioritize garment and pattern assets for each garment in
the submission. Digital fabrics and trims can be separate searches later. A
digital fabric asset is distinct from the physical fabric procurement handled by
MAYA's existing Fabrics feature.

## API inventory

There are two documented integration families relevant to this work, plus an
unverified marketplace-access requirement. This is not a claim that CLO has only
two APIs across all its products.

| Surface | Verified scope | Use in MAYA |
| --- | --- | --- |
| CLO desktop API/SDK | Six main modules: EXPORT_API, FABRIC_API, IMPORT_API, PATTERN_API, REST_API and UTILITY_API. Python/C++ access and additional GUI, event and Library plug-in interfaces are documented. | Later: open an acquired project, inspect or edit patterns, simulate, and export through an installed CLO application. |
| CLO-SET API V2 | The published machine-readable index lists 68 operation entries across 14 groups, including one explicitly labeled dummy endpoint; 67 entries exclude that dummy. This counts documentation entries, not independently tested production endpoints. | Search/list permitted styles, retrieve previews and download links, manage versions, rendering and tech-pack data. |
| CONNECT marketplace | Public Store and individual listings are accessible through web search. No public marketplace catalog-search API was verified in the reviewed documentation. | Initial discovery through source-linked search; complete inventory access remains a vendor question. |

Sources: [desktop API reference](https://developer.clo3d.com/list.html),
[SDK overview](https://developer.clo3d.com/),
[CLO-SET V2 operation index](https://closet-api-v2.apidog.io/llms.txt).
The V2 count includes Auth 2, Group 1, Company 5, Brand 4, Line 4, Season 4,
Room 5, Style 28, Space 1, Render 6, Linesheet 1, Workflow 2, Category 2 and
WebTechpack 3. Schemas and the tutorial are excluded.

Desktop REST_API supplies HTTP request helpers; its name does not imply a hosted
marketplace search service. The [Library Window plug-in](https://developer.clo3d.com/library.html)
lets a developer show an external content source inside CLO. It does not grant a
feed of everything sold on CONNECT.

CLO-SET documents `GET /api/styles` with group, keyword, paging and filter inputs.
Its scope is styles the caller can access. The response example uses `styleId`,
`fileName`, `thumbnailPath` and `thumbnailName`; a proper adapter must resolve
previews and content URLs through documented behavior.
[Style-list reference](https://closet-api-v2.apidog.io/get-style-list-42347750e0).

Developer-page group tokens require the acting group member's `X-User-Email`
alongside Bearer authorization. Other authentication paths exist, and the
tutorial contains legacy wording, so verify the chosen path against its endpoint
documentation before implementation.
[Authentication tutorial](https://closet-api-v2.apidog.io/clo-set-api-tutorial-2469682m0).

Published CLO-SET pricing lists Premium at $40/user/month with 300 API calls per
user/month, $5 for an additional 300 calls, and Enterprise with unlimited API
calls. These are cloud-library terms, not a CONNECT marketplace API offer.
Catalog synchronization and cached metadata would conserve calls.
[CLO-SET pricing](https://style.clo-set.com/service/pricing).

CLO-SET also offers image similarity search in its UI for content the user can
access. That is useful evidence of a product capability, but its availability as
a public API and coverage of CONNECT were not established.
[CLO-SET search guide](https://support.clo-set.com/hc/en-us/articles/45303160683161-Search).

## What MAYA already has

| Current source | Existing behavior | Integration implication |
| --- | --- | --- |
| `backend/server/fabrics.mjs` | One OpenAI Responses image/text search; source-backed URLs; saved garment context; private research, dismissals and selections; deadlines and cancellation. | Reuse these conventions in a separate digital-assets service. OpenAI owns relevance decisions. |
| `frontend/index.html`, submission upload flow | Initializes a submission, then uploads the image and summary concurrently. Individual uploads can fail or retry. | Submission initialization is too early to trigger matching. Add a durable ready/finalization contract. |
| `backend/server/server.js`, `/api/admin/savepieces` | Validates and saves dissection with unique garment IDs and generation checks. | Use canonical saved garments when available; refine full-look research after dissection. |
| `backend/server/server.js`, `/api/admin/clo-search` | Admin-authenticated keyword proxy using `CLOSET_API_TOKEN` and a configurable `CLOSET_SEARCH_URL`; returns at most 12 loosely mapped rows. | This is incomplete account-library plumbing, not verified marketplace sourcing. |
| `backend/operation-workspace.html`, `startCloMatch` | Classifies the photo, sends keywords to that proxy, then displays returned rows. Its fallback scores a `window.CLO_LIBRARY` manifest by type/tags and returns three matches. | Replace the legacy route through a deliberate migration. It neither visually reranks returned candidates nor saves a submission shortlist. |
| `docs/check.mjs` | Explicitly excludes the retired `clo-library.js` from published assets. | Do not restore the old manifest as the active integration. |

The older Plan B copy says it grades the selected pattern, but the inspected match
function only renders links/reference rows. That claim must be corrected when the
feature is implemented. No working grading pipeline was found in this path.
The current proxy also lacks canonical submission/garment context and does not
map the documented style-list preview fields. Its configuration was not inspected;
source presence alone does not establish a live connection.

## Proposed sourcing flow

1. **Finish the submission.** Add an authenticated, idempotent finalization action
   after required uploads succeed. The server verifies ownership, the deletion
   barrier and saved reference/summary before marking an immutable input revision
   ready. Missing required uploads leave a recoverable incomplete submission.
2. **Create durable work.** Save a job/outbox record within the submission and
   dispatch it to a dedicated worker. Key it by account, submission, reference
   revision and search-policy version. Persist claims/results so duplicate events
   and worker restarts cannot casually duplicate paid searches. Reconcile an
   uncertain provider outcome rather than automatically paying again.
3. **Use canonical images.** If dissection is available, source against each saved
   garment ID and its image. Otherwise prepare a full-look shortlist under a
   separate look scope, without generating pattern drawings or pretending the
   look is one garment. Bind later garment matches to saved piece revisions.
4. **Search CONNECT.** Use the existing Responses image/text search design with
   `connect.clo-set.com` as the allowed domain. Request actual Store listings;
   exclude guides, community posts, gallery-only work and collection pages from
   the asset shortlist. Keep manual source-link addition available for listings
   that search does not discover.
5. **Let OpenAI choose.** Compare garment category, silhouette, construction,
   neckline, sleeves, closure, seams, length and drape. Prefer a useful editable
   starting pattern over superficial color similarity. Include free and paid
   candidates; price is a tie-breaker unless the owner sets a constraint.
6. **Save and present.** Show up to ten distinct, supported choices with the
   image, listing link, match explanation, required changes, and available
   format/price/license facts. Keep unknown facts explicitly unknown. Saving,
   dismissing and reopening use the same durable conventions as Fabrics.
7. **Select a production starting point.** Save the chosen asset/version against
   its garment. Acquisition and opening in CLO are separate from sourcing.
   Adaptation, fit review and pattern export follow after acquiring an appropriate
   native project and confirming the permitted use.

The first search-only implementation should use one provider request and a bounded
tool call, like Fabrics. It can rank source-backed suggestions, but search captions
alone do not establish that every candidate image was visually inspected. Record
whether the match used listing text, a preview image, or both. If a pilot shows
that explicit candidate-image comparison is necessary, add a separately budgeted
OpenAI vision comparison over a bounded set of retrieved previews. Do not describe
that extra pass as part of today's fabric implementation.

Automatic work must survive closing the browser; do not start a detached promise
inside the submission request. Cloud Tasks infrastructure exists for callback
leads, but digital sourcing needs its own job scope, worker authorization and
deployment configuration. Existing callback credentials/queues are not assumed
to authorize this workload. Limit work per submission and concurrency, especially
for multi-garment looks; reopening saved research must never start another charge.

## Matching evidence and asset usefulness

MAYA should distinguish **editable pattern candidate**, **visual reference** and
**unknown contents**. Native project/garment formats such as ZPRJ/ZPAC are useful
signals, but file extension alone does not prove editable panels, sewing,
measurements or production readiness. A mesh-only FBX/OBJ/GLTF listing can still
be a reference. It should not be presented as a usable sewing pattern.

Store free/paid/unknown independently from numeric price, so a genuine zero price
survives normalization. Preserve the quoted currency and license tier. Record
format, software version, pattern contents and rights only when supported by a
listing or inspected file. A visually close asset with unknown rights may appear
as a reference, but cannot be labeled production-ready. CONNECT provides a
seller-controlled Physical Production option separately from its Basic/Extended
price fields. [Seller documentation](https://support-connect.clo-set.com/hc/en-us/articles/45304331487769-Uploading-Items).

Public discovery was demonstrated with real listings such as this
[halter-neck wrap maxi dress](https://connect.clo-set.com/detail/e13b408cb5854b768e0fe22df9f4be98)
and [corset mini dress](https://connect.clo-set.com/detail/c6c2de5fb82842e2936735ce05fe912a).
These establish discoverability, not matches to a particular client submission.
Search-index text and opened pages exposed different amounts of metadata. That
supports a partial-coverage pilot, not a claim to search the entire marketplace
or verify all formats, prices and permissions automatically.

## Proposed implementation contract

Create `backend/server/digital-assets.mjs` with provider adapters for CONNECT web
discovery and, later, account-authorized CLO-SET content. Leave fabric-specific
prompts and physical material storage in `fabrics.mjs`.

Suggested private storage under `submissions/{id}/digital-assets/`:

- `jobs/{jobId}.json`: immutable input revision, job state, attempt/claim,
  provider status and result reference. Workers run under a service identity;
  they do not invent an admin UID for jobs created by client submissions.
- `research/{scopeId}.json`: source-backed automatic results for the full look
  or a saved garment, bound to submission ownership and input revision.
- `reviews/{adminUid}/{scopeId}.json`: private dismissals and selection, with
  storage-generation checks. No client-specific research enters studio favorites.

Each result needs provider/source ID, source URL, sourced preview, title, formats,
price status and optional amount/currency/tier, pattern-content evidence,
physical-production status, match reasons, differences, evidence mode and checked
time. Store provenance for commercial claims; model confidence is not evidence.
Keep access tokens and temporary signed download URLs out of persistent cards.

Suggested new routes: an authenticated submission finalization action,
admin-only `GET /api/admin/digital-assets/research`, explicit search/refresh and
review mutation routes, and a separately authenticated task worker. These are
proposed MAYA contracts, not existing CLO endpoints.

Use the submission tombstone barrier before reads and before/after writes; reject
stale input revisions and generation conflicts. Preserve successful stored data
on read/provider failures. Enforce exact source hosts and safe HTTPS links, and
never let model output introduce an uncited source or arbitrary server fetch.
Send only the necessary reference image and garment descriptors to OpenAI; names,
contacts, body measurements and private image URLs do not belong in web queries.

In Brief and Backend 2, present **CLO Assets** alongside Fabrics using existing
gallery, Inner, Glass, typography and image-inspection components. Keep preview
cards compact; show alterations and evidence details on selection. The retired
Plan B should delegate to this shared research rather than maintain another
search/ranking implementation. Aesthetic Control previews and owner review remain
required for visible changes.

## Delivery sequence and acceptance

1. **CONNECT sourcing pilot:** implement the separate service, private saved
   research and gallery; evaluate on a small owner-reviewed set of real garments.
   Measure relevant results, usable-pattern evidence, unsupported claims, latency
   and provider usage. A valid result has a real listing and a useful explanation;
   empty or short results are acceptable. Ten unrelated assets are not success.
2. **Submission automation:** add finalization, durable jobs and worker dispatch;
   prepare full-look research on submission and garment research after saved
   dissection. Test duplicate delivery, partial uploads, deletion, worker restart,
   stale revisions and paid-call uncertainty before activation.
3. **Owned library:** integrate documented CLO-SET style listing/detail/preview
   endpoints with explicit group scope, pagination and caching. Prefer already
   acquired useful assets where appropriate; continue OpenAI matching.
4. **CLO handoff:** open acquired projects through a validated desktop workflow;
   inspect native patterns, adapt and review fit, then export. A later plug-in can
   expose MAYA's selected assets inside CLO's Library. This needs a licensed CLO
   runtime; the web backend is not assumed to provide headless CLO execution.

Extend the consolidated checks for source-only results, zero-price preservation,
unknown rights/formats, cross-submission denial, stale results, durable dismissals,
read failures, cancellation/deadlines and no-charge reopening. Validate integration
with actual provider responses separately from fixtures. No live OpenAI search,
account-library call, asset download or CLO pattern edit was performed for this
research.

For broader coverage, obtain vendor answers on CONNECT catalog/search or partner
API availability, preview reuse/caching rights, free/paid filters, format and
physical-production fields, rate limits and image-search API availability. The
immediate implementation can proceed as limited public-listing discovery while
that access question remains open; it must not promise an exhaustive catalog.
