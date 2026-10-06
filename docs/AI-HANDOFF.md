# MAYA handoff - October 5, 2026

## Current request: Completed status and consistent icon alignment

Started clean at fa4ba1b, one local commit ahead of origin/maya-v2. Leads now accepts Completed through Admin, owner CRM and the server update path. Filters and status pickers include it; its visible pill, dot and border use the existing green semantic color. Refreshed lead data retains the owner-set status.

Icons center vertically on their assigned row, independent of text baseline or saved text vertical alignment. The Status header keeps real table-cell layout and groups its text/gear explicitly. Aesthetic Control → Icons and dropdown now saves Inside pill gap (6px default) and Beside text gap (8px default), each 0–32px; legacy saves get defaults. Active pill/gear and bare text/gear previews open their actual editors. Existing used icons are retained; the invented Drawer AI cost metric is removed. Five unique status-color examples remain five, with Completed shown in the table preview.

Shared runtime v18/gallery v31 references updated on every served page. Server design validation accepts bounded optional gaps. Changed paths include backend/status.html, shared typography runtime, gallery, design-config/server/owner-crm, served cache references, focused status/filter/gallery/design tests and continuity documents.

Validation: all 33 exact Cloud Build gates, full app-regression and real local server smoke passed. Responsive status filters cover seven widths, and gallery editors cover eleven widths. Tests cover Completed persistence, picker/filter entries, actual visible green status material, hard icon centering even when text is set to Top, independent saved gaps and live Admin token application. Isolated screenshots reviewed. The final preview-click check caught and fixed immediate outside-click dismissal; the focused gallery rerun passed.

Limitations: isolated Chromium and fake providers only. No personal Chrome, production credentials, live calls/SMS or provider connections accessed. No push/deploy performed. The preceding reviewed automation work remains in fa4ba1b and is also unpushed.
Exact next step: Fromsa presses Push in GitHub Desktop for the prepared local commit. After Cloud Build succeeds, verify release.json for the exact commit and check Completed and both icon gaps live.

## Previous request: fixed Messages hierarchy and reviewed text automations

Started clean at 3ec09fa, matching origin/maya-v2. Messages stays in its original H2 tab-title location before and after selecting a contact. The contact below is H3, plain text without a pill/panel backing or duplicate phone number; pencil is hover/focus only. Circular Share/Phone, inline lead notes, saved column widths, independent table material and the bottom voice dock remain intact.

Systems now has Automations beside Aesthetic Control. It opens a drawer view with first/second text examples, triggers, earliest Los Angeles draft times and follow-up wait days. Owner-authenticated configuration persists under private/text-automations/<encoded sub>.json with generation preconditions. Rules are REVIEW-ONLY, not scheduled client sends. Opening a conversation with an empty composer can preview an AI idea based on the exact unambiguous studio lead and recent texts. Use draft appends for review; only explicit Messages Send calls the SMS provider. AI uses the existing CRM budget/provider selection. STOP/blocked threads, replies, two outgoing texts and premature times suppress ideas. Errors preserve editable drafts. Recipient/account guards reject stale responses and composer drafts do not cross contacts/accounts.

Shared typography runtime v17 maps the contact to H3 and gives Automations cards Inner material. All served HTML references updated; authored role locations regenerated (H1 now 13, not 14). Automation form spacing and mobile layout were visually reviewed. No dead placeholder automation buttons or background send timer were added.

Changed paths: backend/status.html; aesthetics/ui/typography-controls.js; served HTML runtime references; aesthetics/aesthetic-control/typography-usage.json; docs/server/{server.js,text-automations.mjs,Dockerfile}; cloudbuild.yaml; tests/{text-automations,lead-notes-ui,component-gallery,design-contract,app-regression,smoke}.mjs and typography-role-usage.py; project continuity/design documents.

Validation: all 33 exact Cloud Build tests passed; full app-regression and local server smoke passed. Focused final drawer checks cover four widths, fixed title coordinates, hierarchy, transparent name, hover pencil, unsent AI/booking drafts, saved settings and failed-save preservation. New unit tests cover account isolation, validation, lead grounding, STOP/blocked contacts, no-reply timing and the two-text limit. Real server smoke rejects unauthenticated reads/saves/ideas. Existing gallery, Outbound/filter, CRM, wake and all communications suites passed. Screenshots visually reviewed; git diff --check clean.

Limitations: fake providers and isolated Chromium only. No personal Chrome, live AI inference, microphone, actual SMS/calls or production credentials/settings accessed. Automations creates reviewable ideas when a conversation opens; it does not send on a schedule or modify existing owner signup alerts. Existing Send/delivery controls remain the actual provider path.
Exact next step: Fromsa presses Push in GitHub Desktop for the prepared local commit. Confirm Cloud Build success and run tests/verify-live.mjs --wait for that exact commit. Owner checks a real first-message idea and reviews before sending. No push/deploy performed here.

## Previous request: editable Leads notes, Contact, name/date roles and message actions

Started clean at c9d43df, matching origin/maya-v2. Prior owner SMS/numeric-phone
fix is now pushed; no live trace or delivery verification was accessed here.

Leads now shows Full name, Contact (stored phone), Status and Latest Notes.
Existing saved column orders retain their order and gain Contact after Name.
Names use H5, dates use H6 below the name; category ?/SI/CE/SU badges are removed.
Aesthetic Control previews the same four columns and exposes H5/H6 with authored
source locations. Shared runtime v15/gallery v29 preserve old saves and semantic
column indexes; Contact adds a fourth optional saved column style.

Click anywhere in a Latest Notes cell to open its reviewed textarea. Dictate
starts browser recognition only on a click, fills the unsaved draft and pauses
Hey Maya recognition. Cancel/close stops recognition; auth changes close the
editor. Save uses authenticated lead-update with the exact stable lead ID and
only paints success after the server accepts it. Failures retain the draft.
Reviewed note replacements are timestamped; refresh cannot overwrite them with
older recorded notes. A newer recorded touchpoint updates both note and wrote,
so dashboard and Maya read the same enriched feed.

Messages preserves known Lead names through empty/Caller provider responses.
Call is now the existing handset SVG in its pill, with accessible label and
existing explicit call confirmation. Booking Link puts the approved consultation
URL into the visible unsent composer, retains existing text and avoids duplicate
links. It does not call the booking preview or send endpoints; blocked/STOP
contacts cannot receive that draft action. Explicit Send and carrier-status
checks remain. Existing separately approved booking workflows are preserved.

## Changed paths and validation

backend/status.html; docs/server/server.js and design-config.mjs; shared typography
runtime and cache references on served pages; gallery/editor/CSS/usage inventory;
focused lead note UI/persistence suites and updated affected regression fixtures;
AGENTS/design/requests/fixes/COMMIT-REVIEW.

Passed: full app-regression (gallery at eleven widths and lead note editor at
four widths); outbound-ui/lead-filter-ui at seven widths; phone (57), messages
(55), transfer/feedback, owner conversation/SMS, wake, design and container checks;
frontend/Playground hands batteries. Note persistence fixtures cover manual/Wix
replacements, older-note refresh precedence and newer touchpoints. All providers
are fake and Chromium is isolated; no personal Chrome, live calls/SMS, credentials,
billing or production environment changes. Shared cache references and diff checks
passed.
## Exact next step

The verified deployment-gate fix is prepared as a local commit for Fromsa to Push. dd7ba48 is already pushed but failed deployment. Never push automatically.
After Cloud Build deploys, verify release.json; check note typing/dictation,
Save/reload, H5/H6 changes, contact numbers and an unsent Booking Link draft.
Owner must verify actual microphone capture and explicit SMS/call delivery;
carrier acceptance is not delivery confirmation. Prior owner SMS verification:
"Send me the last 5 leads", THREAD Nick/MORE/ACTIONS and phone-requested numeric
contact texts. No real sends ran in this task.

## Standing constraints

Ask and wait before each personal Chrome session; MAYA and Worldofsiyo are
separate. Preserve account/project boundaries, client preview/SEND/STOP gates,
non-retryable claims, private archives, migrations and Storage cleanup paths.
No credentials, billing or production variables. docs/design.md is the sole
active aesthetic specification; local commits are authorized, pushes are not.
