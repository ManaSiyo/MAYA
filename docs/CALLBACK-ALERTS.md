# Callback notifications

A Wix Call back submission must produce an owner SMS and an independent owner
call. These are owner notifications, not client messages. Lead ingestion,
notification dispatch, provider acceptance and actual delivery are separate
checks; a lead appearing in Admin does not prove a text or ring happened.

## Incident verified October 6, 2026

Wix and live Admin both contain Julia Lokey's callback submission,
`f779663a-b287-45d5-b64d-68c32d891d84`, created 23:04:16 UTC (4:04 PM Pacific).
The enabled Call back form matches MAYA's existing form filter. The live release
matched `9de4fd7dd6d942e6d461a4957dfbc3b4ef40ac7d`.
Google Cloud console for `pro-maya` showed Cloud Scheduler API's **Enable**
button: the service was disabled. Enabled it during this audit, then confirmed
there are no Cloud Scheduler jobs. The deployed worker was coupled to the hourly
Outbound task, with only a five-minute visible Admin fallback. That cannot
provide autonomous callback notifications while Admin is closed. Exact Julia
Twilio outcomes were not available in the old Admin logs, so carrier rejection,
voice readiness and prior alert claims remain unverified.

## Immediate trigger update — October 6

Use the signed Wix event → durable Cloud Tasks path in [EVENT-TRIGGERS.md](EVENT-TRIGGERS.md)
as the primary trigger. Calls now dispatch independently of SMS formatting and
delivery. The two-minute job below is reconciliation only; it cannot meet the
owner's low-latency requirement by itself. Neither queue nor webhook has been
activated in production by this task.

## Owner activation after deployment

Production environment variables and credentials are owner-only under AGENTS.md.
No environment values, billing settings or provider secrets were changed.
Cloud Scheduler API was enabled; no job was created.

1. Push the prepared commit, wait for Cloud Build, then verify `/release.json`
   against that exact commit (`node tests/verify-live.mjs --wait`).
2. In [Cloud Scheduler](https://console.cloud.google.com/cloudscheduler?project=pro-maya),
   confirm the API remains enabled and create a dedicated HTTP job, every two minutes
   (`*/2 * * * *`, America/Los_Angeles), POST to
   `https://maya-api-53947659283.us-west1.run.app/api/tasks/lead-alerts`.
   Use `Content-Type: application/json`, body `{}`, and a 180-second attempt
   deadline compatible with Cloud Run's request timeout.
3. Select the owner-approved Scheduler service account and OIDC authentication.
   The verifier deliberately shares the existing `OUTBOUND_SCHEDULER_EMAIL`
   and `OUTBOUND_SCHEDULER_AUDIENCE` settings. The account email and custom OIDC
   audience must match those values exactly, even if the audience is an existing
   Outbound URL. If absent, the owner must configure them first. Do not guess
   values or change an existing Outbound audience without updating its job.
   Use the direct Cloud Run URL, not Firebase Hosting. No workspace/accountId,
   Gmail connection or enabled Outbound workspace is required for callbacks.
4. Check owner-authenticated `GET /api/admin/lead-alerts/status`. Admin's Leads
   warning uses this same read-only report. Confirm feed connected, provider
   configuration, latest lead, pending claims and an actual recent scheduled
   heartbeat. Configuration flags alone do not prove a job exists or delivery.
5. Review the ledger before running the job: initial catch-up covers the last
   72 hours and may notify about several older submissions. Running the task or
   Admin's check sends real owner SMS/calls. Do not use a client as a test.
6. Run the job once, inspect its HTTP result and the report, then verify a
   second automatic heartbeat with Admin closed. Submit an owner-approved test
   callback using the owner's own contact details. Confirm both the received
   SMS and ringing/working call. A two-minute poll adds up to two minutes plus
   provider latency; it is not an instant Wix webhook.

## Failure handling

The private ledger `private/lead-alerts/callbacks.json` records channel claims,
provider SID/status and errors; `private/lead-alerts/health.json` records worker
health. Only the verified owner can read the HTTP status report. Scheduler calls
require a verified Google service-account token. Anonymous/browser tokens cannot
run the worker. No public endpoint exposes lead records or provider IDs.

SMS and call execute independently. Preference-storage failure falls back to a
grounded signup format. A history-write failure after SMS acceptance preserves
the provider SID and warns rather than sending the SMS again. Definite provider
refusals retry after 15 minutes, at most three attempts. Claimed/uncertain
outcomes never retry automatically: inspect Twilio by SID before an operator
reconciles a claim. Never clear claims blindly. Accepted means accepted by the
provider, not delivered or answered. Read Messages delivery receipts and Twilio
call logs for the actual result.

The dedicated and legacy Outbound task return HTTP 503 for notification failures.
Admin also exposes unresolved historical attempts, missing provider setup and
stale scheduling; quiet fallback errors are visible. The five-minute Admin
fallback remains deduplicated, but is not the autonomous worker.

Validation: `tests/lead-alerts.mjs`, communications suites, full Cloud Build gates,
`tests/app-regression.mjs`, and `tests/smoke.mjs`. All local provider calls are
fake. No live SMS/call was sent as part of this audit.
