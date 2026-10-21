# MAYA department audit — October 21, 2026

Baseline: 718f404 (deployed before this work). This is a source/dependency audit
plus targeted executable tests and two authorized owner-browser searches. It is
not a claim that every production integration or provider account was exercised.

## Ownership map

| Area | Main owners | Shared contracts / checks |
| --- | --- | --- |
| Fabrics in Brief and Operations | server/fabric-search.mjs (orchestration, seller facts, private books), fabric-retailers.mjs (merchant policy), fabric-discovery.mjs (provider contract), fabric-sourcing.js (qualification/ranking); ui/fabric-assistant and fabric-search-details | Admin authentication, canonical saved submission, shared design, model configuration; fabric-search, sourcing, search-ui, workflow-ui |
| Brief and saved projects | backend/backend.html, server submission routes | UID/project lifecycle, saved piece IDs, canonical measurements; project-lifecycle, brief-operation-races, brief-workspace-ui |
| Operation Room | backend/operations.html and production routes | Same saved garment/measurement contracts; operation-controls, operation-save-failures |
| SMS / Messages / owner text | maya-messages.mjs, message-archive.mjs, owner-sms-access.mjs, owner-conversation.mjs, owner-crm.mjs; Admin Messages | Explicit send claims, STOP, authenticated owner identity, account-scoped history; communications and owner suites |
| Phone / web voice | maya-phone.mjs, maya-transfer.mjs, realtime-voice.mjs; ui/voice-preparation.js | Shared authenticated context and reviewed tool authority; phone/transfer/voice suites |
| Wix lead ingress / alerts | event-triggers.mjs, lead-alerts.mjs, lead-store.mjs | Signed ingress, durable tasks, independent claimed SMS/call notifications; event-triggers, lead-alerts, lead-store |
| Outbound / Gmail / Ads | outbound.mjs, crm-{intelligence,gmail,ai,store}.mjs, server marketing routes; backend/outbound.* | Account-scoped storage, provider adapters, budget; CRM/outbound tests |
| Aesthetic Control | aesthetics/aesthetic-control/, ui/{typography-controls,presentation-runtime,pill-runtime}, server/design-config.mjs | One validated saved schema, active previews and final aesthetic-authority |
| Client MAYA | frontend/index.html | Sealed projects, shared presentation/voice; client/project/hands suites |
| Hosting / container / release | docs/firebase.json, server/Dockerfile, cloudbuild.yaml | Exact shipped imports/assets, branch guard, API/page commit identity; container/release/live checks |

Paths above are relative to docs/ except frontend/, backend/ and aesthetics/.

## Findings and disposition

**P1, Fabrics — fixed:** automatic saved-look requests skipped the direct retailer
path. Valid direct results were also replaced by an empty later web response.
The regression fixture reproduced this before implementation. Saved material
vocabulary now seeds at most two queries across four eligible Shopify stores;
no client names, measurements or free-form private prose enter those queries.
Qualified direct/web candidates merge before one bounded visual review. Empty or
failed visual review still produces no confirmed matches.

**P1, Fabrics — fixed:** In House loaded after reference conversion, so a failed
private photo could prevent unrelated public inventory from loading. Inventory
starts independently; a held and failed reference fixture verifies usable cards.

**P2, Fabrics — fixed:** the common automatic UI hid the photo description and
never rendered search queries. Sourceable now has hover, keyboard and tap access
to saved traits, actual retailer queries, provider-exposed web queries, resolved
search, qualified interpretation, searched stores and current stage. The web
provider does not always expose queries; the UI says so. Looking at details
makes no provider calls. Account/project/garment resets clear old private data.

**P2, Fabrics — fixed:** malformed provider objects became unexplained empty
answers, www/non-www source aliases could reject the same evidenced product,
and a stalled browser stream had no overall deadline. Validate the candidates
array, compare source identity without changing fetch/redirect destinations,
and bound the read-only stream to 60 seconds with an explicit retry message.
No automatic paid retry was added.

**P2, Fabrics — improved, live accuracy still empirical:** discovery now receives
both the original look and canonical selected crop. Discovery/ranking distinguish
base cloth from added beads/chains/hardware and garment construction. The fabric
provider request uses low reasoning effort for supported GPT-5/6 models; shared
SMS/voice/model defaults are unchanged. This is not a measured latency SLA or a
guarantee that every bespoke concept has an available retail equivalent.

**P1, architecture — remaining risk:** server.js is still a 4,943-line composition
root with legacy route implementations; frontend/index.html is 19,657 lines,
Brief 5,141 and Admin 4,067 at the audited baseline. A shared process, dependency
installation, global middleware, models, design runtime and deployment can still
break several departments together. Imports alone do not provide runtime fault
isolation. No evidence established that a fabric import itself caused the earlier
SMS composer clipping; that incident was a drawer layout defect.

The new domain-boundaries release gate inspects all current server JS modules,
restricts Fabrics imports/routes, forbids reverse dependencies outside server
composition, checks that client/Admin/Outbound do not load fabric assets, and
rejects unscoped fabric CSS. It does not prove network isolation, protect against
all dynamic code or make Cloud Run deployments independent.

Recommended next refactor: extract legacy server routes behind injected auth,
storage and provider adapters one department at a time, preserving endpoint
contracts and failure fixtures. Then split frontend/Brief/Admin controllers by
workspace without changing shared Aesthetic Control. Separate deployments only
after contracts, health checks and rollback ownership are explicit. A broad
rewrite during a fabric incident would introduce unnecessary regression risk.

**P1, Fabrics vocabulary — follow-up fixed:** a read-only check against a real
Mood brocade page reproduced a seller product rejected by isFabricProduct: the
fabric vocabulary omitted brocade. Include brocade/jacquard in eligibility and
weave constraints, with an original-code failure and negative unrelated-weave/tool
fixtures. Price/unit stay unknown when the seller parser cannot establish them;
this change never invents those facts. This was found after the first repair push,
so it is a separate focused commit with its own validation.

**P2, architecture — corrected documentation:** the old AI architecture document
mixed historical feed/model descriptions with current behavior. The current
fabric path is now stated explicitly; old version sections remain historical.
Do not delete still-mounted legacy endpoints or migration paths on this basis.

**P1, shared dependencies — remains open:** the locked install's npm audit
reports ws 8.18.0 affected by a high-severity memory-exhaustion advisory
([maintainer advisory](https://github.com/websockets/ws/security/advisories/GHSA-96hv-2xvq-fx4p),
patched in 8.21.0) and moderate qs advisories through Express 4.22.2
([maintainer advisory](https://github.com/ljharb/qs/security/advisories/GHSA-4mjr-xmp4-gh2g),
qs patched in 6.16.0). The same direct versions are pinned in the root test and
server runtime manifests. npm suggested ws 8.22.0 and Express 4.22.3 at audit
time. This confirms affected dependencies, not an exploit reproduced against
MAYA. Upgrade both lockfiles in a separate shared-infrastructure change, rerun
transport/ingress/auth regressions and verify voice/SMS after deployment. They
were not silently upgraded in this fabric-specific change.

## Live evidence and limits

Before the fix, the owner's crocodile-trouser search returned a relevant Britex
crocodile-backed vinyl listing. The newer embellished-coat search returned no
confirmed products and no visible interpretation. Snapshots were taken about
28 and 24 seconds after opening; these are observation times, not measured first
result latency. No client records, messages, calls or dissection generation were
changed during the inspection. Post-deployment acceptance belongs in AI-HANDOFF.

Only nine approved merchants are discoverable; this is not an exhaustive fabric
marketplace. Seller blocking, missing images, sparse wording, stock changes and
strict visual thresholds can produce honest empty results. Tests use fake AI and
seller responses, so semantic quality and carrier/voice acceptance need live
checks. The shared release suites are cross-department regression evidence,
not a guarantee that every external integration is currently configured.

## Provider contract references

OpenAI's [web-search guide](https://developers.openai.com/api/docs/guides/tools-web-search)
describes exposed search actions/queries and source evidence. Its
[GPT-6 Luna model page](https://developers.openai.com/api/docs/models/gpt-6-luna)
lists low reasoning effort support. These changes are confined to Fabrics;
credentials, production environment and global model configuration are untouched.
