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
   its SSRF guard, the per-user rate limiter, and since v14.02 `POST /mcp`
   (MAYA's door, `maya-mcp.mjs`) plus `maya-character.md` (who she is).
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

## v14.19 (Claude): the drawer untangled

The avatar pane had two identities braided together. currentClientName is
the PROJECT label (the Save flow names it; autoName otherwise) and
lastSummary.client.name is the CLIENT (face, measurements, the person who
wears the board). Three fallbacks leaked the project label into the client
(saveAvatar, randomizeAvatar, onFacePhotoSelected) and updateClientNameInline
wrote both; all four are client only now, and refreshDrawerClientName no
longer falls back to the project label. pgUpdatePill writes the open
project's name into #pg-project-beside (class .on) and syncs .active on
the list rows from projectStore.currentId; it runs after every
refreshDrawerClientName and _renderSessionsDropdown, plus a 1.2s watch on
(currentId, currentClientName, autoName) that repaints only on change. The
store's methods are NOT wrapped: the regression suite reads them by
source (projectStore.save.toString()). The photo
button calls toggleAvatarSwitcher. switchAvatar and newAvatar go through
_wearClient(a): identity fields only, the board and the notes stay, then
queueSave. deleteAvatar(id) removes a roster entry (confirm gated, rewrites
settings/avatars). pgRenameClient() is an in place input over the name
span (Enter or blur keeps, Escape drops) that names the client and files it
in the library. The Projects tile uses projectStore.list() (listSessions
never existed on the store). Voice: list_clients and switch_client.
Battery: 124 checks.

## v14.18 (Claude): the universal glide and the wider search

The glide is _pgGlideStart(els, dir, axis) now: element or array, axis 'x'
or 'y', 1.5px/frame rAF over scrollLeft/scrollTop, every element moving
together. Favorites glides 'x', community glides all .community-row rows
'x' at once, pins glide 'y'; stop stays a first class direction everywhere.
search_pins has two rooms: the loaded wall first (returning a spoken OFFER
of the wider search), then wider:true, or a local miss, calls GET
/api/pinterest/search, a new server proxy over Pinterest v5 /search/pins
(everything the ACCOUNT has saved, page_size 48, biggest image picked,
requireAuthHeader + Google user + pinConfigured). The wall re-renders those
pins (window._pinWiderActive) and clear_pin_search restores the cached wall.
Pinterest exposes no public search beyond an account's own saves; the tool
says so and points at describe_garment for fresh imagery. Battery: 115
checks.

## v14.17 (Claude): Pinterest search, the glide, position words

The search: #pin-search-btn + #pin-search-input in #pin-tabs; _pinSearch(q)
filters .pin-pic by dataset.alt and .pin-tile by name, plural tolerant,
returns the visible count. Voice: search_pins(query) opens the drawer,
filters, scrolls to top and starts the glide; clear_pin_search restores;
bring_in_pins collects only visible pins. The glide: _pgGlideStart(el, dir)
is a 1.5px/frame rAF loop stopping on _pgGlideStop (the stop direction on
scroll and scroll_pins), wheel/pointerdown, the end of the wall, or hang_up.
Position words: _pgPosWord(it, pool) buckets style.left/top into terciles
(top/middle/bottom x left/center/right); _pgBoardSnapshot carries pos, the
server sanitizer passes it (24 chars) and boardLines print it; the matcher
resolves 2D regions with version-family collapse and candidate ambiguity.
Search filtered only the LOADED wall in this version; v14.18 added the true
API search of everything the account saved. Battery: 109 checks.

## v14.16 (Claude): the studio gauge and the fast Admin

_mayaUsage gained admin (from /api/usage admin:true); _renderDrawerStats has
an admin branch (full ring, Studio, no cap) on BOTH index and playground.
Admin: loadMkt's paint block extracted to _paintMkt(d, alsoBrief); success
saves maya_mkt_cache (localStorage, ts + payload); _mktWarmPaint paints the
cache instantly at boot when a cached admin token exists (48h ceiling), with
fetchBrief gated to fresh fetches only. Assertions in the v14.16 block.

## v14.15 (Claude): the feedback round

Four fixes straight from maya/features.json: brevity after actions and
live write_feedback typing (both in the voice instructions, UNDERSTANDING
THEM block), singular/plural tolerant pin matching in bring_in_pins, and a
self-explaining dissect refusal. Assertion in the v14.15 regression block.

## v14.14 (Claude): the release audit, blockers closed

Codex's 20-finding review, triaged and fixed before any push. The load
bearing changes: _pgFindCardDetailed no longer falls back to the open card
on a zero-score named query (the deictic path is untouched); every mutating
card tool uses the detailed matcher and surfaces candidates; delete_card is
a two-call confirm handshake staged by card id with a 60s window
(window._pgPendingDelete). _pgRunCall races every tool against
window._PG_TOOL_TIMEOUT_MS (default 25s), catches throws, classifies
failures (_pgClassifyFail: expected/ambiguity/confirmation/timeout/defect;
only defect and timeout auto-file), posts consented telemetry
(_pgTelemetry, gated by localStorage maya_improve_consent, toggle in the
Improve Maya modal), and ALWAYS sends function_call_output. pgMayaStart
resets _pgToolChain and mints _pgTraceId. _pgWatchRender polls
_renderLabels and _pgLastRenderError and injects the true outcome into the
conversation; modify/visualize answer STARTED. Server: withLock promise
mutex around features/memory/soul/people/telemetry; POST /api/telemetry
(sanitized schema, capped 5000); GET /api/admin/maya-digest (admin
Markdown); mcpAuthScope splits header (full) from query token (readonly,
MCP_HEADER_ONLY_TOOLS = feature_done, journal, memory, leads). cloudbuild
runs the browser battery when chromium installs, skips loudly otherwise.
Battery: 97 checks incl. the routing layer driven through _pgOnMessage.
Deferred items and reasons live in requests.txt.

NEXT (Fromsa): push (v14.10 through v14.14 ride it). The Claude connector
keeps working read-only via ?token=; for full access it needs the token as
an Authorization header (see fixes.txt).

## v14.13 (Claude): she understands the card in front of her

The comprehension pass, from a live session. Root causes, not symptoms:
`visualize` always ran `visualizeGarment()` (home screen: avatar check then
`openFabricMode()`), so talking to an open picture could never render and
always popped a fabric chooser. Fixed with `modify_garment(text)` which
pushes into `visualizeModifications` and calls `modifySubmit()` (the direct
apply path, no picker), and `visualize` is now context aware. `viewer`
next/prev called `_favStep` (favorites strip) instead of `viewerStep`
(versions): new `card_version` tool plus `_pgStep()` which checks
`#viewer-version-nav` visibility. `_pgFindCardDetailed` replaces the flat
matcher: deixis (open card), position (left/right/middle by style.left),
recency, double weight on the five design notes and color, version families
collapsed to newest, and `ambiguous` + candidates on a genuine tie so she
asks. `showError` records `window._pgLastRenderError` and auto-logs; new
`render_status` tool. Instructions gained THE CARD EDITOR and UNDERSTANDING
THEM sections. 44 tools. Battery: 82 checks.

Also: docs/CODEX-MAYA-BRIEF.md is the second-engineer handoff (frustrations,
fixes, repo map, prior art on tool design and voice repair, paste prompt).
Open question it raises: 44 flat tools is past reliable selection; consider
per-mode tool sets pushed with session.update when the viewer opens.

NEXT (Fromsa): push. Then open a picture and just talk to it: "make it a
trench coat", "go back to the previous version", "the red one".

## v14.12 (Claude): the second pass

Audit findings on my own v14.10/v14.11 work, all fixed: #pinterest-drawer-body
is STATIC markup, always in the DOM, so every "is Pinterest open" check must
use offsetParent, never bare existence (scroll_pins, scroll's pins branch,
and scroll's bare-area inference all fixed; two scripted battery scenarios
now pin this). /api/usage returns admin:true and leftUsd; check_credits now
honors both. addManualRef dedupes silently, so add_reference counts items
before and after and reports "already on the canvas". viewer returns a
spoken reason on a miss. New tools: move_card (style.left/top are canvas
units so zoom never skews the step; _persistSession saves), resize_card
(140 to 640 px clamp, mirrors the resize handle's img sizing), list_favorites
and open_favorite (items filter favorited+image; openFavoriteForSubmit),
set_quality (writes STORAGE_KEY_IMG_QUALITY directly, never saveSettings,
which would clobber the model input; only medium and high exist in the app),
clear_hints. Battery: 73 checks. She is at 41 tools.

NEXT (Fromsa): push. Then on a call: "move the red dress to the center and
make it bigger", "open my favorite with the gold collar", "high quality
this time".

## v14.11 (Claude): thirteen new hands

The method: inventory every interactive element in the live playground DOM
(buttons, onclicks, pills) via the browser, then close the gap between what
a finger can do and what Maya can. New _pgTool cases: zoom (window.pgZoomTo
added inside the zoom closure, clamped to zfloor), organize_board
(brandTitleClick), dissect_card (.dissect-btn on the matched card),
add_reference (addManualRef at a center-ish xy; the v14.07 wrapper divides
by zoom), card_details (card.profile + refs), list_projects / open_project
(parse .session-item[data-id] title attrs, call loadSavedSessionById) /
new_project (newConsultation), check_credits (GET /api/usage: spentUsd,
capUsd, images), background (pgApplyBackground star / pgGenerateBackground),
randomize_avatar, set_measurement (spoken name to ameas-* id map, then
saveAvatar), pick_fabric (mode-choose then .fabric-pick match then
fabric-pick-confirm). Viewer map: heart, photo, attributes. Server declares
all thirteen, the viewer enum grew, and the instructions carry one line per
power. Battery: 59 checks in tests/maya-hands-smoke.mjs.

NEXT (Fromsa): push, then on a call try "step back and look at the whole
board", "what do my favorites say about me", "my waist is 29", and inside a
photo "switch the fabric to the midnight velvet".

## v14.10 (Claude): her legs and ears

tests/maya-hands-smoke.mjs is the new battery: serves the repo with a fake
/api, boots playground headless (fake media flags), seeds two cards, fires
~30 calls through `_pgTool` with good and bad args, asserts shape not just
success, checks the v14.09 auto-log fires on failure, and that the wake
plumbing never throws. Run it after touching anything in the voice agent.
Found: no screen navigation and no general scroll (the "cannot go down"
bug). Fixed: `go_to_screen` (setScreen 0/1/2) and `scroll` (favorites
scroller sideways, community rows sideways, pins down; no area = the screen
under her, or step a screen). `_pgFindCard` hay now includes profile
bio/aesthetic/silhouette/color/era. Server: both voice-token routes send
audio.input.noise_reduction far_field (+ gpt-4o-mini-transcribe on the app
line) and RETRY WITH THE PLAIN SHAPE if OpenAI rejects it, so voice cannot
die from the upgrade. Instructions carry the honest-ears line. Metas and
changelog stamp 14.10.

NEXT (Fromsa): push, then call her in a noisy room and say "go to my
favorites" and "keep going".

## v14.09 (Claude): the autonomous observer

Maya logs her own limits. `_pgAutoLog(text, who, source)` in the playground
buffers, renders and POSTs to /api/feature; `_PG_CANT` catches her "I can't"
lines on the transcript, `_PG_WISH` catches user wishes, and the failed-tool
hook sits IN `_pgRunCall` itself (fires on `out.ok === false`, `hang_up`
excluded). Dedupe by normalized 160 chars in `_pgLogSeen`. The Improve Maya
modal has two tabs (`#fb-tabs`: Your note / Maya's logs); `openFeedback`
re-renders and resets to the note tab. Server: /api/feature reads
`source:'maya'` (who defaults to Maya); voice instructions carry the "YOUR
OWN LIMITS ARE LOGGED FOR YOU" paragraph. Admin front room filters
`source==='app'||source==='maya'`. Metas and changelog stamp 14.09.

NEXT (Fromsa): push (five commits ride it: v14.05 through v14.09). Then set
MAYA_MCP_TOKEN on Cloud Run and add the connector (steps in docs/fixes.txt).

## v14.08 (Claude): triple-audit round 3, the sign-off

Third independent pass, clean browser: both pages boot with zero JS errors;
the five-truths notes render centered; every voice wrapper verified as a
function (`startVisualizeListen`/`stopVisualizeListen` wrapped, 402 resume);
`get_feature_digest` answered; Feature requests dedupe live; the hamburger
computes 32x28 with the fixed stylesheet. Version metas and the changelog
stamp at 14.08. Fromsa's loop for big rounds is now the house method: build,
fresh scan and fix, scan again, three commits.

NEXT (Fromsa): push (three commits ride this push: v14.06, v14.07, v14.08).
Then live: open a card and watch the five truths fill in as the sweep runs;
say Hey Maya out of credits and confirm the wake word survives; ask her to
read the feature inbox on Admin.

## v14.07 (Claude): triple-audit round 2, the fresh-eyes fixes

An independent audit agent re-read the Aug 27-28 ledger against the code and
found 13 real defects (33 of 41 claims verified clean). All fixed:
`get_feature_digest` answered on Admin; wake word survives the 402 branch and
the viewer's Tap to Listen (`startVisualizeListen`/`stopVisualizeListen`
wrapped); look-then-greet on connect; Feature requests dedupe (inbox text set);
pinch-resize seeds `offsetWidth`; fly animations and `addManualRef` divide by
the zoom; fullscreen photo hides `.submit-wrap`; `@media (hover:none)` shows
the pills on phones; mobile toast 96px; `_capTries` three-strikes; dead
`wrap.classList.remove('open')` gone. 396 assertions green. Round 3 follows.

## v14.06 (Claude): the five truths (triple-audit round 1)

`playground/index.html`, `backend/status.html`, metas, `tests/*`: the caption
sweep became the PROFILE sweep (`card.profile` = bio, aesthetic, silhouette,
color, era via one json_object vision call; `card.caption` = bio; cards with
only the old caption get upgraded; live viewer repaints on arrival);
`renderViewerNotes` leads with the five centered subheadlines for every card;
`#viewer-notes` text centered; viewer block 30px lower; toast bottom 72px;
favorites arrows in the canon pill recipe at 42px insets; the submit-wrap rise
keeps the 16px bottom radius. Probed headless: titles Bio/Aesthetic/
Silhouette/Color/Era, centered, Design ideas intact, 0 JS errors; 395
assertions green. Rounds 2 and 3 of Fromsa's triple audit follow separately.

## v14.05 (Claude): the door actually opens

Live smoke test of production (v14.03 at the time) found that
`POST https://maya.manasiyo.com/mcp` never reached the server: the hosting
catch-all rewrite served `frontend/index.html` with a 200. The route existed
only on Cloud Run. Fix: `docs/firebase.json` rewrites `/mcp` to the run
service, and `server.js` mounts the door at BOTH `/mcp` and `/api/mcp`
(`/api/**` was always routed, so `/api/mcp` works on any deploy).
`fixes.txt` now tells Fromsa to use `/api/mcp?token=...` for the Claude
connector. One new regression assertion covers all three.

Everything else verified live on v14.03: floor row Logout/Feedback/Hey Maya,
the switch, ticker strip under the drawer at z 0, Feature requests fold
painting 5 rows, prompting engine hidden, sources table hidden, all five
health lights green, /api/voice-token and /api/feature deployed (401 clean
when unauthenticated). The v14.04 items (eyes, glass, THE hamburger fix)
are committed but were not yet pushed at test time; re-verify after push.

## v14.04 (Claude): Maya opens her eyes, one feedback stream, the Bible of glass

`playground/index.html`, `backend/status.html`, `docs/server/server.js`,
`aesthetics/ui/status-v13.19.css`, `backend/marketing.html`, `frontend/index.html`
(meta), `tests/*`:

- **MAYA SEES**: tool `look` captures the live page with html2canvas (cdnjs,
  loaded once on demand, useCORS, ~1100px wide jpeg) and sends it into the
  Realtime session as an `input_image`; she also looks on arrival. Fallback on
  capture failure: the structured board snapshot. Instructions tell her to look
  whenever something visual is referenced and never to guess the screen.
- **More hands**: `open_card`, `delete_card`, `favorite_card` (match by words
  via `_pgFindCard` over captions/titles/refs), `viewer(action)` (close, next,
  prev, post_wall, get_it_made, listen, switch_fabric, add_reference),
  `pin_view(all|boards)`, `open_board(name)`, `scroll_pins(direction)`.
- **Her voice on screen**: `#pg-maya-lines` is the tap-to-listen echo's exact
  voice (Cormorant italic 11px, whisper faint), absolute in `#screen-inspo`
  just above the Visualize pill, three rows, older lines fade and leave, the
  whole thing fades ~6s after the last word. The logo breathes
  (`pgMayaBreathe`, 3.2s) while she is live. One warm opinion allowed, rarely.
- **Every picture speaks**: `_pgCaptionOne` sweep (7s interval, one at a time,
  gpt-4o-mini via the proxy) writes `card.caption` (max 10 words) for any
  pictured card without one; `_buildPieceSummaryLine` returns the caption when
  present, so favorites hover and the viewer's piece line show it. Persisted.
- **Improve Maya**: the feedback popup is one box and one Submit (chips,
  Tap to Listen and Talk to Maya removed); every note goes to /api/feedback
  AND /api/feature (one stream). Toast: "Thank you. Maya keeps it."
- **The drawer is the Bible**: `.modal` overlay is translucent
  (rgba(8,12,24,0.38) + blur 28) and `.modal-card`, `.mmp-card`, `.mcp-card`
  all wear the drawer gradient glass, radius 18. Wall/favorites glow eased 5%.
  The two destination pills live INSIDE `#garment-image-wrap`, hover-revealed
  over a black rise.
- **THE HAMBURGER, actually fixed**: `aesthetics/ui/status-v13.19.css` carried
  `.systems-map .top-btn.hamburger{width:36px;height:36px}` and a min-height,
  loading after the inline styles and overriding every prior fix. Removed;
  verified live-computed 32x28 on both pages is now inevitable.
- **Admin Feature requests**: two rooms (Front end, what users ask; Admin
  side, what we ask), the feedback store merged into the front room, a hover
  check (`markFeatureDone` → `POST /api/admin/maya-feature-done`) marks a wish
  shipped or unshipped.
- Verified: 392 browser assertions + suites; headless probe: transcript rows,
  parent, position above the pill, Improve Maya, submit-wrap in the photo,
  logo animation, 0 JS errors.

NEXT (Fromsa): push, then talk to her with eyes: "let's work on the white and
red outfit, the girl with the apple". Watch the first `look`: html2canvas may
miss a cross-origin picture here and there; if her sight reads wrong, say
which card and we tighten the capture. Visualization speed is a decision, not
a bug: a low-quality fast preview upgraded on heart would cut the wait
roughly in half at a quarter of the render price; say the word.

## v14.03 (Claude): Maya on the user side, drag while zoomed, Admin round

`playground/index.html`, `backend/status.html`, `docs/server/server.js`,
`backend/marketing.html`, `frontend/index.html` (meta only), `tests/*`:

- **Playground, everything works zoomed**: pointer deltas in `makeDraggable`
  and the resize handle are divided by `pgZoomLevel()`; the
  `pointer-events:none` rule is gone. Cards drag, resize, open and favorite
  at any zoom.
- **Backgrounds fold**: two pills, "Upload" and "Generate", side by side in
  `#pg-bg-pills`, lower, near the floor divider.
- **Floor row**: Logout (left), Feedback (middle), Hey Maya switch (right).
  Tip is gone from the playground only (the app keeps it).
- **Hey Maya on the user side**: `POST /api/voice-token` (any signed in user,
  rate limited, 402 when the trial is spent, priced `PRICE_REALTIME` 0.10 per
  call opened) builds a Realtime session from `maya-character.md` plus the
  client's own board (sent in the body) with tools executed in the browser:
  `open_drawer`, `close_drawer`, `bring_in_pins` (matches words against the
  loaded pins' alt text, picks, `_pinImport()`), `describe_garment`
  (`processConsultation`), `visualize`, `write_feedback`, `log_feature`
  (`POST /api/feature`, new, any user, lands in the inbox as source `app`),
  `list_board`, `hang_up`. The wake word (`_pgWake*`, localStorage
  `maya_pg_wake`) pauses while the moodboard's Tap to Listen or the feedback
  listener owns the speech engine (they are wrapped). Her lines show above
  the voice bar (`#pg-maya-lines`), a chip at the bottom right hangs up.
- **Feedback popup**: the drawer's exact glass, an X pill on the title, a
  Feedback / Feature request chip pair, "Talk to Maya" (she takes structured
  notes into the box via `write_feedback`), Submit posts to `/api/feedback`
  and, for a feature request, to `/api/feature`.
- **Admin**: `.top-btn` carries the app's exact shadow, hover and 44px hit
  target (the hamburger is the same object now); `toggleWakeWord` is async
  and primes the microphone on the click, transient recognizer errors no
  longer snap the switch off; `#voice-dock` padding-top 9, margin-bottom -16;
  **Feature requests** fold (`#features-fold`, `loadFeatureRequests()` from
  `/api/admin/maya-features`, who / concise ask / day, done ones struck)
  replaced the Prompting Engine fold, which is `hidden` but still loads and
  saves; the Sources of traffic table is hidden inside the Bottom Line.
- **Changelog rule**: `#changes-fold` carries `data-version`; the regression
  suite fails when it drifts from the meta version. Two entries added.
- Verified: 386 browser assertions, 11 MCP, smoke; headless screenshots of
  the playground floor row, the feedback popup and the Admin drawer.

NEXT (Fromsa): push, then on the playground flip Hey Maya on, allow the mic,
say "Hey Maya" and ask her to open the drawer, bring in a pin by name, and
visualize. Report what she got wrong; that is the next round. Open MAYA's
door (fixes.txt) if not yet done.

## v14.02 (Claude): zoom v5, the frozen meter, the drawer floor, MAYA's door

`playground/index.html`, `frontend/index.html`, `backend/status.html`,
`backend/marketing.html`, `docs/server/server.js`, `docs/server/maya-mcp.mjs`
(new), `docs/server/maya-character.md` (new), `docs/server/Dockerfile`,
`cloudbuild.yaml`, `tests/*`:

- **Playground zoom v5** (replaces v4): the transform is on `#maya-canvas` (the
  cards' own container), not on the whole screen. v4 measured the children of
  `#screen-inspo` (so the bbox was always the full canvas, never the cards) and
  the canvas' `overflow:hidden` cropped every card placed past the fold: that
  was the crop Fromsa saw. Now `measure()` reads the canvas' children, the
  cluster's own bbox glides to the center as the scale falls, and the floor is
  `MINZ = 0.40` unless the cluster would still crop at 0.40 (then the fit
  scale, never below 0.12). No CSS transition: a rAF lerp (`z += d * 0.32`)
  drives every frame, so wheel bursts never restart an easing curve. Card
  glass (`backdrop-filter`) rests while zoomed (the single most expensive
  thing to scale). The screens are NOT pinned any more: plain wheel is never
  touched (canon: native scroll only), so scrolling to favorites and pulling
  the drawer work while zoomed. `parkVoiceBar` is gone (the voice bar is a
  sibling of the canvas, it never moved). Verified headless: 13 cards spread
  to y=1650 on a 900px viewport, 0 cropped at the floor, back to 1 clean.
- **The money counter never restarts**: `TRIAL_EPOCH` is frozen at `v14.00`
  with a loud comment. Do NOT bump it in a release; an out-of-band reset is
  the Cloud Run env var, never code.
- **Gauge ring** bluer (`rgba(128,176,255,0.95)`) and 5 percent thinner (5.2),
  both files.
- **Admin**: the marquee moved out of `#top-bar` into its own fixed
  `#ticker-bar` at z 0, beneath the panes (z 1), so the drawer slides over it;
  `placeTicker()` fits it between the wordmark and the hamburger. The Hey Maya
  pill is an Apple-style switch (`.mt-switch` / `.mt-knob`, word fixed as
  "Hey Maya", `role="switch"`); `#voice-dock` padding-top 38 to 12 so the
  divider sits low; every drawer line `text-align:center`.
- **MAYA's door**: `POST /mcp` is a Model Context Protocol server (Streamable
  HTTP, JSON replies, protocol 2025-06-18) exposing `maya_status`, `maya_inbox`,
  `maya_feature_done`, `maya_memory`, `maya_people`, `maya_soul`,
  `maya_journal`, `maya_leads`. Pure module `docs/server/maya-mcp.mjs`, tested
  by `tests/maya-mcp.mjs` (11 cases) and two smoke checks. Guarded by
  `MAYA_MCP_TOKEN` (Bearer header or `?token=`); with no token the door is
  closed (503). Fromsa's steps to open it are in `fixes.txt`.
- **MAYA's character**: `docs/server/maya-character.md` ships in the container
  and is read into the voice instructions first (`MAYA_CHARACTER`). It is the
  builder-with-taste personality Fromsa asked for; edit it to change how she
  thinks. The GCS `maya/soul.md` stays her journal.
- **Docs**: this file trimmed to a state file (older sections archived);
  `docs/MAYA-INDEPENDENCE.md` is the roadmap for Maya as an entity;
  `docs/AUDIT-2026-08-27.md` is the codebase audit.

(Superseded by v14.03 above.)

## v14.01 (Claude): the lag found and killed + zoom v4 + wall enforcement

- **THE ADMIN LAG ROOT CAUSE**: base `.top-btn` has `transition:all .2s`; the
  admin hamburger inherited it, so its transform animated 200ms behind the
  drawer. Fix: `.top-btn.hamburger{transition:opacity .25s}` + the scroll
  listener calls `update` synchronously (no rAF). This was the years-long
  "drawer not the same" complaint.
- **Admin `#drawer`** = frontend `#notes-drawer` glass verbatim (top:10 right:18
  bottom:10 left:0, gradient, 18px radius, blur 28, inset shadows, padding
  56/12/16). v13.98 full-bleed reverted.
- **Playground zoom v4** (`playground/index.html` addon): `measure()` computes
  the card bounding box (children of #screen-inspo minus #voice-wrap, offset*
  geometry); transform = translate(center-delta) + scale about the bbox center,
  so nothing crops; `parkVoiceBar()` reparents #voice-wrap to body (fixed,
  bottom 22) while zoomed and restores it after; screens pinned: overflowY
  hidden + `scrollSnapType:none` + scroll listener forcing scrollTop 0; ALL
  plain wheel consumed while zoomed. Live-verified.
- **Stats v14.01**: gauge = dollars left (cap 'left of $2'), ring stroke 5.5;
  `pg-stat-images` tile = "Visualizations left" (cardsLeft). Both files.
- **Wall enforcement**: `communityBoard.reconcile()` (both files) sweeps this
  uid's posts where pid == current project against currently-favorited postIds;
  orphans deleted with storage copy. Called on wall entry.
- Invoice modal fully centered; background pills stacked lower; changelog
  relabeled to Fromsa-local dates.
- Repo cleanup r1: `MAYA-audit-2026-08-24.html`, `tests/_drawer.png` moved to
  `_to_delete/`. Deep dead-code pass queued (Codex-friendly; docs current).

## v14.00 (Claude): the honest meter, playground round 3, invoice sending

`docs/server/server.js`, `frontend/index.html`, `playground/index.html`,
`backend/status.html`:

- **Economics**: PRICE_IMAGE 0.13 (medium x0.5 = $0.065/card, the true cost; the
  old 0.05 was silently halved to 0.025). TRIAL_EPOCH `v14.00` resets all.
  `/api/usage` adds `perCardUsd`.
- **Stats in cards**: gauge "N card renders left" (cardsLeft = leftUsd/perCard);
  dollars tile -> Projects (from projectStore.listSessions); "Images rendered" ->
  "Cards rendered"; popup copy 30 free / ~75 for $5; no dollar faces the user.
- **Invoice composer**: `_invEmailLead` / `_invTextLead` send the pay link via
  Gmail compose / sms:, buttons labeled with the lead's first name; sheet chip
  centered on ADMIN (`left:50%;translateX(-50%)`, padding-top 2px).
- **Playground zoom v3**: MINZ 0.25; origin 50%/50%; `#screens` overflowY hidden
  while zoomed (favorites can never pull up); snap to 1 past z>0.92 on zoom-in +
  touchend (fixes stuck pointer-events / the + icon); wheel still ctrl/meta-only.
- **Playground**: badge `#pg-badge` moved into `#top-left-brand` (same row);
  halo alphas ~x0.72; backgrounds v2 (`maya_pg_bgs` list, every generated one
  saved, `pgUploadBackground` + hidden file input, cards named Birth of a Star /
  Generated background / My background, cap 6).
- Viewer actions column centered (`#viewer-actions{flex column center}`), both.
- Emails sent to Fromsa: typography audit (MAYA vs Apple), unit economics.
- Verified headless: zoom lock+snap+unlock, badge in brand row, gauge "card
  renders left", upload pill, 0 JS errors. All suites pass.

NEXT decisions Fromsa owes: the $50 consultation pay link (flow queued with his
popup copy); then the queued audit fixes (lead-email note migration, vision 403,
dissect mismatch, README/verify-live, deploy gate).

## v13.99 (Claude): playground feedback round

`playground/index.html`, `frontend/index.html`:

- **Zoom gesture fixed**: fires ONLY on trackpad pinch (browser reports it as
  ctrl+wheel) or Cmd/Ctrl+scroll; plain scroll always navigates screens
  (`if (!(e.ctrlKey || e.metaKey)) return;`). Touch pinch unchanged.
- **Screen order**: inspo (land) → favorites → community wall, via flex `order`
  on `#screens` + `window._pgScreenPos = {1:0, 2:1, 0:2}` mapping in
  `setScreen`/resize; `data-screen` semantics untouched so wall/favorites logic
  still keys correctly. Zoom's `onInspo()` now checks position 0.
- **Background cards**: fabric-card style (2-col grid, 16:10 image,
  `.pg-bg-cardname` under each: Birth of a Star / My background / Generated
  background); `addBgCard()` helper; generate still never auto-swaps.
- **Projects pill 16px** (was 19) in app + playground; still Cormorant italic,
  centered, caret absolute.
- Verified headless: visual order correct, lands on inspo, plain wheel does NOT
  zoom, ctrl+wheel does, reset works, card 160px wide, pill 16px, 0 JS errors.

## Older versions

v13.24 through v13.98 live in `docs/archive/AI-HANDOFF-through-v13.98.md`.
The narrative is in `docs/history.txt`, the asks in `docs/requests.txt`.
