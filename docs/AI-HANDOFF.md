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
