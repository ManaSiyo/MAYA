# Mana Siyo's Outbound: activation

Prepared locally on September 27, 2026. Not deployed or connected to live Gmail by
this change. Consumer MAYA and Playground are unchanged.

## Included

- A master list of up to 10,000 contacts, 50 results per page, reusable campaign
  membership, campaign-specific drafting and explicit reviewed sending.
- Two independently authorized Gmail mailboxes in the same signed-in admin
  workspace. Connect worldofsiyo@gmail.com and fromsa@manasiyo.com there; signing
  into Admin as a different Google account still opens a separate workspace.
- Hourly Sheet, Gmail, existing Twilio activity and bounded Hunter reconciliation.
  New Gmail correspondents require review before becoming prospects. No automatic
  email sends, automatic bookings or automatic changes to closed/suppressed stages.
- Shared Admin/Outbound AI meter: a combined $1/day **Outbound text AI** allowance,
  resetting at midnight America/Los_Angeles. This does not cap consumer generation,
  images, voice, other MAYA AI calls, Hunter, Twilio or Google infrastructure.
- Green person, blue company and yellow offer fields in the editable sample email.

## Owner-only setup

Repository instructions reserve credentials and production environment changes to
Fromsa. No secrets were read or changed during implementation.

1. **Deploy:** Push the prepared commit from GitHub Desktop and wait for Cloud
   Build to pass. Keep all private credentials in your existing secret manager.
2. **Google Sheet:** Outbound → Connections → save the workbook → Refresh from
   Google Sheet. Share Viewer access with the Cloud Run service account shown by
   a denied-access error. The three supported tabs are `9/23 Ceremonial`,
   `9/23 Corporates`, and `9/23 Fashion Houses`. This is read-only: local edits win,
   drafts remain, bounced contacts are suppressed, source deletions aren't erased.
3. **Gmail API:** In [Google Cloud](https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=pro-maya),
   enable Gmail API and configure a Web application OAuth client. Authorized
   redirect URI: `https://maya.manasiyo.com/api/outbound/gmail/callback`.
   Required scopes are `https://www.googleapis.com/auth/gmail.readonly` and
   `https://www.googleapis.com/auth/gmail.send`. Complete the Google consent-screen
   requirements applicable to your app. External testing-mode authorization can
   expire; production use needs the appropriate publishing/verification status.
4. **Server configuration:** Attach `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`,
   `GMAIL_REDIRECT_URI` and a dedicated `GMAIL_TOKEN_ENCRYPTION_KEY` (32 random bytes
   represented as 64 hexadecimal characters). Keep that encryption key stable;
   replacing it requires reconnecting mailboxes. Optional provider credentials:
   `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `HUNTER_API_KEY`.
   A provider with no credential is shown as not connected, never as zero usage.
5. **Connect both:** In the Outbound drawer, use Connect Gmail mailbox once per
   mailbox and approve the scopes. This application authorization is separate
   from Gmail access granted to ChatGPT/Codex. Disconnect removes MAYA's stored
   refresh token; Google account access can also be revoked in Google settings.
6. **Hourly worker:** Create one [Cloud Scheduler](https://console.cloud.google.com/cloudscheduler?project=pro-maya)
   HTTP POST job for this workspace. Use cron `0 * * * *`, timezone
   `America/Los_Angeles`, URL
   `https://maya-api-53947659283.us-west1.run.app/api/tasks/outbound-sync`,
   `Content-Type: application/json`, and body `{"accountId":"WORKSPACE_REFERENCE"}`.
   Copy the workspace reference from Outbound → Hourly updates & spending.
   Use an owner-selected service account and OIDC authentication. Set its exact
   email as `OUTBOUND_SCHEDULER_EMAIL` and set `OUTBOUND_SCHEDULER_AUDIENCE` to the
   exact OIDC audience configured on the job (normally the target URL). Use the
   direct Cloud Run URL, not Firebase Hosting, for long-running scheduled work.
   Allow a 900-second attempt deadline and compatible Cloud Run request timeout.
   The endpoint verifies Google's signature, audience, expiry and service-account
   email. It rejects browser/admin tokens. Enable hourly updates in the drawer.
   The UI reports awaiting, running or overdue based on actual scheduled runs.
7. **Hunter:** Default automatic lookup allowance is zero until selected. A run
   can discover up to 25 people from one saved active-campaign company domain;
   configure 0–20 lookups/day. Failed/uncertain calls retain their daily claim.
   Hunter credits are separate from the AI allowance. Manual Hunter actions are
   explicit. No unsupported automated company-discovery prompt is invented.

## Verify after activation

- Refresh the master Sheet and compare campaign counts with the workbook.
- Connect both mailboxes; run Update CRM now. Send a message from each mailbox to
  your own test address through reviewed send, reply, and update again. Also send
  a message directly in Gmail and verify it is reconciled. Do not use a prospect
  as a delivery test. Gmail accepting a send is not proof of recipient delivery.
- Make a separately approved test call/SMS. Existing stored Twilio events match
  contacts by exact normalized phone number; this does not change consent or
  repair Twilio webhooks. Live incoming SMS remains a separate verification item.
- Run the Scheduler job once and inspect its HTTP response plus the drawer's last
  scheduled run. After an hour, verify another run. Turning the UI switch on alone
  cannot create a Cloud Scheduler job.
- Request one AI draft with each connected provider; verify the meter changes.
  Exhausted/uncertain allowance blocks new AI calls while deterministic sync works.

## Cost basis and limits

Meter amounts are provider-reported token counts multiplied by checked text rates,
not billing-account totals or provider invoices. Reservations are taken before
requests using a conservative input bound and a fixed output-token limit; parallel
requests share the same account/day ledger. Unknown completion/usage keeps its
reservation for the day. There is no paid automatic fallback/retry.

| Provider | Economy model | Input / output per million tokens | 2,000 input + 500 output |
|---|---|---|---|
| OpenAI | gpt-5-nano | $0.05 / $0.40 | $0.00030 |
| Claude | claude-haiku-4-5-20251001 | $1 / $5 | $0.00450 |
| Gemini | gemini-2.5-flash-lite | $0.10 / $0.40 | $0.00040 |

Examples exclude tax, provider price changes and unrelated API use. Actual token
usage varies; reservations reduce usable headroom temporarily. Auto chooses the
lowest estimated-cost configured model. Provider access must be verified live.
A $1 allowance is not a promise of a fixed number of successful messages.

Gmail backfill covers the last 30 days, up to 100 messages per mailbox per run,
with bounded batches and resumable history cursors. Large inboxes may need several
runs. Only metadata/snippets are summarized, not entire threads or attachments.
AI briefs process up to eight changed contacts per run. The dashboard retains
2,000 recent matched events and 100 unmatched review items; source mail remains
in Gmail. Legacy campaign copies are retained to avoid losing notes or drafts;
new imports reuse a master identity. This is not an archival migration tool.

Sources checked September 27, 2026:
[Gmail incremental sync](https://developers.google.com/workspace/gmail/api/guides/sync),
[Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server),
[Scheduler OIDC](https://docs.cloud.google.com/scheduler/docs/http-target-auth),
[Firebase cookie forwarding](https://firebase.google.com/docs/hosting/manage-cache#using_cookies),
[OpenAI rates](https://developers.openai.com/api/docs/models/gpt-5-nano),
[Claude rates](https://platform.claude.com/docs/en/about-claude/pricing),
[Gemini rates](https://ai.google.dev/gemini-api/docs/pricing).
