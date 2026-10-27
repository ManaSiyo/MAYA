# Immediate events and latency — October 6, 2026

Prepared locally. This code is not active until Fromsa pushes, Cloud Build
succeeds and the owner completes the provider configuration below. No production
environment variables, credentials, OAuth grants or billing were changed.

## Wix callback path

Signed Wix Submission Created → durable Cloud Tasks enqueue → authenticated
worker → fetch that submission from Wix → independent owner SMS and call.
No browser, periodic scan, AI summary or completed SMS is required before a ring.
A durable channel claim still prevents a repeated event from sending twice.
Unknown carrier outcomes require reconciliation, never blind retries.

Owner setup:

1. Enable Cloud Tasks and create a queue in `pro-maya`, preferably `us-west1`.
   Configure `EVENT_TASK_QUEUE` as its full
   `projects/pro-maya/locations/us-west1/queues/<queue>` resource. Ensure queue
   rate/concurrency limits do not introduce a deliberate minute-long delay.
2. Give the Cloud Run workload identity Cloud Tasks Enqueuer access to this
   queue and permission to act as the chosen worker service account. Configure
   the Cloud Tasks service agent's token-creation permissions as required by
   Google. Review existing IAM; do not grant broad project ownership.
3. Cloud Tasks uses existing `OUTBOUND_SCHEDULER_EMAIL` and
   `OUTBOUND_SCHEDULER_AUDIENCE` for its OIDC identity. These must match the
   server verifier exactly; preserve any existing Scheduler audience. The task
   targets the direct Cloud Run `/api/tasks/wix-callback` route. Cloud Run IAM,
   when enforced, must accept that account and audience as well.
4. In the owner-controlled Wix app, subscribe to **Form Submissions →
   Submission Created**, destination
   `https://maya-api-53947659283.us-west1.run.app/api/events/wix`.
   Release/install the app on Mana Siyo. Configure `WIX_WEBHOOK_PUBLIC_KEY`
   from that app and `WIX_WEBHOOK_INSTANCE_ID` from its actual installation.
   An app instance ID is not the site ID. Never put a private key in MAYA.
5. The handler verifies raw RS256 JWTs, exact instance, entity and event type;
   only callback form `d6894a81-9660-42ba-ae5b-874a85024837` can request a call.
   The site-scoped Wix API integration must have Get Submission's required
   **Manage Submissions** permission. The worker re-fetches the saved record;
   webhook fields cannot choose a recipient or owner account.
6. Wix requires acknowledgement within 1,250 ms. The handler acknowledges only
   after Cloud Tasks accepts the durable task, with a 1,000 ms HTTP enqueue
   budget. A cold instance/token request may exceed the Wix deadline: Wix must
   retry, with named task deduplication. Never replace enqueue with detached
   in-process work after returning 200. Measure cold starts before deciding on
   paid minimum instances; no such billing/configuration change was made here.
7. Keep the dedicated two-minute `/api/tasks/lead-alerts` Scheduler job from
   CALLBACK-ALERTS.md as reconciliation for missed events, not the primary
   low-latency trigger. Scheduler was previously enabled with zero jobs.

After deployment/configuration, submit a callback using owner-approved test
contact details. With Admin closed, verify actual owner SMS receipt and ringing
call, Wix webhook status, Cloud Tasks execution and private callback ledger.
`callDispatchMs` measures worker-start → provider invocation;
`callLeadAgeMs` measures form-created → invocation; `callProviderMs` measures
provider request time. These do not prove handset ringing or SMS delivery.
GET `/api/admin/lead-alerts/status` requires owner auth and exposes readiness,
claims and timings. Configuration alone does not prove event delivery.

## Gmail inbound path retired

Outbound Gmail watch and Pub/Sub handlers were removed at the owner's request.
Old mailbox credentials, OAuth grants, watch bindings and cloud subscriptions were
not changed or deleted. The owner should review and disable any retired Gmail
subscription or Outbound Scheduler job, and revoke grants if desired. Keep the
independent callback Scheduler and its existing `OUTBOUND_SCHEDULER_*` identity.

## OpenAI audit and recommendation

Current defaults: text `gpt-6-luna`, Chat Completions with reasoning effort
`none`; CRM draft/owner SMS parsing uses its existing cheaper provider routing
(`gpt-5-nano` or Gemini), with its existing $1/day text cap. Web voice uses
Realtime client secrets and WebRTC; phone voice bridges Twilio audio to OpenAI
Realtime WebSockets, default `gpt-realtime-2.1-mini`. Image defaults and image
quality are unchanged. Environment overrides may differ: Admin provider
snapshot is the authenticated source for runtime configuration.

No official model named “GPT-6 Sol Light” was verified. Keep Luna for routine
text and Realtime Mini for speech, rather than changing to an unverified name.
OpenAI lists Luna at $0.10 input/$0.50 output per million tokens. Existing CRM
nano routing can cost less for its narrow tasks; Luna is not automatically the
cheapest model for every request. Fast/Priority mode can cost twice as much;
leave it off pending measured need and owner cost approval.

Changes remove 20 optional summary calls from ordinary lead reads (10-second
raw cache), bound optional Admin voice context to 1,200 ms, overlap phone memory
with socket setup and bound it to 1,200 ms, and reduce phone end-of-speech wait
from 420 to 300 ms. Unavailable context stays explicit. Model/network/provider
latency is additional; 300 ms is not a total voice response guarantee.
Phone logs separate `session_ready`, `response_first_audio` and
`turn_first_audio` timings, in milliseconds. The latter includes tool work and
transport after speech stops. No live p50/p95 model latency was measured here;
use deployed logs and real owner calls before making a numerical speed claim.

Official references checked October 6:
- https://developers.openai.com/api/docs/models/gpt-6-luna
- https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini
- https://developers.openai.com/api/docs/guides/latency-optimization
- https://developers.openai.com/api/docs/guides/fast-mode
- https://developers.google.com/workspace/gmail/api/guides/push
- https://docs.cloud.google.com/tasks/docs/create-tasks
- https://docs.cloud.google.com/pubsub/docs/authenticate-push-subscriptions
- https://dev.wix.com/docs/build-apps/develop-your-app/api-integrations/events-and-webhooks/about-webhooks
- https://dev.wix.com/docs/api-reference/crm/forms/form-submissions/submission-created
