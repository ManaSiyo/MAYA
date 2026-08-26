# MAYA shared handoff

The one live file Claude and Codex both read first and both update last.
It is the current state of the work, never a history log. Replace stale
lines instead of appending. The narrative belongs in `history.txt`, the
incidents in `fixes.txt`, Fromsa's asks in `requests.txt`.

Whoever finishes a piece of work updates this file in the SAME commit.
If this file disagrees with chat memory, this file is right.

## The rules, in one place

1. One repository, one branch: `ManaSiyo/MAYA`, branch `maya-v2`, working
   folder `~/Desktop/MAYA-new`. No agent creates a second clone, ever. The
   duplicate clone of August 14 is what broke two days of pushes.
2. One agent at a time in `index.html`. Fetch and pull before starting.
   Read this file before starting. Update this file before stopping.
3. Commits are labelled: `[Claude][v13.xx] Description` or
   `[Codex][v13.xx] Description`. One category per commit.
4. Fromsa presses Push. Neither agent has his credentials, and neither
   agent touches a password, a key or a token, ever. Credential work is
   written up as numbered steps WITH clickable links, in `fixes.txt`.
5. Every shipped version bumps `<meta name="maya-version">` in BOTH
   `index.html` and `status.html`. They must match; the regression suite
   fails if they drift, and a mismatch means the Systems Map never signs
   people out after a deploy.
6. Every completed request in `requests.txt` earns an assertion in
   `tests/app-regression.mjs`. That is the whole anti-regression system.
7. Anything Fromsa reads on screen: no em dashes, no en dashes.

## If you are auditing this, start here

1. `AGENTS.md` for the layout and the rules. The folder changed on Aug 21:
   `frontend/index.html`, `backend/*.html`, `aesthetics/` at the root,
   everything else in `docs/`.
2. `docs/firebase.json` is the hosting map. Every old address is rewritten
   onto its new file, and the catch-all serves `frontend/index.html`. If a
   page 404s, this file is the first thing to read.
3. `tests/app-regression.mjs` is the browser and source contract. It runs only where
   there is Chromium and a free socket: `node tests/app-regression.mjs` from
   the repo root. `tests/smoke.mjs` covers the server. `/verify.html` is the
   only check Fromsa can run himself, because his Mac has no Node.
4. `docs/server/server.js` is the whole API. Look for: the submission store in
   MAYA's own bucket, the credit meter (`/api/admin/spend`, `/api/admin/credit`),
   marketing (`/api/admin/marketing`), Pinterest OAuth, `/api/fetchpic` with
   its SSRF guard, and the per-user rate limiter.
5. Known open risks: no client side error reporting; the rate
   limiter is per Cloud Run instance and resets on restart; community
   provenance is app level only; submissions filed before Aug 17 may still be
   in the old Drive folder; Realtime availability still depends on the OpenAI
   account; no Gmail read integration exists.

## The playground rule, August 21

`playground/index.html` (served at /playground.html, linked from the MAYA door
on Admin on hover) is Fromsa's private staging copy. Experimental features go
there FIRST; `frontend/index.html` changes only when he approves a promotion.
It shares the live sign in and data, so destructive experiments still need
care. Keep the small amber Playground badge so the two are never confused.
Since v13.58 the playground has carried approved designs before promotion.
The v13.62 filing cabinet was promoted faithfully to the real app in v13.71,
but Playground still keeps its amber badge and remains the source of truth for
future visual experiments. Never regenerate it as frontend plus badge.

Admin access: ADMIN_EMAILS defaults to fromsa@manasiyo.com and
worldofsiyo@gmail.com only, overridable by env. /api/admin/users lists named
accounts (email + last seen) for the Users hover; markers at metrics/users/
carry email since v13.43, older ones are anonymous.

Marketing: WINDSOR_API_KEY on Cloud Run feeds /api/admin/marketing (chart,
campaign table, warnings, ticker) through Windsor, per connector. Direct
META_ADS_TOKEN / GOOGLE_ADS_* still win when set.

The fabric sourcing revamp shipped in v13.44; see that section below.

## v13.93 (Claude): Lead Station goes Hunter-style (frozen header + first column)

`backend/status.html` + `docs/server/server.js`:
- The **Lead Station is a scrolling CRM now**. The panel is a scroll box
  (`#leads-fold .panel{max-height:62vh;overflow:auto}`); the **header row is
  frozen** (`th{position:sticky;top:0}`) and the **Full name column is frozen**
  (`.lead-td-name{position:sticky;left:0}`), Hunter.io style. New columns:
  **Company / Title, Quote, Invoice 1, Invoice 2**, and the recommendation column
  header is now **Actions**. Empty money cells show a faint `+`, empty company a
  faint `add`.
- **One marquee speed for all rows.** `_leadMarquees()` sets each note's
  `animationDuration` from its scroll distance at a fixed ~34 px/s, so long and
  short notes drift at the same pace instead of long ones sprinting.
- **Server persists the new fields.** `updateLead` accepts `company`, `quote`,
  `invoice1`, `invoice2` (in-place for manual leads, overrides for Wix). The
  client `saveLeadField` now mirrors any edited field back onto the local row.

NEXT (this batch, ordered by Fromsa): (2) Admin drawer as an EXACT functional
copy of the frontend swipe + hamburger (fixes the reverse-swipe firing the
browser back-gesture; center the drawer headings; hover pills under ADMIN).
(3) Speed to Lead scaffolding LAST — Wix webhook → Maya drafts SMS/email + a
voice heads-up to Fromsa via Quo/OpenPhone; auto-send to the lead is APPROVED,
the call to Fromsa is the human checkpoint. Needs from Fromsa: Quo account + key,
his phone number in env (never stored by Claude), his humanized copy prompt.
Also queued: quote→pay-link automation, Maya voice drawer control, Maya knowing
yesterday's Wix stats.

## v13.92 (Claude): favorites polish, popup copy, card centering, avatar-dropdown target

`frontend/index.html` (the three other surfaces: version bump for lockstep):
- **Favorites pills** relabelled **"Post to Community Wall"** and **"Get it made"**,
  restyled to read like the X/heart glass icons — subtle 0.22 border, no
  attention-pulse (the `::after` halo + `maya-submit-pulse` keyframes are gone) —
  and smaller (9.5px, tighter padding, min-width 0).
- **Mana Siyo popup**: the em-dash is gone (house rule), body copy is a touch
  larger (13.5px) and the **Request my quote** button is a small centred pill
  (`inline-block; width:auto`) instead of a full-width bar.
- **Favorite card stays centered when stepping.** The caption slot
  (`#viewer-piece-summary` in submit mode) now reserves a fixed two-line height
  (`2.9em`), so a short vs long caption no longer shifts the image up and down as
  you go left/right. The three-view cards are one aspect, so the image now holds
  its position.
- **Favorites nav arrows** (`fav-nav-prev/next`) moved nearer the corners (18px →
  10px).
- **Avatar switcher hit target.** The caret was a ~2px sliver beside the big
  Projects pill; now the **name itself opens the switcher** (`#drawer-avatar-name`
  onclick) and the caret is a bigger button (13px, 4×7 padding). If the dropdown
  still misbehaves, we need the exact symptom (nothing happens vs opens empty).
- Dissect is untouched and still fires on favorite; design notes (with the
  dissection) remain on the inspo screen only.

OPEN / NEXT: **playground** — Fromsa wants it brought up to the current app
("make the playground the current version of what Maya is"), then a
**pinch-to-zoom map feature added to the playground only**: the whole board
zooms in/out like a map, floor at ~10% card size, tapping the Maya logo resets to
100%. That is the next chunk (a careful playground refresh + a new pan/zoom
engine); NOT in v13.92.

## v13.91 (Claude): favorites two-pill submit, admin lead-station + swipe, merges

`frontend/index.html`:
- **Projects pill** now uses the EXACT type of the "Fromsa" name — Cormorant,
  19px, weight 300, italic, not caps — so it never reads larger than the name.
  (Reverses the v13.90 caps/bold that looked oversized.) Mobile matches at 17px.
- **Favorites: two pills side by side**, both always visible — **Community Wall**
  and **Mana Siyo** — replacing the v13.90 Submit-hover menu (the menu vanished
  before it could be clicked). `.submit-wrap` is a centred, wrapping row.
- **Design notes are OUT of the favorites screen** — hidden in
  `[data-mode="submit"]`; they live only on the inspo/modify screen (where the
  exclude-x pills still work). The v13.90 pills→prose/colour-tint code was
  reverted since notes no longer render in favorites.
- Mana Siyo still opens the quote-by-email confirm → atelier submit.

`backend/status.html` (Admin):
- **Lead Station marquee.** Latest Notes now scroll (ping-pong) inside their
  column when longer than the space, pausing on hover and while editing
  (`.lead-note-vp`, `_leadMarquees()`, `@keyframes leadmq`). The **Email** cell
  now shares the notes' Cormorant face/size (`.lead-email-edit`), keeping its own
  colour. The call CTA is a **real smartphone glyph** (`PHONE_SVG`), not the ☎
  handset.
- **Sources of traffic + The bottom line merged into one fold** (`#bottom-fold`):
  funnel + tiles up top, a `.bl-sub` divider, then the sources table. The old
  `#sources-fold` is gone; the panel-spotlight map points `sources → bottom-fold`.
- **Drawer swipe finally answers the trackpad.** `_wireDrawerSwipe` already had
  touch + mouse, but a Mac two-finger swipe fires `wheel` (deltaX), which nothing
  listened for — that's why it never worked. Added a horizontal-wheel accumulator
  that pulls the drawer in on a right-to-left swipe and pushes it back on
  left-to-right, ignoring vertical scroll and swipes over scrollable tables.
- NOTE: users visibility — signed-in Gmail accounts already surface in Admin via
  `/api/admin/users` (the Users hover / `metrics/users/<hash>.json` markers).
  Cloud Run console/IAM access is Fromsa's own GCP grant, not something the app
  can hand out.

## v13.90 (Claude): favorites Submit split, design-notes as prose, drawer polish

`frontend/index.html` only (other three surfaces: version bump for lockstep):
- **Favorites is Submit-only.** In `#garment-modal[data-mode="submit"]` the modify
  chrome (`#viewer-row-modify-1` Tap to Listen / Switch Fabric / Add Reference,
  and `#viewer-mid-row` Visualize) is hidden — those stay inspo-only. The lone
  **Submit** pill (tighter now) reveals two destinations on hover (desktop) or
  tap (`toggleSubmitMenu`, works on touch):
  - **Community Wall** → `submitToCommunity()` publishes the vision to the wall
    (`communityBoard.publish`) and confirms.
  - **Mana Siyo** → `submitToManasiyo()` → `mayaShowManasiyoPopup()`, a made-to-
    order confirm ("we'll email you back a custom quote — cost and timeline").
    On confirm it runs the existing atelier submission (`submitFavorite` →
    `/api/submit`). Quote amounts are deliberately NOT shown (most run $1,500+).
- **Design notes read as prose, not pills.** In submit (favorites) mode
  `renderViewerNotes` renders each value as a plain italic word instead of a
  `.vn-pill` with an exclude-x; colour values are tinted their actual colour via
  `_colorSwatch` (a name→hex map). Modify (inspo) mode keeps the functional
  pills + x so refs can still be excluded from the next Visualize.
- **Drawer.** The **Projects** pill now matches the "Fromsa" name — Cormorant,
  ~19px, centred, ALL CAPS — sitting beside it. The top label and tab titles are
  uppercased (`.pg-tabtitle text-transform: uppercase` → USERS / FABRICS /
  PINTEREST). **Stats and Measurements both default `open`.**
- **Upload** is brighter at rest (`rgba(220,230,248,0.68)`), clearly brighter on
  hover (`rgba(236,242,255,0.94)`, no longer a fade), nudged a couple px lower.
- **Mobile pass.** The new drawer type steps down on phones (`@media
  max-width:640px`) at the same ~0.88 ratio the rest of the app uses; the name
  no longer truncates to "Fro…" beside the Projects pill (name won't shrink, the
  pill yields / wraps). Design notes stay desktop-only (hidden < 1280px).
- NOTE: the Mana Siyo "custom quote" is by email only — there is no in-app
  pricing engine yet; Fromsa is building the approximate-quote logic separately.

## v13.89 (Claude): free-trial credits, drawer Stats + Projects/Users restructure

`frontend/index.html`:
- **Upload reverted** from the v13.86 glass pill to the playground's plain text
  link — a touch brighter at rest (`rgba(216,226,246,0.60)`), hover holds the
  same colour a hair faded (`0.52`, constant, not lit), nudged a few px lower
  (`margin-top: 7px`). Tap-to-Listen already matched the playground, so it was
  left as-is.
- **Drawer restructure.** The top cabinet label now reads **"Users"** (the
  account/Google-ID header), no longer the projects opener. The **Projects
  dropdown moved beside the avatar name** (`#pg-project-beside`, right-aligned
  over the Remove pill), keeping the exact same behaviour (`pgProjects` →
  `toggleSessionsDropdown`). Avatar (face + measurements) and Projects are now
  independent under one account; the old `#pg-project-pill` stays hidden.
- **Stats fold** (`#pg-stats`), collapsible like Measurements and sitting ON TOP
  of it, fills the empty drawer space. A circular SVG gauge shows trial credits
  left of $2, over four tiles: credits left, cards made, favourites, images
  rendered. Cards/images/favourites come from local `items`; credits come from
  `/api/usage`. `_renderDrawerStats()` repaints on avatar-pane show and on
  favourite toggle. A **"Try popup"** dev link (and `?trypopup`) previews the
  out-of-credits popup.
- **Out-of-credits popup** (`mayaShowCreditsPopup`): shown when an image call
  returns `402 trial_exhausted`, with an Upgrade (($5, ~13 renders) button that
  is a labelled placeholder until payments are wired. `showError` swallows the
  trial error so no raw toast fires.

`docs/server/server.js`:
- **Per-user free-trial meter.** Every signed-in account gets `USER_TRIAL_USD`
  (default $2) of image renders. Image calls are refused with `402
  trial_exhausted` once the account is at the cap; **admins are never capped**.
  The check runs BEFORE the upstream call, so a blocked user costs nothing.
  Cumulative (a trial is a lifetime allowance), one GCS object per account at
  **`metrics/trial/<sha256(sub)[:24]>.json`** — its OWN prefix, hashed sub, so
  it never collides with or inflates the `metrics/users/` account count.
  `noteUserSpend` charges the meter after each successful call (images flush
  immediately so the cap survives a restart). **`GET /api/usage`** returns the
  signed-in user's own meter (`capUsd`, `spentUsd`, `leftUsd`, `images`) — any
  authed user, real numbers for everyone so the gauge moves.
- KNOWN LIMIT: like the rate limiter, the per-user meter is per-instance
  in-memory with a 10s GCS-backed read, so a rare cross-instance race can let a
  render or two slip past $2. Fine for a trial guard; not a billing ledger.
  Payments (the real $5 top-up) are NOT wired — that is the next step.

## v13.88 (Claude): Hey-Maya wake word, fabric arrival/USD, community wall

`backend/status.html`: a **"Hey Maya" wake word** — an opt-in background
SpeechRecognition (`toggleWakeWord`, off by default, persisted in localStorage)
that taps the voice line when it hears "hey/hi/ok maya"; it pauses while she's
live and resumes on a `maya-voice-ended` event, and self-restarts on `onend`.
Toggle chip in the drawer command head. `backend/backend.html` (the Brief):
fabric cards read **"Arrives in N days"** (relative) instead of a date, and prices
are **converted to USD** (`_priceUSD`, approximate FX table, original kept on
hover). `frontend/index.html`: **community wall text centered** (`.cc-meta`).
Version 13.88 x4; app-regression + contract green; 3-page headless smoke = 0 JS
errors; conversion unit-checked.

NEXT (from spec §8): compact Upload/Listen on one row; project scorecard
(cards/images/versions) in the empty middle; cross-project favorites store;
favoriting-resets-the-card-stack bug; fabric matching that combines all garments
(Fromsa said fine for now).

## v13.87 (Claude): the Lead Station becomes a real custom CRM

Server (`docs/server/server.js`): `maya/leads.json` now holds `{items, overrides,
tombstones}`. `updateLead(id, patch)` edits any lead — manual in place, Wix via an
override (survives the next Wix refresh); `deleteLead(id)` removes a manual lead
or tombstones a Wix one (stays in Wix, hidden from the station). `loadLeadFeed`
applies overrides + tombstones. New `POST /api/admin/lead-delete`; `lead-update`
now takes any id (was manual-only). Maya voice tools `update_lead` + `delete_lead`
(confirm-gated) + client handlers. Client (`backend/status.html`): the station
edits like a sheet — name / email / notes are contenteditable cells (no pencil),
saved via lead-update / lead-note; each row has a delete X (instant remove);
`#leads-bar` has Reload + "+ Add lead"; the WIX badge sits BESIDE the name now.
Version 13.87 x4; app-regression + contract + admin-command green; admin headless
smoke = 0 JS errors; CRM override/tombstone merge unit-tested.

AUDIT ANSWERED: the "users" number is signed-in ACCOUNTS (countUsers → GCS user
records): total 3. GA MAYA visitors = 15 (7d) / 49 (28d); manasiyo.com (Wix) is
~30/day. So 3 is correct for accounts; the ~30 are site visitors, a different
metric. NOT DONE: merging Bottom Line + Sources of Traffic into one shell (still
queued in the spec).

## v13.86 (Claude): upload button + two data-safety bug fixes

`frontend/index.html`: (1) the "+ upload" button was invisible faint text — now a
real glass pill (wider `padding:7px 30px`, brighter `rgba(222,230,248,0.72)`,
`margin-top:8px` lower). (2) BUG (data risk): deleting a project waited for the
async cloud delete before removing the row, so on a slow link the X looked dead
and the next click deleted a DIFFERENT project — now the row is removed the
instant delete is confirmed (`deleteSavedSessionRow`), with the end re-render
restoring it if the delete fails. (3) BUG: `toggleFavorite` only re-rendered the
Favorites screen when favoriting, so un-hearted pieces stayed — now it re-renders
on unfavorite too. Version 13.86 x4; app-regression + contract green; 0 JS errors.

NEXT: design-notes categories (Fabric / Color / Silhouette / Style as color-coded
H1/H2/H3) — a proper design pass; needs to confirm which surface renders the notes
(notes panel / favorite-card dissection / the Brief). Then Pinterest sub-pills +
search, and the Admin confirm-button repro.

## v13.85 (Claude): Projects caret + empty-project bug fix

`frontend/index.html`: (1) the "Project" title is now "**Projects**" with a
dropdown **caret** (`.pg-tabtitle-caret`) so the project list is discoverable —
it always worked, it was just hidden under the title (Fromsa confirmed). No
redesign. (2) BUG FIX: switching an avatar spawned an empty project every time,
because `_persistNow`'s `hasContent` counted a bare `lastSummary` (the avatar
identity set on switch) as content. Now `hasContent = items.length ||
currentClientName` — an avatar alone no longer opens a bin; only a populated
board or a named project does. Version 13.85 x4; app-regression + contract green;
frontend headless smoke = 0 JS errors.

Verified upstream: feature log works (maya/features.json, 3 items via
/api/admin/maya-features). Codex's v13.83 server work (buildFeatureDigest,
get_feature_digest, _leadNoteCache) is committed + deployed; synced into this
tree. Email intent CORRECTED (log mis-transcription): Fromsa WANTS Maya to open a
ready-to-send email directly (the draft→open-Gmail flow) — the only line held is
no auto-SEND without his click.

OPEN (need repro/verify before shipping): the Admin "confirm" button for
lead-station changes reportedly not working — server lead-note path verified
correct, so it's client-side/repaint; Pinterest sub-tabs beside title + search;
affiliate-program feature. See docs/maya-vision-spec.md.

## v13.84 (Claude): Pinterest wall overhaul + admin spacing

`frontend/index.html`: Pinterest no longer reloads on every tab switch —
`_pinPicsCache` + `_pinLoaded` + `_pinStatusOk` cache the session (like Fabrics);
`openPinterestDrawer` keeps the rendered wall if it exists, `_pinReload()` forces
a real refetch. The wall is edge-to-edge (`#pinterest-drawer{position:relative;
padding:0}`, compact `#pin-tabs`), and "Bring in" is now a floating, near-
transparent pill (`position:absolute;bottom:16px`, glass) that appears ONLY while
pictures are selected (`_pinSetFoot(_pinPicked.size>0)`), label kept as "Bring in".
`backend/status.html`: `#ads-fold` gets `margin-top:40px` (breathing room before
the money section). Version 13.84 x4; app-regression + contract green; frontend
headless smoke = 0 JS errors.

NEXT (from docs/maya-vision-spec.md): admin shell-merge (Sources+Maya+Bottom into
one), top-bar height trim, drawer trackpad-swipe, surface the feature digest fold,
then the brain items (Maya MCP/API + expanded email) which need Fromsa's decisions.

## v13.83 (Claude): quick wins + the vision spec

Small safe batch while the big vision gets specced. `backend/status.html`: Lead
Station header "Reach them"→"Email"; "Latest submissions"→"My submissions".
`frontend/index.html`: fabric spec line no longer repeats words already in the
name ("Burgundy Lace" + "burgundy · lace" → name only). New: `docs/maya-soul.md`
(local mirror of Maya's soul, Claude-readable) and **`docs/maya-vision-spec.md`**
— the full prioritized build list from Fromsa's Aug 25 vision dump (dynamic Lead
Station, admin layout merge, Pinterest cache + full-screen wall + floating "Bring
in", Maya-as-brain: own MCP/API, weekly digest, soul auto-export, expanded email
power with the never-auto-send safety line). START THERE for the next build.

Changed: backend/status.html, frontend/index.html, playground/index.html,
backend/marketing.html, tests/app-regression.mjs (+1), tests/admin-ui-contract.mjs,
docs/maya-soul.md (new), docs/maya-vision-spec.md (new). Version 13.83 x4.
VALIDATION: app-regression all passed, contract green.

## v13.82 (Claude): Maya becomes the intelligence layer

The big one. Fromsa's repeated frustration: the voice agent could not see what
he sees, above all daily ad clicks. Root cause: her snapshot
(`buildAdminCommandSnapshot`) only carried 7-day ad aggregates, never a per-day
breakdown, so "how many clicks today vs yesterday" was structurally unanswerable.

- DAILY AD CLICKS. `docs/server/admin-command.mjs`: `mergeAdDaily()` folds every
  source's Windsor daily map into one calendar; `panels.ads` now carries
  `today`, `yesterday` and a 7-day `daily` tail, and the briefing says clicks
  today vs yesterday. `server.js` passes `tz` (WIX_TZ). Client:
  `_mayaPanelData('ads')` computes today/yesterday from the same daily series the
  chart paints; `get_briefing` returns `adClicks`.
- DYNAMIC LEAD STATION. `maya/leads.json` store + `loadLeadFeed()` merges Wix +
  hand-added leads at one chokepoint (swapped into all four lead consumers).
  Every lead is `source`-tagged; the station labels Wix ones with a blue "WIX"
  chip, added ones "added". `add_lead` voice tool + `/api/admin/lead-add`
  (confirm-gated). Notes already editable by Fromsa and Maya.
- IDENTITY + PEOPLE. `maya/people.json` seeded with Fromsa (founder, default
  speaker) and Paula (teammate), loaded into instructions; "this is Paula" is
  recognized. `add_person` tool (confirm-gated) + `/api/admin/maya-person`.
- SOUL. `maya/soul.md`, seeded and loaded each session; `journal` tool
  (no-confirm) appends. Her running personal record between calls.
- INTERNAL OPS SHEET. `readTeamSheet()` reads the Google Sheet via the SA token
  (`spreadsheets.readonly`); `read_team_sheet` tool + `/api/admin/team-sheet`.
  NEEDS INFRA (see requests.txt): share the sheet with the SA email and enable
  the Sheets API, or it reports not-connected and names the SA to share with.
- EMAIL. `lead-draft` takes a `goal` so Maya can steer the draft; still
  confirm-gated, still opens Gmail, never auto-sends (safety).
- DRAWER BUG. Tapping the voice logo no longer force-opens the drawer
  (`_voiceLive` line removed). It stays closed unless Fromsa opens it.
- FRONTEND. Visualize pill z-index 9000 so climbing cards (`_zCounter`) can't
  bury it; Pinterest "bring them in" pill dropped lower (padding 1px 18px 10px);
  avatar switcher capped `max-height:44vh` + internal scroll + scrollIntoView so
  it is never cropped at the fold.

Changed files: `docs/server/admin-command.mjs`, `docs/server/server.js`,
`backend/status.html`, `frontend/index.html`; version 13.82 across four surfaces;
`tests/app-regression.mjs` (+7 assertions), `tests/admin-ui-contract.mjs`.

VALIDATION: app-regression all passed, admin-ui-contract green, admin-command
safety green (new ad fields do not leak PII through buildRealtimeCommandContext).
Live voice not tested end-to-end: blocked on OpenAI credits (429). "nurture" is
not a string anywhere in the repo — asked Fromsa where he sees it.

OPEN: Fromsa pushes (unpushed); buy OpenAI credits; share the ops sheet with the
SA + enable Sheets API; confirm the "nurture" location.

## v13.81 (Claude): Pinterest footer, Lead Station "Latest Notes" editable

- `frontend/index.html`: Pinterest `.pin-drawer-foot` is a smaller pill
  (`flex:none;width:auto;min-width:150px`), lifted off the very bottom
  (padding 4px 18px 22px), tighter gap above it.
- `backend/status.html` Lead Station: the Notes column is now "Latest Notes",
  and the note cell is click-to-edit in place (`onclick=toggleLeadNote`), with a
  quiet "add a note" prompt when empty. Notes were already editable via the
  pencil and via Maya's `note_lead` tool; this makes it obvious and inline.

NOTE: Fromsa's message about the Lead Station was CUT OFF ("...and"). The full
"dynamic/modifiable" intent likely has more — asked him to finish. What is done:
rename + inline edit. Open: whatever the rest of his sentence asks.

Changed files: `frontend/index.html`, `backend/status.html`; version 13.81
across the four surfaces; `tests/app-regression.mjs`, `tests/admin-ui-contract.mjs`.

VALIDATION: app-regression all passed, contract green.

## v13.80 (Claude): Maya's feature log (the Maya → Claude relay, step 1)

- New `log_feature({text, who})` voice tool. Server: `POST
  /api/admin/maya-log-feature` appends to GCS `maya/features.json` (last 500);
  `GET /api/admin/maya-features` lists them (admin only). Client `_voiceTool`
  posts directly (no confirm — logging has no external side effect) and echoes
  "Logged for Claude" into the chat. See `docs/maya-feature-log.md` for the
  relay: read the endpoint (or ask Maya) and paste to Claude; a live automation
  is a later owner decision.
- NOTE: server change, so it only works after a push + Cloud Run deploy.

Changed files: `docs/server/server.js`, `backend/status.html`,
`docs/maya-feature-log.md`; version 13.80 across the four surfaces;
`tests/app-regression.mjs`, `tests/admin-ui-contract.mjs`.

VALIDATION: app-regression all passed, full gate suite green, server --check OK.

NEXT STEP — still open from Fromsa's Maya vision
- Favorites: clean read-only submit-only card; unfavorite removes from community.
- Bigger: surface the feature log in the drawer; Maya's growing memory/"soul";
  a more dynamic admin; a real Maya→Claude automation channel (needs an owner
  decision: GitHub issue / email / webhook). And OpenAI credits for voice.

## v13.79 (Claude): Maya's conversation shows on screen (chat box)

- `backend/status.html`: the drawer command now carries a `#maya-chat`
  transcript. `_mayaChatAdd(who, text)` appends copyable bubbles; the voice
  handler feeds it from `response.audio_transcript.done` (Maya) and
  `conversation.item.input_audio_transcription.completed` (you, when the session
  provides it). Cleared on each new connect. Maya's lines work with the current
  session config; the server voice config was intentionally NOT changed (adding
  input transcription there risks breaking the token mint), so "You" lines only
  appear if the session emits them.

Changed files: `backend/status.html`; version 13.79 across the four surfaces;
`tests/app-regression.mjs`, `tests/admin-ui-contract.mjs`.

VALIDATION: app-regression all passed.

NEXT STEP — Maya vision, still open (roadmap)
- `log_feature` voice tool + persistent feature log (GCS) + a Maya→Claude relay
  doc I read each session. Server work (new tool + endpoint), so needs a push.
- Maya = Claude-like abilities, a growing memory/"soul", a more dynamic admin.
- Favorites: clean read-only submit-only card; unfavorite removes from community.

## v13.78 (Claude): cabinet order/labels, swipe memory, logo ring, ops beta

- `frontend/index.html` cabinet: tab order is Pinterest, Fabrics, Avatar; the
  switch-avatar caret moved beside the name (`.pg-avatar-nameline`); the tab
  title reads "Project"; the last-tab memory now also fires on the SWIPE path
  (refactored into `_pgRestoreLastTab()`, called from the hscroll open handler,
  not just `toggleNotesDrawer`). Pinterest's empty head is hidden so its
  All-saves/Boards row aligns to Fabrics' tabs and the cards get the same room;
  `.pin-drawer-foot` anchors to the bottom.
- `backend/status.html`: the logo has NO ring when stationary
  (`border:...transparent`, no background); the ring + faster pulse
  (`voicepulse 0.85s`) appear only under `body.maya-live`.
- `backend/operations.html`: `.brand-words` is a baseline row so "beta" sits to
  the right of "Operations Room".

Changed files: `frontend/index.html`, `backend/status.html`,
`backend/operations.html`; version 13.78 across the four surfaces;
`tests/app-regression.mjs`, `tests/admin-ui-contract.mjs`.

VALIDATION: app-regression all passed, contract green.

NEXT STEP — Fromsa's Maya vision (big, in progress)
- Drawer chat box: show Maya's replies as readable, copy-pasteable text while
  she is live (transcript from the realtime events), not just voice.
- Maya feature-log tool + a Maya→Claude relay for feature requests; Maya's own
  save/soul that grows; a more dynamic admin driven by conversation.
- Favorites: clean read-only submit-only card; unfavorite removes from the
  community wall (still open from the earlier batch).

## v13.77 (Claude): Admin logo is the voice, drawer polish

- On `backend/status.html` the circular logo IS Maya's voice now: it is a
  `<button onclick="toggleMayaVoice()">`, and the ADMIN wordmark is a separate
  home link (`a.brand-home`). The old hover `maya-chip` (which was unclickable)
  is gone. Tapping the logo shows a "Connecting" chip immediately (surfaced in
  `toggleMayaVoice` so it shows even with the drawer closed) and the ring pulses
  while live. NOTE: this logo-as-voice is Admin-only; the other back rooms keep
  the logo as the home link.
- Drawer section titles forced to the logo blue (`#a9c9ff !important`); the
  SYSTEMS health lights are centered.

Changed files: `backend/status.html`; version 13.77 across the four surfaces;
`tests/app-regression.mjs`, `tests/admin-ui-contract.mjs`.

VALIDATION: app-regression all passed, contract green.

NEXT STEP (Fromsa's Aug 24 batch, still open)
- Cabinet: caret beside the name; fix the broken avatar switcher; rename
  Projects→Project; reorder tabs to Pinterest, Fabrics, Avatar; Pinterest layout
  parity with Fabrics (toggle height, card room, anchor Bring-them-in).
- Favorites: clean read-only submit-only card (no Switch Fabric/Add
  Reference/Tap to Listen, no editable pills); unfavoriting removes from the
  community wall.

## v13.76 (Claude): fabrics show real photos, not color swatches

Fromsa: the sourceable fabric matches were rendering as solid crimson color
fills with no image. Root cause in `backend/backend.html`: when the visual
ranking (`/api/rank-fabric`) returned nothing — a failure, or no OpenAI credits
— `_fetchLiveSourcing` returned early (`if (!matches.length) return`) and left
only the static color-swatch wall standing. The real retailer products from
`/api/source-fabric` (which each already carry a real photo and url) were never
shown.

- When ranking is unavailable, paint the raw `products` unranked instead of
  bailing: `paint(matches.length ? matches : products)`.
- The static color-swatch wall was dropped. The sourceable tab renders only
  cards with a real image (`live.filter(c => c.img)`); a "Searching the shelves…"
  line holds the space until the photos arrive. No more crimson placeholders.
- Refresh already re-sources the currently dissected garment (clears the live
  cache and re-fetches for `_fabActivePiece().fabric`); with the wall now built
  from real photos, that re-scan is finally visible.

Note: `Visualize` (the Nano-Banana fabric render on an imageless card) is gone
from the sourceable wall along with the imageless cards; it needs OpenAI credits
anyway.

Changed files: `backend/backend.html`; version 13.76 across the four surfaces;
`tests/app-regression.mjs`, `tests/admin-ui-contract.mjs`.

VALIDATION: app-regression all passed, gate suite green, backend.html loads with
no console errors.

NEXT STEP
- All of Fromsa's Aug 24 requests are now applied locally (v13.72–v13.76). He
  must PUSH (GitHub Desktop) to deploy, and top up OpenAI credits for voice,
  Visualize, and fabric ranking. Nothing else queued.

## v13.75 (Claude): MAYA app cabinet refinements

Fromsa's cabinet fixes in `frontend/index.html` (the live app cabinet, which
now runs slightly ahead of `playground/index.html`).

- The drawer reopens on the LAST tab used, not always Avatar. `pgTab` records
  `window._pgLastTab`; the `toggleNotesDrawer` override restores it on open
  (re-opening Fabrics/Pinterest via their own openers, guarded by `_pgRestoring`
  against recursion). Picking Avatar sets the memory back to Avatar.
- The current tab's name (`#pg-tabtitle`: Projects / Pinterest / Fabrics) rides
  in the dead space beside the circle row; the redundant in-pane titles
  (`#pg-project-pill`, `.pg-pane .drawer-head-title`) are hidden, so the panes
  start higher. The Projects title is click-through to `pgProjects()`.
- Avatar tab: the avatar dropdown is back (the `#drawer-avatar-switcher`
  force-hide was removed; `#drawer-avatar-caret` shows). Randomize was moved out
  of the Measurements fold up into the `.pg-avatar-actions` row beside Replace
  and Remove, and those three pills were shrunk to fit one row. `#pg-meas-host`
  gained bottom padding so Measurements is not clipped.

Playground keeps the base cabinet; the app-regression assertion now checks the
force-hide only in Playground and adds three v13.75 checks for the app.

Changed files: `frontend/index.html`; version 13.75 across the four surfaces;
`tests/app-regression.mjs`, `tests/admin-ui-contract.mjs`.

VALIDATION: app-regression all passed (incl. a stubbed tab-restore probe), full
gate suite green.

NEXT STEP
- Fabrics (backend.html Brief): still owed. Hide sourced results with no real
  image (they render as solid crimson), and make Refresh always re-source for
  the currently dissected garment. Then the OpenAI-credits items on Fromsa.

## v13.74 (Claude): Maya lives in the logo, Marketing door removed

- The top-left logo is a circle now (52px, same size), wrapped in
  `.maya-logo-wrap`. It pulses (the `voicepulse` ring) while `body.maya-live`.
- Hovering `#top-left-brand` drops a MAYA chip (`.pg-chip.maya-chip`) beneath
  it; clicking it calls `toggleMayaVoice()`, so Maya can be woken from the logo
  without opening the drawer.
- Maya has a new voice tool `show_drawer` (server.js tools + status.html
  `_voiceTool`) so she can open/close the drawer to surface her command line as
  she talks.
- The MARKETING nav door was removed (its modules are already migrated into
  Admin). The nav is MANA SIYO and MAYA only. `backend/marketing.html` still
  ships as the standalone fallback; only the Admin nav link is gone.
- Hamburger anchor fixed: the drawer is 360 wide, so the drawer-open offset is
  `translateX(-356px)` (was -320, overlapping the widened drawer).

Changed files: `backend/status.html`, `docs/server/server.js`; version 13.74
across the four surfaces; `tests/app-regression.mjs`, `tests/admin-ui-contract.mjs`.

VALIDATION: app-regression all passed, full gate suite green, server --check OK.

NEXT STEP (Fromsa's same message, not yet done)
- MAYA app cabinet (frontend/index.html): (1) persist the last tab when the
  drawer is reopened; (2) move the tab title (Projects/Pinterest/Fabrics) into
  the dead space beside the circle row to reclaim vertical space; (3) Avatar
  tab: restore the avatar dropdown, fix the cropped Measurements, move
  Randomize up beside Replace/Remove and shrink those three pills.
- Fabrics (backend.html Brief): hide any sourced result with no real image
  (they render as solid crimson now); the refresh must always re-source for the
  currently dissected garment.
- The voice 429 and empty visualize are likely OpenAI credits (Fromsa is
  buying). To-do list owed to Fromsa.

## v13.73 (Claude): backend Brief is one slide, Design Studio has a home

Two follow-ups from Fromsa after v13.72.

- `backend/backend.html` is a single slide now. The embedded Operations Room
  (screen 2, the `/aesthetics/operations/` iframe) and the page-dot indicator
  were removed, so the Brief is the only screen and the dead pill that lived in
  that embed is gone with it. `goToScreen` now clamps to the screens that exist,
  so a stale `goToScreen(1)` after a dissection cannot scroll into empty space.
  The standalone `/operations.html` is untouched (Fromsa's choice).
- The MANA SIYO Design Studio chip now opens `https://manasiyo.com/design`.

Changed files: `backend/backend.html`, `backend/status.html` (Design Studio
href + changelog); version 13.73 across the four surfaces;
`tests/app-regression.mjs`, `tests/admin-ui-contract.mjs`.

VALIDATION: app-regression all passed (browser + source), full gate suite green.

NEXT STEP
- Fabric ("still not working"): the wall is static-first; the live retailer
  window (`/api/source-fabric`) reads public Shopify feeds and the visual
  ranking (`/api/rank-fabric`) uses Terra, both already connected. What is NOT
  connected is the CLO library for Plan B (needs `CLOSET_API_TOKEN` +
  `CLOSET_SEARCH_URL` on Cloud Run, fixes.txt step 6). Awaiting Fromsa on
  whether "Fabric is still not working" means the retailer window itself is
  empty (a retrieval/CORS issue to debug) or the CLO route. Await push of
  v13.72 and v13.73.

## v13.72 (Claude): Admin cleared its center, controls to the edges

Fromsa's redesign of the Admin page after Codex's v13.71 push.

- The day ticker moved up into the top bar, riding between the ADMIN wordmark
  and the hamburger, colored like Marketing's line: green for good news, red
  and amber for warnings, white otherwise. No border, no lines above or below.
- The five health lights (Site, API, Images, Submissions, Backup) moved into
  the drawer under a Systems heading, so the page opens straight onto the three
  doors.
- The center Maya Command panel is gone. It became Maya's private line inside
  the drawer: tap the voice star and `body.maya-live` turns the drawer into her
  screen (grounded brief, attention, and the Confirm/Dismiss action queue),
  hiding the links; tap it off and the drawer is a drawer again. Same element
  IDs, so all of Codex's command/voice plumbing is unchanged. When the line
  will not open it now says so in plain words, never a raw error code (the
  429 is an OpenAI Realtime quota/rate limit, an owner-config matter).
- The duplicate `Manasiyo.com | MAYA` visitor fold was removed; Users and
  traffic already pairs both windows. The hidden `mkt-wix-tiles` holders remain
  so `paintSite` stays safe.
- MANA SIYO now mirrors MAYA: hover it and Design Studio and Wix Studio hang to
  the LEFT (Wix Studio = the manage.wix.com dashboard). The Design Studio chip
  points at manasiyo.com pending Fromsa's real target.
- Fixed three pre-existing app-regression failures from v13.71 that never ran
  in CI (app-regression is not in the Cloud Build gate): a `MKT_SOURCE`
  temporal-dead-zone crash, a mic-release assertion that did not match the
  code, and a stale cabinet assertion.

Changed files: `backend/status.html`; version bumped to 13.72 across
`frontend/index.html`, `playground/index.html`, `backend/status.html`,
`backend/marketing.html` (lockstep, unchanged content on the other three);
`tests/app-regression.mjs`, `tests/admin-ui-contract.mjs`.

VALIDATION BEFORE COMMIT
- PASS: app-regression (browser + source, all passed), smoke (all passed),
  Admin command 6, Admin UI contract 6, proxy policy 27, AI routing 7,
  fabric sourcing 6, node --check on the three server modules.

NEXT STEP
- Operations Room follow-up (Fromsa, same message): remove the dead-pill /
  Plan B section at the bottom of the backend and make Operations Room a single
  slide; report what Fabric needs connected (CLO-SET token on the server). Not
  in this commit. Await Fromsa on the Design Studio link and on pushing v13.72.

## v13.71 (Codex): Admin command center and faithful Marketing parity

- Admin Maya is now a visible internal command layer, not only a voice line.
  It reads the bounded Admin snapshot, shows Today and Attention, spotlights
  panels, performs exact lead lookup, and creates visible Confirm/Dismiss rows
  for memory, lead-note and Gmail-draft actions. No action silently sends.
- Voice and the visible command center share the same snapshot. The Realtime
  prompt strips lead email and phone fields it does not need; exact contact
  resolution remains server-side. Direct Meta/Google feeds now backfill the
  briefing when Windsor is unavailable.
- The complete Marketing presentation is embedded in Admin under its shell:
  moving ticker, full metric strip, Wix visitor row, spacious campaign table
  and chart with mouse/touch hover, Lead Station, Sources and Bottom Line.
  Refresh and authorization failures are visible. `backend/marketing.html`
  remains served and is not retired or redirected.
- The approved Playground filing cabinet is promoted to
  `frontend/index.html`. Projects, avatar/measurements, Pinterest and Fabrics
  use the same tab/folder structure while retaining the live project, auth,
  autosave, Storage and deep-link implementations.
- v13.51 fabric sourcing was audited and preserved: garment plus inferred
  traits, real retailer inventory, image-aware thumbnail ranking, closest
  visual matches wording, real buying fields, admin auth and static-first
  fallback. No behavior change was required.
- Cloud Build now gates command and proxy-policy tests in addition to AI
  routing, fabric sourcing and syntax. Docker already ships every imported
  helper.

VALIDATION BEFORE COMMIT
- PASS: Admin command 6, Admin UI source contract 6, proxy policy 27, AI
  routing 7, fabric sourcing 6.
- PASS: `node --check` for server, command helper, app regression and smoke;
  all inline scripts parsed for app (5), Playground (5), Admin (6) and
  standalone Marketing (2); `git diff --check` clean.
- NOT RUN LOCALLY: smoke requires Express, and app regression requires the
  Playwright package plus Chromium. This managed workspace contains no npm,
  Express or browser executable, and local socket binding is blocked. The new
  pure Admin UI contract covers the release's source/visual parity invariants
  and runs in Cloud Build. Post-push live desktop/mobile inspection remains the
  final visual check; authenticated data depends on an existing Admin session.

NEXT SAFE SLICE
- Do not retire standalone Marketing tonight. Later, extract shared canonical
  Marketing rendering/styles once the embedded page has production evidence.
- Deferred audit work remains: shared/distributed rate limiting, client error
  reporting, end-to-end deletion authorization review, Vertex/Gemini evals,
  Gmail read OAuth only if Fromsa explicitly authorizes its privacy scope.

## v13.70 (Claude, Commit A1): proxy security hardening

The first commit of the staged remediation program. ONE risk domain: the raw
authenticated /api/openai proxy.

WHAT CHANGED
- New pure module docs/server/proxy-policy.mjs (evaluateProxyPolicy): the
  single fail-closed decision for every proxied call. No I/O, no globals.
- server.js: the proxy now (1) verifies the Google token in a pre-buffer gate
  (openaiAuthGate) BEFORE express.raw reads the 24MB body; (2) replaces the two
  size-gated inline checks with one call to the helper. The upstream call,
  the tier-fallback retry, streaming and logging are unchanged.
- Enforced now, regardless of body size or multipart field order:
  recognized content type required; a present, valid model required on every
  model-bearing route; model-to-endpoint match (whisper cannot ride chat,
  gpt-image-2 cannot ride embeddings); Sol is admin only; image n<=2 and
  quality=high admin-only; multipart policy fields read by a real small-field
  part walk so a field after a large file is still seen; a duplicated model
  field is ambiguous and refused. Never fails open.
- Dockerfile ships proxy-policy.mjs.

WHAT DELIBERATELY DID NOT CHANGE
- No prompt, model tier, GPT Image 2 size/quality, fabric behavior, UI, Vertex,
  Realtime, or voice change. MODEL_ALLOWED stays as the canonical inventory
  (the helper is the enforcer now; keep them in step).

TEST EVIDENCE (all run locally, all pass)
- tests/proxy-policy.mjs: 27 unit checks covering valid chat/image/embeddings/
  transcription, missing/unknown/malformed/mismatched model, content-type
  spoof, oversized JSON model + image count + quality, multipart count/quality
  after a 300KB file, ambiguous duplicate model, non-admin vs admin Sol,
  non-admin vs admin high quality.
- ai-routing 7, fabric-sourcing 6 (ranking regression), smoke all, app
  regression 273 (incl. two new wiring assertions). node --check clean.

FOLLOW-UP STATUS
- v13.71 adds the pure command and proxy-policy suites to Cloud Build. Smoke
  and browser regression remain local release checks because the current
  Cloud Build image does not install their Express/Chromium dependencies.
- Dependency pinning and a hermetic browser test image remain deferred rather
  than changing deployment tooling in the same product release.

## v13.69 (Claude): Maya more capable, and the memory glitch fixed

- THE MEMORY GLITCH: her memory lived inside `ctx`, which is
  JSON.stringify(ctx).slice(0, 14000). On a busy day leads + campaigns +
  submissions pushed past 14k and her memory (added last) was silently
  truncated off the prompt. Fixed: memory is pulled OUT into `memoryLines`
  and concatenated after the (now 12k) capped snapshot, so it is ALWAYS
  spoken to her in full. Capacity raised to 60 recent items.
- FOUR TOOLS now (session `tools` + client handlers): remember, forget
  (new, /api/admin/maya-forget removes matching items), note_lead (now
  also refreshes the migrated Lead Station live via loadMkt), and
  draft_email (new) which opens a prefilled Gmail compose in the browser,
  never auto-sends (honors drafts-only). Tool events are handled robustly:
  the primary response.function_call_arguments.done AND a fallback scan of
  response.done output items, deduped by call_id.
- THE BACKBONE: her instructions now carry a plain-language description of
  how MAYA is built (the pages, Cloud Run proxy, Firebase, analytics
  sources, the free-tool business model) so she can help troubleshoot and
  explain, while being told she cannot change code.
- WHY THINGS WEREN'T SHOWING: nothing was blocked. cloudbuild.yaml deploys
  BOTH server and Firebase Hosting on a push to maya-v2, gated by
  ai-routing + fabric-sourcing + node --check (all pass). v13.68's
  migration/pills were committed after his screenshots; a push + a
  hard-refresh shows them (version badge should read 13.69).

FOLLOW-UP STATUS:
- Gmail READ (so she fills leads from his inbox) needs Gmail OAuth on the
  server, a real setup with a scope/consent change; draft_email covers
  writing without it. Green step to be given when he wants it.
- The cabinet was promoted in v13.71. Favorites already uses its submit-only
  mode in source. A broader Fabrics visual redesign remains a later product
  slice. Standalone Marketing is deliberately retained as the fallback.

## v13.68 (Claude): Marketing migrated into Admin, App Check wired

- THE MIGRATION: the four Marketing modules now live in status.html under
  Users and traffic, inside #adm-mkt: Ad Campaigns (D/W/M chips, campaign
  table, the SVG line chart with hover), The Lead Station (CTA column,
  draft/call/note), Sources of traffic, The Bottom Line. Ported WHOLE from
  marketing.html and sealed in an IIFE so nothing collides with Admin's
  globals; the onclick handlers (setAdRange, setAdMetric, draftLead,
  leadContact, toggleLeadNote, saveLeadNote) are re-exposed on window, and
  loadMkt() fetches /api/admin/marketing on sign-in and on the 120s tick.
  metricVal() had to be pulled in too (the chart calls it). Marketing.html
  is UNTOUCHED and still live; retire it in a later pass. When editing a
  migrated module, edit BOTH until Marketing is deleted, or delete
  Marketing first.
- PILLS POP: #head-tiles .tile .v is white/500, .pair-b is #a9c9ff/500,
  the traffic-legend is white with the MAYA half blue. The paired numbers
  now read like figures, not labels.
- DRAWER: width 360 (matches MAYA's inner drawer), every h3 in the logo
  blue.
- APP CHECK wired but dormant in frontend + playground: the
  firebase-app-check-compat script is loaded and, right after
  initializeApp, App Check activates IF MAYA_APPCHECK_SITE_KEY is set
  (empty by default = no-op, nothing breaks). Setup steps are in fixes.txt.
- SETUP CHECKLIST for Fromsa written to docs/fixes.txt: GA property pin
  (the real cause of the low counts), billing caps, the down/failure alert,
  App Check enforcement, the Realtime model, the CLO token.

STILL OPEN / NEXT (told to Fromsa):
- Promote the playground cabinet drawer to the real MAYA app
  (frontend/index.html) per his approval, and while there: the open tab
  should PERSIST (staying on Pinterest when scrolled), and the projects
  pill is cropped.
- Favorites cards: a clean submit-only card (image + a 3-4 sentence
  description + Submit to Mana Siyo), NOT the inspo card with Switch
  Fabric / Add Reference / Tap to Listen.
- "Fabrics is still terrible" — the fabrics tab UI needs a pass.
- Retire marketing.html once Admin has run as the single dashboard.
- Wall: no report button (per Fromsa); the unfavorite->takedown sweep
  already exists (_unpublishNow) and stays the mechanism.

## v13.67 (Claude): Maya home in the drawer with hands, Admin consolidating

- VOICE BACK IN THE DRAWER: the top-left star is a plain home link again
  (the double-click collided with navigation). #voice-dock is pinned at the
  drawer floor (flex column, margin-top:auto); #voice-chip is a fixed
  bottom-right pill that shows while the line is live so she keeps talking
  with the drawer closed, and tapping either the star or the chip hangs up.
- SHE HAS HANDS: the minted Realtime session now carries two tools
  (server builds `tools` and passes `instructions, tools`): remember(text)
  -> POST /api/admin/maya-remember, and note_lead(lead, note, contact) ->
  POST /api/admin/lead-note. The browser handles
  response.function_call_arguments.done on the data channel, runs the tool,
  returns function_call_output + response.create. lead-note now resolves a
  first name to an email via resolveLeadEmail() against wixLeads.
- SHE HAS MEMORY: MAYA_MEM_PATH = maya/memory.json (GCS), loadMayaMemory /
  appendMayaMemory; her memory + leads_by_name ride in the voice snapshot.
- ADMIN DRAWER CONSOLIDATED (per Fromsa): The vault = one Firebase line;
  "Behind the scenes" (light-blue h3.tint) = one Cloud Run line; "The
  outside tools" = Google Ads manager, Meta Ads manager, Wix dashboard;
  Privacy policy. Design Studio, Credits, API logs, Keys/settings, GA all
  removed.
- PILLS PAIRED: /api/admin/analytics now returns wixSite, and
  _paintHeadTiles pairs today/7d/28d as manasiyo (white) | MAYA (blue);
  Users and Live now stay single (accounts, no Wix live). A legend rides
  the "Users and traffic" heading. This is migration step one; the four
  Marketing modules (ad campaigns, lead station, sources, bottom line) move
  under Users and traffic next, then Marketing is retired.
- Marketing header is one clean row now: manasiyo.com | MAYA, Wix jump at
  the far right.

OPEN / NEXT (told to Fromsa, not yet built):
- The big migration: ad campaigns + lead station + sources + bottom line
  into Admin under Users and traffic, then delete Marketing.
- GA property is the likely cause of the low MAYA count: pin
  MARKETING_GA_PROPERTY_ID and GA_PROPERTY_ID to the MAYA app property
  (behind G-ETTJ6PXEMM) so discovery stops guessing manasiyo's property.
- Alerting on image-gen failure / credit exhaustion (needs a channel).
- Maya email access (Gmail send) and live lead transcription: the tools
  scaffold is here; Gmail send needs server OAuth, deferred.

## v13.66 (Claude): the voice in the star, and the bottom line

- THE DOCK IS GONE; the voice lives in the TOP LEFT star. Double click the
  Admin logo (ondblclick on the brand anchor, preventDefault so the home
  navigation stays on single click) to open the line; while live the
  .maya-logo-mark wears .live (voicepulse) and a single click on the star
  hangs up (the onclick guards on _voice). #voice-word floats fixed under
  the logo. On open the data channel sends response.create so Maya greets
  FIRST, which is also the working-line check Fromsa asked for.
- SHE SCANS EVERYTHING: voice-token's snapshot now adds submissions
  (folder count + most recent, from gcsListSubmissions), recently_shipped
  (recentShips() reads the top three changelog entries off the public
  status.html, cached an hour, so the voice always matches production) and
  the current date and time in San Francisco baked into the instructions;
  she is told to ask questions back when it sharpens the answer.
- THE BOTTOM LINE (marketing, below everything): the fold nothing above
  says. One funnel for the week: paid link clicks (arrow silent, most of
  the site arrives free) to manasiyo.com to MAYA to leads with the real
  conversion at each step; tiles: cost per lead this week, ad spend vs
  last week (amber over +25%), the cheapest campaign that delivered at
  least 5 clicks, the share of the site that steps into MAYA, and the day
  of the week that brings people (dow rollup of wixSite.daily, 28 days);
  one plain sentence under it. paintBottomLine(d) is pure arithmetic over
  the payload the page already holds; no model, no new endpoint.
- Playwright probed: dock gone, dblclick path, signed-out and failure
  words, star never stuck live; the bottom line rendered from a realistic
  stubbed payload (funnel, five tiles, the sentence).

## v13.65 (Claude): Maya's voice on Admin

- THE STAR AT THE DRAWER'S FLOOR: status.html's drawer is a flex column
  now and #voice-dock rides margin-top:auto, the 64px circular logo button
  centered at the bottom. Tap: a live voice-to-voice line opens and the
  logo breathes (.live + voicepulse). Tap again: hang up. Signed out it
  says "sign in first"; every failure path lands back in the idle state.
- HOW THE LINE WORKS: POST /api/admin/voice-token (admin, rate limited,
  weight 4) gathers wixInsights + windsorInsights + wixLeads (the cached
  fetchers marketing uses), bakes a compact JSON snapshot into the session
  INSTRUCTIONS (visitors, campaigns, warnings-free source rollup, newest
  leads with their summaries; capped 14k chars) with the Maya persona:
  warm, brief, thirty-second analysis on request, marketing first, plain
  spoken numbers, never invent, say "I do not have it live" when the
  snapshot lacks something. Then it mints an OpenAI Realtime ephemeral key
  (POST v1/realtime/client_secrets, model OPENAI_REALTIME_MODEL default
  gpt-realtime, voice OPENAI_REALTIME_VOICE default marin) and returns
  ONLY {value, model}. The long-lived OPENAI_API_KEY never reaches the
  page.
- The browser does WebRTC itself: getUserMedia, RTCPeerConnection, SDP
  offer POSTed to v1/realtime/calls with the ephemeral Bearer, answer set,
  remote audio into an Audio element. Mobile works because the tap is the
  user gesture both mic and autoplay need. connectionstatechange cleans up
  on drops.
- NOT yet verifiable end to end from here (needs mic + the live key); the
  UI paths are Playwright-probed (dock in drawer, signed-out word, failure
  never leaves live state) and both endpoints carry smoke 401 checks.

## v13.64 (Claude): the room in the family, real CLO, honest today

- OPS HEADER IS THE FAMILY'S: fixed top bar like Marketing and Admin,
  logo-208 + "Operations Room" (Cormorant 20px, .22em caps) with "Beta"
  beneath, top left, linking back to the Systems Map. The centered title is
  gone; the centered line is the PLAN and clicking it switches plans
  (setPlan(getPlan()==='A'?'B':'A')). The Plan pill in the header is gone;
  the drawer's data-plan pills remain. The "dead pill" at the bottom of
  every screenshot was the EMPTY #toast peeking above the floor
  (translateY(140%) leaves ~10px visible); it is visibility:hidden until
  .show now. Dead-button audit: every onclick resolves to a defined
  function.
- PLAN B ASKS THE REAL LIBRARY: new POST /api/admin/clo-search (admin,
  rate limited). CLO-SET's public CONNECT marketplace refuses outside
  fetches and has no open search API; the honest path is CLO-SET's account
  API. When CLOSET_API_TOKEN + CLOSET_SEARCH_URL ({q} placeholder) are set
  on Cloud Run the proxy searches Fromsa's workroom and the panel renders
  the items in place; until then it answers clo_not_connected and the page
  says so, offering the CONNECT search link and the local manifest.
- TODAY WAS A TIMEZONE BUG: Wix reports days in the SITE's timezone.
  day(0) used UTC, so from 5pm Pacific the server hunted for a row that
  cannot exist yet while the Wix dashboard showed the day fine (verified
  live: Aug 23 row present with 41 sessions while UTC said Aug 24).
  wixInsights now computes all dates via Intl.DateTimeFormat en-CA in
  WIX_TZ (default America/Los_Angeles).
- MARKETING, ONE ROW: "Manasiyo.com ↗ · MAYA", the jump small and beside
  the name (preventDefault + stopPropagation so the fold does not toggle),
  MAYA in .grp-maya #a9c9ff, the pair-legend row removed.
- LEAD STATION CTA COLUMN: the buttons moved out of Who into a CTA column
  headed by the recommended move (.lead-rec, deterministic: no email →
  Call; <2 days → Email now, first touch; <7 → follow up; else call or
  revive). Note row colspan is 4.
- PLAYGROUND CABINET, FULL BLEED: circles at -8px into the drawer's
  padding so they ride the bezel at the hamburger's height; order Avatar,
  Pinterest, Fabrics; .pg-folder lost its box (no border/background,
  margin 0 -12px) so the open pane consumes the whole drawer; the pill
  always says just "Projects".

## v13.63 (Claude): centered terms, the AI and face disclosures

- CENTERED: the terms document reads centered everywhere it lives: the
  #tos-modal in frontend AND playground (tos-scroll, its h3s, head and sub)
  and backend/terms.html (the sheet, brand and foot).
- BUILT ON AI, new section in all three places: MAYA is an AI system and
  using it means interacting with one; models from OpenAI and Google under
  Mana Siyo's accounts; every garment picture is AI generated unless the
  user uploaded it; illustrative fabric pictures labeled Generated;
  generated pictures carry the models' machine readable provenance marks;
  AI can be wrong, renders are not promises. Written with the EU AI Act
  Article 50 transparency rules (in force Aug 2, 2026: disclose AI
  interaction, machine readable marking of synthetic media) and California
  SB 942 (applies above 1M monthly users, MAYA is under the threshold but
  follows its spirit) in view. FTC baseline: never present AI output as a
  photograph or a promise.
- YOUR FACE PHOTOGRAPH, new section: used only to render the garment on
  that person; sent to AI providers only for that; no facial recognition,
  no face geometry scan or biometric identifier created or kept, never
  sold or shared for advertising, never published; deleted on replace or
  remove or account deletion; a pictured person can ask for removal. This
  is the BIPA style disclosure set (purpose, retention, destruction, no
  sale) even though MAYA stores photographs, not biometric templates.
- privacy.html: the face photograph paragraph carries the same commitments,
  and a new "AI generated content" paragraph states the provenance marking.
- MAYA_TOS_VERSION bumped to 2026-08-24 in BOTH index files, so every
  account reads and agrees to the new text once at next sign in. The terms
  date moved to August 24 in terms.html and both modals. Remember the rule:
  the modal body duplicates terms.html on purpose; a terms change edits
  frontend, playground AND terms.html together, plus the version constant.
- NOT LEGAL ADVICE: this is careful drafting from public sources, not a
  lawyer's opinion; a licensed attorney should review before Fromsa treats
  it as bulletproof.

## v13.62 (Claude): the cabinet drawer, and the Lead Station

THE PLAYGROUND CABINET (playground only, per the playground rule; supersedes
the v13.60 tab pills):

- THREE CIRCLES, 32px like the hamburger pill, no pill wrapper, sitting on
  the drawer's top row and HOLDING one folder (.pg-folder) below them. The
  active circle wears a brighter ring and a small tail pointing into the
  folder. They never leave and there is no Back anywhere: switching tab is
  how you leave a panel.
- ONE FOLDER, THREE PANES. At mount the patch script moves the WHOLE
  #fabrics-drawer and #pinterest-drawer elements into #pg-pane-fabrics /
  #pg-pane-pinterest and CSS neutralises their fixed-panel positioning
  (position static, no glass of their own). Moving the elements whole, not
  their children, is what keeps every descendant style and every render
  function (renderFabricsGrid, _pinBody) working untouched.
- pgShow(which) is the single source of truth for which pane is up;
  openFabricsDrawer / openPinterestDrawer are wrapped so opening either
  from anywhere else (the upload chooser reaches for Pinterest) opens the
  drawer on that tab; the close wrappers hand the folder back to Avatar.
- NOTHING REPEATS ANY MORE, which was the complaint: the name input and the
  face row inside #avatar-body are hidden in the measurements fold (they
  live above it), the avatar caret and its switcher are hidden (the client
  comes with the project, and the face was appearing three times), and the
  old "Projects" toggle row is hidden so the pill on top is the ONE projects
  control: it names the open project and drops the list in below the avatar.
- #notes-drawer-content is flex 0 0 auto now so the folder owns the height.

THE LEAD STATION (marketing + server):

- The leads fold is "The Lead Station". The Notes column is a SUMMARY now,
  what they want and which tier, written server side by MODEL_LUNA
  (summarizeLead, cached 24h per submission id). The lead's own words move
  to lead.wrote and stay as the cell's hover title. When the model is
  unreachable the deterministic line stands (tier + their words); never a
  guess, never a blank. The tier comes from any form field matching
  /tier|package|plan/.
- Under every name: an email CTA and a call CTA. The email CTA posts to
  /api/admin/lead-draft (Terra), which composes subject and body from the
  summary, every note on file and how many emails came BEFORE (first
  contact, second, later), then the page opens Gmail compose prefilled.
  MAYA never sends: there is no send path in the server, on purpose. The
  call CTA is a tel: link and records the contact.
- /api/admin/lead-note stores the information dump per lead in the
  submissions bucket at leads/notes/<sha256(email)>.json: notes[] and
  contacts[]. The pencil CTA opens an inline box; saved notes steer every
  later draft. Both endpoints are admin only and rate limited.
- Sources of traffic, the answer to his question: the table is right, the
  site is not instrumented. Wix links to MAYA carry no referrer, so those
  arrivals land as Direct, and Stripe dominates because checkout sends
  people back with one. Fix is Wix side, adding utm to the MAYA link.
- Verified: local Playwright probe of the cabinet (panes, tabs persisting
  across a fabrics switch, no Back visible, no repeats, measurements
  render), regression 256 checks green, smoke green, server syntax checked.

## v13.61 (Claude): the Operations Room joins the family

- HAMBURGER OFFSET IS COMPUTED NOW: _placeHamburger() in operations.html
  measures the pill's natural rect on open and translates it to rest 8px
  outside the drawer's left edge (window.innerWidth - 378 - 8). The old
  fixed -360px overshot by ~140px on wide screens because the header is
  width constrained. Recomputed on resize while open, cleared on close,
  skipped at or under 640px. Curves aligned to the family everywhere:
  .42s cubic-bezier(0.16,1,0.3,1) on .hpane-drawer and the pill.
- TRACE PLACEHOLDERS: the four trace cards and the composed-prompt pre
  held literal commas before a run; they hold an ellipsis (&#8230;) now.
  The chunks/promptbox fold summaries are family folds: default marker
  gone, arrow beside the title via ::after, sideways when closed.
- PLAN B IS A REAL ROOM: plan-b-view rebuilt as the same .cols two-panel
  layout as Plan A. Left panel holds #hero-img-b / #hero-empty-b, synced
  from Plan A's #hero-img by _syncPlanB() (called from syncPlan when the
  plan is B). Right panel is #clo-result: startCloMatch() runs
  classifyGarment on the photo, resolves the grammar type, and ranks
  window.CLO_LIBRARY (type match 3 points, each seen tag 1 point), top
  three or an honest empty state. The manifest is NEW
  aesthetics/operations/clo-library.js (window.CLO_LIBRARY = [], entry
  format documented in the file: {id,name,types,tags,file}); it ships
  empty until Fromsa lists real CLO projects, and the panel says so
  instead of inventing matches. A small esc() helper was added
  (operations.html had none).
- Verified with a local Playwright probe: pill rect lands exactly at the
  drawer edge on a 1600px window and resets on close, ellipses render,
  Plan B shows/syncs the photo, empty-library and one-match paths both
  render, no page errors. Regression 253 checks green.

## v13.60 (Claude): the playground tabs drawer

- STAGED ON THE PLAYGROUND ONLY (the playground rule). The v13.58 circles
  became three Chrome-style TABS in one row at the drawer's top, each the
  hamburger pill's height (30px, radius 12px 12px 6px 6px): Avatar (the
  face, default on open), Fabrics (the Orange Cheetah swatch), Pinterest
  (the logo). Clicking a tab closes the other panels FIRST, then marks
  itself .on; the close wrappers reset the mark to Avatar, so the order
  matters (marking before closing let a wrapper immediately unmark, the
  one bug found in testing).
- AVATAR TAB LAYOUT: the open project's name sits in a pill on TOP
  (#pg-project-pill, tap opens the projects dropdown), then a bigger
  60px face with the client's name at its right (Replace / Remove appear
  only on hover), the projects dropdown below, then Measurements as a
  collapsible fold (#pg-meas). Tip / Log out / Feedback alone at the
  bottom, pushed down with margin-top auto.
- HOW IT IS WIRED: a "v13.60 PLAYGROUND" script before </body> moves the
  existing #avatar-body and .drawer-actions-bottom into the new homes at
  mount and then WRAPS the frontend functions by reassigning their names
  (openAvatarSubMenu, closeAvatarSubMenu, toggleNotesDrawer,
  refreshDrawerClientName, closeFabricsDrawer, closePinterestDrawer,
  _renderSessionsDropdown). Function-name bindings are reassignable, so
  the shared frontend code is untouched; regenerating the playground from
  frontend loses ALL of this unless both PLAYGROUND blocks are reapplied.
  pgUpdatePill reads the active .session-item's title for the pill.
- VERIFIED with a local Playwright probe (serve the repo, page.evaluate
  the functions directly; the sign-in gate eats real clicks): tabs
  render, avatar body renders in place, measurements fold opens and
  closes, fabrics tab marks itself and hands back to avatar, no page
  errors. Full regression green (250 checks then, 253 with the v13.61 additions). frontend/index.html keeps
  its old drawer on purpose until Fromsa promotes the design.

## v13.59 (Claude): marketing aesthetics, one paid fold, D W M everywhere

- FOLD ARROWS ride beside the titles now (summary is flex, gap 8px), and
  a closed fold's arrow points sideways.
- FOUR PILLS, one row: live now (MAYA only; Wix has no live feed, the
  tooltip says so), today, 7 days, 28 days. Each pairs manasiyo.com in
  white with MAYA in the logo's light blue (#a9c9ff), a thin bar between.
  The visits / forms / clicks-to-contact tiles left on request (the
  server still fetches those Wix measurement types; only the tiles went).
- WIX JUMP: a small circled arrow at the visitors section's top right
  opens Fromsa's Wix Analytics highlights dashboard in a new tab (URL he
  supplied, pinned to site a4ad1a21).
- AD CAMPAIGNS: one fold for the whole paid story, campaigns table FIRST,
  chart under it. D / W / M moved to the top of the fold with a range
  word ("last 7 days" etc.) and now steer the TABLE too: the server ships
  raw campaign days (windsor.campaignDaily, capped 400 rows; stripped
  from the brief payload) and the page aggregates whichever window is on.
  The old campaigns-fold and its heading are gone; adCombined.campaigns
  (7d rollup) stays for the brief and as a fallback.
- SETUP FOLD REMOVED: "Connecting what is missing" left the page; all of
  it was connected, and the optional direct Meta/Google token recipe
  lives here instead: META_ADS_TOKEN + META_AD_ACCOUNT_ID, or
  GOOGLE_ADS_DEVELOPER_TOKEN/CLIENT_ID/CLIENT_SECRET/REFRESH_TOKEN/
  CUSTOMER_ID on Cloud Run; Windsor covers both meanwhile. The Wix key
  fold text also lives on only in this file.
- TICKER starts mid story: the line is doubled and the keyframes slide
  half its width (translateX 0 to -50%), so words are on screen at once
  and the loop is seamless; pace a touch faster (chars / 4.5, min 20s).

## v13.58 (Claude): the terms popup, BACKEND caps, circles on the playground

- TERMS AS A POPUP (supersedes v13.57's checkbox, per Fromsa): sign in
  first, then #tos-modal opens over the app with the full terms text.
  Agree is disabled and reads "Scroll to the end" until the text has been
  scrolled to its bottom (12px tolerance; a tall window that already shows
  everything arms immediately). Accept stores maya_tos_accepted and fires
  /api/hello; "Not now" signs out. One time per browser; a future terms
  change bumps MAYA_TOS_VERSION in index.html AND the modal/terms.html
  text together. The modal body duplicates backend/terms.html on purpose
  (no iframe): edit BOTH when the terms change.
- BACKEND caps: #brand in backend.html is text-transform uppercase.
- PLAYGROUND CIRCLES (staged on the playground ONLY, per the playground
  rule; the app keeps its current drawer until Fromsa promotes it): the
  drawer's avatar row and the bottom Fabrics/Pinterest buttons became
  three hamburger-sized circles at the top: Avatar (the face, opens the
  avatar view with name + measurements), Fabrics (the Orange Cheetah
  in-house swatch, opens the fabrics drawer), Pinterest (the Pinterest
  glyph, opens the Pinterest drawer). Hover titles are one word each. The
  client-switch caret stays at the row's right; the name span is hidden
  but kept (JS still writes it). Tip / Logout / Feedback ride the drawer's
  floor (margin-top auto). IMPORTANT: playground/index.html now DIVERGES
  from frontend/index.html. Do NOT regenerate it as frontend + badge; the
  circles patch must be re-applied (the v13.58 blocks are marked
  "v13.58 PLAYGROUND" in the file). Verified end to end with a local
  browser run: circles render, drawer opens/closes, avatar view opens,
  terms modal arms only at the end of the text.

## v13.57 (Claude): terms at the door, a truthful wall, a complete count

- TERMS: backend/terms.html (served at /terms.html; the rewrite is in
  docs/firebase.json, same commit). Succinct and plain: account, content
  ownership, the community wall rule stated in full (a heart publishes the
  render with the first name; unheart takes it down; uploads and face
  photos never appear), renders are visualizations not promises, orders
  are agreed with the atelier, acceptable use, as-is disclaimer, $100
  liability cap, California law. Privacy page links to it and back.
- CONSENT AT SIGN IN: replaced by the v13.58 popup above.
- WALL MIRRORS HEARTS: _unpublishNow now also sweeps every post THIS
  account made for the garment's fingerprint (where uid==me and fp==fp,
  limit 10, deletes doc + storagePath). Ghost posts from older id schemes
  can no longer survive an unheart. Rules already permit it (own-uid
  delete, signed-in read).
- COMPLETE USERS COUNT: new POST /api/hello (requireGoogleUser inside, so
  noteUser marks the account) called once per session by the app after
  sign in, fire and forget, sessionStorage guarded. Before this only
  accounts whose work reached the API were counted: the store held 2
  markers while GA saw dozens of people; that was Fromsa's "we have more
  than two users", and he was right. It also records tosVersion +
  tosAcceptedMs on the user marker. History cannot be reconstructed: the
  count is complete from this version forward, which Admin's changelog
  says out loud.
- PLAYGROUND: checked end to end locally (Playwright: hamburger toggle
  opens the drawer pane to full scroll, body class flips, closes clean;
  every inline script parses; live file byte-identical to frontend plus
  the badge). No fault found in the page itself; if a specific link
  misbehaves for Fromsa again, ask WHICH link before changing code.

## v13.56 (Claude): the ticker, the folds, one drawer family

- TICKER: the Today strip became a marquee in the top bar between the
  wordmark and the hamburger (#ticker / buildTicker in marketing.html).
  Jost small caps, var(--blue), scrolls continuously, pauses on hover,
  hidden under 760px. Content: AI headline (when the hourly brief answers),
  every deterministic warning colored red/amber, week spend + link clicks,
  per network CPL, leads this week/month, cost per lead, one next action.
  Wording rules: relative words (today, yesterday, this week, vs
  yesterday), CPL not cost per link click, raw dates rewritten to mm/dd.
- FOLDS: visitors, Ads (renamed from "Paid, both networks together"),
  campaigns, leads and sources are all <details class="fold" open>.
- COMBINED PILLS: "Manasiyo.com · MAYA" pills pair both properties per
  window (wix first, then MAYA GA users; legend line says the order). Wix
  publishes a day at a time, so wixSite.today.visitors is NULL until the
  day exists (verified against the API: Aug 23 absent while 21/22 present)
  and the pill shows "…" with a tooltip, never a fake 0. Extra Wix tiles:
  visits, forms submitted, clicks to contact (new measurement types).
- CAMPAIGN TABLE: new Cost column (7d spend per campaign, replacing the
  two deleted network panels), clicks column is Link clicks on both
  networks (windsorInsights accumulates linkClicks per campaign), CPC =
  spend / link clicks. paintAds and the two panels are REMOVED; the server
  still computes each network's d7 (warnings, brief and ticker read them).
- DRAWER FAMILY: marketing's dropdown became the sliding drawer with the
  riding hamburger (same .42s cubic-bezier(0.16,1,0.3,1) as Admin/app);
  Admin's pill moved 2px closer to the drawer edge (-320px), Marketing
  rests at -290px. Escape and click-outside now call toggleDrawer(false).
- What-they-read is gone. Sources say "Sources of traffic, MAYA", site
  shaped sources are links, and the note explains checkout.stripe.com
  (returns from a Stripe tip payment). Wix has NO per-source breakdown in
  its Data API; its Semantic Model API could open that later (deferred,
  noted on the page).

## v13.55 (Claude): revenue cancelled, notes on the leads, steadier Windsor

- REVENUE IS GONE, on Fromsa's direct request ("cancel everything about
  revenue... that was just my bad"). sheetRevenue(), every REVENUE_* env,
  the money row and its note were all removed; a regression assertion now
  FAILS if the word revenue reappears in server.js or marketing.html. Do
  not rebuild it without a fresh ask.
- Windsor was NOT disconnected: verified live through Fromsa's session
  right after his report (windsor.connected true, chart drawing, both
  panels via windsor, brief answering). What he saw was the revenue
  "not connected" note reading like a failure. Still hardened: the two
  connector fetches are now independent, so one failing never blanks the
  other; only both failing reports disconnected, with both reasons named.
- Leads list: the When column became NOTES, the client's own words from
  the form (server picks the longest free-text answer, 400 chars, skips
  emails/phones); the date sits small under the name. Wix key question
  answered: the key he set on Aug 22 already covers Forms, leads were
  verified connected live (d7=2 at check time), no key work needed.
- D / W / M chips sit closer (gap 3px).
- costPerLead stays in the payload (it is leads + spend, not revenue) and
  still feeds the hourly brief; nothing on screen shows it for now.

## v13.54 (Claude): Marketing v2, the intelligence layer

Built from Fromsa's pasted handoff spec ("marketing.html v2"). Build order
followed the spec: truth first, then leads, revenue, warnings, chart, AI,
menu. Voice (spec 5.2) is DEFERRED on purpose: text first, voice when the
text layer is answering well.

- TRUTH FIXES (spec 0): windsorInsights() now asks each connector in its own
  words instead of the flattening /all feed. Meta link_clicks (27, $2.12)
  and Google clicks are the comparable pair; Meta's every-interaction
  "clicks" (53, $1.08) shows separately as "All interactions". Meta reach
  and frequency come from a no-date-dimension aggregate call (Windsor then
  returns the connector's own deduplicated totals: reach 928 verified),
  fixing the hardcoded reach: 0. Google conversions are null + "not
  configured" on screen: absence, not failure. Direct metaInsights() also
  requests inline_link_clicks / cost_per_inline_link_click / frequency for
  whenever META_ADS_TOKEN is set.
- LEADS (spec 1, better source): wixLeads() reads the canonical Wix Forms
  record (POST forms/v4/submissions/namespace/query, same WIX_API_KEY +
  wix-site-id headers as analytics, namespace wix.form_app.form, 10 min
  cache, 28d window by pagination, names/emails parsed from the field-id
  keys). NOT Gmail parsing: the API record is what the notification email
  is written from, and needs no new OAuth. VERIFIED live through Fromsa's
  Wix account: 20 real submissions returned. If the Cloud Run key was made
  analytics-only, leads report why and the page shows the fix (regenerate
  key with All site permissions). No pixel was added, per spec.
- REVENUE (spec 2): built here, then CANCELLED and fully removed in
  v13.55 on Fromsa's request. See the v13.55 section above.
- out.costPerLead = (google+meta spend)/leads stays in the payload for the
  brief. Lead list (12 newest) under the panels.
- WARNINGS (spec 4): computeMarketingWarnings(), deterministic, no model:
  enabled ad group silent since date X (Windsor only reports days WITH
  delivery, so a never-served group is invisible; a served-then-silent one
  is caught: this is the Suits and Tailoring failure class), enabled
  campaign spending nothing, CPC-per-link-click +50% DoD, link CTR -30%
  WoW (14d dailies), Meta frequency > 3, no leads in 7d. Google Ads credit
  balance is NOT readable via any connected API: no credit warning is
  computed rather than a guessed one (documented gap).
- SUMMARY STRIP + AI (spec 4+5.1): collapsed "Today" strip at the top;
  deterministic warnings render immediately; POST /api/admin/marketing-brief
  (requireAdmin, 1h server cache keyed by UTC hour, MODEL_TERRA with a
  one-shot gpt-4.1 fallback on model-shaped errors, response_format
  json_object → {headline, observations[{text,severity}], action}) adds the
  hourly reading. Lead names/emails are stripped before the model sees the
  payload: numbers only, never names. On any failure the strip shows the
  warnings alone.
- CHART (spec 3): D / W / M range chips (localStorage maya_mkt_range),
  server always sends 30 days and the page slices; D = today vs yesterday
  (Windsor has no hourly). Native <title> tooltips replaced by a hover
  layer: guide line, enlarged dots, floating clamped tooltip, touchstart/
  touchmove served by the same handler. "Clicks" chip now means link clicks
  on both networks; chart cpc = spend/linkClicks per day.
- MENU (spec 6): grouped MAYA / Outside tools / Legal, with Marketing,
  Playground, Wix dashboard added; drawer scrolls (max-height).
- Campaign key separator in windsorInsights was a literal NUL byte ('\\0')
  hiding in the old code (made grep call server.js binary); now ' | '.
- Env summary (new, all optional): REVENUE_SHEET_ID, REVENUE_SHEET_RANGES,
  REVENUE_MTD, REVENUE_ORDERS, WIX_FORMS_NAMESPACE.
- Do not point the panels back at Windsor /all; do not sum daily reach; do
  not let the brief endpoint receive lead names; do not compute a Google
  credit warning without a real balance source.

## v13.53 (Claude): the tier upgrade, the allowlist, privacy, Nano Banana

- THE PROXY DECIDES THE MODEL NOW. `/api/openai/*` parses JSON bodies:
  `gpt-4.1` is upgraded to `MODEL_TERRA` (default `gpt-5.6-terra`),
  `gpt-4o-mini` to `MODEL_LUNA` (default `gpt-5.6-luna`), the `gpt-5.6-*`
  names pass, `gpt-image-2` / `whisper-1` / `text-embedding-3-small` pass
  unchanged, and ANY other model answers 403 `model_not_allowed` (multipart
  model fields are checked too). This closes the localStorage `getModel()`
  hole named as the top risk in both review memos. The client pages still
  say the legacy names on purpose: rollback is env only
  (`MODEL_TERRA=gpt-4.1`, `MODEL_LUNA=gpt-4o-mini`), no client edit.
- SAFETY NET: if the upgraded model comes back as a model-shaped 400/404
  (not found, no access, not supported), the proxy retries ONCE with the
  original model and logs `[ai] tier fallback`. A missing GPT 5.6
  entitlement therefore degrades to exactly v13.52 behavior, silently.
- STRUCTURED SPEND: every proxied AI call now logs one `[ai]` JSON line:
  path, model actually used, mapped-from, ms, and for non-streamed chat and
  embeddings the REAL prompt/completion tokens from the response body.
- Operations Room: the pattern critique judge and the streamed pattern loop
  ask for `gpt-5.6-sol` by name (Sol = streamed expert pattern critique
  only, per the agreed plan). classifyGarment stays on the mapped name.
- Fabric ranking: `fabric-sourcing.js` model is `RANK_MODEL || MODEL_TERRA
  || gpt-5.6-terra`; the ai-router `fabric.visual_rank` task (version 2) has
  that as its primary route and the proven `gpt-4.1` as its registered
  fallback route.
- NANO BANANA: POST `/api/visualize-fabric` (requireAdmin, image-weighted
  rate limit) asks `NANO_BANANA_MODEL` (default `gemini-3.1-flash-image`)
  on Vertex AI in `VERTEX_LOCATION` (default `us-central1`) via the Cloud
  Run service identity (metadata token, cloud-platform scope; project id
  from the metadata server or `VERTEX_PROJECT`). It illustrates a dissected
  fabric spec; the answer is always `label: GENERATED`. In backend.html,
  gradient-only sourcing cards wear a Visualize chip; the result replaces
  the gradient and wears a Generated badge, and the card still opens the
  merchant's real search. NEEDS OWNER SETUP: enable `aiplatform.googleapis.com`
  on the project, else the endpoint answers 503 `vertex_not_enabled` and the
  chip says "Not enabled yet" (that state is handled, not an error).
- Privacy page: new dateline Aug 23; the OpenAI paragraph now says plainly
  that consultation words, transcripts, measurements, reference pictures,
  fabric photographs and the face photograph go to OpenAI's API; a Google AI
  paragraph covers Vertex fabric imagery, generated-and-labeled, inside our
  own project.
- HONESTLY DEFERRED: the Gemini 3.7 Flash shadow evaluation for ranking and
  dissection is NOT in this slice. It waits for the eval suite
  (tests/eval/), per the architecture memo. No other Google surface exists.
- Env summary (all optional): MODEL_TERRA, MODEL_LUNA, MODEL_SOL,
  RANK_MODEL, NANO_BANANA_MODEL, VERTEX_LOCATION, VERTEX_PROJECT.
- Do not put a model allowlist bypass back; do not let the browser name a
  model that is not on MODEL_ALLOWED; do not present a Visualize picture as
  a merchant photograph.

## v13.52 (Codex): routing foundation and one image model

- `docs/server/ai-router.js` is the provider-neutral task registry, router,
  safe telemetry emitter and evaluation harness. It logs only task/route,
  timing, outcome, safe error category and numeric usage. Prompts, pictures,
  outputs, transcripts, measurements, retailer records, account identity and
  project identity never enter telemetry or evaluation summaries.
- `fabric.visual_rank` is the first exercised task. It still has exactly one
  route: OpenAI `gpt-4.1`, `v1/chat/completions`, 60 second ceiling. The
  admin-only `/api/rank-fabric` request, validation, response and static-first
  fallback are unchanged from v13.51. No parallel model call and no live
  cross-provider fallback were added.
- The router can later use a second route only for a timeout, transport error,
  provider overload/server error or invalid structured response. It never
  falls through on a safety refusal, cancellation, client error, auth error or
  missing configuration. The Cloud Build gate now runs routing and fabric
  contract tests before building the server image.
- GPT Image 1.5 has no active path or picker. The app, Playground, Backend
  piece renders, pattern rasters and stored model preference now converge on
  `gpt-image-2`. Existing medium quality, 1024x1536 client generations,
  1536x1024 piece renders, reference anchors and parallel piece rendering are
  unchanged.
- `docs/MAYA-AI-ARCHITECTURE.md` is the canonical boundary and staged route
  map. MAYA is Most Advanced Yet Acceptable, the explainable intelligence
  layer. Mana Siyo is the human-verified CLO, SVG, LightBurn, laser cut and sew
  workflow. No generated pattern is silently called production ready.
- Validation before commit: `tests/ai-routing.mjs` 7 of 7 and
  `tests/fabric-sourcing.mjs` 5 of 5; `node --check` clean for
  `ai-router.js`, `fabric-sourcing.js` and `server.js`; v13.52's four new
  regression conditions passed independently; executable inline scripts parse
  in the app, Playground, Backend, Admin and Marketing; version tags agree;
  `git diff --check` clean. The full app regression cannot start on this
  machine because Playwright is not installed, and server smoke cannot start
  because Express is not installed. No dependency was installed for this
  slice. The preceding v13.51 commit ran smoke 20 of 20 and independently
  validated its browser conditions.
- No Vertex/Gemini credential, API, IAM, deployment or cloud setting changed.
  No production call was made. The next implementation stages remain: task-
  by-task OpenAI tier evaluation; owner-configured Gemini vision canaries after
  approval; normalized catalog/embedding retrieval; and versioned production
  memory for real Mana Siyo corrections. Claude verified this slice on the
  Mac (all four suites green) and committed it on Codex's behalf as 57f9cea;
  v13.53 builds directly on it.

## v13.50 (Claude): the live merchant window

- THE DISSECTION SPEAKS FABRIC: the prompt now also returns "fabric_spec"
  per piece: fiber, weave, weight_gsm, stretch, sheen, texture, all read
  from the image by the same gpt-4.1 call. `_sourcingQuery()` builds the
  shop query from it (color word + fiber + weave beats the raw sentence).
- `/api/source-fabric?q=` (server.js, requireAdmin): queries six retail
  merchants' public Shopify suggest feeds in parallel
  (moodfabrics, blackbirdfabrics, shop.missmatatabi, thefabricsales,
  thefabricstore, tessuti.com.au; Mood/Blackbird/Matatabi/FabricSales
  verified answering on Aug 22), 6s timeout each, failures skipped, top 60
  normalized products {merchant, place, etaDays, currency, title, price,
  url, image}. In-memory cache 24h per query. EVERY answer is also seeded
  to catalog/queries/<slug>.json in the bucket: that is the growing corpus
  future CLIP visual matching will search; do not delete catalog/.
- Client (backend.html): the static wall paints instantly, then
  `_fetchLiveSourcing()` fetches once per fabric per session and repaints
  with live products first (color-ranked against the dissected hex),
  static cards filling the rest. Any failure leaves the static wall
  untouched. Live prices show with their own currency code; no invented
  conversion.
- SwatchOn: the partnership letter is DRAFTED in Fromsa's Gmail
  (to support@swatchon.com, asking for the partnerships/API team), waiting
  for him to review and send. Do not send mail on his behalf.
- 202 regression checks + 19 smoke checks (source-fabric 401 covered).

## v13.49 (Claude): the model that sees the picture names the color

- The dissection prompt (backend.html, DISSECTION_SYSTEM_PROMPT) now asks
  gpt-4.1 for a "fabric_hex" per piece: the dominant fabric color READ
  FROM THE IMAGE, six digit hex. `_targetFabricRgb()` trusts it first,
  the fabric string's color word second, the sampled picture last. Old
  saved dissections have no fabric_hex and fall through gracefully; a
  re-dissection picks it up.
- docs/fabric-sourcing-study.md is the worldwide RETAIL sourcing study
  (no MOQ, 2 to 3 yards must be a normal order; wholesale is out).
  Headlines: SwatchOn (Seoul, 20,000+ fabrics, 1 yard MOQ, video
  swatches, no public API but a partner program: the best catalog fit,
  worth a partnership email), Amazon (PA-API is gated behind Associates
  sales, so links or a SERP API first), Etsy Open API v3 (free,
  approachable, real listings with pictures and prices: the easiest true
  integration), and roughly twenty curated Shopify garment fabric shops
  across the US, Canada, UK, Europe, Asia Pacific. Build order stays:
  hex (done) -> live merchant search server side (/api/source-fabric,
  cached) -> SERP API breadth -> CLIP visual matching once a catalog
  exists. Read the study before building the next fabrics pass.

## v13.48 (Claude): Wix visitors, chart axes, the wall back in its frame

- MANASIYO.COM VISITORS COME FROM WIX ITSELF now: `wixInsights()` in
  server.js reads GET https://www.wixapis.com/analytics/v2/site-analytics/data
  (query params dateRange.startDate/endDate + measurementTypes
  TOTAL_SESSIONS and TOTAL_UNIQUE_VISITORS; a GET with a BODY is refused,
  use query params). Auth: `Authorization: <WIX_API_KEY>` +
  `wix-site-id: <WIX_SITE_ID>`; the site id defaults to the live Mana Siyo
  site a4ad1a21-d8dc-4986-8ac2-9db20fbf366f (the second Wix site,
  "Mana Siyo (2/22/26)", is empty; verified live on Aug 22: 141 unique
  visitors in 7 days, 30 on Aug 20). Wix keeps 62 days of data; never ask
  for more. Needs WIX_API_KEY on Cloud Run (account API key with Site
  Analytics permission); Fromsa pastes it himself.
- Marketing page: the last checked line is gone (the element remains as an
  error mouth only), MAYA's arrival tiles left the page, and the top
  section is "Manasiyo.com, who is arriving" fed by `out.wixSite`. The two
  GA tables stayed but say whose they are: "MAYA, where its visitors came
  from" and "MAYA, what they read".
- Paid chart: subtle axes. Every day is named under the chart (#ad-xaxis),
  the gridline values ride the left edge as HTML overlays (#ad-ylabels;
  works because preserveAspectRatio=none maps viewBox height 1:1 to the
  fixed 190px, so vertical pixel positions line up; do NOT put text inside
  this stretched SVG, it distorts). A fourth chip, "All three", draws
  clicks (solid, dotted markers), impressions (thin, 55%) and cost per
  click (dashed) at once, each metric scaled to its own peak across both
  networks, with a second legend row for the line styles.
- THE FABRIC WALL FITS ITS FRAME AGAIN. The v13.44 pager let long nowrap
  card titles blow the layout: grid columns default to min-content, so the
  wall stretched the whole .op-row sideways and the square-aspect swatches
  overflowed an unscrollable panel. Fixes, all CSS: .op-row columns are
  minmax(0, 1.2fr)/minmax(0, 0.8fr); .brief-fabrics is height:70vh (the
  full view frame's own scale) with min-width:0; .fab-page is
  grid-template-columns/rows repeat(4/3, minmax(0,1fr)) at height:100%;
  .fab-card is a min-width:0 column; .fab-swatch dropped its aspect-ratio
  and flexes to the row. 12 cards always fit exactly; pages swipe.
- COLOR-TRUE SOURCING. "Crimson wool suiting" was shown in navy: crimson
  meant nothing to _COLOR_RGB and search cards borrowed the family's first
  product photo. Now ~20 more color words exist (crimson, scarlet, maroon,
  wine, teal, mustard...), `_targetFabricRgb()` takes the color from the
  dissected fabric STRING first (sampled image as fallback), merchant
  search cards wear a `_tintSwatch()` gradient of that color and never a
  borrowed photo, and when the wanted color is known the ranking weights
  flip to 0.35 relevance / 0.65 color so a navy pick cannot outrank a
  crimson search. Curated picks keep their real photos and real prices.
- Verified headlessly: 14 fake cards render as a 4x3 page inside an
  830x665 panel with a second page and dots, no sideways document scroll;
  the chart draws axes in clicks mode and three styled line pairs in All
  three mode. 197 regression checks + 18 smoke checks pass.

## v13.47 (Claude): the numbers audit. READ THIS BEFORE TOUCHING ANALYTICS

Verified live on Aug 22 through Fromsa's signed-in admin session:

- /api/admin/analytics AND /api/admin/marketing both read GA property
  **properties/538681159, displayName "pro-maya"**: MAYA's own Firebase
  Analytics (G-ETTJ6PXEMM in index.html). It is the ONLY property shared
  with the Cloud Run service account
  (53947659283-compute@developer.gserviceaccount.com). So the Admin tiles
  (live/today/7d/28d) are MAYA visitors and are WORKING; on Aug 22 they
  read 1 live, 1 today, 24 in 7d, 46 in 28d.
- The 14-people-a-day Fromsa sees for manasiyo.com is Wix's own internal
  analytics. The Wix site has NO GA4 property, so those visitors cannot
  reach any page here until one exists. The Marketing fold now carries the
  exact steps (create GA4 property, connect Measurement ID in Wix, add the
  service account as Viewer). `marketingProperty()` now prefers any
  property that is not pro-maya, so sharing the new property is enough by
  itself; MARKETING_GA_PROPERTY_ID pins it only if the pick is ever wrong.
- USERS = Google accounts that signed in to MAYA (metrics/users/ markers),
  which is why it reads 2 while visitors read 24: visitors who never sign
  in are in the traffic pills, not in Users. Each traffic pill now says
  what it counts in its hover title. The anonymous "before names were
  kept" row is a pre-v13.43 marker; noteUser fills its email the next
  time that account signs in, and its label now says so.
- Windsor: Fromsa's Windsor account (worldofsiyo@gmail.com, Trial) HAS
  google_ads (Mana Siyo 780-624-2945), facebook (Mana Siyo Ads), GA4
  pro-maya, instagram and google_my_business connected, and last-7-day
  spend/impressions/clicks data flows for both ad networks (verified via
  the Windsor API on Aug 22). The ONLY missing piece for the paid chart is
  WINDSOR_API_KEY on the maya-api Cloud Run service. Never handle the key;
  Fromsa pastes it himself.
- Marketing page: the paid section (combined chart + campaigns) moved to
  the TOP under the visitor tiles; the four week daily bar graph is
  deleted (it repeated the tiles); the "who is arriving" heading names the
  property actually read (MAYA vs Manasiyo.com) and, while it is pro-maya,
  a note explains why the Wix site's visitors are absent.
- Admin: the MAYA door chips (operations room beta, playground) are
  reachable now: the hover gap is inside the chip strip (padding-left, not
  margin) and the strip lingers 0.4s before hiding.

## v13.46 (Claude): anchored, full height, in caps

- MAYA's pill is ANCHORED to the drawer, not transitioned after it: its
  transform is written from `hscroll.scrollLeft` on every scroll frame
  inside `updateDrawerState` (`translateX(-max(0, scrollLeft - 18))`), so
  it is glued to the drawer's edge through the native scroll physics. The
  CSS class transform + transition from v13.45 is deleted; do not put a
  transform transition back on `#hamburger-toggle`, that is exactly the
  "chasing" Fromsa reported. Phones (<=640px) keep the pill parked.
- Admin's drawer now SLIDES (translateX + opacity, 0.42s
  cubic-bezier(0.16,1,0.3,1)) instead of popping display:none/block, and
  the pill uses the identical duration and curve, so the two move as one.
  Backend's pill matches its drawer's 0.42s too, and `openClientsDrawer`
  adds `.open` FIRST and fills after; it used to await the submissions
  fetch before opening, which made the drawer lag the pill. Operations
  Room pill curve matches its pane (0.22,1,0.36,1).
- Fabrics and Pinterest drawers are the same full height as the main
  drawer (top 10 / bottom 10; on phones top 64, matching #notes-drawer).
  The click-outside-closes handler EXCLUDES `#fabrics-drawer`,
  `#pinterest-drawer` and `#feedback-modal`: Back in those panels was
  being treated as an outside click and closed the main drawer under
  them. Back now only closes its own panel. Swiping the main drawer away
  still closes Fabrics AND Pinterest with it.
- Admin doors, in caps per Fromsa: MANA SIYO, MARKETING, MAYA.
- Versions: metas 13.46; changelog 2026-08-22c; 186 regression checks +
  18 smoke checks pass. Verified headlessly: pill transform tracks
  scrollLeft (0 at rest, -360 at full open), fabrics drawer computes
  top/bottom 10px, Admin drawer opens to transform:none opacity:1, doors
  read MANA SIYO / MARKETING / MAYA.

## v13.45 (Claude): the hamburger rides with the drawer

- The drawer's own inner hamburger from v13.44 is GONE everywhere, per
  Fromsa: the top bar pill never disappears now, it slides LEFT with the
  drawer (transition on transform) and rests hanging just outside the
  drawer's left edge; the same pill closes it. Travel distances are fixed
  px, measured from the right edge, so they hold at any viewport: MAYA
  -360px, Admin -322px, Backend -352px, Operations Room -360px. On phones
  (max-width 640px) the transform is cancelled, the drawer is full width
  below the top bar, and the pill stays put.
- A click (pointerdown, capture phase) anywhere OUTSIDE the drawer closes
  it, on MAYA, Admin, Backend and Marketing; the Operations Room already
  had this.
- Admin doors: THREE now, in his order: Mana, Marketing, MAYA. Hovering
  MAYA reveals `.pg-chips`, two chips to its right: operations room beta
  (/operations.html) and playground (/playground.html).
- Mobile: cards start smaller (max-width 200px, thumb max-height 260) and
  type steps down a notch (.item-title 13px, inspo title 11px, drawer
  links 13.5px). A TWO FINGER PINCH on any card resizes it: touch handlers
  inside `makeDraggable` (guarded by `el._pinching`, which the drag onMove
  respects), same 120..560px clamps and the same `_persistSession()` as
  the corner handle.
- Versions: metas are 13.45; changelog entry 2026-08-22b; 182 regression
  checks + 18 smoke checks all pass. Verified with headless screenshots:
  pill rides out and back, click-outside closes, chips show on hover,
  mobile drawer full width with the pill still visible.

## v13.44 (Claude): one column of pills, plain doors, the world's fabric

- Viewer: the Attributes list merged INTO Design Notes. Every value under
  "Aesthetics and constraints" is a `.vn-pill` chip with a cross; crossing
  one toggles the same `viewerDeselected` set the old attributes panel used,
  so the render prompt logic is untouched. On wide screens (min-width
  1280px) the old attributes toggle and #viewer-refs are hidden; the notes
  column is the one place. The mid-row button says **Visualize** ("Apply
  changes" when edits are staged), and the reference picker confirm says
  "Use this reference" / "Use N references" in staging mode.
- Drawers, everywhere: full height (top 10 / bottom 10), and the drawer
  carries its OWN hamburger in its top-left corner while the top bar one
  fades (`body.drawer-open`). Applied to MAYA (`.notes-close` is now that
  hamburger), Admin (#drawer), the Backend clients drawer, and the
  Operations Room (whose embedded-mode CSS now hides only the header
  hamburger, `html.embedded header .icon-btn.hamburger`, so the drawer's
  own button survives embedding).
- Admin: the four doors are plain words, no pills (Fromsa liked the
  accidentally unstyled MAYA door and asked for all four to match): flex
  row, centered, 20px, gap 34, "Manasiyo.com" renamed **Mana**. The
  playground chip now hangs to the RIGHT of the MAYA word (left:100%).
  `_wireDrawerSwipe` answers mousedown/mouseup drags as well as touch, so
  the swipe works on desktop.
- Backend: top-left brand says **Backend** (the brand-sub span is gone),
  the drawer is titled **Submissions**, and every count string says
  submissions, not clients.
- Marketing is one dashboard: `#ad-chart` (inline SVG, a polyline per
  network, Google #8ab4f8 / Meta #81c995, metric chips for Clicks,
  Impressions, Cost per click) plus `#campaigns-table` (status by actual
  delivery, campaign, network, impressions, clicks, CTR, CPC). Fed by
  `out.adCombined` from the server: `windsorInsights()` now requests
  `source,date,campaign,impressions,clicks,spend` (falls back to the old
  field list if campaign is refused) and returns `campaigns` plus the
  per-source daily series. The old two summary panels remain below.
- Fabric sourcing looks worldwide: `WORLD_MERCHANTS` in backend.html (Mood
  New York, The Fabric Store NZ, Blackbird Vancouver, Merchant & Mills,
  Tessuti Sydney, Miss Matatabi Tokyo, The Fabric Sales Antwerp,
  Stonemountain Berkeley, Etsy, Amazon), each a real search URL for the
  exact fabric string. The wall is `.fab-page` pages of 12 (4 columns x 3
  rows, scroll-snap swipe, dot indicators). Search cards say "varies"
  because only a listing can state its own price; curated picks keep their
  verified listed prices. Live per-listing pricing would need a server-side
  fetch and is NOT built. Sourcing now works from the FULL VIEW without
  dissection (`_buildFullViewCards()`, color-ranked against the garment
  picture). The in-house library is prefetched ~1.2s after boot and its
  first 16 swatches warmed, so the In-house tab opens instantly.
- Versions: index/status/marketing metas are 13.44; Admin changelog has the
  Aug 22 entry; 178 regression checks + 18 smoke checks all pass.

## Where things stand, August 21 2026

- FEEDBACK exists as of v13.41: the app drawer's Privacy slot became Feedback
  (Privacy stays on the sign in screen and the map). Spoken or typed, POSTed
  to `/api/feedback`, stored at `feedback/` in the bucket, listed at
  `/api/admin/feedback` (admin only, newest 50). Rate limited, 4000 chars.
- SECURITY as of v13.41: a submission can only be written by the account that
  opened it (`subOwner()` reads the init marker, cached). The legacy Pinterest
  modal is deleted; the drawer is the only implementation.
- Live line: `maya-v2`. v13.48 is pushed and live. **v13.49 through v13.51 are
  committed and waiting for Fromsa's push** (fabric color and traits, the
  live merchant window, then garment-to-thumbnail visual ranking).
- **The folder changed in v13.37.** Pages are no longer loose at the root:
  `frontend/index.html`, and `backend/` holds status, marketing, operations,
  backend and privacy plus verify. Every old URL still answers, because
  `docs/firebase.json` rewrites each one onto its new file and the catch-all
  now points at `/frontend/index.html`. If a page 404s after a deploy, the
  rewrite list is the first place to look. `aesthetics/` stays at the root on
  purpose: `docs/**` is ignored by Hosting, so pictures inside it would never
  deploy.
- Tests: 207 checks in `tests/app-regression.mjs`; the last complete browser
  run passed all 202 pre-v13.51 checks, and v13.51 adds five source assertions
  for vision-led sourcing. The suite still checks that every old address maps
  to a file that exists.
- Pinterest: app id and secret ARE set on Cloud Run. The sign in currently
  fails with Pinterest's own 400, "this application has not registered a
  redirect URI": `https://maya.manasiyo.com/api/pinterest/callback` must be
  added in the Pinterest app under Manage, Configure. The drawer now names
  that address when a sign in dies. Trial access approved Aug 18. Standard
  access needs a screen recording of the OAuth flow, submitted from the
  Pinterest developer console. Nobody has recorded it yet.
- Credit meter: the RING WAS REMOVED from the Systems Map in v13.39. Fromsa
  does not want a gauge that needs explaining. The server side still works and
  is still there: `/api/admin/spend` and `/api/admin/credit` (last top up in
  `metrics/credit.json`, OpenAI Costs API when `OPENAI_ADMIN_KEY` is set).
  OpenAI has no balance endpoint; do not go looking for one again, and do not
  put the ring back without being asked.
- Marketing: `/api/admin/marketing` reads Analytics with the Cloud Run
  identity, Meta with `META_ADS_TOKEN` + `META_AD_ACCOUNT_ID`, Google Ads with
  the five `GOOGLE_ADS_*` values. Each half reports itself not connected
  rather than inventing a number.

## Where things stand, August 16 2026

- Live and verified: **v13.27 confirmed working** (submissions land and list
  from MAYA's own bucket, renders work). **v13.28 is committed and waiting for
  Fromsa's push.**
- Git: `~/Desktop/MAYA-new`, `origin/maya-v2` and GitHub were identical at
  `ba825c5` with a clean tree before this handoff. GitHub is working. The
  Codex sandbox cannot resolve github.com; that is a sandbox limit, not a
  repository problem, so the push always happens from GitHub Desktop.
- Cloud Build deploys on every push to `maya-v2` and refuses every other
  branch. Server, hosting and rules are separate steps. It sets NO
  environment variables, so a deploy can never overwrite a credential.
- **Google Drive is gone from MAYA.** v13.27 moves submissions into MAYA's own
  Cloud Storage bucket, written by the server's own service account. The
  OAuth refresh token that died twice in four days is no longer read anywhere.
  If submissions are still red after v13.27 deploys, it is IAM, not a
  credential: the Cloud Run service account needs Storage Object Admin on
  `pro-maya.firebasestorage.app`. Submissions filed before Aug 17 remain in the
  old Drive folder and are NOT listed in MAYA; copying them across is optional
  work nobody has done.

## Where each test can actually run, corrected August 16

This was wrong in every earlier handoff and it is why regressions shipped.

- `tests/app-regression.mjs` (browser): runs ONLY in Claude's cloud container.
  Codex has no Chromium and cannot bind a socket. **Fromsa's Mac has no Node at
  all**, so it has never run there either. Do not claim it passed unless it
  printed "all passed"; a crash mid-file used to hide every later check.
- `tests/smoke.mjs` (server): Claude's container, after `npm install` in
  `docs/server`.
- `tests/verify-live.mjs` (deploy): needs the internet, so neither agent
  sandbox can run it. It also needs Node, which Fromsa does not have.
- **`/verify.html` (deploy, no install): the one Fromsa can actually use.** It
  is a page ON the site, so it reads the live files and the live API, and it
  borrows the Systems Map sign in from same-origin localStorage to ask deep
  health whether Drive is truly authorised. Open maya.manasiyo.com/verify.html
  after any push. Works on a phone.

## v13.31 (Claude): Pinterest, and pictures from anywhere

- `/api/fetchpic?u=` fetches any public https picture server side (a browser
  cannot read cross-origin bytes). SSRF is the risk, so DNS is resolved first
  and refused on private, loopback, link-local or CGNAT addresses (the metadata
  server is 169.254.169.254), no redirects are followed, the answer must be an
  image, 20 MB cap, signed in and rate limited.
- Pinterest OAuth lives entirely in the server: `PINTEREST_APP_ID`,
  `PINTEREST_APP_SECRET`, optional `PINTEREST_REDIRECT_URI` and
  `PINTEREST_SCOPES`. Endpoints: status, start, callback, boards, pins,
  disconnect. State is an HMAC of uid plus timestamp, compared with
  `timingSafeEqual` and expired after 20 minutes. Tokens live per MAYA account
  at `pinterest/<uid>.json` in the bucket and refresh automatically; a dead
  refresh forgets the connection and the screen asks to reconnect.
- The client shows the Pinterest button ONLY when status.configured is true.
  Board grid, then pin grid, six selectable, imported through
  `importPictureFromUrl()` so every picture is copied into the project.
- Pinterest access tiers: a new app is Trial (its own account and listed
  testers only). Standard access, needed for clients, requires Pinterest to
  review a video of this flow. The code is done; that approval is not code.
- Verified against a local stand-in for Pinterest and storage: status before
  and after, the authorize URL, boards, pins (largest image chosen, pins with
  no picture dropped), a forged state refused, a traversal board id refused,
  disconnect, and status returning to not connected.

## v13.29 (Claude): the launch pass

- **The share bug**: a share stored the sharer's own picture addresses, which
  Storage rules let only the sharer read, so a recipient got 403 and the import
  died. `_publishShare()` now copies every picture to
  `shares/<ownerUid>/<token>/i<n>.jpg` (new `storage.rules` block: read by any
  signed-in user, write/delete only by the owner) and the snapshot points there.
  Import skips an unreadable picture instead of aborting. Deleting a project
  queues `shares/<uid>/<token>/` for cleanup; paths ending in `/` are treated as
  folders by `_cleanupDeletedAssets`.
- `shareProjectById(id)` shares a project WITHOUT opening it, from its stored
  document. The row glyph calls it; the drawer-wide Share button is gone.
- Save button removed (autosave is the only saver), Fabrics full width, notes
  collapsed into one `Design notes` block with empty parts omitted.
- Copy pass: ~45 user-facing strings shortened. "Project deleted everywhere"
  was frightening and is now "Project deleted".
- Wall rows alternate: `SPEEDS = [-26, 21, -31]`.
- Map: strip padding + scale-on-hover (no clipping), per-check dot painting,
  4s image probes, 7s fetch timeout, 5s poll while something is arriving.
- Credit meter can be REAL: `OPENAI_ADMIN_KEY` → OpenAI Costs API
  (`/v1/organization/costs`, 15 min cache) and `OPENAI_CREDIT_USD` → count down
  from the money actually loaded. Falls back to the estimate, and the page
  always says which one it is showing.

## v13.28 (Claude): the credit meter

- `/api/admin/spend` (admin only) answers the month's ESTIMATED OpenAI spend
  against `MONTHLY_BUDGET_USD` (default 50). The Systems Map draws it as a ring
  under the LIVE NOW tile, amber under 40 percent, rose under 15.
- Why estimated: OpenAI exposes a real balance only to an organisation admin
  key, which must never live on a web server. So `noteSpend()` prices every
  successful proxy call (`OPENAI_PRICE_IMAGE` 0.19 default, x0.5 medium, x0.25
  low, `OPENAI_PRICE_CHAT` 0.01, `OPENAI_PRICE_AUDIO` 0.006). The page says
  "estimated" out loud; never present it as billing truth.
- Each Cloud Run instance owns ONE object,
  `metrics/spend/<YYYY-MM>/<instanceId>.json`, flushed at most once a minute, so
  instances cannot overwrite each other. The endpoint sums the others (20s
  cache) and adds this instance's live tally, so the gauge reacts immediately.
  `bootMeter()` reads the instance's own object back after a restart.
- If a real balance is ever wanted, that is an admin key on Cloud Run and the
  OpenAI Costs API. Fromsa has not asked for that and it is a security call.

## v13.27 (Claude): submissions live in MAYA, not in Drive

- `submissions/<client>-MM-DD-YYYY-<6 hex>/` in `SUBMISSIONS_BUCKET` (default
  `pro-maya.firebasestorage.app`). `submission.json` marks the submission and
  carries the client's name; each file is an object beside it.
- Token comes from the Cloud Run metadata server (`serviceToken(scope)`), same
  pattern the analytics feed already used. No new dependency, no OAuth.
- The feed is ONE list request grouped in memory. `pathToId`/`idToPath` make the
  object path the file id and refuse anything that is not a file directly inside
  a submission, so `subthumb`/`subfile` cannot read the rest of the bucket.
- The feed's `name` keeps the `<client>-MM-DD-YYYY` shape on purpose: the map
  strips the date for its label and the Brief parses it for the caption.
- Deep health checks the bucket and reports `submissions`; `drive` is mirrored
  for one version so a cached page still reads something. The map prefers
  `submissions`.
- Verified against a local stand-in for the metadata and storage APIs: open,
  upload, feed shape, thumb, file, savepieces, deep health, plus traversal,
  filename and cross-prefix read all refused.

## v13.26 (Claude): renders were broken for every saved project

- Reading a card's picture threw "Failed to fetch": the pictures live in
  Firebase Storage, the bucket sends no CORS headers, so script cannot read
  bytes the browser will happily draw. Visualize and Modify need those bytes as
  the gpt-image-2 anchor, so every render on a saved project died and the toast
  said "connection hiccup". This was NOT the server: chat answered in 1.1s and
  images in 38s through the live proxy during the diagnosis.
- Fix: `blobFromPicture()` is the single reader. Direct first, then back through
  the new same-origin `/api/imgproxy` (sign in required, MAYA storage hosts
  only, `redirect: 'error'`, image or video only, 25 MB cap). Four call sites
  converted: render anchors, video save, one pager, pieces upload.
- A bucket CORS rule is still worth setting once so the direct path works; the
  exact Cloud Shell command is in `fixes.txt`, August 17. The proxy means MAYA
  never depends on it.
- Systems Map now says SUBMISSIONS, not Drive, and its failure text describes
  what happened to the submissions rather than naming Google plumbing.

## v13.25 (Claude): the deploy check

- `/verify.html` added, `verify-live.mjs` kept for whoever has Node, and three
  assertions guard the page: it ships, it asks the real Drive question, and it
  never renders the borrowed token.

## v13.24, this handoff's work (Claude)

- Community wall now matches the inspiration cards exactly. The 6 percent
  white plate behind each picture is deleted: that plate, showing through
  wherever a render did not fill its frame, was the lit column Fromsa kept
  seeing between cards. The card is transparent glass with the favorite
  card's starlight border and halo, and each frame now takes its own
  picture's proportions on load (`--cc-ar`, set by `communityBoard.fit()`),
  so `object-fit: contain` has no empty space left to letterbox. Metadata
  still fades in on hover or keyboard focus only.
- Fixed the regression suite itself. Four assertions added on August 14 read
  `projectStore`, `_cardState`, `communityBoard` and `scanFabricsFromAssets`
  from Node, where they do not exist, so the file threw a ReferenceError and
  everything after it, including the whole Systems Map section, never ran.
  They read from inside the page now.
- Three new assertions: the wall card carries no background plate, the frame
  defaults to 3/2 before load, and a taller picture reshapes its own frame.

## Verification actually performed, August 16

- 13 inline script blocks in `index.html` parse; 13 in `status.html` parse.
- `node --check` on `docs/server/server.js`: clean.
- `tests/app-regression.mjs`: runs to the end, ALL PASS (the whole file, for
  the first time since August 14).
- `tests/smoke.mjs`: all 16 server checks pass.
- Live browser check of the deployed pages: version meta, community rows and
  card geometry read directly from maya.manasiyo.com.

## Next work, in order

1. Push v13.25 from GitHub Desktop, then open maya.manasiyo.com/verify.html
   and press "Watch for a new deploy". That page replaces guessing.
2. After v13.27 deploys, confirm SUBMISSIONS is green by making one real
   submission. If red, grant the Cloud Run service account Storage Object Admin
   (`fixes.txt`, August 17 midday). Optional: copy pre-Aug-17 submissions out of
   the old Drive folder into the new store.
3. Durable per-uid quotas to replace the per-instance memory rate limit, plus
   generation backpressure. This is the last thing standing between the
   controlled beta and a public launch.
4. `backend.html` still contains a hidden legacy Operations Room; patterns
   render into it, so it needs rewiring before removal. The two Operations
   Room files stay separate on purpose: `operations.html` is the Beta test
   bench, the embedded one is production.
5. Stale-save conflict resolution UI (Reload cloud / Save as copy). An honest
   toast ships today; the dialog does not exist.

## Standing risks, unchanged

- Rate limiting lives in process memory: every Cloud Run instance and restart
  starts a fresh counter. Not a cost boundary for 1,000 public users.
- Drive is one OAuth account and one folder, and it has now failed twice.
- Each project and the project index is a single Firestore document, 1 MiB
  ceiling. Concurrent edits are rejected safely but with no resolution UI.
- Community loads up to 120 documents per fresh session. App Check and a
  budget are required before broad anonymous acquisition.
- Community provenance is app level only: rules accept `gpt-image-2` but a
  hostile client can still claim it. Real trust needs server-side publishing.
- Legacy session and IndexedDB migration code is deliberately still there.
  Measure migration completion before deleting the 700 to 1,200 legacy lines.
