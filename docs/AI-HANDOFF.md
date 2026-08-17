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

- Live and verified: **v13.24 confirmed serving** on maya.manasiyo.com and on
  the Systems Map. **v13.25 is committed and waiting for Fromsa's push.**
- Git: `~/Desktop/MAYA-new`, `origin/maya-v2` and GitHub were identical at
  `ba825c5` with a clean tree before this handoff. GitHub is working. The
  Codex sandbox cannot resolve github.com; that is a sandbox limit, not a
  repository problem, so the push always happens from GitHub Desktop.
- Cloud Build deploys on every push to `maya-v2` and refuses every other
  branch. Server, hosting and rules are separate steps. It sets NO
  environment variables, so a deploy can never overwrite a credential.
- **DRIVE IS RED.** Google has revoked the server's Drive refresh token for
  the second time (renewed Aug 13, dead again by Aug 16). Submissions do not
  land. This is not a code fault and no agent can repair it. The numbered
  steps with links are in `fixes.txt`, entry of August 16.

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
2. Renew the Drive credential (`fixes.txt`, August 16) and log the result.
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
