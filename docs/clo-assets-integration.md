# CLO asset sourcing in MAYA

Live on November 12, 2026 as `006c575799e7eb6f20f4ef3697d3c36f9bc228fe`.
Google build, full CI, queue setup, Cloud Run, Hosting and rules succeeded.
Seven release endpoints were independently verified. A newly queued real submission
search saved two source-backed assets; purchases/downloads are never automatic.
[Release evidence](https://github.com/ManaSiyo/MAYA/runs/131365347622).

## Current UI migration — November 13

CLO now belongs to the original Backend: Mark 1 → CLO 3D → Pipeline. The existing
34/66 image/pattern layout and Submissions/Settings drawer stay intact. Backend 2,
its compact rail and the old Plan B sourcing pane are deleted. The dated rollout
above describes the existing server/queue, not verification of this UI migration.

## Delivery checklist

1. **Current Backend integration:** optional CLO panel, independent gallery/CSS,
   shared parent image viewer and account/submission/garment/revision-bound cleanup.
2. **Preview repair:** square photos retain their decoded image across saved reads,
   reviews, filters and tab switches. Candidate failures/timeouts use only source
   evidence alternatives; a missing photo keeps a truthful listing link. CI tests
   default and changed aesthetics at phone/tablet/desktop widths. Owner visual
   review follows deployment; no local browser or new paid search is used.
3. **Done — implement CONNECT sourcing.** One server-side OpenAI Responses search
   uses the saved reference and CONNECT domain restriction. OpenAI orders up to
   ten source-backed garment references. Free/paid and editable-pattern filters,
   match reasons, alterations, source links and available commercial facts appear
   in the CLO tab. Fewer results and unknown facts are valid outcomes.
4. **Done — retain private work.** Research survives reopening. Each admin's
   selection and dismissed URLs are saved separately. Stale inputs, conflicting
   writes, unreadable records and deleted submissions cannot silently replace
   current work. Refresh is explicit and may incur another provider charge.
5. **Done — implement submission automation.** After the saved image/summary writes, the server schedules work. As a fallback, the
   client calls the submission-ready route. The server verifies ownership and
   saved image/summary, writes pending work and enqueues it when configured.
   Saving dissection prepares up to 12 garment jobs; additional garments can be
   searched individually. Durable claims prevent duplicate task deliveries from
   issuing another paid search. Failed/uncertain attempts require explicit retry.
6. **Done — activate automatic dispatch.** Cloud Build now configures a dedicated
   Cloud Tasks queue, dispatch service account and OIDC settings listed below.
   Without them, pending work remains saved and Find assets works interactively
   through the existing OpenAI connection. No new CLO account token is required
   for public-listing discovery.
7. **Done — Push and live verification; owner visual review remains.** Google
   Cloud Build and all seven release stamps passed. One real queued submission
   saved two source-backed matches. CI checked phone/tablet/desktop layouts.
   Signed-in selection and visual/match-quality acceptance remain owner review.
8. **Optional later integration — owned library and desktop CLO.** Add a documented
   CLO-SET account-library adapter once account scope/access is available. Broader
   CONNECT catalog access needs vendor confirmation. Acquired native projects can
   later be handed to licensed desktop CLO for adaptation, fit review and export.

[Verified Google build](https://github.com/ManaSiyo/MAYA/runs/130982536294).

## Current integration

`backend/server/digital-assets.mjs` owns sourcing, parsing, canonical input reads,
research storage, durable execution claims, queue dispatch and HTTP routes.
`docs/aesthetics/ui/clo-assets.js` owns the gallery, selection, filters and saved-only
polling. `operation-clo.js` registers it with `MayaOperationPanels` in
`original-operation.js`. `clo-preview-bridge.js` validates iframe/context messages
and expands healthy photographs in the parent viewer. Unregistering the panel
aborts requests, disposes images, closes its preview and restores Mark 1. No
pattern/fabric state is stored by the CLO module. The legacy configurable `/api/admin/clo-search` proxy
returns 410. Its arbitrary endpoint mapping and local tag-ranking fallback are
retired, and the unsupported automatic-grading copy has been removed.

The implementation follows the existing Fabrics conventions but keeps digital
assets separate from physical fabric sourcing. It uses one bounded Responses
image/text web-search call, with `connect.clo-set.com` as the allowed domain.
Only sourced `/detail/` URLs can become cards; model text cannot introduce an
uncited listing or photograph. Model-selected order is retained without a custom
server ranking formula. Free prices preserve numeric zero. Commercial facts
require listing-evidence text; unknown formats, price, currency, pattern contents
and physical-production permission remain unknown.
[OpenAI web-search documentation](https://developers.openai.com/api/docs/guides/tools-web-search).

The input is the canonical saved image and a small garment/material description.
Names, contacts and body measurements are not included in the request. The model
is instructed to keep private image URLs and identifying data out of search
queries. Listing text is evidence, not executable instructions. Matching is labeled
as listing-search evidence; it does not claim native-file inspection or a separate
visual comparison of every candidate.

Full view sources the complete submitted look. A dissected selection sources that
saved garment. Initial preparation and subsequent reads do not pay for model
calls; the configured worker or explicit Find/Refresh performs the search.
Background work survives the browser closing when the task queue is active.
Tab navigation only reads stored results. Scope changes cancel interactive
requests and discard late responses; an uncertain attempt is not retried silently.

## Routes and stored data

| Route | Access and behavior |
| --- | --- |
| `POST /api/submissions/clo-ready` | Verified submission owner; prepares full-look work after uploads. Repeated requests reuse the input fingerprint and task identity. |
| `GET /api/admin/digital-assets/research` | Admin-only; reads canonical state and that admin's review. No model call. |
| `POST /api/admin/digital-assets/search` | Admin-only and rate-limited; runs pending work or explicitly refreshes with a generation guard. |
| `POST /api/admin/digital-assets/review` | Admin-only; select, clear, hide or restore, bound to research fingerprint and review generation. |
| `POST /api/tasks/clo-assets` | Dedicated OIDC worker identity/audience; executes only the matching pending attempt. |

All routes remain same-origin behind the current Cloud Run API. No credential was changed. The four CLO settings were activated by the
owner-authorized deployment; existing provider environment values were preserved.

Research/job state is stored at
`submissions/{id}/digital-assets/research/look.json` or
`submissions/{id}/digital-assets/research/garment-{garmentId}.json`.
Each record has input and result fingerprints, an attempt ID, status,
timestamps and at most ten current candidates. It doubles as the durable job
record; there is no separate job collection. A failed refresh retains the last
successful candidates and marks changed-input results stale.

Reviews live at
`submissions/{id}/digital-assets/reviews/{adminUid}/look.json` or the matching
`garment-{garmentId}.json`. A selected reference retains its source metadata and
input fingerprint; dismissed URLs are capped at 500 with an explicit restore
control. Client-specific work is not copied into shared studio Favorites.

Writes use Cloud Storage generations and the existing before/after submission
deletion barrier, including cleanup of a write racing deletion. Failed reads do
not become empty replacement stores. Workers claim before contacting OpenAI.
A worker crash or ambiguous paid response leaves running/failed work for explicit
review and refresh rather than an automatic second charge. Enqueue failures leave
pending work available for manual search or a later idempotent ready request.

## Automatic dispatch setup

The deployed service reads these settings, provisioned through the authorized build:

| Setting | Required value |
| --- | --- |
| `CLO_TASK_QUEUE` | Dedicated queue resource: `projects/{project}/locations/{region}/queues/{queue}`. |
| `CLO_TASK_ORIGIN` | The HTTPS Cloud Run service origin, without a trailing slash. |
| `CLO_TASK_SERVICE_ACCOUNT` | Dedicated account used in the task's OIDC token. |
| `CLO_TASK_AUDIENCE` | Exactly the same origin as `CLO_TASK_ORIGIN`. |

Grant the API service the permissions needed to enqueue tasks and use the dispatch
identity. Confirm Cloud Tasks can issue its OIDC token and reach the worker.
Use conservative queue concurrency for the first live submission. Do not reuse
callback-lead worker identity or queue configuration implicitly. The worker checks
its own email and audience through the existing Google JWT verifier.

Queue configuration is not required for interactive sourcing. The existing
`OPENAI_API_KEY` and configured text model are used; code does not inspect or
change their values. CLO-SET account tokens and a desktop CLO installation are
not required to discover public listing references.

## CLO API inventory and coverage

| Surface | Verified scope | Remaining integration |
| --- | --- | --- |
| CLO desktop SDK | Six main modules: export, fabric, import, pattern, REST helpers and utilities; additional Python/GUI/event/Library interfaces. | Native file editing, simulation and export require a licensed desktop runtime and a tested workflow. |
| CLO-SET V2 | 68 documented operation entries across 14 groups, including one dummy entry; 67 excluding it. | Account-authorized library access, previews, downloads, rendering and tech packs. |
| CONNECT Store | Public free/paid garment, fabric, trim, avatar and scene listings. | No public full-marketplace search API was verified; web discovery has partial coverage. |

Sources: [desktop API reference](https://developer.clo3d.com/list.html),
[CLO-SET V2 index](https://closet-api-v2.apidog.io/llms.txt),
[CONNECT Store](https://connect.clo-set.com/store).
The cloud count is documentation entries, not independently tested endpoints:
Auth 2, Group 1, Company 5, Brand 4, Line 4, Season 4, Room 5, Style 28, Space 1,
Render 6, Linesheet 1, Workflow 2, Category 2 and WebTechpack 3.

`GET /api/styles` searches styles the caller can access, with group, keyword and
paging inputs. It does not establish access to everything for sale on CONNECT.
[Style-list reference](https://closet-api-v2.apidog.io/get-style-list-42347750e0).
Developer-page group tokens require the acting member's `X-User-Email` alongside
Bearer authorization. [Authentication tutorial](https://closet-api-v2.apidog.io/clo-set-api-tutorial-2469682m0).

CLO-SET's published Premium plan lists $40/user/month and 300 API calls per
user/month; additional 300-call usage is listed at $5, and Enterprise lists
unlimited API calls. Those are account-library terms, not a CONNECT marketplace
API offer. [Pricing](https://style.clo-set.com/service/pricing).

CLO-SET provides image similarity search in its UI for accessible content, but
its public API availability and marketplace coverage were not established.
[Search guide](https://support.clo-set.com/hc/en-us/articles/45303160683161-Search).
The desktop [Library plug-in API](https://developer.clo3d.com/library.html) can show
MAYA's external content inside CLO; it does not grant a marketplace catalog feed.

Native ZPRJ/ZPAC files are useful signals, not proof of editable panels or
production-ready patterns. Mesh-only assets can be visual references. CONNECT
allows sellers to set physical-production permission separately from license
pricing. Maya displays source-reported permission without treating an asset's
format or price as a manufacturing grant.
[Seller documentation](https://support-connect.clo-set.com/hc/en-us/articles/45304331487769-Uploading-Items).

## Verification

Node20 code-only checks pass. The consolidated runtime tests cover sourced ordering and rejected invented URLs,
zero-price preservation, canonical inputs, private reviews, generation conflicts,
failed reads, changed-input staleness, duplicate claims/dispatch, provider failure,
deletion races, deadlines and owner/worker authorization. DOM tests cover the
three tabs, saved-only opening, selected assets and stale account/garment results.
Aesthetic Control has a functional CLO gallery sample using a local fixture;
CI assertions check tab/frame containment at phone, tablet and desktop sizes and
changed aesthetic settings. No local browser was launched.

Live dispatch, provider execution and saved results are verified. Match usefulness
and native CLO file compatibility still require review.

## November 11 rollout

`docs/setup-clo-queue.sh` is an idempotent Cloud Build step: dedicated queue
`maya-clo-assets` in us-west1, one concurrent dispatch, three transport attempts,
10–60 second backoff. Runtime receives enqueue on that queue and actAs on
`maya-clo-dispatch`; dispatch receives invoke on maya-api. Cloud Tasks uses its
service agent to issue OIDC. Existing provider environment values are preserved.
[Google queue permissions](https://docs.cloud.google.com/tasks/docs/secure-queue-configuration),
[authenticated tasks](https://docs.cloud.google.com/tasks/docs/creating-http-target-tasks).

`docs/check-clo-live.mjs` schedules the real submission shown in the owner's
screenshot using the build identity, then observes the deployed worker's saved
results. It never calls OpenAI locally, resets failed work, or retries an uncertain
paid call. Successful verification writes a durable rollout receipt outside client
submissions; later releases reuse it without paying again or relying on that
submission remaining. It verifies queue/provider/storage, while authenticated
browser interactions and match usefulness still need owner review.

The server upload path now prepares the job before returning the final image or
summary upload acknowledgment; the browser ready request is a fallback. Large
references up to the existing 25MiB limit are accepted. The current Backend keeps
shared Inner materials and its existing toolbar/Drawer geometry. Default and changed
shared materials remain covered by CI; no local browser has been launched.

### Verified rollout outcome

The first provisioning attempt created the queue/account but could not inspect
queue IAM. The final script tested existing runtime permissions instead; both
`cloudtasks.tasks.create` and `iam.serviceAccounts.actAs` were present. It used the
SDK's bundled Python and the existing Cloud Tasks service-agent OIDC role, with
application-level signed worker identity/audience checks preserved. No broad
permissions were added. Cloud Run revision `maya-api-00222-tcl` received 100% traffic.

The one-time check logged `pending queued`, then completed with these two listings:
- https://connect.clo-set.com/detail/3001c20cd5d2481fa7f3357acc5ff44c
- https://connect.clo-set.com/detail/c54b579e46d84c49a43a803d658b87f8

This establishes a new queue → deployed worker → OpenAI → saved-results flow,
not just reuse of old research. Signed-in browser interaction and a human judgment
of match quality were not claimed. The screenshot submission itself was reused;
no synthetic customer submission was created.
