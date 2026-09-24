# Maya Outbound · v14.37

Prepared locally, not deployed by Codex. Opens at `/outbound.html` from the
right-side Maya menu. Operation Room and Playground stay alongside it.

## What works in code

- Account-scoped campaigns, audience/offer/competitor notes, contacts and drafts.
- Hunter Discover (25 companies/page), Domain Search (25 contacts/page), named
  Email Finder and Email Verifier. Offset controls support later result pages.
- Google Sheets read/import up to 1,000 rows, pasted CSV import and CSV export.
  Expected headers: Name, Email, Company, Domain, Title, Notes. Email is optional.
- Per-campaign deduplication; suppression propagates across matching emails in
  the owner's workspace and applies when importing into another campaign.
- Maya market research with web search; editable email drafts grounded in saved
  studio facts and contact/campaign data. Explicit actions initiate billable work.
- Email-app handoff for human review. No automatic sends, inbox/reply sync,
  scheduled sequences, mailbox warming or calendar booking. Results reflect
  manually recorded stages, not observed email delivery/open/click events.
- GCS generation preconditions protect concurrent writes; failed storage reads
  never become an empty overwrite. Every endpoint requires admin authorization.

## Owner connection steps

1. Provide the outbound Google Sheet URL and exact tab name, or enter them in
   Outbound → Connections after deployment. Share that sheet as Viewer with the
   existing Cloud Run service account. Do not publish the sheet publicly.
2. If Hunter is not configured, attach its key as `HUNTER_API_KEY` to Maya's
   Cloud Run service through your existing secret-management process. Never put
   the key in this repository, a browser field or chat. No credentials or service
   environment settings were inspected or changed during this implementation.
3. Save your real studio facts in Connections. Create a campaign, import a small
   known sample, then check field mappings. Imported rows do not overwrite
   existing contact notes or drafts. Export is CSV; no automatic Sheets writeback.
4. Review Hunter/OpenAI account access and balances before clicking paid actions.
   Provider adapters are tested against fakes; production credentials and model
   entitlement still need owner verification after deployment.
5. Review drafts before opening them in your mail app. Record Contacted/Replied/
   Meeting/Closed after those events occur. Use Suppressed for do-not-contact.

## Models and economics, checked September 23

- Default text/vision reasoning: `gpt-6-luna`. Standard short-context text rates
  from its model page are $0.10 input / $0.50 output per million tokens. Example:
  2,000 input + 500 output tokens is about $0.00045, excluding web tools, cached
  input, long context and retries. This is an estimate, not a latency benchmark.
- Chat Completions uses `reasoning_effort: none` for tool compatibility; Responses
  market research uses low reasoning. Expensive text tiers are not defaults.
  Existing owner-set MODEL_TERRA/MODEL_LUNA/MODEL_SOL/RANK_MODEL overrides win.
- Image default: `gpt-image-2.5-flare`, documented as the faster everyday option.
  Existing image quality/size settings stay. It is not guaranteed cheaper for
  every render; token usage depends on quality, size and reference images.
  Legacy `gpt-image-2` community records remain accepted alongside Flare.
- Voice default: `gpt-realtime-2.1-mini`, with separate phone/environment
  overrides preserved. Audio rates: $10 input / $20 output per million audio
  tokens; text rates differ. No live audio quality or latency test was run.
- Embeddings and transcription remain specialized models. No Astra default was
  introduced. Account access must be confirmed before relying on new models.

The existing dashboard spend meter is still a coarse per-call estimate; it is
not a token-accurate invoice. Internal drafts/research now record usage metadata
and increment that estimate. Use OpenAI billing for actual account charges.

Sources:
- https://developers.openai.com/api/docs/models/gpt-6-luna
- https://developers.openai.com/api/docs/guides/image-generation
- https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini
- https://hunter.io/api-documentation/v2
- https://explee.com/ (workflow reference, not a service dependency)

## Validation and launch limits

Offline Outbound/model tests cover auth, account isolation, deduplication,
suppression, CSV mapping, generation conflicts, failed writes, confirmation
requirements and draft review. Existing API, phone/SMS, transfer, feedback,
proxy policy, routing, ranking and admin contracts pass. No computer use,
paid API requests, calls, emails or SMS were performed. Visual/browser checks,
Firestore emulator checks and real provider smoke tests remain outstanding.

Public HTML fetch confirmed the deployed Admin still had the older below-Mana
CSS at inspection. Local v14.37 restores left placement and increments the
version so the Admin's deployment refresh can detect the new shipment. Owner
must push and confirm both hosting and API/rules deployment succeed.

## Owner workbook inspected
Workbook: https://docs.google.com/spreadsheets/d/1G2zfqopOyZNHf78nuEeNdLgRY7ON0JTeegkhhZ4azyg/edit
The supplied gid points to Principles (sales framework), not a contacts table.
Use one of these exact tab names in Connections and a corresponding campaign:
- August SDR
- 9/23 Ceremonial
- 9/23 Corporates
- 9/23 Fashion Houses
Corporates uses row 3 for headers; the importer detects it automatically. Research,
original status, date and other extra columns are retained in contact notes.
Sheet Hunter status does not automatically count as current email verification.
Incomplete historical addresses stay in notes; bounced addresses are suppressed.
This is a read-only import, not ongoing two-way sync. The original workbook was
not modified. Cloud Run service-account access still needs verification.
