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

NEXT (Fromsa): push; then open MAYA's door (fixes.txt steps: set
MAYA_MCP_TOKEN on Cloud Run, add the connector in Claude). Then verify live:
pinch on the playground (floor 40, nothing cropped, scroll and drawer work),
the admin drawer over the marquee, the switch.

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
