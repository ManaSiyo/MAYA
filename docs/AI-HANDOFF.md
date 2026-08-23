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
3. `tests/app-regression.mjs` is the contract, 199 checks. It runs only where
   there is Chromium and a free socket: `node tests/app-regression.mjs` from
   the repo root. `tests/smoke.mjs` covers the server. `/verify.html` is the
   only check Fromsa can run himself, because his Mac has no Node.
4. `docs/server/server.js` is the whole API. Look for: the submission store in
   MAYA's own bucket, the credit meter (`/api/admin/spend`, `/api/admin/credit`),
   marketing (`/api/admin/marketing`), Pinterest OAuth, `/api/fetchpic` with
   its SSRF guard, and the per-user rate limiter.
5. Known open risks, unchanged: no client side error reporting; the rate
   limiter is per Cloud Run instance and resets on restart; community
   provenance is app level only; submissions filed before Aug 17 are still in
   the old Drive folder.

## The playground rule, August 21

`playground/index.html` (served at /playground.html, linked from the MAYA door
on Admin on hover) is Fromsa's private staging copy. Experimental features go
there FIRST; `frontend/index.html` changes only when he approves a promotion.
It shares the live sign in and data, so destructive experiments still need
care. Keep the small amber Playground badge so the two are never confused.

Admin access: ADMIN_EMAILS defaults to fromsa@manasiyo.com and
worldofsiyo@gmail.com only, overridable by env. /api/admin/users lists named
accounts (email + last seen) for the Users hover; markers at metrics/users/
carry email since v13.43, older ones are anonymous.

Marketing: WINDSOR_API_KEY on Cloud Run makes /api/admin/marketing fill both
ad panels (impressions, clicks, spend, last 7 days) through Windsor. Direct
META_ADS_TOKEN / GOOGLE_ADS_* still win when set.

The fabric sourcing revamp shipped in v13.44; see that section below.

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
- Live line: `maya-v2`. v13.48 is pushed and live. **v13.49 is committed and
  waiting for Fromsa's push** (the dissection returns fabric_hex read from
  the image; the sourcing study is in docs/fabric-sourcing-study.md).
- **The folder changed in v13.37.** Pages are no longer loose at the root:
  `frontend/index.html`, and `backend/` holds status, marketing, operations,
  backend and privacy plus verify. Every old URL still answers, because
  `docs/firebase.json` rewrites each one onto its new file and the catch-all
  now points at `/frontend/index.html`. If a page 404s after a deploy, the
  rewrite list is the first place to look. `aesthetics/` stays at the root on
  purpose: `docs/**` is ignored by Hosting, so pictures inside it would never
  deploy.
- Tests: 199 checks in `tests/app-regression.mjs`, all passing, including a
  check that every old address still maps to a file that exists.
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
